"""Small adapter to the installed Index.enqueue synchronous branch; no SQL writer."""
from pathlib import Path
import inspect
import json
import tag_phase2c as base

class NativeAlbumIndex:
    def __init__(self,index):
        self.index=index
        if index is None or 'synchronous' not in inspect.signature(index.enqueue).parameters:
            raise ValueError('native_synchronous_enqueue_not_installed')
    def preflight(self,album_id,album_path):
        i=self.index
        if i.stopping.is_set() or i.active or not i.jobs.empty():raise PermissionError('native_index_busy')
        if i.meta('seed_complete')!='1':raise PermissionError('native_catalog_seed_incomplete')
        if not album_path or album_path in ('.','/'):raise ValueError('album_scope_required')
        folder=i.folder(album_path)
        if folder==i.root:raise ValueError('whole_library_scope_rejected')
        with i.db() as db:
            if any(json.loads(r[0]).get('state') in ('queued','running') for r in db.execute('SELECT data FROM jobs ORDER BY rowid DESC LIMIT 500')):raise PermissionError('native_index_job_pending')
            rows=db.execute('SELECT id,path,missing,hidden FROM albums WHERE path=? OR substr(path,1,?)=?',
                (album_path,len(album_path)+1,album_path+'/')).fetchall()
        exact=[r for r in rows if r['id']==album_id and r['path']==album_path and not r['missing'] and not r['hidden']]
        if len(exact)!=1 or any(r['id']!=album_id and not r['missing'] for r in rows):
            raise PermissionError('native_album_scope_not_single_active_album')
        album,entries,issues=base.inventory(i.dbpath,i.root,album_id)
        if issues:raise PermissionError('native_album_inventory_not_safe')
        return album
    def __call__(self,album_id,album_path):
        self.preflight(album_id,album_path)
        # enqueue's existing @index_job and the HTTP runtime guard retain the
        # reentrant whole-job lease in THIS thread until execute_job completes.
        job=self.index.enqueue(album_path,recursive=True,kind='manual',scan_mode='changes',synchronous=True)
        if job.get('state')!='completed' or job.get('errors') or job.get('deduplicated'):
            raise RuntimeError('native_album_index_not_cleanly_completed:'+str(job.get('state')))
        with self.index.db() as db:
            row=db.execute('SELECT id,path,missing,hidden FROM albums WHERE id=?',(album_id,)).fetchone()
        if row is None or row['path']!=album_path or row['missing'] or row['hidden']:
            raise RuntimeError('native_index_album_identity_changed')
        return {'state':'completed','job_id':job['id'],'album_id':album_id}
