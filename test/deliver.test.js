import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openProject } from '../cli/lib/project.js';
import { deliver, pickPoster, probe } from '../cli/lib/deliver.js';
import { usePrivateTools } from '../cli/lib/tools.js';

usePrivateTools();
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const skip = !HAS_FFMPEG && 'no ffmpeg';
const ff = (...a) => assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', ...a]).status, 0, a.join(' '));

// A 6 s film: a moving test pattern everywhere except 3.0–4.0 s, where a still, busy card holds.
function film(withAudio = true) {
  const dir = mkdtempSync(join(tmpdir(), 'om-deliver-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><div data-composition-id="f" data-width="320" data-height="180"></div>');
  mkdirSync(join(dir, 'out'));
  const moving = join(dir, 'moving.mp4'), card = join(dir, 'card.mp4'), out = join(dir, 'out', 'film-v1.mp4');
  ff('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=6', '-pix_fmt', 'yuv420p', moving);
  ff('-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=1:duration=1', '-frames:v', '1', join(dir, 'card.png'));
  ff('-loop', '1', '-i', join(dir, 'card.png'), '-t', '1', '-r', '30', '-pix_fmt', 'yuv420p', card);
  const audio = withAudio ? ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=6'] : [];
  ff('-i', moving, '-i', card, ...audio, '-filter_complex', "[1:v]setpts=PTS+3/TB[c];[0:v][c]overlay=enable='between(t,3,4)'[v]", '-map', '[v]', ...(withAudio ? ['-map', '2:a', '-c:a', 'aac'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-t', '6', out);
  return { project: openProject(dir), out, dir };
}

test('deliver: the poster is the settled stretch, not a moving frame', { skip }, () => {
  const { out } = film(false);
  const p = pickPoster(out);
  assert.ok(p.at >= 3 && p.at <= 4, `picked ${p.at}`);
});

test('deliver: frame 0 becomes the poster, length and audio unchanged, share copy and collection folder', { skip }, () => {
  const { project, out, dir } = film(true);
  writeFileSync(join(dir, 'share-copy.txt'), 'One line, postable as is.\n');
  const to = join(dir, 'collected');
  const r = deliver(project, { to });
  const before = probe(out), after = probe(r.video);
  assert.ok(Math.abs(after.duration - before.duration) < 0.05, `${before.duration} → ${after.duration}`);
  assert.equal(after.hasAudio, true);
  assert.ok(existsSync(r.poster));
  assert.equal(readFileSync(r.share, 'utf8'), 'One line, postable as is.\n');
  // frame 0 of the delivered film looks like the poster, not like the render's first frame
  const grab = (file, extra = []) => spawnSync('ffmpeg', ['-v', 'error', '-i', file, ...extra, '-frames:v', '1', '-vf', 'scale=32:18,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 }).stdout;
  const diff = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length;
  const poster = grab(r.poster), first = grab(r.video), original = grab(out);
  assert.ok(diff(first, poster) < diff(original, poster), 'frame 0 was replaced by the poster');
  assert.ok(diff(grab(r.video, ['-ss', '2']), grab(out, ['-ss', '2'])) < 6, 'later frames are the render\'s');
  assert.deepEqual(r.collected.map((f) => f.split('/').pop()).sort(), ['film-v1-share.txt', 'film-v1.jpg', 'film-v1.mp4']);
});

test('deliver: --at is honoured and checked against the length; no render is a clear error', { skip }, () => {
  const { project } = film(false);
  assert.equal(deliver(project, { at: 1.5, copy: 'x' }).at, 1.5);
  assert.throws(() => deliver(project, { at: 99 }), /outside the film/);
  const empty = mkdtempSync(join(tmpdir(), 'om-deliver-'));
  writeFileSync(join(empty, 'index.html'), '<!doctype html>');
  assert.throws(() => deliver(openProject(empty)), /render first/);
});

test('deliver: text still being typed is not "settled"; --video-only collects just the film', { skip }, () => {
  // 8 s: a busy still card 1–3 s that changes a little every 0.3 s (typing), then a card that truly holds 5–7 s
  const dir = mkdtempSync(join(tmpdir(), 'om-deliver-typing-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html>');
  mkdirSync(join(dir, 'out'));
  const out = join(dir, 'out', 'film.mp4');
  ff('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=8', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30:duration=8',
    '-filter_complex', "[1:v]trim=0:0.04,loop=-1:1:0,setpts=N/30/TB[hold];[0:v][hold]overlay=enable='between(t,1,3)+between(t,5,7)'[a];[a]drawbox=x='mod(floor(t/0.3)*24,300)':y=150:w=20:h=20:color=white:t=fill:enable='between(t,1,3)'[v]",
    '-map', '[v]', '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out);
  const p = pickPoster(out, { from: 0.05, to: 0.95 });
  assert.ok(p.at >= 5 && p.at <= 7, `picked ${p.at} (typing stretch is 1–3 s)`);
  const r = deliver(openProject(dir), { to: join(dir, 'videos'), videoOnly: true, copy: 'x' });
  assert.deepEqual(r.collected.map((f) => f.split('/').pop()), ['film.mp4']);
});
