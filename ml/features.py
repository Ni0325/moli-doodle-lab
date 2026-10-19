"""Deterministic stroke-to-image preprocessing shared with dist/features.js.

Normalize the bounding box into a centered 22-pixel square. Rasterize each
segment by its distance to pixel centers. No UI decoration enters this data.
"""
import numpy as np

SIZE = 28


def rasterize(strokes):
    output = np.zeros((SIZE, SIZE), dtype=np.float32)
    valid = [np.asarray(s, dtype=np.float32) for s in strokes if len(s)]
    if not valid:
        return output.ravel()
    points = np.concatenate(valid)
    minimum, maximum = points.min(axis=0), points.max(axis=0)
    span = maximum - minimum
    if float(span.max()) < 0.001:
        return output.ravel()
    scale = 21.0 / float(span.max())
    offset = (27.0 - span * scale) / 2
    for stroke in valid:
        normalized = (stroke - minimum) * scale + offset
        for start, end in zip(normalized[:-1], normalized[1:]):
            low = np.maximum(0, np.floor(np.minimum(start, end) - 1.4).astype(int))
            high = np.minimum(27, np.ceil(np.maximum(start, end) + 1.4).astype(int))
            if (high < low).any():
                continue
            y, x = np.mgrid[low[1]:high[1]+1, low[0]:high[0]+1]
            delta = end - start
            denominator = float(delta @ delta)
            t = np.clip(((x-start[0])*delta[0]+(y-start[1])*delta[1]) / max(denominator, 1e-8), 0, 1)
            distance = np.sqrt((x-start[0]-t*delta[0])**2 + (y-start[1]-t*delta[1])**2)
            coverage = np.clip(1.35-distance, 0, 1)
            target = output[low[1]:high[1]+1, low[0]:high[0]+1]
            np.maximum(target, coverage, out=target)
    return output.ravel()


def unpack(drawing):
    return [list(map(list, zip(stroke[0], stroke[1]))) for stroke in drawing if len(stroke[0]) >= 2]


def prefix(strokes, fraction):
    budget = max(2, int(sum(len(s) for s in strokes) * fraction))
    result = []
    for stroke in strokes:
        take = min(budget, len(stroke))
        if take >= 2:
            result.append(stroke[:take])
        budget -= take
        if budget <= 0:
            break
    return result
