import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { findNode, setupFfmpeg, toolsBin, usePrivateTools } from '../cli/lib/tools.js';

usePrivateTools();
const systemNode22 = ['/opt/homebrew/bin/node', '/usr/local/bin/node'].some((n) => Number(spawnSync(n, ['-p', 'process.versions.node.split(".")[0]'], { encoding: 'utf8' }).stdout) >= 22);

test('tools: the private bin folder goes first on PATH, once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'om-tools-'));
  process.env.OM_TOOLS_DIR = dir;
  try {
    const env = { PATH: ['/usr/bin', '/bin'].join(delimiter) };
    assert.equal(usePrivateTools(env), false, 'no bin folder yet: PATH untouched');
    assert.equal(env.PATH, ['/usr/bin', '/bin'].join(delimiter));
    mkdirSync(toolsBin(), { recursive: true });
    assert.equal(usePrivateTools(env), true);
    usePrivateTools(env);
    assert.deepEqual(env.PATH.split(delimiter), [toolsBin(), '/usr/bin', '/bin']);
  } finally { delete process.env.OM_TOOLS_DIR; }
});

test('tools: findNode picks the newest ≥22 from nvm, fnm and Volta and ignores older ones', () => {
  const home = mkdtempSync(join(tmpdir(), 'om-home-'));
  const fake = (p) => { mkdirSync(resolve(p, '..'), { recursive: true }); writeFileSync(p, ''); chmodSync(p, 0o755); };
  fake(join(home, '.nvm/versions/node/v21.7.3/bin/node'));
  fake(join(home, '.nvm/versions/node/v22.11.0/bin/node'));
  fake(join(home, '.local/share/fnm/node-versions/v24.2.0/installation/bin/node'));
  fake(join(home, '.volta/tools/image/node/23.1.0/bin/node'));
  assert.equal(findNode(22, home), join(home, '.local/share/fnm/node-versions/v24.2.0/installation/bin/node'));
  assert.equal(findNode(25, home), null);
});

test('tools: setup is a no-op when FFmpeg is already there, and says why', { skip: spawnSync('ffmpeg', ['-version']).status !== 0 && 'no ffmpeg' }, () => {
  const r = setupFfmpeg({ npm: '/nonexistent/npm' }); // would fail loudly if it tried to install
  assert.equal(r.installed, false);
  assert.match(r.reason, /already on PATH/);
});

test('tools: the launcher finds a Node ≥22 when the shell\'s node is older', { skip: process.platform === 'win32' && 'POSIX launcher' }, () => {
  const home = mkdtempSync(join(tmpdir(), 'om-home-'));
  const oldBin = join(home, 'old-bin'); mkdirSync(oldBin);
  // the shell's node: a stub that claims to be Node 20
  writeFileSync(join(oldBin, 'node'), '#!/bin/sh\nif [ "$1" = "-e" ]; then printf 20; exit 0; fi\necho old-node "$@"\n'); chmodSync(join(oldBin, 'node'), 0o755);
  // an nvm Node 24: the real one running this test
  const nvm = join(home, '.nvm/versions/node/v24.0.0/bin'); mkdirSync(nvm, { recursive: true });
  writeFileSync(join(nvm, 'node'), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`); chmodSync(join(nvm, 'node'), 0o755);
  const launcher = resolve('skills/huashu-motion/bin/om');
  const r = spawnSync(launcher, ['--version'], { encoding: 'utf8', env: { HOME: home, PATH: [oldBin, '/usr/bin', '/bin'].join(delimiter) } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
  // and with no new Node anywhere, it says what to do instead of crashing inside the CLI
  if (systemNode22) return; // this machine has a system-wide Node 22+, which the launcher rightly uses
  const bare = mkdtempSync(join(tmpdir(), 'om-home-'));
  const r2 = spawnSync(launcher, ['--version'], { encoding: 'utf8', env: { HOME: bare, PATH: [oldBin, '/usr/bin', '/bin'].join(delimiter) } });
  assert.notEqual(r2.status, 0);
  assert.match(r2.stderr, /needs Node 22 or newer/);
});
