"""Focused administrator HTTP dispatch contract tests; NO NAS/media/DB writes.

Previously qualified native file writers are not rerun here.
"""
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'nas/tag-editor-cover'))
import tag_cover_http as http

ORIGIN='https://jiondad.github.io'
PREFIX='/v2/admin/tag-cover'

class Headers(dict):
    def get_content_type(self):
        return self.get('Content-Type','').split(';')[0]

class Handler:
    def __init__(self,path,post=False,body=None,origin=ORIGIN,authorized=True):
        self.path=path
        payload=json.dumps(body or {}).encode()
        self.rfile=io.BytesIO(payload)
        self.headers=Headers({'Origin':origin,'Content-Type':'application/json','Content-Length':str(len(payload))})
        self.authorized=authorized
        self.reply_result=None
        self.index_admin_calls=0
        self.member_gate_calls=0
    def index_admin(self):
        self.index_admin_calls+=1
        if not self.authorized:raise PermissionError('not_admin')
    def member_gate(self):
        self.member_gate_calls+=1
        return True
    def reply(self,status,payload):
        self.reply_result=(status,payload)
        return self.reply_result

class Index:
    dbpath='/fixture/not-a-real-catalog'

class TestAdminHttpDispatch(unittest.TestCase):
    def test_capability_get_only_admin(self):
        h=Handler(PREFIX+'/save-capabilities')
        with patch.object(http,'save_capabilities',return_value={'state':'TAG_EDITOR_SAVE_CAPABILITIES','tags':True,'cover':True,'rename':True}):
            result=http.handle(h,Index(),'/fixture/not-real-media',ORIGIN,False)
        self.assertEqual(result[0],200)
        self.assertTrue(result[1]['rename'])
        self.assertEqual(h.index_admin_calls,1)
        self.assertEqual(h.member_gate_calls,1)

    def test_all_three_write_routes_forward_confirmed_bodies_without_mutation(self):
        routes=('/tag-apply','/apply','/rename-apply')
        for route in routes:
            with self.subTest(route=route):
                body={'album_id':'fixture','file':'TEST/01.flac','confirm_write':True}
                h=Handler(PREFIX+route,True,body)
                calls=[]
                def fake_save(db,music,route,body):
                    calls.append((db,music,route,body))
                    return {'state':'FIXTURE_ROUTE_ONLY','writes':0}
                with patch.object(http,'save_request',side_effect=fake_save):
                    result=http.handle(h,Index(),'/fixture/not-real-media',ORIGIN,True)
                self.assertEqual(result,(200,{'state':'FIXTURE_ROUTE_ONLY','writes':0}))
                self.assertEqual(len(calls),1)
                self.assertEqual(calls[0][2],PREFIX+route)
                self.assertEqual(calls[0][3],body)

    def test_wrong_origin_and_unapproved_admin_block_before_dispatch(self):
        for options in ({'origin':'https://evil.example'},{'authorized':False}):
            with self.subTest(options=options):
                h=Handler(PREFIX+'/rename-apply',True,{'confirm_write':True},**options)
                with patch.object(http,'save_request') as save:
                    result=http.handle(h,Index(),'/fixture/no-media',ORIGIN,True)
                self.assertEqual(result[0],403)
                save.assert_not_called()

    def test_no_get_apply_and_no_non_json_write(self):
        h=Handler(PREFIX+'/rename-apply',False)
        with patch.object(http,'save_request') as save:
            result=http.handle(h,Index(),'/fixture/no-media',ORIGIN,False)
        self.assertEqual(result[0],405)
        save.assert_not_called()
        h=Handler(PREFIX+'/tag-apply',True,{'confirm_write':True})
        h.headers['Content-Type']='text/plain'
        with patch.object(http,'save_request') as save:
            result=http.handle(h,Index(),'/fixture/no-media',ORIGIN,True)
        self.assertEqual(result[0],400)
        save.assert_not_called()

if __name__=='__main__':unittest.main()
