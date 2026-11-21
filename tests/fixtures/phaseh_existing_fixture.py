import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import uuid
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import tag_cover_h as cover
from mutagen.easyid3 import EasyID3
from mutagen.flac import FLAC,Picture
from mutagen.id3 import ID3,APIC

PNG=bytes.fromhex('89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63b4710b60606060626060606060000009ee00d679e53bbd0000000049454e44ae426082')
# Tests verify gate, preview identity, stream preservation, and rollback on isolated temp audio.
class CoverTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.music=self.root/'music';self.music.mkdir();self.backup=self.root/'backups'
        self.folder=self.music/'JAZZ'/'Chet Baker';self.folder.mkdir(parents=True)
        self.img=self.root/'art.png';self.img.write_bytes(PNG)
        self.db=self.root/'catalog.db'
        self.albums={}
        db=sqlite3.connect(self.db)
        db.execute('CREATE TABLE albums (id TEXT, artist TEXT, title TEXT, path TEXT, year TEXT, format TEXT, missing INTEGER, hidden INTEGER, data TEXT)')
        db.commit();db.close()
        self.previous=os.environ.pop(cover.COVER_ENV,None)
    def tearDown(self):
        os.environ.pop(cover.COVER_ENV,None)
        if self.previous is not None:os.environ[cover.COVER_ENV]=self.previous
        self.tmp.cleanup()
    def album(self,ext,name='track'):
        path=self.folder/(name+ext)
        # Tiny real test audio; subprocess does not access music or NAS.
        args=['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=0.12', '-y']
        if ext=='.mp3':args+=['-codec:a','libmp3lame','-qscale:a','5']
        args+=[str(path)]
        subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
        if ext=='.flac':
            f=FLAC(str(path));f['artist']=['Chet Baker'];f['title']=['Time After Time'];f['genre']=['Jazz','Cool Jazz'];f.save()
        else:
            t=EasyID3(str(path));t['artist']=['Chet Baker'];t['title']=['Time After Time'];t['genre']=['Jazz'];t.save()
        album_id=str(uuid.uuid4());file=path.relative_to(self.music).as_posix()
        db=sqlite3.connect(self.db)
        db.execute('INSERT INTO albums VALUES (?,?,?,?,?,?,?,?,?)',(album_id,'Chet Baker',name,'JAZZ/Chet Baker','1954',ext,0,0,json.dumps({'tracks':[{}],'physical_files':[file]})))
        db.commit();db.close()
        return album_id,file,path
    def plan(self,a,f,act='add',im=True):return cover.cover_plan(str(self.db),str(self.music),a,f,act,str(self.img) if im else None)
    def apply(self,a,f,plan,act='add',im=True,approve=True):
        return cover.cover_apply(str(self.db),str(self.music),str(self.backup),a,f,act,
                                 str(self.img) if im else None,plan['plan_id'],
                                 approve,approve,approve)
    def test_image_validation(self):
        obj=cover._image_info(PNG)
        self.assertEqual((obj['mime'],obj['width'],obj['height']),('image/png',2,2))
        for b in (b'x',b'\x89PNG\r\n\x1a\n',b'\xff\xd8',PNG[:-1],PNG[:-25]+bytes([PNG[-25]^1])+PNG[-24:]):
            with self.assertRaises(ValueError):cover._image_info(b)
    def test_readonly_add_and_no_wrong_remove(self):
        a,f,p=self.album('.flac')
        before=p.read_bytes()
        q=self.plan(a,f)
        self.assertEqual(q['state'],'READ_ONLY_COVER_PLAN')
        self.assertFalse(q['apply_supported'])
        self.assertEqual(q['media_writes'],0)
        self.assertEqual(p.read_bytes(),before)
        self.assertEqual(self.plan(a,f,'remove',False)['reason'],'no_front_cover_to_change')
    def test_default_off_and_explicit_gate(self):
        a,f,p=self.album('.flac');original=cover.base.file_sha256(p)
        q=self.plan(a,f)
        self.assertEqual(self.apply(a,f,q)['reason'],'cover_writer_feature_off')
        os.environ[cover.COVER_ENV]='true'
        self.assertEqual(self.apply(a,f,q,approve=False)['reason'],'explicit_approval_required')
        self.assertEqual(cover.base.file_sha256(p),original)
    def test_jpeg_mp3_add(self):
        from io import BytesIO
        from PIL import Image
        b=BytesIO();Image.new('RGB',(3,2),(10,30,70)).save(b,format='JPEG')
        jpeg=self.root/'test.jpg';jpeg.write_bytes(b.getvalue())
        a,f,p=self.album('.mp3','jpeg');os.environ[cover.COVER_ENV]='true'
        q=cover.cover_plan(str(self.db),str(self.music),a,f,'add',str(jpeg))
        self.assertEqual(q['state'],'READ_ONLY_COVER_PLAN',q)
        result=cover.cover_apply(str(self.db),str(self.music),str(self.backup),a,f,'add',str(jpeg),q['plan_id'],True,True,True)
        self.assertEqual(result['state'],'COVER_WRITE_COMPLETED',result)
        self.assertEqual(cover._covers(p)[0]['mime'],'image/jpeg')

    def test_wrong_plan_hold(self):
        a,f,p=self.album('.mp3');os.environ[cover.COVER_ENV]='true'
        q=self.plan(a,f);q['plan_id']='0'*64
        self.assertEqual(self.apply(a,f,q)['reason'],'plan_id_changed_since_preview')
    def test_flac_add_and_restore(self):
        a,f,p=self.album('.flac');os.environ[cover.COVER_ENV]='true'
        before=p.read_bytes();stream=cover._stream_signature(p);tags=cover._tag_state(p)
        q=self.plan(a,f);r=self.apply(a,f,q)
        self.assertEqual(r['state'],'COVER_WRITE_COMPLETED',r)
        self.assertEqual(cover._tag_state(p),tags)
        self.assertEqual(cover._stream_signature(p),stream)
        self.assertEqual(cover._covers(p)[0]['sha256'],hashlib.sha256(PNG).hexdigest())
        s=cover.cover_restore(str(self.music),str(self.backup),r['operation_id'],True,True)
        self.assertEqual(s['state'],'COVER_RESTORE_COMPLETED',s)
        self.assertEqual(before,p.read_bytes())
    def test_mp3_add_and_restore(self):
        a,f,p=self.album('.mp3');os.environ[cover.COVER_ENV]='true'
        before=p.read_bytes();stream=cover._stream_signature(p);tags=cover._tag_state(p)
        q=self.plan(a,f);r=self.apply(a,f,q)
        self.assertEqual(r['state'],'COVER_WRITE_COMPLETED',r)
        self.assertEqual(cover._tag_state(p),tags)
        self.assertEqual(cover._stream_signature(p),stream)
        self.assertEqual(cover._covers(p)[0]['sha256'],hashlib.sha256(PNG).hexdigest())
        s=cover.cover_restore(str(self.music),str(self.backup),r['operation_id'],True,True)
        self.assertEqual(s['state'],'COVER_RESTORE_COMPLETED',s)
        self.assertEqual(before,p.read_bytes())
    def test_replace_and_remove_flac(self):
        a,f,p=self.album('.flac','replace');os.environ[cover.COVER_ENV]='true'
        t=FLAC(str(p))
        pic=Picture();pic.type=3;pic.mime='image/png';pic.data=b'old';t.add_picture(pic)
        other=Picture();other.type=4;other.mime='image/png';other.data=b'other';t.add_picture(other);t.save()
        q=self.plan(a,f,'replace');r=self.apply(a,f,q,'replace')
        self.assertEqual(r['state'],'COVER_WRITE_COMPLETED',r)
        self.assertEqual(len(cover._covers(p)),2)
        q=self.plan(a,f,'remove',False);r=self.apply(a,f,q,'remove',False)
        self.assertEqual(r['state'],'COVER_WRITE_COMPLETED',r)
        self.assertEqual(len(cover._covers(p)),1)
        self.assertEqual(cover._covers(p)[0]['type'],4)
    def test_remove_mp3_other_art(self):
        a,f,p=self.album('.mp3','rm');os.environ[cover.COVER_ENV]='true'
        t=ID3(str(p));t.add(APIC(encoding=3,mime='image/png',type=3,desc='front',data=b'old'))
        t.add(APIC(encoding=3,mime='image/png',type=4,desc='back',data=b'other'));t.save(str(p))
        q=self.plan(a,f,'remove',False);r=self.apply(a,f,q,'remove',False)
        self.assertEqual(r['state'],'COVER_WRITE_COMPLETED',r)
        self.assertEqual(len(cover._covers(p)),1)
        self.assertEqual(cover._covers(p)[0]['desc'],'back')
    def test_plan_reject_file_outside_album(self):
        a,f,p=self.album('.flac')
        self.assertEqual(self.plan(a,'JAZZ/Chet Baker/other.mp3')['state'],'HOLD')
    def test_source_file_cas_prevents_apply(self):
        a,f,p=self.album('.flac');os.environ[cover.COVER_ENV]='true'
        q=self.plan(a,f)
        # metadata change after preview prevents stale plan substitution.
        t=FLAC(str(p));t['title']=['Modified Since Preview'];t.save()
        self.assertEqual(self.apply(a,f,q)['state'],'HOLD')
    def test_no_image_for_replace(self):
        a,f,p=self.album('.mp3')
        self.assertEqual(self.plan(a,f,'replace',False)['state'],'HOLD')
    def test_unexpected_rollback_and_noncover_protection(self):
        a,f,p=self.album('.flac');os.environ[cover.COVER_ENV]='true'
        q=self.plan(a,f);before=p.read_bytes()
        with patch.object(cover,'_cover_change',side_effect=ValueError('forced_staging_error')):
            r=self.apply(a,f,q)
        self.assertEqual(r['state'],'HOLD_ROLLED_BACK',r)
        self.assertEqual(p.read_bytes(),before)

if __name__=='__main__':unittest.main()
