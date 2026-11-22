"""Targeted temporary-file tests for disc ancillary folder read-only exception.
No audio playback, NAS, Catalog or production write.
"""
import pathlib
import tempfile
import unittest
import sys
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'nas/tag-editor-cover'))
import tag_phase2c as base
import tag_cover_http as http


class AncillaryDiscTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=pathlib.Path(self.tmp.name)
        self.album=self.root/'Album'
        self.disc=self.album/'CD1'
        self.disc.mkdir(parents=True)
        (self.disc/'01.flac').write_bytes(b'fake discovery only')
        self.aux=self.disc/'Booklet'
        (self.aux/'Scans').mkdir(parents=True)
        (self.aux/'Scans'/'cover.jpg').write_bytes(b'jpg')

    def test_readonly_ignores_bounded_non_audio_disc_folder(self):
        paths,issues=base.discover_files(self.root,self.album,allow_auxiliary_disc_dirs=True)
        self.assertEqual([p.name for p in paths],['01.flac'])
        self.assertEqual(issues,[])

    def test_writer_default_still_rejects_even_safe_auxiliary_directory(self):
        _,issues=base.discover_files(self.root,self.album)
        self.assertEqual([i['code'] for i in issues],['nested_directory_below_disc'])

    def test_nested_audio_fails_closed_even_in_readonly_mode(self):
        (self.aux/'Scans'/'02.mp3').write_bytes(b'mock')
        _,issues=base.discover_files(self.root,self.album,allow_auxiliary_disc_dirs=True)
        self.assertEqual([i['code'] for i in issues],['nested_directory_contains_audio'])

    def test_symlink_fails_closed(self):
        try:(self.aux/'Scans'/'shortcut').symlink_to(self.root/'outside')
        except (OSError,NotImplementedError):self.skipTest('symlink creation unavailable')
        _,issues=base.discover_files(self.root,self.album,allow_auxiliary_disc_dirs=True)
        self.assertEqual([i['code'] for i in issues],['nested_directory_symlink'])

    def test_unreadable_tree_fails_closed(self):
        with patch.object(pathlib.Path,'iterdir',side_effect=OSError('not readable')):
            self.assertEqual(base._auxiliary_tree_issue(self.root,self.aux)['code'],
                             'nested_directory_unreadable')

    def test_depth_limit_fails_closed(self):
        current=self.aux
        for i in range(10):
            current=current/f'sub{i}'
            current.mkdir()
        _,issues=base.discover_files(self.root,self.album,allow_auxiliary_disc_dirs=True)
        self.assertEqual([i['code'] for i in issues],['nested_directory_inspection_limit'])

    def test_read_endpoint_only_opt_in_not_save_plan(self):
        with patch.object(http.cover.base,'inventory',return_value=({'id':'x'},[{'file':'Album/CD1/01.flac'}],[])) as inv:
            result=http.read_album_tags('catalog','music','id')
            self.assertEqual(result['state'],'ACTUAL_ALBUM_TAGS')
            inv.assert_called_once_with('catalog','music','id',allow_auxiliary_disc_dirs=True)

if __name__=='__main__':unittest.main()
