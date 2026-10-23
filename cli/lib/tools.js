// Local tools: an FFmpeg that does not need Homebrew, and the PATH that finds it.
//
// Two things stopped the first real run of this project on a working Mac: Homebrew refused to
// install FFmpeg because the Command Line Tools were one version behind, and the shell's Node was
// 21. Neither is the user's fault and neither should end the session. `om setup` puts a static
// FFmpeg + ffprobe in a folder this tool owns, and every command looks there first.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, lstatSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

export const toolsDir = () => process.env.OM_TOOLS_DIR || join(homedir(), '.huashu-motion', 'tools');
export const toolsBin = () => join(toolsDir(), 'bin');

// Put our bin folder first on PATH, once, so every spawn('ffmpeg') in the CLI finds it.
export function usePrivateTools(env = process.env) {
  const bin = toolsBin();
  if (!existsSync(bin)) return false;
  const parts = (env.PATH || '').split(delimiter);
  if (parts[0] !== bin) env.PATH = [bin, ...parts.filter((p) => p !== bin)].join(delimiter);
  return true;
}

const which = (bin, env = process.env) =>
  spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore', env }).status === 0;

export const hasFfmpeg = (env = process.env) => which('ffmpeg', env) && which('ffprobe', env);

// Installs ffmpeg-static + ffprobe-static (npm packages with prebuilt binaries for macOS, Linux and
// Windows) into toolsDir and links them into toolsBin. Idempotent: a second run is a no-op.
export function setupFfmpeg({ log = () => {}, force = false, npm = 'npm' } = {}) {
  const dir = toolsDir(), bin = toolsBin();
  if (!force && hasFfmpeg()) return { installed: false, reason: 'ffmpeg and ffprobe are already on PATH' };
  mkdirSync(bin, { recursive: true });
  if (!existsSync(join(dir, 'package.json'))) writeFileSync(join(dir, 'package.json'), '{ "name": "om-tools", "private": true }\n');
  log(`setup    installing ffmpeg-static and ffprobe-static into ${dir}`);
  const r = spawnSync(npm, ['install', '--no-audit', '--no-fund', '--foreground-scripts', 'ffmpeg-static@5', 'ffprobe-static@3'], { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`npm install failed in ${dir}:\n${(r.stderr || r.stdout || '').trim().split('\n').slice(-6).join('\n')}`);
  const ext = process.platform === 'win32' ? '.exe' : '';
  let ffmpeg = join(dir, 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`);
  // Some npm setups skip install scripts; ffmpeg-static downloads its binary in one. Run it ourselves.
  if (!existsSync(ffmpeg)) {
    log('setup    running ffmpeg-static\'s download step (npm skipped install scripts)');
    spawnSync(process.execPath, [join(dir, 'node_modules', 'ffmpeg-static', 'install.js')], { cwd: join(dir, 'node_modules', 'ffmpeg-static'), stdio: 'ignore' });
  }
  if (!existsSync(ffmpeg)) throw new Error('ffmpeg-static did not produce a binary — install FFmpeg another way (https://ffmpeg.org/download.html)');
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const plat = process.platform === 'win32' ? 'win32' : process.platform;
  const ffprobe = join(dir, 'node_modules', 'ffprobe-static', 'bin', plat, arch, `ffprobe${ext}`);
  if (!existsSync(ffprobe)) throw new Error(`ffprobe-static has no binary for ${plat}/${arch}`);
  link(ffmpeg, join(bin, `ffmpeg${ext}`));
  link(ffprobe, join(bin, `ffprobe${ext}`));
  usePrivateTools();
  return { installed: true, bin, ffmpeg: join(bin, `ffmpeg${ext}`), ffprobe: join(bin, `ffprobe${ext}`) };
}

function link(target, path) {
  try { if (lstatSync(path)) unlinkSync(path); } catch { /* not there yet */ }
  try { symlinkSync(target, path); }
  catch { // Windows without symlink rights: a copy works just as well
    spawnSync(process.platform === 'win32' ? 'cmd' : 'cp', process.platform === 'win32' ? ['/c', 'copy', target, path] : [target, path]);
  }
}

// Newest installed Node ≥ min from the usual version managers, for the bin/om launcher's hint and tests.
export function findNode(min = 22, home = homedir()) {
  const roots = [
    [join(home, '.nvm', 'versions', 'node'), (v) => join(v, 'bin', 'node')],
    [join(home, '.local', 'share', 'fnm', 'node-versions'), (v) => join(v, 'installation', 'bin', 'node')],
    [join(home, '.volta', 'tools', 'image', 'node'), (v) => join(v, 'bin', 'node')],
  ];
  const found = [];
  for (const [root, exe] of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(name);
      if (!m || Number(m[1]) < min) continue;
      const path = exe(join(root, name));
      if (existsSync(path)) found.push({ version: m.slice(1).map(Number), path });
    }
  }
  found.sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2]);
  return found[0]?.path || null;
}
