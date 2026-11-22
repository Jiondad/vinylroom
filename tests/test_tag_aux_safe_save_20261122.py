"""Targeted nested ancillary folder storage PLAN tests on isolated fixture audio.

No NAS, no production catalog, no real production audio changes.
"""
import io
import json
import pathlib
import sys
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'nas/tag-editor-cover'))
sys.path.insert(0,str(ROOT/'tests'))
from test_tag_full_save_extension_20261122 import FullTagSaveFixture
import tag_cover_http as http
import tag_rename_writer as rename
from PIL import Image


class SafeAncillarySavePlan(unittest.TestCase):
    def setUp(self):
        self.fixture=FullTagSaveFixture('test_flac_album_common_fields')
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        f=self.fixture
        self.aux=f.album_dir/'CD1'/'Booklet'
        self.aux.mkdir(parents=True)
        (self.aux/'scans').mkdir()
        (self.aux/'scans'/'cover.png').write_bytes(b'image-only fixture')
        # Existing fixture stores tracks in the album root; move both into disc
        # and update only the temporary sqlite Catalog paths.
        disc=f.album_dir/'CD1'
        for ext in ('flac','mp3'):
            (f.album_dir/('01.'+ext)).rename(disc/('01.'+ext))
        import sqlite3
        with sqlite3.connect(f.db) as db:
            row=json.loads(db.execute('SELECT data FROM albums WHERE id=?',(f.id,)).fetchone()[0])
            row['physical_files']=[{'path':'TEST/Album/CD1/01.flac'},{'path':'TEST/Album/CD1/01.mp3'}]
            db.execute('UPDATE albums SET data=? WHERE id=?',(json.dumps(row),f.id))
        self.file='TEST/Album/CD1/01.flac'
        self.tags=http.cover.base.read_tags(f.music/self.file)

    def test_all_three_read_only_plans_accept_non_audio_aux(self):
        f=self.fixture
        original=self.tags.get('title',[])
        tag_body={'album_id':f.id,'file':self.file,'edits':{'title':['Aux Safe Save']},
                  'before_tags':{'title':original}}
        p=http.tag_plan(f.db,f.music,tag_body)
        self.assertEqual(p['state'],'READ_ONLY_TRACK_WRITE_PLAN',p)
        ins=http.inspect(f.db,f.music,f.id,self.file)
        self.assertEqual(ins['state'],'EMBEDDED_COVER_INSPECTED',ins)
        image=io.BytesIO()
        Image.new('RGB',(8,8),'purple').save(image,'PNG')
        from tempfile import NamedTemporaryFile
        with NamedTemporaryFile(suffix='.png') as tmp:
            tmp.write(image.getvalue());tmp.flush()
            cp=http.cover.cover_plan(f.db,f.music,f.id,self.file,'add',pathlib.Path(tmp.name))
            self.assertEqual(cp['state'],'READ_ONLY_COVER_PLAN',cp)
        rp=rename.plan(f.db,f.music,f.id,self.file,'01 - Auxiliary Test.flac')
        self.assertEqual(rp['state'],'READ_ONLY_RENAME_PLAN',rp)
        self.assertTrue(all(v['media_writes']==0 for v in (p,cp,rp)))

    def test_actual_tag_preflight_uses_same_safe_aux_inventory(self):
        f=self.fixture
        plan=http.tag_plan(f.db,f.music,{'album_id':f.id,'file':self.file,
                          'edits':{'title':['Aux Save']},'before_tags':{'title':self.tags['title']}})
        self.assertEqual(plan['state'],'READ_ONLY_TRACK_WRITE_PLAN',plan)
        pre=http.cover.base.track_write_preflight(f.db,f.music,f.backup,
                      f.id,self.file,{'title':['Aux Save']},plan['plan_id'])
        self.assertEqual(pre['state'],'WRITE_PREFLIGHT_READY',pre)

    def test_nested_audio_remains_hold_for_all_save_plans(self):
        f=self.fixture
        (self.aux/'scans'/'hidden.mp3').write_bytes(b'fake nested audio')
        tag=http.tag_plan(f.db,f.music,{'album_id':f.id,'file':self.file,
                      'edits':{'title':['Aux Save']},'before_tags':{'title':self.tags['title']}})
        self.assertEqual(tag['state'],'HOLD',tag)
        self.assertEqual(tag['reason'],'album_file_inventory_not_safe',tag)
        ins=http.inspect(f.db,f.music,f.id,self.file)
        self.assertEqual(ins['state'],'HOLD',ins)
        self.assertEqual(ins['issues'][0]['code'],'nested_directory_contains_audio',ins)
        rename_plan=rename.plan(f.db,f.music,f.id,self.file,'01 - Auxiliary Test.flac')
        self.assertEqual(rename_plan['state'],'HOLD',rename_plan)
        self.assertEqual(rename_plan['issues'][0]['code'],'nested_directory_contains_audio')

    def test_symlink_remains_hold_in_all_save_plans(self):
        try:(self.aux/'scans'/'shortcut').symlink_to(self.fixture.album_dir/'01.flac')
        except (OSError,NotImplementedError):self.skipTest('symlink unavailable')
        f=self.fixture
        ins=http.inspect(f.db,f.music,f.id,self.file)
        self.assertEqual(ins['state'],'HOLD',ins)
        self.assertEqual(ins['issues'][0]['code'],'nested_directory_symlink',ins)


if __name__=='__main__':unittest.main()
