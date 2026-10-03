#!/usr/bin/env python3
"""Read-only extraction of an installed Electron app for local UI inspection."""
import hashlib,json,shutil,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
APP=Path('/Applications/Claude.app/Contents/Resources')
archive=APP/'app.asar'
out=ROOT/'reference/asar'
out.mkdir(parents=True,exist_ok=True)
records=[]
with archive.open('rb') as f:
    first=f.read(16)
    _,header_size,_,json_size=struct.unpack('<4I',first)
    header=json.loads(f.read(json_size));base=8+header_size
    def extract(entries,prefix=Path()):
        for name,entry in entries.items():
            rel=prefix/name;target=out/rel
            if not target.resolve().is_relative_to(out.resolve()):raise ValueError('Unsafe archive path')
            if 'files' in entry:
                target.mkdir(parents=True,exist_ok=True);extract(entry['files'],rel);continue
            if 'link' in entry:
                records.append({'path':str(rel),'link':entry['link'],'skipped':True});continue
            if entry.get('unpacked'):
                source=Path(str(archive)+'.unpacked')/rel
                data=source.read_bytes()
            else:
                f.seek(base+int(entry['offset']));data=f.read(entry['size'])
                if len(data)!=entry['size']:raise ValueError('Truncated archive member')
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
            records.append({'path':str(rel),'size':len(data),'sha256':hashlib.sha256(data).hexdigest(),'unpacked':bool(entry.get('unpacked'))})
    extract(header['files'])
shutil.copytree(APP/'ion-dist',ROOT/'reference/ion-dist',dirs_exist_ok=True)
(ROOT/'analysis/asar-manifest.json').write_text(json.dumps({'archive':str(archive),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':records},indent=2))
print(f'Extracted {len(records)} ASAR entries; copied ion-dist to {ROOT}/reference')
