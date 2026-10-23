// om deliver — the last step of a launch film, as one command.
//
// From /brag's delivery rules: pick the strongest *settled* frame as the poster (not an arbitrary
// one, not mid-transition), bake it in as frame 0 so every platform's idle thumbnail shows it
// (replace the frame, never add one, so duration and audio sync stay exact), and hand the
// share copy over next to the video. Optionally copy all of it into one collection folder.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { OmError } from './project.js';

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: opts.binary ? 'buffer' : 'utf8', maxBuffer: 256 << 20, ...opts });

export function latestRender(root) {
  const dir = join(root, 'out');
  if (!existsSync(dir)) return null;
  const vids = readdirSync(dir).filter((f) => /\.(mp4|mov|webm)$/i.test(f)).map((f) => join(dir, f)).filter((f) => statSync(f).isFile());
  return vids.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || null;
}

export function probe(file) {
  const r = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', file]);
  if (r.status !== 0) throw new OmError(`cannot read ${file}: ${(r.stderr || '').trim().split('\n').pop()}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new OmError(`${file} has no video stream`);
  const [n, d] = String(v.r_frame_rate || '30/1').split('/').map(Number);
  return { duration: Number(j.format.duration) || 0, width: v.width, height: v.height, fps: d ? n / d : 30, hasAudio: j.streams.some((s) => s.codec_type === 'audio') };
}

// Tiny greyscale thumbnails of the whole film, one per step: enough to tell still from moving and
// busy from blank, cheap enough to decode the full length.
function thumbs(file, step, w = 64, h = 36) {
  const r = sh('ffmpeg', ['-v', 'error', '-nostdin', '-i', file, '-vf', `fps=1/${step},scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-'], { binary: true });
  if (r.status !== 0) throw new OmError(`ffmpeg could not read ${file}`);
  const size = w * h, out = [];
  for (let i = 0; i + size <= r.stdout.length; i += size) out.push(r.stdout.subarray(i, i + size));
  return out;
}

const meanAbs = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const spread = (a) => { let m = 0; for (const x of a) m += x; m /= a.length; let v = 0; for (const x of a) v += (x - m) ** 2; return Math.sqrt(v / a.length); };

// The poster: in the body of the film (not the hook still building, not the end card), the frame that
// has stayed settled the longest while carrying the most picture. "Settled" is judged over a window of
// about ±0.4 s, so text being typed or a counter still running never counts as still between two
// samples. Picture = contrast, so a blank or faded frame never wins. Later frames win ties: the hero
// moment usually sits after the drop.
export function pickPoster(file, { duration, from = 0.35, to = 0.9, step, window = 0.4 } = {}) {
  const d = duration ?? probe(file).duration;
  const s = step ?? Math.max(0.1, Math.min(0.25, d / 120));
  const t = thumbs(file, s);
  if (t.length < 3) return { at: d / 2, reason: 'too short to choose — middle frame' };
  const k = Math.max(1, Math.round(window / s));
  const lo = Math.max(k, Math.floor((from * d) / s)), hi = Math.min(t.length - 1 - k, Math.ceil((to * d) / s));
  const step1 = t.map((_, i) => (i ? meanAbs(t[i - 1], t[i]) : 0));
  const contrast = t.map(spread);
  const busy = [...contrast].sort((a, b) => a - b)[Math.floor(contrast.length / 2)]; // median picture
  let best = null;
  for (let i = lo; i <= hi; i++) {
    if (contrast[i] < busy * 0.6) continue; // fades, flashes, empty frames
    let motion = 0;
    for (let j = i - k + 1; j <= i + k; j++) motion += step1[j];
    const score = motion - contrast[i] * 0.02 - (i / t.length) * 0.05;
    if (!best || score <= best.score) best = { i, score, motion, contrast: contrast[i] };
  }
  if (!best) return { at: d / 2, reason: 'no settled frame with enough picture — middle frame' };
  // ffmpeg's fps filter centres each sample in its interval
  return { at: Math.min(d - 0.05, (best.i + 0.5) * s), reason: `settled for ±${window}s (motion ${best.motion.toFixed(2)}) with contrast ${best.contrast.toFixed(1)}` };
}

export function deliver(project, { at = null, file = null, to = null, name = null, copy = null, videoOnly = false, log = () => {} } = {}) {
  const video = file ? resolve(file) : latestRender(project.root);
  if (!video || !existsSync(video)) throw new OmError(`nothing to deliver — render first (om render ${project.root})`);
  const info = probe(video);
  const pick = at != null ? { at: Number(at), reason: 'chosen with --at' } : pickPoster(video, { duration: info.duration });
  if (!(pick.at >= 0 && pick.at < info.duration)) throw new OmError(`--at ${at} is outside the film (0–${info.duration.toFixed(2)} s)`);

  const stem = name || basename(video, extname(video));
  const outDir = join(project.root, 'out', 'deliver');
  mkdirSync(outDir, { recursive: true });
  const poster = join(outDir, `${stem}.jpg`), final = join(outDir, `${stem}.mp4`), share = join(outDir, `${stem}-share.txt`);

  let r = sh('ffmpeg', ['-v', 'error', '-y', '-nostdin', '-ss', pick.at.toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '2', poster]);
  if (r.status !== 0 || !existsSync(poster)) throw new OmError(`could not grab the poster frame: ${(r.stderr || '').trim()}`);
  log(`poster   ${pick.at.toFixed(2)} s — ${pick.reason}`);

  // Frame 0 becomes the poster: overlay it on the first frame only, keep every other frame and the
  // audio untouched (stream-copied), so length and sync are exactly the render's.
  r = sh('ffmpeg', ['-v', 'error', '-y', '-nostdin', '-i', video, '-i', poster,
    '-filter_complex', `[1:v]scale=${info.width}:${info.height},setsar=1[p];[0:v][p]overlay=0:0:enable='eq(n\\,0)'[v]`,
    '-map', '[v]', ...(info.hasAudio ? ['-map', '0:a', '-c:a', 'copy'] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final]);
  if (r.status !== 0) throw new OmError(`could not bake the poster into frame 0: ${(r.stderr || '').trim().split('\n').pop()}`);
  const after = probe(final);
  if (Math.abs(after.duration - info.duration) > 1 / info.fps + 0.02) throw new OmError(`baked video is ${after.duration}s, the render was ${info.duration}s — not delivering a film that changed length`);

  // Share copy: --copy text, else share-copy.txt in the project (written by the agent while planning).
  const own = join(project.root, 'share-copy.txt');
  const text = copy ?? (existsSync(own) ? readFileSync(own, 'utf8').trim() : null);
  if (text) writeFileSync(share, text.trim() + '\n');

  const files = [final, poster, ...(text ? [share] : [])];
  let collected = [];
  if (to) {
    const dest = resolve(to);
    mkdirSync(dest, { recursive: true });
    collected = (videoOnly ? [final] : files).map((f) => { const d = join(dest, basename(f)); copyFileSync(f, d); return d; });
  }
  return { video: final, poster, share: text ? share : null, at: pick.at, reason: pick.reason, duration: info.duration, collected };
}
