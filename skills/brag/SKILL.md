---
name: brag
description: "Turn the project you just built (or a website URL) into a short, shareable launch video: real UI, its own composed soundtrack, a poster and share copy, then point at any frame to change it. Use when someone says \"/brag\", \"let's brag about this\", \"make a launch video\", \"make a promo / demo / feature video\", or \"turn this into a video\"."
metadata:
  repository: "https://github.com/shaaz1000/brag-motion"
  builds-on: "huashu-motion (MIT, 花叔) · /brag (MIT, latent-spaces)"
---

# /brag

You built it. Now brag. One command turns a project into a launch film people want to share. This skill owns the *what* (the angle, the story, the tone, what is true and what is private); the engine skill next to it, **huashu-motion**, owns the *how* (composition, music, render, studio). Read `../huashu-motion/SKILL.md` once per session: its contract and its `om` commands are how you build.

```
/brag                                   brag about the project in this folder
/brag https://example.com               brag about a website
/brag --tone polished --format vertical
/brag --length 45                       a 30 s, 45 s or 1 minute film (any length 10–180 s works)
/brag the new search feature only       one feature, one film
/brag every feature                     a set of short feature films, one per capability
```

| Option | Values | Default |
|---|---|---|
| `--tone` | a preset from [references/tones.md](references/tones.md) or free text ("fake Series A launch from 2016") | inferred |
| `--format` | `landscape` 1920×1080 · `vertical` 1080×1920 · `square` 1080×1080 · `both` | landscape |
| `--length` | `30` · `45` · `60` (seconds; any 10–180) | 30 for a launch film, 20 for a feature film |
| `--voice` | narration with `om voice` (system voice or a recording) | off |
| `--no-music` / `--no-sfx` | | music and effects on |
| `--to <folder>` | where finished videos are collected | `brag-output/` only |

Write everything to `brag-output/` in the project (`brag-output-YYYY-MM-DD-HHmmss/` if one exists). The film lives in `brag-output/composition/` (an `om` project).

## 0. Tools

Run `om doctor` (the `om` launcher is `../huashu-motion/bin/om`; it finds a Node 22+ from nvm, fnm or Volta by itself). If FFmpeg is missing, run `om setup`: it installs a local FFmpeg + ffprobe that every `om` command uses — no Homebrew, no admin rights. Chrome must be installed; nothing else is downloaded.

## 1. Inspect — read the product, not its marketing

Follow [references/step-1-inspect.md](references/step-1-inspect.md) and answer its 9-question rubric. For a URL, load the page in a headless browser (pages built by JavaScript come back empty from a plain download), dismiss overlays, scroll section by section, and take copy, colours, fonts, logo and screenshots as the visitor sees them.

What matters most is **the product in use**: entry → key action → result. Then read the brand the way huashu-motion's director does ([../huashu-motion/references/director.md](../huashu-motion/references/director.md) §1–3): its real colours and type (exact values from the CSS or theme file), its logo (the real SVG or file, never a stand-in), and its personality on the five sliders.

If the app can run locally, run it and capture the real screens — they are the best reference for a faithful rebuild. Demo data in a database is real material: open it **read-only**.

**Never put on screen or in share copy:** secrets, API keys, tokens, internal hostnames or URLs, real customers' names, emails or phone numbers. If the real UI shows them, use plausible fictional stand-ins and say so in the plan. `om claims` (step 4) checks this mechanically; it does not replace your judgement.

## 2. Plan — `brag-plan.md` and `share-copy.txt`

Commit to one angle. Write `brag-output/brag-plan.md`:

- the 9 rubric answers, the tone (preset + direction), the format;
- **hook (first 2 s)**, reveal, 2–3 highlights, punchline/outro — and which real UI each one shows;
- the rhythm sheet. Start from `om skeleton --length <30|45|60>`: it picks the tempo whose whole bars land exactly on the length (30 s and 60 s at 120 BPM, 45 s at 112) and lays out hook, highlights, burst, the small drop (films over 40 s), the stop, the big drop and the held end card. Fill each scene with real material; move a boundary only by whole bars. Details: [../huashu-motion/references/rhythm.md](../huashu-motion/references/rhythm.md);
- the palette with sources, the type, the logo file;
- a "what is real" list: for every number and quoted string, where it comes from (file, page, table). Anything that is a film device (an animated transition the app does not have, an illustrative timestamp) is listed as such.

Write `brag-output/composition/share-copy.txt`: 1–3 sentences, postable as is, specific, in the tone. No "excited to share".

When the user asked for several films (every feature, both formats), plan them all first, then build. Independent films can be built by parallel agents, each given this skill, the plan, and one film.

## 3. Build — with the engine

```sh
om new brag-output/composition          # or --template <id> when a grammar fits (om templates)
```

Follow huashu-motion's contract and craft rules: one paused GSAP timeline, scene labels on the beat, editable values as variables, `data-om-id` on everything a person might point at, the real UI rebuilt in HTML/CSS with the brand's own tokens and fonts, a composed `om-score` (or `--no-music`), `OM.sfx` on every landing. Build the hook and the key moment first, at full size.

Then look: `om check` (0 errors), `om still … --at` on every scene **and mid-transition**, fix overflow, collisions, contrast and dead frames. `om sound` for the soundtrack.

## 4. Verify — is it true, is it private, does it move?

```sh
om claims brag-output/composition --source .     # every on-screen string and number vs. the product's source
om render brag-output/composition --blur
om qa brag-output/composition
```

- `om claims` lists what it could not find in the source. Captions are yours and will show as not found; everything else needs an answer: reworded real copy (fine), a number from a database (say so in the plan), or an invention (remove it). **Any privacy finding is a stop** — replace it before delivering.
- A film that shows the product doing something it does not do is the worst bug a launch film can have (a confirmation message nothing sends, a button that does not exist). Check behaviour in the code, not only words.
- `om qa`: no single-frame pops; dead time only on reading holds and the end card.

## 5. Deliver

```sh
om deliver brag-output/composition --to brag-output        # add --to ~/Downloads/launch-films to collect every video in one place
```

`om deliver` picks the strongest settled frame as the poster (`--at <sec>` to choose), bakes it in as frame 0 so every platform's thumbnail shows it (length and audio unchanged), and puts the share copy beside the video.

For another format, `om fork brag-output/composition brag-output/composition-vertical --size 1080x1920`, then re-aim the camera and captions for the new frame (not a crop) and repeat steps 3–5.

Then tell the user: where the video, poster and share copy are; the angle in one sentence; what is illustrative and what the film found about the product (a bug, a missing message) — and offer the studio:

```sh
om studio brag-output/composition      # press C, click the frame, say what to change; you pick it up with om inbox --wait
```

## Creative laws

- **As long as it needs, and no longer.** 30 s launch film (default), 45 s with a fuller tour, 60 s for the whole story; feature films 16–22 s. A longer film is not a slower one: it gets more highlights and a second drop, never longer holds. Narration does not extend it.
- **The hook is everything.** Frame 1 already moves; the first 2 s decide whether anyone keeps watching. Plan it first.
- **Show the thing.** The working product doing its job beats a landing page describing it. Rebuild the real UI with the real tokens; never abstract filler.
- **Specific.** It must feel made for this exact project: its own copy, numbers, people and vocabulary. "Streamline your workflow" is banned.
- **True.** No invented claims, numbers or testimonials. Small illustrative UI text (a filename, a toast) is fine and listed as such.
- **Readable.** Pace comes from motion and cuts, never from pulling text away early: a line stays settled about 0.3 s per word.
- **Alive.** Things appear one by one, cursors click, text types, the camera moves through one world; holds drift.
- **Every frame postable.** Any frozen frame should be worth a screenshot.
- **Funny earns its place.** Humour comes from the project's own absurdity, not from trying.
- **Sound is half of it.** A composed score in the film's tempo, cuts on the beat, a hit on every landing, one big moment.
