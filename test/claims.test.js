import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openProject } from '../cli/lib/project.js';
import { claims, onScreenText, numbersIn, privacyScan, indexSource, report } from '../cli/lib/claims.js';

const FILM = `<!doctype html>
<html data-composition-variables='[{"id":"title","type":"string","label":"t","default":"Clinic software that remembers"},{"id":"rows","type":"string","label":"r","default":"[[\\"a\\",1]]"},{"id":"accent","type":"color","label":"c","default":"#1765C1"}]'>
<head><style>.x { color: red; }</style></head>
<body><div id="film" data-composition-id="film" data-width="1920" data-height="1080">
  <h1 data-var-text="title">Clinic software that remembers</h1>
  <div class="stat">7 booked · ₹1,450 due today</div>
  <div class="bubble">Booked. We will see you on 24 September.</div>
  <div class="who">Contact: priya@example.com · +91 98200 41122</div>
  <img alt="Novic logo" src="logo.png">
</div>
<script type="text/vnd.abc" id="om-score">X:1
T:Not on screen
</script>
<script>
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  tl.to('#film .stat', { x: 0, duration: .5 }, 0);   // selectors and eases are code, not claims
  type('#f-rx', 'Amoxicillin 500 mg, three times a day', 1, .6);
  const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
</script></body></html>`;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'om-claims-'));
  const film = join(dir, 'film'); mkdirSync(film);
  writeFileSync(join(film, 'index.html'), FILM);
  const src = join(dir, 'product'); mkdirSync(join(src, 'app'), { recursive: true }); mkdirSync(join(src, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(src, 'app', 'copy.js'), `export const hero = 'Clinic software that remembers';\nexport const done = "Booked. We will see you on {date}.";\nconst rx = 'Amoxicillin 500 mg, three times a day';`);
  writeFileSync(join(src, 'app', 'stats.json'), '{ "booked": 7, "due": 1450 }');
  writeFileSync(join(src, 'node_modules', 'x', 'index.js'), "'7 booked · ₹1,450 due today'"); // dependencies never count as a source
  writeFileSync(join(src, '.env'), 'TITLE="7 booked · ₹1,450 due today"');                      // nor do secrets
  return { film: openProject(film), src };
}

test('claims: on-screen text comes from elements, string variables, alt text and typed strings — not code, CSS or the score', () => {
  const texts = onScreenText(FILM).map((s) => s.text);
  assert.ok(texts.includes('Clinic software that remembers'));
  assert.ok(texts.includes('7 booked · ₹1,450 due today'));
  assert.ok(texts.includes('Amoxicillin 500 mg, three times a day'));
  assert.ok(texts.includes('Novic logo'));
  for (const code of ['power3.out', '#film .stat', '#1765C1', 'Not on screen', '[["a",1]]']) assert.ok(!texts.includes(code), `${code} is not a claim`);
  const classes = onScreenText(`<div></div><script>el.className = 'row me'; b.className = 'pill wait-x'; c.className = 'cc bk'; const msg = 'Booked in at ten';</script>`).map((x) => x.text);
  assert.deepEqual(classes, ['Booked in at ten'], 'class lists are code; a sentence is a claim');
});

test('claims: numbers that make a claim are picked out, single digits in prose are not', () => {
  assert.deepEqual(numbersIn('7 booked · ₹1,450 due today · 280° · 3,452 km · 12%'), ['₹1,450', '280°', '3,452 km', '12%']);
  assert.deepEqual(numbersIn('step 2 of 3'), []);
});

test('claims: each string is looked up in the product; dependencies and secret files are not evidence', () => {
  const { film, src } = setup();
  const r = claims(film, { source: src });
  const by = Object.fromEntries(r.strings.map((s) => [s.text, s]));
  assert.equal(by['Clinic software that remembers'].found, join('app', 'copy.js'));
  assert.equal(by['Amoxicillin 500 mg, three times a day'].found, join('app', 'copy.js'));
  assert.equal(by['7 booked · ₹1,450 due today'].found, null, 'only node_modules and .env contain the sentence');
  const nums = by['7 booked · ₹1,450 due today'].numbers;
  assert.deepEqual(nums.map((n) => [n.raw, n.found]), [['₹1,450', join('app', 'stats.json')]], 'the number itself has a source (1450 without the comma)');
  assert.equal(by['Booked. We will see you on 24 September.'].found, null, 'a filled-in template is not word-for-word in the source');
  assert.ok(indexSource(src).every((f) => !f.path.includes('node_modules') && !f.path.endsWith('.env')));
});

test('claims: emails, phone numbers and keys on screen are flagged; dates are not phones', () => {
  const hits = privacyScan(onScreenText(FILM));
  const kinds = hits.map((h) => `${h.kind}:${h.value}`);
  assert.ok(kinds.includes('email address:priya@example.com'));
  assert.ok(kinds.some((k) => k.startsWith('phone number:+91 98200 41122')));
  assert.ok(kinds.includes('API key or token:sk-proj-abcdefghijklmnopqrstuvwxyz123456'));
  assert.deepEqual(privacyScan([{ text: 'Next consultation: 2026-09-15' }]), []);
  assert.deepEqual(privacyScan([{ text: 'Open http://localhost:4000/queue' }]).map((h) => h.kind), ['internal address']);
});

test('claims: the report says what is unverified and what is private, and works without a source', () => {
  const { film, src } = setup();
  const text = report(claims(film, { source: src }));
  assert.match(text, /not found/);
  assert.match(text, /✗ Booked\. We will see you on 24 September\./);
  assert.match(text, /! email address: priya@example\.com/);
  const bare = claims(film);
  assert.equal(bare.checked, false);
  assert.match(report(bare), /add --source/);
});
