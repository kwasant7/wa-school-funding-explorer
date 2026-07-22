# Downloads official WA Legislature member portraits and stores web-sized
# thumbnails in public/legislators/, recording each file in
# src/data/legislators.json as a `photo` field.
#
# Source: leg.wa.gov member pages -> /memberphoto/<id>.jpg
# (official portraits, Legislative Support Services)
#
# Run: python3 scripts/fetch-legislator-photos.py
import html
import io
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data', 'legislators.json')
OUT_DIR = os.path.join(ROOT, 'public', 'legislators')
UA = {'User-Agent': 'wa-school-funding-explorer/1.0 (civic education project)'}
WIDTH = 240  # thumbnail width; portraits are 3:4


def get(url, timeout=30):
    """Fetch via curl - uses the system trust store, avoiding macOS Python's
    missing-root-certificate problem."""
    out = subprocess.run(
        ['curl', '-sL', '--max-time', str(timeout), '-A', UA['User-Agent'], url],
        capture_output=True,
        check=True,
    )
    if not out.stdout:
        raise RuntimeError('empty response')
    return out.stdout


def photo_id_for(member_url):
    try:
        html = get(member_url).decode('utf-8', 'ignore')
    except Exception as e:
        return None, f'page fetch failed: {e}'
    m = re.search(r'/memberphoto/(\d+)\.jpg', html)
    if not m:
        return None, 'no photo on page'
    return m.group(1), None


def fetch_one(entry):
    url = entry['url']
    pid, err = photo_id_for(url)
    if not pid:
        return url, None, err
    dest = os.path.join(OUT_DIR, f'{pid}.jpg')
    if not os.path.exists(dest):
        try:
            raw = get(f'https://leg.wa.gov/memberphoto/{pid}.jpg')
            img = Image.open(io.BytesIO(raw)).convert('RGB')
            h = round(img.height * (WIDTH / img.width))
            img = img.resize((WIDTH, h), Image.LANCZOS)
            img.save(dest, 'JPEG', quality=82, optimize=True)
        except Exception as e:
            return url, None, f'photo failed: {e}'
    return url, f'{pid}.jpg', None


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = json.load(open(DATA))

    # Repair HTML entities that survived scraping (e.g. "Salda&#xF1;a" ->
    # "Saldaña"), which would otherwise show a misspelled name and break the
    # member link.
    fixed = 0
    for members in doc['legislators'].values():
        for m in members:
            for field in ('name', 'url'):
                if '&#' in m.get(field, '') or '&amp;' in m.get(field, ''):
                    m[field] = html.unescape(m[field])
                    fixed += 1
    if fixed:
        print(f'repaired {fixed} HTML-entity fields')

    # unique legislators across all legislative districts
    by_url = {}
    for members in doc['legislators'].values():
        for m in members:
            by_url.setdefault(m['url'], m)
    targets = list(by_url.values())
    print(f'fetching photos for {len(targets)} legislators...')

    photo_by_url, failures = {}, []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for url, photo, err in pool.map(fetch_one, targets):
            if photo:
                photo_by_url[url] = photo
            else:
                failures.append((url, err))

    # write the photo filename onto every entry (a legislator can appear once)
    for members in doc['legislators'].values():
        for m in members:
            p = photo_by_url.get(m['url'])
            if p:
                m['photo'] = p

    doc.setdefault('sources', {})
    if isinstance(doc['sources'], dict):
        doc['sources']['photos'] = (
            'Official member portraits from the Washington State Legislature '
            '(leg.wa.gov/memberphoto), Legislative Support Services; resized to '
            f'{WIDTH}px wide for the web.'
        )

    json.dump(doc, open(DATA, 'w'))
    total_kb = sum(
        os.path.getsize(os.path.join(OUT_DIR, f))
        for f in os.listdir(OUT_DIR)
        if f.endswith('.jpg')
    ) // 1024
    print(f'saved {len(photo_by_url)} photos ({total_kb} KB total)')
    if failures:
        print(f'{len(failures)} without photos:')
        for u, e in failures[:10]:
            print('  ', u, '-', e)


if __name__ == '__main__':
    main()
