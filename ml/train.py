"""Train an actual, small MLP from QuickDraw strokes, using only NumPy.

Raw drawing IDs are split before prefix augmentation. Validation selects the
checkpoint; held-out test drawings are evaluated only after training.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor
import json
import os
from pathlib import Path
import time
import numpy as np
from features import rasterize, unpack, prefix

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT.parent / 'dist' / 'assets'


def prepare_class(task):
    index, category, seed = task
    rng = np.random.default_rng(seed + index)
    rows = [json.loads(line) for line in (ROOT / 'data' / (category['id'].replace(' ', '_') + '.ndjson')).read_text().splitlines()]
    rows = list({r['id']: r for r in rows}.values())
    rng.shuffle(rows)
    a, b = int(len(rows)*.8), int(len(rows)*.9)
    parts = [rows[:a], rows[a:b], rows[b:]]
    matrices, labels = [], []
    for split, group in enumerate(parts):
        images = []
        for number, row in enumerate(group):
            strokes = unpack(row['drawing'])
            images.append(rasterize(strokes))
            if split == 0 and number % 4 == 0:
                images.append(rasterize(prefix(strokes, float(rng.uniform(.55, .9)))))
        matrices.append(np.stack(images))
        labels.append(np.full(len(images), index, dtype=np.int64))
    print(f"Prepared {category['id']}: {len(rows)} drawings", flush=True)
    return matrices, labels, parts


def softmax(logits):
    exp = np.exp(logits - logits.max(axis=1, keepdims=True))
    return exp / exp.sum(axis=1, keepdims=True)


def forward(x, weights):
    h1 = np.maximum(x @ weights[0] + weights[1], 0)
    h2 = np.maximum(h1 @ weights[2] + weights[3], 0)
    return softmax(h2 @ weights[4] + weights[5]), h1, h2


def accuracy(x, y, weights):
    probability = forward(x, weights)[0]
    return float(np.mean(probability.argmax(1) == y))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=28)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    start = time.time()
    ASSETS.mkdir(exist_ok=True)
    cats = json.loads((ROOT / 'categories.json').read_text())
    cache = ROOT / 'features-v1.npz'
    records_file = ROOT / 'records-v1.json'
    cache_meta = ROOT / 'features-v1.meta.json'
    config = {'seed':args.seed, 'preprocessing_version':1, 'sources':[
        [c['id'],(ROOT/'data'/(c['id'].replace(' ','_')+'.ndjson')).stat().st_size,
        (ROOT/'data'/(c['id'].replace(' ','_')+'.ndjson')).stat().st_mtime_ns] for c in cats]}
    if cache.exists() and records_file.exists() and cache_meta.exists() and json.loads(cache_meta.read_text())==config:
        loaded = np.load(cache)
        arrays = [loaded[key] for key in ['train_x','train_y','val_x','val_y','test_x','test_y']]
        records = json.loads(records_file.read_text())
    else:
        with ProcessPoolExecutor(max_workers=min(4, os.cpu_count() or 1)) as pool:
            prepared = list(pool.map(prepare_class, [(i, c, args.seed) for i, c in enumerate(cats)]))
        arrays = []
        for split in range(3):
            arrays.extend([np.concatenate([item[0][split] for item in prepared]), np.concatenate([item[1][split] for item in prepared])])
        records = [item[2] for item in prepared]
        np.savez_compressed(cache, **dict(zip(['train_x','train_y','val_x','val_y','test_x','test_y'], arrays)))
        records_file.write_text(json.dumps(records, separators=(',', ':')))
        cache_meta.write_text(json.dumps(config))
    x, y, vx, vy, tx, ty = arrays
    print(f'Train {len(x)}, validation {len(vx)}, test {len(tx)}', flush=True)
    rng = np.random.default_rng(args.seed)
    dimensions = [784, 128, 64, len(cats)]
    weights = []
    for n_in, n_out in zip(dimensions[:-1], dimensions[1:]):
        weights.extend([(rng.standard_normal((n_in, n_out))*np.sqrt(2/n_in)).astype(np.float32), np.zeros(n_out, np.float32)])
    moments = [np.zeros_like(w) for w in weights]
    velocities = [np.zeros_like(w) for w in weights]
    best, stale, step = -1., 0, 0
    history = []
    for epoch in range(args.epochs):
        order = rng.permutation(len(x))
        loss_sum = 0.
        learning_rate = .0012 if epoch < 16 else .0005
        for pos in range(0, len(x), 128):
            indices = order[pos:pos+128]
            xb, yb = x[indices], y[indices]
            probability, h1, h2 = forward(xb, weights)
            loss_sum += float(-np.log(probability[np.arange(len(yb)),yb] + 1e-9).sum())
            dz = probability.copy()
            dz[np.arange(len(yb)), yb] -= 1
            dz /= len(yb)
            d2 = (dz @ weights[4].T) * (h2 > 0)
            d1 = (d2 @ weights[2].T) * (h1 > 0)
            gradients = [xb.T @ d1 + .0001*weights[0], d1.sum(0), h1.T @ d2 + .0001*weights[2], d2.sum(0), h2.T @ dz + .0001*weights[4], dz.sum(0)]
            step += 1
            for k, gradient in enumerate(gradients):
                moments[k] = .9*moments[k] + .1*gradient
                velocities[k] = .999*velocities[k] + .001*gradient**2
                weights[k] -= learning_rate * (moments[k]/(1-.9**step)) / (np.sqrt(velocities[k]/(1-.999**step)) + 1e-8)
        val_accuracy = accuracy(vx, vy, weights)
        item = {'epoch':epoch+1,'loss':loss_sum/len(x),'validation_accuracy':val_accuracy}
        history.append(item)
        print(json.dumps(item), flush=True)
        if val_accuracy > best:
            best, stale = val_accuracy, 0
            checkpoint = [w.copy() for w in weights]
            best_epoch = epoch+1
        else:
            stale += 1
            if stale >= 7:
                break
    weights = checkpoint
    probabilities = forward(tx, weights)[0]
    predicted = probabilities.argmax(1)
    confusion = np.zeros((len(cats),len(cats)), int)
    np.add.at(confusion, (ty, predicted), 1)
    top3 = np.argsort(probabilities,axis=1)[:,-3:]
    stats = {
        'model':'MLP 784-128-64-12', 'seed':args.seed, 'best_epoch':best_epoch,
        'source':'Google Quick, Draw! simplified stroke data',
        'source_url':'https://github.com/googlecreativelab/quickdraw-dataset',
        'license':'CC BY 4.0',
        'sampling':'First 2400 recognized drawings per class, shuffled with a fixed seed; not a representative estimate of all user drawings.',
        'train_original':sum(len(r[0]) for r in records), 'train_with_prefix_augmentation':len(x),
        'validation_count':len(vx), 'test_count':len(tx),
        'test_accuracy':float(np.mean(predicted==ty)),
        'test_top3_accuracy':float(np.mean(np.any(top3==ty[:,None],axis=1))),
        'validation_accuracy':best,
        'classes':[dict(c,train=len(r[0]),validation=len(r[1]),test=len(r[2]),test_accuracy=float(confusion[i,i]/confusion[i].sum())) for i,(c,r) in enumerate(zip(cats,records))],
        'confusion_matrix':confusion.tolist(),'history':history,
        'elapsed_seconds':round(time.time()-start,1),
        'limitations':['Only the listed 12 classes are supported.','Softmax scores are not calibrated probabilities of correctness.','Complete recognized dataset drawings differ from incomplete freehand drawings.','No reliable out-of-distribution detection is claimed.']
    }
    counts = []
    flattened = []
    for i,w in enumerate(weights):
        # Store dense matrices output-major for efficient JavaScript inference.
        data = w.T.ravel() if w.ndim==2 else w.ravel()
        counts.append(len(data))
        flattened.append(data)
    np.concatenate(flattened).astype('<f4').tofile(ASSETS / 'weights.bin')
    metadata = {'version':1,'architecture':dimensions,'weight_sizes':counts,'classes':cats,'preprocessing':'stroke-distance-v1','weights':'weights.bin','test_accuracy':stats['test_accuracy'],'test_count':len(tx)}
    (ASSETS/'model.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
    (ASSETS/'metrics.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
    examples, failures, fixtures = [], [], []
    offset = 0
    for c, group in zip(cats,records):
        examples.append({'category':c['id'],'name':c['name'],'id':group[2][0]['id'],'strokes':unpack(group[2][0]['drawing'])})
        for local,row in enumerate(group[2]):
            index = offset+local
            if predicted[index] != ty[index] and sum(f['expected']==c['name'] for f in failures)<2:
                failures.append({'id':row['id'],'expected':c['name'],'predicted':cats[int(predicted[index])]['name'],'score':float(probabilities[index,predicted[index]]),'strokes':unpack(row['drawing'])})
        fixtures.append({'strokes':unpack(group[2][0]['drawing']),'pixels':tx[offset].tolist(),'probabilities':probabilities[offset].tolist()})
        offset += len(group[2])
    (ASSETS/'examples.json').write_text(json.dumps(examples,ensure_ascii=False,separators=(',',':')))
    (ASSETS/'failures.json').write_text(json.dumps(failures,ensure_ascii=False,separators=(',',':')))
    (ROOT.parent/'tests'/'fixtures.json').write_text(json.dumps(fixtures,separators=(',',':')))
    (ROOT/'split_ids.json').write_text(json.dumps({c['id']:{name:[row['id'] for row in part] for name,part in zip(['train','validation','test'],group)} for c,group in zip(cats,records)},separators=(',',':')))
    print(f"DONE test accuracy={stats['test_accuracy']:.4f}, top3={stats['test_top3_accuracy']:.4f}, elapsed={stats['elapsed_seconds']}s",flush=True)


if __name__ == '__main__':
    main()
