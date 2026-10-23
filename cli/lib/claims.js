// om claims — does everything the film says come from the product?
//
// A launch film's worst bug is a true-looking claim that is not true: a number nobody measured, a
// message the product never sends, a customer's real phone number. This lists every string and
// number the composition puts on screen, looks each one up in the product's own source, and flags
// personal data and secrets (the /brag rule: nothing private goes into a public video).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { readVariables } from './project.js';

const SKIP_DIRS = new Set(['node_modules', '.git', '.hg', 'dist', 'build', '.next', '.nuxt', 'out', 'coverage', '.om', 'vendor', '.cache', '.turbo', '.vercel', '__pycache__', '.venv', 'venv', 'secrets', 'credentials', 'brag-output']);
const SECRET_FILE = /^(\.env(\..*)?|id_rsa.*|id_ed25519.*|.*\.(pem|key|p12|pfx|keystore)|service-account.*\.json|credentials.*\.json)$/i;
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.mp4', '.mov', '.webm', '.mp3', '.wav', '.ogg', '.m4a', '.woff', '.woff2', '.ttf', '.otf', '.zip', '.gz', '.pdf', '.db', '.sqlite', '.wasm', '.lock']);

export const norm = (s) => String(s).normalize('NFKC').toLowerCase()
  .replace(/[​-‍﻿]/g, '').replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-')
  .replace(/\s+/g, ' ').trim();
const digits = (s) => s.replace(/[^\d.]/g, '').replace(/^\.+|\.+$/g, '');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', mdash: '—', ndash: '–', middot: '·', hellip: '…' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m));

// Strings that are code, not words a viewer reads.
function looksLikeCode(s) {
  const t = s.trim();
  if (t.length < 3 || !/[\p{L}\d]/u.test(t)) return true;
  if (/^[#.[:]/.test(t) || /=>|[{};]|\$\{|^\w+\(|\)\s*$/.test(t)) return true;
  if (/^(power\d|expo|sine|back|elastic|circ|quad|cubic|none)\b/.test(t)) return true;
  if (/^(scene|om|data|aria)[:-]/.test(t)) return true;
  if (/^#?[0-9a-f]{3,8}$/i.test(t) || /^(rgba?|hsla?|var|calc|url|linear-gradient|radial-gradient)\(/.test(t)) return true;
  if (/^[\w./-]+\.(png|jpe?g|svg|mp4|webm|mp3|wav|woff2?|ttf|css|js|html|json)$/i.test(t)) return true;
  if (/^[a-z][a-zA-Z0-9]*$/.test(t) && !/\s/.test(t)) return true; // a lone identifier
  if (/^[a-z0-9_-]+(?: [a-z0-9_-]+)+$/.test(t) && t.split(' ').some((w) => w.length <= 2 || /[-_]/.test(w))) return true; // a class list: 'row me', 'pill wait', 'act-blue on'
  if (/^[\d.]+(px|em|rem|%|s|ms|deg|vh|vw)?(\s+[\d.]+(px|em|rem|%|s|ms|deg)?)*$/.test(t)) return true; // CSS-ish numbers
  if (/^(absolute|relative|hidden|visible|block|flex|none|center|left|right|top|bottom|auto|inherit)$/i.test(t)) return true;
  return false;
}

// Pieces of code, not prose: string concatenation ends, inline CSS, expressions.
function looksLikeFragment(s) {
  const t = s.trim();
  if (/^[,+:;)\]}]|[,+(:=\[{]$/.test(t)) return true;           // ', ppl: ' · 'x(' · '+ y'
  if (/!=|==|=>|&&|\|\||\?\s*$|\bnull\b|\bundefined\b/.test(t)) return true;
  if (/^[\w-]+\s*:\s*[^\s].*?;?$/.test(t) && /:\s*[\d#.-]/.test(t) && !/\s\w+\s\w+/.test(t)) return true; // top:176px; color: #fff
  return false;
}

// Every piece of on-screen text: element text, string variables, and the string literals the
// timeline types or builds (typed answers, chat bubbles, labels made in a loop).
export function onScreenText(html) {
  const found = new Map();
  const add = (text, where) => {
    const t = decode(text).replace(/\s+/g, ' ').trim();
    if (!t || looksLikeCode(t)) return;
    if (!found.has(t)) found.set(t, where);
  };
  for (const v of readVariables(html)) if (v.type === 'string' && typeof v.default === 'string' && !/^\s*[[{]/.test(v.default)) add(v.default, `variable ${v.id}`);
  const scripts = [];
  const body = html
    .replace(/<script\b[^>]*type=["']text\/vnd\.abc["'][^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, code) => { scripts.push(code); return ' '; })
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<html\b[^>]*>/i, '<html>');
  for (const m of body.matchAll(/>([^<]+)</g)) add(m[1], 'text');
  for (const m of body.matchAll(/\b(?:alt|title|placeholder|aria-label)=["']([^"']+)["']/gi)) add(m[1], 'attribute');
  for (const code of scripts) {
    const stripped = code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
    for (const m of stripped.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/g)) {
      const s = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\n/g, ' ').replace(/\\(.)/g, '$1');
      const before = stripped.slice(Math.max(0, m.index - 40), m.index);
      if (/(class(Name|List)?|\.(add|remove|toggle|contains)\(|setAttribute\(\s*['"]class['"]\s*,|querySelector(All)?\(|getElementById\(|\$\(|gsap\.\w+\(|tl\.\w+\(|style\.\w+\s*=|cssText\s*=)\s*[=:(,+]?\s*$/.test(before)) continue; // class names, selectors, styles
      if (looksLikeFragment(s)) continue;
      if (/<[a-z][^>]*>/i.test(s)) { for (const t of s.matchAll(/>([^<]+)</g)) add(t[1], 'script'); continue; } // HTML built in a string
      if (/\s/.test(s.trim()) || /[₹$€£%°]|\d{2,}/.test(s)) add(s, 'script');
    }
  }
  return [...found].map(([text, where]) => ({ text, where }));
}

// Numbers that make a claim: money, percentages, counts, degrees, times, distances.
export function numbersIn(text) {
  const out = [];
  for (const m of text.matchAll(/([₹$€£]\s?)?(\d[\d,]*(?:\.\d+)?)(\s?(?:%|°|k\b|m\b|x\b|×|km|mg|ms|min|h\b|s\b))?/gi)) {
    const raw = m[0].trim(), d = digits(m[2]);
    if (d.replace('.', '').length < 2 && !m[1] && !m[3]) continue; // single digits are rarely claims
    out.push(raw);
  }
  return out;
}

// The product's text, file by file, skipping build output, dependencies and anything secret.
export function indexSource(root, { maxBytes = 2 << 20, maxFiles = 20000 } = {}) {
  const files = [];
  const walk = (dir) => {
    if (files.length >= maxFiles) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= maxFiles) return;
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.git')) walk(p); continue; }
      if (e.isFile() && /\.(db|sqlite|sqlite3)$/i.test(e.name) && !SECRET_FILE.test(e.name)) { files.push(...readDatabase(p, root)); continue; }
      if (!e.isFile() || SECRET_FILE.test(e.name) || BINARY_EXT.has(extname(e.name).toLowerCase())) continue;
      let st; try { st = statSync(p); } catch { continue; }
      if (st.size > maxBytes || st.size === 0) continue;
      const buf = readFileSync(p);
      if (buf.subarray(0, 1024).includes(0)) continue; // binary
      const text = buf.toString('utf8');
      files.push({ path: relative(root, p), text: norm(text), digits: text.replace(/(\d),(?=\d)/g, '$1') });
    }
  };
  walk(resolve(root));
  return files;
}

// Demo data is real material: names, dates and amounts on screen often come from the product's
// database, not its code. Every text and number cell of every table, read-only, one entry per table.
function readDatabase(path, root, { maxRows = 50000 } = {}) {
  let db;
  try { db = new (requireSqlite())(path, { readOnly: true }); } catch { return []; }
  const out = [];
  try {
    for (const { name } of db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'").all()) {
      const cells = [];
      for (const row of db.prepare(`select * from "${name.replace(/"/g, '""')}" limit ${maxRows}`).all()) {
        for (const v of Object.values(row)) if (typeof v === 'string' || typeof v === 'number') cells.push(String(v));
      }
      if (cells.length) { const text = cells.join('\n'); out.push({ path: `${relative(root, path)}#${name}`, text: norm(text), digits: text.replace(/(\d),(?=\d)/g, '$1') }); }
    }
  } catch { /* an unreadable table is no evidence */ } finally { try { db.close(); } catch {} }
  return out;
}
let sqliteCtor = null;
function requireSqlite() {
  if (!sqliteCtor) sqliteCtor = createRequire(import.meta.url)('node:sqlite').DatabaseSync;
  return sqliteCtor;
}

const PRIVACY = [
  ['email address', /[\w.+-]+@[\w-]+\.[\w.-]*[a-z]{2,}/gi],
  ['phone number', /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?){2,4}\d{3,5}/g],
  ['API key or token', /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,})\b/g],
  ['internal address', /\b(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[\w-]+\.(?:internal|local|corp|lan))(?::\d{2,5})?\b/gi],
];

// A finding is reported masked: the report goes to terminals, agent transcripts and --json logs,
// so it must not repeat the secret it found. Enough is kept to recognise it; the file and line say where.
export function mask(kind, v) {
  if (kind === 'email address') { const [u, d] = v.split('@'); return `${u.slice(0, 1)}***@${d}`; }
  if (kind === 'phone number') { const digits = v.replace(/\D/g, ''); return `${v.trim().startsWith('+') ? '+' : ''}${'•'.repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`; }
  if (kind === 'API key or token') return `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} chars)`;
  return v; // internal addresses are not secrets in themselves; showing them is what makes them fixable
}

// Masks every personal value inside a string, for output only (matching uses the original text).
export function redact(text) {
  let out = text;
  for (const [kind, re] of PRIVACY) {
    if (kind === 'internal address') continue;
    out = out.replace(re, (m) => (kind === 'phone number' && (m.replace(/\D/g, '').length < 10 || /^\d{4}-\d{2}-\d{2}/.test(m.trim())) ? m : mask(kind, m.trim())));
  }
  return out;
}

export function privacyScan(strings) {
  const hits = [];
  for (const { text } of strings) {
    for (const [kind, re] of PRIVACY) {
      for (const m of text.matchAll(re)) {
        const v = m[0].trim();
        if (kind === 'phone number' && v.replace(/\D/g, '').length < 10) continue;
        if (kind === 'phone number' && /^\d{4}-\d{2}-\d{2}/.test(v)) continue; // an ISO date, not a phone
        hits.push({ kind, value: mask(kind, v), in: kind === 'internal address' ? text : '(text withheld)' });
      }
    }
  }
  return hits;
}

// Privacy is checked on everything the project holds, not only on what the claims filters keep as
// on-screen text: a key in a JSON variable, an email in a data attribute or a phone number in the
// share copy must never slip past because it looked like code. Vendor libraries and render output
// are skipped (they are not the user's words).
export function privacyScanProject(project) {
  const hits = [];
  const seen = new Set();
  const walk = (dir) => {
    let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name), rel = relative(project.root, p);
      if (e.isDirectory()) { if (!['vendor', 'out', '.om', 'node_modules', '.git', 'stills', 'snapshots'].includes(e.name)) walk(p); continue; }
      if (!e.isFile() || BINARY_EXT.has(extname(e.name).toLowerCase())) continue;
      let buf; try { buf = readFileSync(p); } catch { continue; }
      if (buf.length > 4 << 20 || buf.subarray(0, 1024).includes(0)) continue;
      buf.toString('utf8').split('\n').forEach((line, i) => {
        for (const h of privacyScan([{ text: line }])) { // the whole line: a secret past column 400 of a minified line still counts
          const key = `${h.kind}|${h.value}`;
          if (seen.has(key)) continue;
          seen.add(key);
          hits.push({ ...h, in: `${rel}:${i + 1}` });
        }
      });
    }
  };
  walk(project.root);
  return hits;
}

export function claims(project, { source = null } = {}) {
  const html = readFileSync(project.index, 'utf8');
  const strings = onScreenText(html);
  const privacy = privacyScanProject(project);
  const shown = (list) => list.map((x) => ({ ...x, text: redact(x.text), ...(x.numbers ? { numbers: x.numbers.map((n) => ({ ...n, raw: redact(n.raw) })) } : {}) }));
  if (!source) return { source: null, strings: shown(strings), privacy, checked: false };
  const root = resolve(source);
  if (!existsSync(root)) throw new Error(`no such source folder: ${root}`);
  const files = indexSource(root);
  const findText = (t) => {
    const n = norm(t).replace(/[.!?…:]+$/, '');
    if (n.length < 2) return null;
    return files.find((f) => f.text.includes(n))?.path ?? null;
  };
  const findNumber = (raw) => {
    const d = digits(raw.replace(/(\d),(?=\d)/g, '$1'));
    if (!d) return null;
    const re = new RegExp(`(^|[^\\d])${d.replace('.', '\\.')}([^\\d]|$)`);
    return files.find((f) => re.test(f.digits))?.path ?? null;
  };
  const results = strings.map((s) => {
    const file = findText(s.text);
    const numbers = numbersIn(s.text).map((raw) => ({ raw, found: file ? file : findNumber(raw) }));
    return { ...s, found: file, numbers };
  });
  return { source: root, files: files.length, strings: shown(results), privacy, checked: true };
}

export function report(r) {
  const lines = [];
  if (!r.checked) {
    lines.push(`claims   ${r.strings.length} on-screen strings (add --source <product folder> to check each one against the product)`);
    for (const s of r.strings) lines.push(`  · ${s.text}`);
  } else {
    const verified = r.strings.filter((s) => s.found);
    const unverified = r.strings.filter((s) => !s.found);
    const loose = r.strings.flatMap((s) => s.numbers.filter((n) => !n.found).map((n) => ({ ...n, in: s.text })));
    lines.push(`claims   ${r.strings.length} on-screen strings · ${verified.length} found in ${r.source} (${r.files} files) · ${unverified.length} not found · ${loose.length} numbers not found`);
    if (unverified.length) {
      lines.push('', 'Not found in the product — real copy reworded, a caption, or an invention? Keep captions; check the rest:');
      for (const s of unverified) lines.push(`  ✗ ${s.text}   (${s.where})`);
    }
    if (loose.length) {
      lines.push('', 'Numbers with no source — measured somewhere else (a database, an export)? Say where, or label them illustrative:');
      for (const n of loose) lines.push(`  ✗ ${n.raw}   in "${n.in}"`);
    }
  }
  if (r.privacy.length) {
    lines.push('', 'Personal data or secrets in the film’s files — a public film must not carry them (use fictional stand-ins):');
    for (const p of r.privacy) lines.push(`  ! ${p.kind}: ${p.value}   in "${p.in}"`);
  } else lines.push('', 'privacy  no emails, phone numbers, keys or internal addresses anywhere in the film’s files');
  return lines.join('\n');
}
