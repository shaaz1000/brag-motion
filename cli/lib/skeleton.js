// om skeleton — the shape of a 30 s, 45 s or 60 s film before a single frame is built.
//
// Length is a creative choice with mechanical consequences: how many bars, at what tempo, where the
// hook, the burst, the stop and the drop fall, how long the end card holds. Getting these on the
// grid first is what lets the score land exactly on the picture (0 % bend) and keeps a longer film
// from turning into one long plateau. The rules come from references/rhythm.md: hook within 3 s, a
// burst at 30–60 %, the climax at 70–85 % for films over 30 s, a second, smaller drop near a third
// for films over 40 s, and a held end card.
import { OmError } from './project.js';

export const PRESETS = {
  30: { highlights: 2, label: 'launch sting+: hook, the product doing its thing, one burst, the hero moment, the mark' },
  45: { highlights: 3, label: 'launch film: a small drop at a third, a burst, the big drop, proof, the mark' },
  60: { highlights: 4, label: 'full story: problem → product → burst → big drop → proof → mark, two drops' },
};

// The BPM in the usual 100–125 range whose whole bars land closest to the length; ties go to 120.
export function fitTempo(seconds, { min = 100, max = 125, beatsPerBar = 4 } = {}) {
  let best = null;
  for (let bpm = min; bpm <= max; bpm++) {
    const barSec = (60 / bpm) * beatsPerBar;
    const bars = Math.max(1, Math.round(seconds / barSec));
    const err = Math.abs(bars * barSec - seconds);
    const score = err + Math.abs(bpm - 120) * 0.0005;
    if (!best || score < best.score) best = { bpm, bars, barSec, length: bars * barSec, err, score };
  }
  return { bpm: best.bpm, bars: best.bars, barSec: best.barSec, length: +best.length.toFixed(3) };
}

export function skeleton(seconds, { bpm = null, highlights = null } = {}) {
  const s = Number(seconds);
  if (!(s >= 10 && s <= 180)) throw new OmError('--length is the film length in seconds, 10–180 (30, 45 and 60 have presets)');
  const preset = PRESETS[Math.round(s)] || { highlights: s < 38 ? 2 : s < 53 ? 3 : 4, label: 'custom length' };
  const tempo = bpm ? (() => { const barSec = 240 / Number(bpm); const bars = Math.max(1, Math.round(s / barSec)); return { bpm: Number(bpm), bars, barSec, length: +(bars * barSec).toFixed(3) }; })() : fitTempo(s);
  const B = tempo.bars, beat = 60 / tempo.bpm;
  const at = (frac) => Math.round(frac * B); // a fraction of the film, snapped to a bar line
  const n = highlights ?? preset.highlights;
  const twoDrops = tempo.length >= 40;

  // Bar lines of the sections. The end card always gets ≥ 2.5 s and ≥ 8 % of the film.
  const markBars = Math.max(Math.ceil(2.5 / tempo.barSec), Math.round(B * 0.08), 1);
  const markAt = B - markBars;
  const hookEnd = Math.max(1, Math.min(at(0.08), Math.floor(3 / tempo.barSec) || 1));
  const dropAt = Math.min(markAt - 2, Math.max(at(twoDrops ? 0.72 : 0.5), hookEnd + 3));
  const smallDrop = twoDrops ? Math.max(hookEnd + Math.ceil(n / 2), at(0.30)) : null;
  // the burst is short — 5–8 cuts in a few seconds — and on a short film it runs straight into the drop
  const burstAt = Math.max((smallDrop ?? hookEnd) + (twoDrops ? n - Math.ceil(n / 2) : n), at(twoDrops ? 0.48 : 0.36));
  const burstEnd = twoDrops ? Math.min(dropAt, burstAt + Math.max(2, Math.round(B * 0.12))) : dropAt;

  const scenes = [];
  const add = (id, from, to, what, energy, events) => { if (to > from) scenes.push({ id, bars: [from + 1, to], start: +(from * tempo.barSec).toFixed(3), end: +(to * tempo.barSec).toFixed(3), what, energy, eventsPerBar: events }); };
  // n highlights spread over [from, to), each at least one bar
  const spread = (from, to, count, first, label, energy0, events) => {
    for (let i = 0; i < count; i++) {
      const a = from + Math.round((i * (to - from)) / count), b = i === count - 1 ? to : from + Math.round(((i + 1) * (to - from)) / count);
      add(`highlight-${first + i}`, a, b, label(i), energy0 + i, events);
    }
  };
  add('hook', 0, hookEnd, 'frame 1 already moves; the one image or line that makes a stranger stay', 7, '3–4');
  if (twoDrops) {
    const k1 = Math.ceil(n / 2);
    spread(hookEnd, smallDrop, k1, 1, (i) => (i === 0 ? 'entry: the product in use, its real UI' : 'the next capability, carried from the last by one shared object'), 5, '2–4');
    spread(smallDrop, burstAt, n - k1, k1 + 1, (i) => (i === 0 ? 'small drop: a lift a third in — new texture, the camera starts travelling' : 'the next capability'), 6, '3–4');
  } else {
    spread(hookEnd, burstAt, n, 1, (i) => (i === 0 ? 'entry: the product in use, its real UI' : 'the next capability, carried from the last by one shared object'), 5, '2–4');
  }
  add('burst', burstAt, burstEnd, 'montage: cuts on every beat, then half-beats — the breadth of the product in one breath' + (burstEnd === dropAt ? '; last half-beat silent (the stop)' : ''), 9, '4–8');
  add('build', burstEnd, dropAt, 'build to the drop: one idea carried forward, the filter opens, a riser; last half-beat silent (the stop)', 7, '2–3');
  add('drop', dropAt, Math.min(dropAt + Math.max(1, Math.round(B * 0.12)), markAt), 'the hero moment on the strongest beat: the one thing this film is about (impact + subdrop)', 10, '2–3');
  add('proof', scenes[scenes.length - 1].bars[1], markAt, 'payoff: the result, a number with a source, the claim', 7, '2');
  add('mark', markAt, B, 'the logo and one line, held — every frame a poster', 3, '1');

  const marks = {
    stop: +(dropAt * tempo.barSec - beat / 2).toFixed(3),
    drop: +(dropAt * tempo.barSec).toFixed(3),
    ...(smallDrop != null ? { smallDrop: +(smallDrop * tempo.barSec).toFixed(3) } : {}),
  };
  return { length: tempo.length, requested: s, bpm: tempo.bpm, bars: B, barSeconds: +tempo.barSec.toFixed(4), preset: preset.label, highlights: n, scenes, marks };
}

export function report(k) {
  const pct = (t) => `${Math.round((t / k.length) * 100)}%`;
  const lines = [
    `skeleton ${k.length.toFixed(2)} s (asked ${k.requested} s) · ${k.bpm} BPM · ${k.bars} bars of ${k.barSeconds.toFixed(2)} s — ${k.preset}`,
    `         score: Q:1/4=${k.bpm}, ${k.bars} bars of 4/4; in the film OM.music({ bpm: ${k.bpm} }) and scene labels on OM.beat(4 × bar)`,
    '',
    'scene         bars     time            energy  events/bar  what',
  ];
  for (const sc of k.scenes) lines.push(`${sc.id.padEnd(13)} ${`${sc.bars[0]}–${sc.bars[1]}`.padEnd(8)} ${`${sc.start.toFixed(1)}–${sc.end.toFixed(1)} s`.padEnd(15)} ${String(sc.energy).padEnd(7)} ${sc.eventsPerBar.padEnd(11)} ${sc.what}`);
  lines.push('', `marks    ${k.marks.smallDrop != null ? `small drop ${k.marks.smallDrop} s (${pct(k.marks.smallDrop)}) · ` : ''}stop ${k.marks.stop} s · drop ${k.marks.drop} s (${pct(k.marks.drop)})`);
  return lines.join('\n');
}
