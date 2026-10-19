import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rasterize,inkLength} from '../dist/features.js';
import {DoodleModel} from '../dist/model.js';
import {sampleStrokes} from '../dist/particles.js';
const metadata=JSON.parse(fs.readFileSync(new URL('../dist/assets/model.json',import.meta.url)));
const buffer=fs.readFileSync(new URL('../dist/assets/weights.bin',import.meta.url));
const model=new DoodleModel(metadata,buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url)));

test('Particles preserve pen-up gaps and do not mutate recognition input',()=>{
  const strokes=[[[0,0],[20,0]],[[100,100],[120,100]]],before=JSON.stringify(strokes);
  const points=sampleStrokes(strokes);
  assert.ok(points.length>0);
  for(const [x,y] of points)assert.ok((y===0&&x>=0&&x<=20)||(y===100&&x>=100&&x<=120));
  assert.equal(JSON.stringify(strokes),before);
  assert.deepEqual(sampleStrokes([[[1,1],[1,1]]]),[]);
});
test('Particle count stays bounded for complex drawings',()=>{
  const points=sampleStrokes([Array.from({length:6000},(_,i)=>[i%2*600,i])]);
  assert.equal(points.length,1400);
  assert.ok(points.every(point=>point.every(Number.isFinite)));
});

test('Python and JavaScript preprocessing agree on held-out drawings',()=>{
  for(const fixture of fixtures) {
    const pixels=rasterize(fixture.strokes);
    const error=Math.max(...pixels.map((v,i)=>Math.abs(v-fixture.pixels[i])));
    assert.ok(error<.00002,`pixel difference ${error}`);
  }
});
test('Exported browser model agrees with Python predictions',()=>{
  for(const fixture of fixtures) {
    const result=model.predict(rasterize(fixture.strokes));
    const error=Math.max(...result.map((v,i)=>Math.abs(v-fixture.probabilities[i])));
    assert.ok(error<.0001,`prediction difference ${error}`);
    assert.ok(Math.abs(result.reduce((a,b)=>a+b,0)-1)<1e-6);
  }
});
test('Translation and uniform scale do not change normalized input',()=>{
  for(const fixture of fixtures.slice(0,3)) {
    const original=rasterize(fixture.strokes);
    const transformed=rasterize(fixture.strokes.map(s=>s.map(([x,y])=>[x*2.7+81,y*2.7-14])));
    assert.ok(Math.max(...original.map((v,i)=>Math.abs(v-transformed[i])))<1e-5);
  }
});
test('Empty and single-point strokes produce no artificial drawing',()=>{
  assert.equal(rasterize([]).reduce((a,b)=>a+b,0),0);
  assert.equal(rasterize([[[20,20]]]).reduce((a,b)=>a+b,0),0);
  assert.equal(inkLength([[[2,3]]]),0);
});
test('Dataset split IDs do not leak between train, validation, and test',()=>{
  const split=JSON.parse(fs.readFileSync(new URL('../ml/split_ids.json',import.meta.url)));
  const train=new Set(),val=new Set(),heldout=new Set();
  for(const group of Object.values(split)) {
    group.train.forEach(id=>train.add(id));group.validation.forEach(id=>val.add(id));group.test.forEach(id=>heldout.add(id));
  }
  assert.equal(train.size,23040);assert.equal(val.size,2880);assert.equal(heldout.size,2880);
  for(const id of heldout){assert.ok(!train.has(id));assert.ok(!val.has(id));}
  for(const id of val)assert.ok(!train.has(id));
});
