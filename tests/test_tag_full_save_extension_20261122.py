import contextlib
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import imageio_ffmpeg
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'nas/tag-editor-cover'))
import tag_cover_http as http
import tag_rename_writer as rename


class FullTagSaveFixture(unittest.TestCase):
    def setUp(self):
        self.work=tempfile.TemporaryDirectory()
        self.root=Path(self.work.name)
        self.music=self.root/'music'
        self.album_dir=self.music/'TEST'/'Album'
        self.album_dir.mkdir(parents=True)
        self.db=self.root/'catalog.sqlite3'
        self.backup=self.root/'backups'
        self.id='11111111-1111-4111-8111-111111111111'
        for ext in ('mp3','flac'):
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-v','error','-f','lavfi','-i',
                            'sine=frequency=440:duration=0.15',
                            '-metadata','title=Before','-metadata','artist=Original',
                            '-metadata','album=Album',str(self.album_dir/('01.'+ext))],check=True)
        with sqlite3.connect(str(self.db)) as db:
            db.execute('CREATE TABLE albums (id TEXT,artist TEXT,title TEXT,path TEXT,year TEXT,format TEXT,missing INTEGER,hidden INTEGER,data TEXT)')
            db.execute('INSERT INTO albums VALUES(?,?,?,?,?,?,?,?,?)',
                       (self.id,'Original','Album','TEST/Album','2026','FLAC',0,0,
                        json.dumps({'physical_files':[{'path':'TEST/Album/01.mp3'},{'path':'TEST/Album/01.flac'}]})))
        self.oldflags={name:os.getenv(name) for name in
                       (http.cover.base.TRACK_WRITE_ENV,http.cover.base.FULL_TAG_WRITE_ENV)}
        os.environ[http.cover.base.TRACK_WRITE_ENV]='true'
        os.environ[http.cover.base.FULL_TAG_WRITE_ENV]='true'
        @contextlib.contextmanager
        def lease():
            yield
        http.configure_save_context(lease,str(self.backup),
                                    {'tags':True,'cover':True,'full_tags':True})
        self.db_sha=http.cover.base.file_sha256(self.db)

    def tearDown(self):
        http._SAVE_CONTEXT.update(guard=None,backup_root=None,qualified=False)
        for k,v in self.oldflags.items():
            if v is None:os.environ.pop(k,None)
            else:os.environ[k]=v
        self.work.cleanup()

    def apply_tag(self,file,values):
        old=http.cover.base.read_tags(self.music/file)
        body={'album_id':self.id,'file':file,
              'edits':values,'before_tags':{k:old[k] for k in values}}
        plan=http.tag_plan(self.db,self.music,body)
        self.assertEqual(plan['state'],'READ_ONLY_TRACK_WRITE_PLAN',plan)
        body.update(expected_plan_id=plan['plan_id'],confirm_write=True)
        result=http.save_request(self.db,self.music,http.PREFIX+'/tag-apply',body)
        self.assertEqual(result['state'],'TAG_TRACK_WRITE_COMPLETED',result)
        self.assertEqual(http.cover.base.file_sha256(self.db),self.db_sha)
        return result

    def test_mp3_full_tags_audio_and_restore(self):
        file='TEST/Album/01.mp3'
        before=http.cover.base.file_sha256(self.music/file)
        audio_before=http.cover._mp3_audio_hash(self.music/file)
        values={'title':['Updated'],'album':['New Album'],
                'album_artist':['New Artist'],'date':['2024'],
                'tracknumber':['01'],'discnumber':['1'],'featuring':['Guest']}
        result=self.apply_tag(file,values)
        tags=http.cover.base.read_tags(self.music/file)
        for name,expected in values.items():self.assertEqual(tags[name],expected)
        self.assertEqual(audio_before,http.cover._mp3_audio_hash(self.music/file))
        restored=http.cover.base.track_write_restore(self.music,self.backup,
                                    result['operation_id'],True,True)
        self.assertEqual(restored['state'],'TAG_TRACK_RESTORE_COMPLETED',restored)
        self.assertEqual(http.cover.base.file_sha256(self.music/file),before)

    def test_flac_album_common_fields(self):
        file='TEST/Album/01.flac'
        before=http.cover.base.file_sha256(self.music/file)
        audio_before=http.cover.base.flac_frames_sha256(self.music/file)
        values={'album':['New Album'],'album_artist':['New Artist'],'date':['2024']}
        result=self.apply_tag(file,values)
        for name,expected in values.items():
            self.assertEqual(http.cover.base.read_tags(self.music/file)[name],expected)
        self.assertEqual(audio_before,http.cover.base.flac_frames_sha256(self.music/file))
        self.assertEqual(http.cover.base.track_write_restore(self.music,self.backup,
                         result['operation_id'],True,True)['state'],'TAG_TRACK_RESTORE_COMPLETED')
        self.assertEqual(http.cover.base.file_sha256(self.music/file),before)

    def test_mp3_and_common_tags_hold_without_full_qualification(self):
        c=http.save_capabilities()
        self.assertTrue(c['mp3_tags'])
        self.assertIn('album_artist',c['tag_fields'])
        http._SAVE_CONTEXT['qualified']={'tags':True,'cover':True}
        c=http.save_capabilities()
        self.assertFalse(c['mp3_tags'])
        self.assertEqual(c['tag_formats'],['flac'])
        p=http.tag_plan(self.db,self.music,
                        {'album_id':self.id,'file':'TEST/Album/01.mp3',
                         'edits':{'title':['New']},'before_tags':{'title':['Before']}})
        self.assertEqual(p['state'],'HOLD')
        os.environ[http.cover.base.FULL_TAG_WRITE_ENV]='false'
        album,entries,issues=http.cover.base.inventory(self.db,self.music,self.id)
        p=http.cover.base.track_write_plan(album,entries,issues,
                  'TEST/Album/01.flac',{'album':'New Album'})
        self.assertEqual(p['state'],'HOLD')

    def test_rename_writer_requires_catalog_callback(self):
        os.environ[rename.RENAME_ENV]='true'
        try:
            plan=rename.plan(self.db,self.music,self.id,'TEST/Album/01.flac',
                             '1 - 01. Updated.flac')
            self.assertEqual(plan['state'],'READ_ONLY_RENAME_PLAN',plan)
            original=http.cover.base.file_sha256(self.album_dir/'01.flac')
            result=rename.apply(self.db,self.music,self.backup,self.id,
                                'TEST/Album/01.flac','1 - 01. Updated.flac',
                                plan['plan_id'],None,True)
            self.assertEqual(result['state'],'HOLD')
            self.assertTrue((self.album_dir/'01.flac').exists())
            self.assertFalse((self.album_dir/'1 - 01. Updated.flac').exists())
            self.assertEqual(original,http.cover.base.file_sha256(self.album_dir/'01.flac'))
        finally:
            os.environ.pop(rename.RENAME_ENV,None)

    def test_rename_requires_synchronous_catalog_update(self):
        os.environ[rename.RENAME_ENV]='true'
        try:
            old_file=self.album_dir/'01.flac'
            old_sha=http.cover.base.file_sha256(old_file)
            plan=rename.plan(self.db,self.music,self.id,'TEST/Album/01.flac',
                             '1 - 01. Updated.flac')
            self.assertEqual(plan['state'],'READ_ONLY_RENAME_PLAN',plan)
            def reindex(album_id,album_path):
                with sqlite3.connect(str(self.db)) as db:
                    row=db.execute('SELECT data FROM albums WHERE id=?',(album_id,)).fetchone()
                    data=json.loads(row[0])
                    data['physical_files']=[{'path':'TEST/Album/'+p.name}
                         for p in sorted(self.album_dir.glob('*')) if p.suffix in ('.mp3','.flac')]
                    db.execute('UPDATE albums SET data=? WHERE id=?',
                               (json.dumps(data),album_id))
            result=rename.apply(self.db,self.music,self.backup,self.id,
                                'TEST/Album/01.flac','1 - 01. Updated.flac',
                                plan['plan_id'],reindex,True)
            self.assertEqual(result['state'],'RENAME_WRITE_COMPLETED',result)
            self.assertFalse(old_file.exists())
            self.assertEqual(http.cover.base.file_sha256(
                self.album_dir/'1 - 01. Updated.flac'),old_sha)
            self.assertIn('1 - 01. updated.flac',
                rename._catalog_file_names(self.db,self.id))
        finally:
            os.environ.pop(rename.RENAME_ENV,None)

if __name__=='__main__':unittest.main()
