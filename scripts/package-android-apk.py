"""Keep only complete ARM phone libraries before APK alignment and signing."""
from pathlib import Path
import json
import sys
import zipfile

source, destination = map(Path, sys.argv[1:])
architectures = {'arm64-v8a', 'armeabi-v7a'}
if source.resolve() == destination.resolve():
    raise SystemExit('Input and output APK paths must differ.')
with zipfile.ZipFile(source) as archive:
    bundle = archive.read('assets/index.android.bundle')
    if b'widget-fixture.test' in bundle:
        raise SystemExit('The emulator fixture entry must never be published.')
    if any(marker not in bundle for marker in [b'RNWidgetBackgroundTask', b'FriendListening', b'ListeningCircle']):
        raise SystemExit('Android widget registration is missing from the bundled app.')
    names = archive.namelist()
    if len(names) != len(set(names)):
        raise SystemExit('Duplicate APK entries are unsupported.')
    libraries = {
        abi: {name.rsplit('/', 1)[1] for name in names if name.startswith(f'lib/{abi}/') and name.endswith('.so')}
        for abi in architectures
    }
    if not all(libraries.values()) or libraries['arm64-v8a'] != libraries['armeabi-v7a']:
        raise SystemExit('Both ARM architectures must have the complete set of native libraries.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w') as output:
        for entry in archive.infolist():
            parts = entry.filename.split('/')
            if len(parts) > 2 and parts[0] == 'lib' and parts[1] not in architectures:
                continue
            output.writestr(entry, archive.read(entry.filename))
print(json.dumps({'architectures': sorted(architectures), 'native_libraries_per_architecture': len(libraries['arm64-v8a']), 'output_bytes': destination.stat().st_size}))
