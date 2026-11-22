"""Runs only inside the isolated NAS fixture container. Never imports server/AI.
Uses actual installed Index/Lease and a fixture scanner reading only fixture audio.
"""
import contextlib,hashlib,io,json,os,shutil,sys
from pathlib import Path
sys.path.insert(0,'/app')
import tag_cover_http as http
import tag_rename_writer as rename
from tag_native_index import NativeAlbumIndex
from index_engine import Index
from PIL import Image
import base64
assert not Path('/music').is_mount() and not Path('/data').is_mount(),'production storage must not be mounted'
assert os.geteuid()==1026,'fixture user differs from NAS service'
root=Path('/qualification-data');work=root/'run'
assert root.is_dir() and not work.exists(),'qualification run must be new'
work.mkdir(mode=0o700);music=work/'music';folder=music/'TEST/Album';folder.mkdir(parents=True)
for ext in ('mp3','flac'):shutil.copyfile('/fixture-source/test.'+ext,folder/('01.'+ext))
assert all(p.resolve().is_relative_to(work.resolve()) for p in folder.iterdir())
image=io.BytesIO();Image.new('RGB',(8,8),'blue').save(image,'JPEG');(folder/'0.jpg').write_bytes(image.getvalue());folder_cover=http.cover.base.file_sha256(folder/'0.jpg')
class FixtureScanner:
    EXCLUDE=set();AUDIO={'.mp3','.flac'};SCAN_REVISION='native-fullsave-fixture-v1'
    @staticmethod
    def disc_number(name):return None
    @staticmethod
    def scan(path,*args,**kwargs):
        path=Path(path);assert path.resolve()==folder.resolve()
        files=[];tracks=[]
        for p in sorted(path.iterdir()):
            if p.suffix.lower() not in FixtureScanner.AUDIO:continue
            tags=http.cover.base.read_tags(p)
            files.append({'filename':p.name,'path':p.relative_to(music).as_posix(),'raw_tags':tags})
            tracks.append({'title':(tags['title'] or ['Fixture'])[0],'number':len(tracks)+1,'file':p.relative_to(music).as_posix()})
        return {'albums':[{'artist':'Fixture','title':'Fixture Album','original_year':'2026','physical_files':files,'tracks':tracks,'sources':[]}],'errors':[]}
def cloud(*args,**kwargs):raise AssertionError('network/cloud path forbidden in fixture')
index=Index(music,work/'index',cloud,FixtureScanner,track_search=False)
uid='11111111-1111-4111-8111-111111111111'
data=FixtureScanner.scan(folder)['albums'][0];data['relative_path']='TEST/Album'
with index.db() as db:index.put(db,data,uid,identity=f'{folder.stat().st_dev}:{folder.stat().st_ino}')
index.setmeta('seed_complete','1')
backup=work/'backups'
@contextlib.contextmanager
def guard():
    with index.whole_job_lease(blocking=False):yield
http.configure_save_context(guard,str(backup),{'tags':True,'cover':True,'full_tags':True})
http.configure_rename_context(NativeAlbumIndex(index),True)
assert http.save_capabilities()['rename'] and http.save_capabilities()['mp3_tags']
cases=[]
for ext in ('flac','mp3'):
    file='TEST/Album/01.'+ext;p=music/file;oldsha=http.cover.base.file_sha256(p);old=http.cover.base.read_tags(p)
    edits={'title':['NAS Full Save'],'artist':['Fixture Artist'],'album':['Fixture Album'],'album_artist':['Fixture Album Artist'],'date':['2026-11-22'],'genre':['Rock','Pop'],'featuring':['Guest'],'tracknumber':['01'],'discnumber':['1']}
    body={'album_id':uid,'file':file,'edits':edits,'before_tags':{k:old[k] for k in edits}}
    plan=http.tag_plan(index.dbpath,music,body);assert plan['state']=='READ_ONLY_TRACK_WRITE_PLAN',plan
    result=http.save_request(index.dbpath,music,http.PREFIX+'/tag-apply',{**body,'expected_plan_id':plan['plan_id'],'confirm_write':True});assert result['state']=='TAG_TRACK_WRITE_COMPLETED',result
    assert result['saved_tags']==edits
    restored=http.cover.base.track_write_restore(music,backup,result['operation_id'],True,True);assert restored['state']=='TAG_TRACK_RESTORE_COMPLETED',restored
    assert http.cover.base.file_sha256(p)==oldsha;cases.append(ext+'_full_tags_restore')
    cover_ops=[]
    for action,color in [('add','blue'),('replace','red'),('remove',None)]:
        state=http.inspect(index.dbpath,music,uid,file);blob=None
        if color:
            im=io.BytesIO();Image.new('RGB',(8,8),color).save(im,'PNG');blob=base64.b64encode(im.getvalue()).decode()
        body={'album_id':uid,'file':file,'action':action,'expected_file_sha256':state['file_sha256'],'expected_catalog_digest':state['catalog_digest'],**({'image_base64':blob} if blob else {})}
        plan=http.plan(index.dbpath,music,body);assert plan['state']=='READ_ONLY_COVER_PLAN',plan
        result=http.save_request(index.dbpath,music,http.PREFIX+'/apply',{**body,'expected_plan_id':plan['plan_id'],'confirm_write':True});assert result['state']=='COVER_WRITE_COMPLETED',result
        assert len(result['verification']['front_covers'])==(0 if action=='remove' else 1)
        cover_ops.append(result['operation_id']);cases.append(ext+'_cover_'+action+'_api_reread')
    for op in reversed(cover_ops):
        result=http.cover.cover_restore(music,backup,op,True,True);assert result['state']=='COVER_RESTORE_COMPLETED',result
    assert http.cover.base.file_sha256(p)==oldsha;cases.append(ext+'_cover_exact_restore')
file='TEST/Album/01.flac';oldsha=http.cover.base.file_sha256(music/file)
body={'album_id':uid,'file':file,'new_name':'1 - 01. Death Penalty.flac'};plan=http.save_request(index.dbpath,music,http.PREFIX+'/rename-plan',body);assert plan['state']=='READ_ONLY_RENAME_PLAN',plan
result=http.save_request(index.dbpath,music,http.PREFIX+'/rename-apply',{**body,'expected_plan_id':plan['plan_id'],'confirm_write':True});assert result['state']=='RENAME_WRITE_COMPLETED',result
assert result['new_file'] in rename._catalog_files(index.dbpath,uid)
restored=http.save_request(index.dbpath,music,http.PREFIX+'/rename-restore',{'operation_id':result['operation_id'],'confirm_write':True});assert restored['state']=='RENAME_RESTORE_COMPLETED',restored
assert http.cover.base.file_sha256(music/file)==oldsha and file in rename._catalog_files(index.dbpath,uid)
assert index.jobs.empty() and not index.active
with index.db() as db:jobs=[json.loads(r[0]) for r in db.execute('SELECT data FROM jobs')]
assert len(jobs)==2 and all(j['state']=='completed' and j['path']=='TEST/Album' for j in jobs),jobs
assert http.cover.base.file_sha256(folder/'0.jpg')==folder_cover
cases.extend(['rename_native_index','rename_native_restore','folder_cover_unchanged'])
names=('server.py','index_engine.py','catalog_lease.py','tag_cover_http.py','tag_phase2c.py','tag_cover_h.py','tag_rename_writer.py','tag_native_index.py')
proof={'schema':'fullsave-native-qualification-v1','state':'PASS','cases':cases,'native_job_ids':[j['id'] for j in jobs],'hashes':{n:hashlib.sha256((Path('/app')/n).read_bytes()).hexdigest() for n in names},'operating_media_writes':0,'operating_db_writes':0,'http_requests':0,'native_index_real_code':True,'scanner':'fixture-only read-tags adapter; production scanner unchanged'}
output=root/'qualification.json'
with output.open('x') as f:json.dump(proof,f,indent=2)
output.chmod(0o600);print(json.dumps(proof))
