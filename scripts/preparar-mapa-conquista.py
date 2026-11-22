"""Reproduce the mobile map and factual snapshot from swisstopo 2026.
Requires shapely; writes no answers to public assets.
"""
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import urllib.request
import zipfile
from shapely import from_wkb
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip'
CHECKSUM = '68e922353c76fa5db3cef06a32f9711c0198faa6fbd2b5bcde9edc88b0f8999f'
CODES = 'ZH BE LU UR SZ OW NW GL ZG FR SO BS BL SH AR AI SG GR AG TG TI VD VS NE GE JU'.split()
tmp = Path(tempfile.gettempdir()) / 'suizamente-conquista'
tmp.mkdir(exist_ok=True)
archive = tmp / 'boundaries.zip'
if not archive.exists():
    with urllib.request.urlopen(SOURCE, timeout=60) as response:
        archive.write_bytes(response.read())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == CHECKSUM
with zipfile.ZipFile(io.BytesIO(archive.read_bytes())) as zipped:
    gpkg = tmp / 'boundaries.gpkg'
    if not gpkg.exists():
        gpkg.write_bytes(zipped.read(next(n for n in zipped.namelist() if n.endswith('.gpkg'))))
db = sqlite3.connect(gpkg)
db.row_factory = sqlite3.Row
def geometry(blob):
    envelope = (blob[3] >> 1) & 7
    return from_wkb(blob[8 + [0, 32, 48, 48, 64][envelope]:])

rows = list(db.execute("SELECT * FROM tlm_kantonsgebiet WHERE icc='CH' ORDER BY kantonsnummer"))
geometries = {CODES[r['kantonsnummer'] - 1]: geometry(r['geom']) for r in rows}
min_x = min(g.bounds[0] for g in geometries.values())
max_y = max(g.bounds[3] for g in geometries.values())
max_x = max(g.bounds[2] for g in geometries.values())
scale = 810 / (max_x - min_x)
def project(x, y, z=None):
    return (25 + (x - min_x) * scale, 25 + (max_y - y) * scale)
def ring_path(ring):
    coordinates = list(ring.coords)
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y, *_ in coordinates) + 'Z'
def svg_path(g):
    polygons = list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]
    return ''.join(ring_path(p.exterior) + ''.join(ring_path(r) for r in p.interiors) for p in polygons)

snapshot, paths = [], []
for row in rows:
    code = CODES[row['kantonsnummer'] - 1]
    towns = [dict(t) for t in db.execute("SELECT name,bfs_nummer,gem_flaeche,einwohnerzahl FROM tlm_hoheitsgebiet WHERE kantonsnummer=? AND icc='CH' AND objektart='Gemeindegebiet' ORDER BY einwohnerzahl DESC,name", (row['kantonsnummer'],))]
    # Exclaves are duplicate polygons of the same municipality, not extra towns.
    unique = {}
    for town in towns:
        key = town['bfs_nummer']
        if key not in unique:
            unique[key] = {'name': town['name'], 'bfs': key, 'area': town['gem_flaeche'] / 100, 'population': town['einwohnerzahl'] or 0}
    towns = list(unique.values())
    assert len(towns) >= 3
    neighbours = [k for k, g in geometries.items() if k != code and g.distance(geometries[code]) < 1]
    snapshot.append({'code': code, 'native': row['name'], 'number': row['kantonsnummer'], 'area': row['kantonsflaeche'] / 100, 'population': row['einwohnerzahl'], 'municipalities': len(towns), 'neighbours': neighbours, 'towns': towns})
    shape = transform(project, geometries[code].simplify(350, preserve_topology=True))
    center = shape.representative_point()
    paths.append({'code': code, 'path': svg_path(shape), 'x': round(center.x, 1), 'y': round(center.y, 1)})

private = ROOT / 'data/suizamente/conquista'
public = ROOT / 'public/suizamente/conquista'
private.mkdir(parents=True, exist_ok=True)
public.mkdir(parents=True, exist_ok=True)
provenance = {'source': SOURCE, 'sha256': CHECKSUM, 'edition': '2026-01-01', 'reviewed': '2026-11-22', 'attribution': '© swisstopo, swissBOUNDARIES3D 2026'}
(private / 'geografia-2026.json').write_text(json.dumps({**provenance, 'cantons': snapshot}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
height = round(max(transform(project, g).bounds[3] for g in geometries.values()) + 25)
(public / 'mapa.json').write_text(json.dumps({**provenance, 'viewBox': f'0 0 860 {height}', 'cantons': paths}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'Official map: {len(paths)} cantons, {height}px; factual municipality snapshot saved outside public/.')
