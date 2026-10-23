import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitTempo, skeleton, report } from '../cli/lib/skeleton.js';

test('skeleton: 30, 45 and 60 s land on whole bars at a tempo in the usual range', () => {
  for (const s of [30, 45, 60]) {
    const t = fitTempo(s);
    assert.ok(t.bpm >= 100 && t.bpm <= 125, `${s}s at ${t.bpm}`);
    assert.ok(Math.abs(t.length - s) < 0.05, `${s}s → ${t.length}`);
  }
  assert.equal(fitTempo(30).bpm, 120);
  assert.equal(fitTempo(60).bpm, 120);
  assert.equal(fitTempo(45).bpm, 112); // 21 bars × 240/112 = 45.0 s
});

for (const s of [30, 45, 60]) {
  test(`skeleton: the ${s} s shape — contiguous, hook within 3 s, burst at 30–60 %, held end card`, () => {
    const k = skeleton(s);
    assert.equal(k.scenes[0].start, 0);
    for (let i = 1; i < k.scenes.length; i++) assert.equal(k.scenes[i].start, k.scenes[i - 1].end, `gap before ${k.scenes[i].id}`);
    assert.ok(Math.abs(k.scenes.at(-1).end - k.length) < 1e-6);
    const by = Object.fromEntries(k.scenes.map((x) => [x.id, x]));
    assert.ok(by.hook.end <= 3.01, `hook ends at ${by.hook.end}`);
    assert.ok(by.burst.start / k.length >= 0.28 && by.burst.start / k.length <= 0.6, `burst at ${by.burst.start}`);
    assert.ok(by.mark.end - by.mark.start >= 2.5);
    assert.equal(k.marks.drop, by.drop.start);
    assert.ok(k.marks.stop < k.marks.drop && k.marks.drop - k.marks.stop <= 0.3);
    assert.equal(k.scenes.filter((x) => x.id.startsWith('highlight')).length, k.highlights);
    for (const x of k.scenes) assert.ok(x.end > x.start, `${x.id} is empty`);
  });
}

test('skeleton: films over 40 s get a small drop near a third and the big one at 70–85 %', () => {
  assert.equal(skeleton(30).marks.smallDrop, undefined);
  for (const s of [45, 60]) {
    const k = skeleton(s);
    assert.ok(k.marks.smallDrop / k.length > 0.25 && k.marks.smallDrop / k.length < 0.4, `small drop ${k.marks.smallDrop}`);
    assert.ok(k.marks.drop / k.length >= 0.68 && k.marks.drop / k.length <= 0.85, `drop ${k.marks.drop}`);
  }
});

test('skeleton: a fixed BPM is honoured, odd lengths work, nonsense is refused, the report is readable', () => {
  const k = skeleton(45, { bpm: 120 });
  assert.equal(k.bpm, 120);
  assert.equal(k.bars, 23); // 22.5 bars at 120 rounds to 23 (46 s): asking for a BPM trades exact length for the tempo
  assert.ok(skeleton(37).scenes.length >= 5);
  assert.throws(() => skeleton(3), /10–180/);
  const text = report(skeleton(60));
  assert.match(text, /60\.00 s .* 120 BPM .* 30 bars/);
  assert.match(text, /burst/);
  assert.match(text, /small drop/);
});
