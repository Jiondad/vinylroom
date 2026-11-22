"""One scoped end-to-end HTTP handler -> writer -> fixture media -> restore check.

NEVER mounts/reads the running NAS. The fixture creates only temporary audio and
SQLite data in a TemporaryDirectory. Uses prior writer tests' setup, not their tests.
"""
import base64
import io
import json
import os
from pathlib import Path
import sqlite3
import sys
import unittest
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_tag_full_save_extension_20261122 import FullTagSaveFixture
from test_tag_admin_http_dispatch_20261122 import Handler,Index,ORIGIN,PREFIX
import tag_cover_http as http
import tag_rename_writer as rename

class IndexFixture(Index):
    def __init__(self,dbpath):self.dbpath=dbpath

class TestFullSaveHttpFixture(unittest.TestCase):
    def test_actual_http_tag_cover_rename_roundtrip_fixture_only(self):
        f=FullTagSaveFixture('test_mp3_full_tags_audio_and_restore')
        f.setUp()
        old_cover=os.environ.get(http.cover.COVER_ENV)
        old_rename=os.environ.get(rename.RENAME_ENV)
        os.environ[http.cover.COVER_ENV]='true'
        os.environ[rename.RENAME_ENV]='true'
        def call(route,body=None):
            handler=Handler(PREFIX+route,post=body is not None,body=body)
            status,result=http.handle(handler,IndexFixture(f.db),f.music,ORIGIN,body is not None)
            self.assertEqual(status,200,(route,result))
            return result
        try:
            # 1. Tag save through authenticated HTTP handler, same-file verification and restore.
            file='TEST/Album/01.mp3'
            original_sha=http.cover.base.file_sha256(f.music/file)
            old=http.cover.base.read_tags(f.music/file)
            tags={'album':['HTTP Fixture Album'],'album_artist':['HTTP Artist'],'date':['2026'],
                  'tracknumber':['01'],'discnumber':['1'],'title':['HTTP Fixture Title']}
            request={'album_id':f.id,'file':file,'edits':tags,
                     'before_tags':{key:old[key] for key in tags}}
            plan=call('/tag-plan',request)
            self.assertEqual(plan['state'],'READ_ONLY_TRACK_WRITE_PLAN',plan)
            result=call('/tag-apply',{**request,'expected_plan_id':plan['plan_id'],'confirm_write':True})
            self.assertEqual(result['state'],'TAG_TRACK_WRITE_COMPLETED',result)
            for field,value in tags.items():self.assertEqual(result['saved_tags'][field],value)
            restored=http.cover.base.track_write_restore(f.music,f.backup,result['operation_id'],True,True)
            self.assertEqual(restored['state'],'TAG_TRACK_RESTORE_COMPLETED',restored)
            self.assertEqual(http.cover.base.file_sha256(f.music/file),original_sha)

            # 2. Embedded cover add -> reread through same HTTP boundary -> restore.
            file='TEST/Album/01.flac'
            original_sha=http.cover.base.file_sha256(f.music/file)
            state=call('/inspect?album_id='+f.id+'&file=TEST%2FAlbum%2F01.flac')
            self.assertEqual(state['state'],'EMBEDDED_COVER_INSPECTED')
            im=io.BytesIO();Image.new('RGB',(16,16),'navy').save(im,'PNG')
            request={'album_id':f.id,'file':file,'action':'add',
                     'image_base64':base64.b64encode(im.getvalue()).decode(),
                     'expected_file_sha256':state['file_sha256'],
                     'expected_catalog_digest':state['catalog_digest']}
            plan=call('/plan',request)
            self.assertEqual(plan['state'],'READ_ONLY_COVER_PLAN',plan)
            result=call('/apply',{**request,'expected_plan_id':plan['plan_id'],'confirm_write':True})
            self.assertEqual(result['state'],'COVER_WRITE_COMPLETED',result)
            self.assertEqual(len(result['verification']['front_covers']),1)
            restored=http.cover.cover_restore(f.music,f.backup,result['operation_id'],True,True)
            self.assertEqual(restored['state'],'COVER_RESTORE_COMPLETED',restored)
            self.assertEqual(http.cover.base.file_sha256(f.music/file),original_sha)

            # 3. Native callback simulation touches ONLY this temp SQLite fixture.
            def fixture_reindex(album_id,album_path):
                with sqlite3.connect(str(f.db)) as db:
                    row=db.execute('SELECT data FROM albums WHERE id=?',(album_id,)).fetchone()
                    catalog=json.loads(row[0])
                    catalog['physical_files']=[{'path':'TEST/Album/'+p.name}
                        for p in sorted(f.album_dir.iterdir()) if p.suffix.lower() in ('.flac','.mp3')]
                    db.execute('UPDATE albums SET data=? WHERE id=?',(json.dumps(catalog),album_id))
                return True
            http.configure_rename_context(fixture_reindex,True)
            file='TEST/Album/01.flac'
            original_sha=http.cover.base.file_sha256(f.music/file)
            request={'album_id':f.id,'file':file,'new_name':'1 - 01. HTTP Fixture.flac'}
            plan=call('/rename-plan',request)
            self.assertEqual(plan['state'],'READ_ONLY_RENAME_PLAN',plan)
            result=call('/rename-apply',{**request,'expected_plan_id':plan['plan_id'],'confirm_write':True})
            self.assertEqual(result['state'],'RENAME_WRITE_COMPLETED',result)
            self.assertTrue((f.music/result['new_file']).is_file())
            self.assertIn(result['new_file'],rename._catalog_files(f.db,f.id))
            restored=call('/rename-restore',{'operation_id':result['operation_id'],'confirm_write':True})
            self.assertEqual(restored['state'],'RENAME_RESTORE_COMPLETED',restored)
            self.assertTrue((f.music/file).is_file())
            self.assertEqual(http.cover.base.file_sha256(f.music/file),original_sha)
            self.assertIn(file,rename._catalog_files(f.db,f.id))
            self.assertFalse((f.album_dir/'1 - 01. HTTP Fixture.flac').exists())
        finally:
            http._SAVE_CONTEXT.update(reindex_album=None,rename_qualified=False)
            for key,old in ((http.cover.COVER_ENV,old_cover),(rename.RENAME_ENV,old_rename)):
                if old is None:os.environ.pop(key,None)
                else:os.environ[key]=old
            f.tearDown()

if __name__=='__main__':unittest.main()
