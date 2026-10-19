"""Download a bounded subset of official QuickDraw stroke data (CC BY 4.0)."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
SOURCE = 'https://storage.googleapis.com/quickdraw_dataset/full/simplified/'


def download(category, count):
    destination = ROOT / 'data' / (category['id'].replace(' ', '_') + '.ndjson')
    if destination.exists():
        with destination.open() as f:
            existing = sum(1 for _ in f)
        if existing >= count:
            print(f"{category['id']}: cached {existing}", flush=True)
            return
    url = SOURCE + urllib.parse.quote(category['id']) + '.ndjson'
    temporary = destination.with_suffix('.part')
    for attempt in range(3):
        try:
            n = 0
            with urllib.request.urlopen(url, timeout=45) as response, temporary.open('w') as out:
                for line in response:
                    row = json.loads(line)
                    if not row.get('recognized') or not row.get('drawing'):
                        continue
                    # Keep IDs for reproducible splits; do not retain contributor metadata.
                    out.write(json.dumps({'id': row['key_id'], 'drawing': row['drawing']}, separators=(',', ':')) + '\n')
                    n += 1
                    if n >= count:
                        break
            if n < count:
                raise RuntimeError(f'Only received {n}/{count} drawings')
            temporary.replace(destination)
            print(f"{category['id']}: downloaded {n}", flush=True)
            return
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--per-class', type=int, default=2400)
    args = parser.parse_args()
    (ROOT / 'data').mkdir(exist_ok=True)
    categories = json.loads((ROOT / 'categories.json').read_text())
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda category: download(category, args.per_class), categories))
