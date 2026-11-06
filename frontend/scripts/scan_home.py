"""Run a read-only NAS pilot from the signed-in Windows user's session."""
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime


def main():
    project = Path(__file__).resolve().parents[1]
    root = Path(r'\\Hyun-Nas\music')
    print('Music Archive - read-only pilot scan', flush=True)
    print(f'Music folder: {root}', flush=True)
    print('Original music files will not be changed.', flush=True)
    try:
        next(root.iterdir(), None)
    except OSError as exc:
        print(f'Cannot access the music folder: {exc}')
        print('Open \\Hyun-Nas\\music in File Explorer first, then retry.')
        print('Run this file normally, NOT as administrator.')
        return 1

    deps = project / '.scanner-deps'
    env = dict(os.environ)
    env['PYTHONPATH'] = str(deps)
    check = subprocess.run([sys.executable, '-c', 'import mutagen; from PIL import Image'], env=env, capture_output=True)
    if check.returncode:
        print('Installing scanner dependencies from PyPI into this project...', flush=True)
        install = subprocess.run([sys.executable, '-m', 'pip', 'install', '--disable-pip-version-check', '--timeout', '20', '--retries', '1', '--target', str(deps), '-r', str(project / 'scanner' / 'requirements.txt')])
        if install.returncode:
            print('Dependency installation failed. Please share the error with Codex.')
            return 1

    output = project / 'scan-results' / ('home-pilot-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.json')
    print('Scanning folder paths; reading metadata for up to 30 album folders.', flush=True)
    print('A large NAS can take a while. No audio hashing or uploading is performed.', flush=True)
    result = subprocess.run([sys.executable, str(project / 'scanner' / 'scan.py'), '--root', str(root), '--library-id', 'classified-music', '--output', str(output), '--limit', '30', '--covers'], env=env)
    if output.exists():
        manifest = json.loads(output.read_text(encoding='utf-8'))
        print(f"Albums: {len(manifest['albums'])}; errors: {len(manifest['errors'])}")
        print(f'Result: {output}')
        if manifest['errors']:
            print('Some entries could not be read. Ask Codex to inspect the result before importing.')
        else:
            print('In Music Archive: Add albums > Select scan list > choose this JSON.')
        os.startfile(str(output.parent))
    return result.returncode


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f'Error: {exc}')
        raise SystemExit(1)
