"""Build the offline city-distance index from swisstopo's WGS84 locality CSV."""
import csv
import io
import json
from pathlib import Path
import re
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict

SOURCE = (
    'https://data.geo.admin.ch/ch.swisstopo-vd.ortschaftenverzeichnis_plz/'
    'ortschaftenverzeichnis_plz/ortschaftenverzeichnis_plz_4326.csv.zip'
)
TARGET = Path(__file__).resolve().parents[1] / 'src/lib/swissLocalityCoordinates.json'


def normalize(value):
    value = unicodedata.normalize('NFD', value.lower())
    return re.sub('[^a-z0-9]', '', value)


with urllib.request.urlopen(SOURCE, timeout=30) as response:
    archive = zipfile.ZipFile(io.BytesIO(response.read()))
csv_name = next(name for name in archive.namelist() if name.endswith('.csv'))
rows = csv.DictReader(io.StringIO(archive.read(csv_name).decode('utf-8-sig')), delimiter=';')
localities = defaultdict(set)
municipalities = defaultdict(set)
qualified_names = defaultdict(set)
for row in rows:
    point = (float(row['N']), float(row['E']))
    assert 45 < point[0] < 48.5 and 5 < point[1] < 11
    for field, groups in [('Ortschaftsname', localities), ('Gemeindename', municipalities)]:
        name = row[field].strip()
        groups[normalize(name)].add(point)
        qualified = re.match(r'^(.*?)\s+\(?([A-Z]{2})\)?$', name)
        if qualified:
            qualified_names[normalize(qualified[1])].add(normalize(name))

# Prefer actual locality points; municipalities cover names such as Val-de-Travers.
for key, points in municipalities.items():
    localities.setdefault(key, points)
result = {}
for name, points in sorted(localities.items()):
    center = [round(sum(p[i] for p in points) / len(points), 5) for i in range(2)]
    result[name] = center
for plain, qualified in qualified_names.items():
    if plain not in result and len(qualified) == 1:
        result[plain] = result[next(iter(qualified))]

# A locality can cross a cantonal border (Basel, Herisau, St. Gallen, etc.).
# Its official name and unique postal points identify the locality, not the
# canton of each municipality intersecting the postal area. Homonyms with
# official canton qualifiers stay separate (e.g. Reinach AG / Reinach BL).

assert len(result) > 3000
TARGET.write_text(json.dumps(dict(sorted(result.items())), ensure_ascii=False, indent=None) + '\n', encoding='utf-8')
print(f'Wrote {len(result)} locality/municipality centers to {TARGET.name}')
