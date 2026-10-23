# Changelog

## 0.2.0 — brag-motion

The first release of brag-motion: /brag's workflow on the huashu-motion engine.

- **`/brag` skill on the engine** (`skills/brag/`): inspect → plan → build → verify → deliver, with /brag's tones, creative laws and never-publish-secrets rule, and huashu-motion's director, composer, studio and checks. No HyperFrames dependency.
- **Film lengths: 30 s, 45 s, 60 s** (`--length`, `om skeleton`): the tempo whose whole bars land exactly on the length, and the shape of the film — hook, highlights, burst, a small drop for films over 40 s, the big drop at 70–85 %, a held end card.
- **`om claims`**: every on-screen string and number checked against the product's source (dependencies, build output and secret files are never evidence); flags emails, phone numbers, API keys and internal addresses.
- **`om deliver`**: poster = the strongest settled frame, baked in as frame 0 (length and audio unchanged), share copy beside it, `--to` collects everything in one folder.
- **`om setup`**: a local FFmpeg + ffprobe with every encoder the renderer needs, no Homebrew or admin rights; every `om` command uses it.
- **Launcher finds Node 22+** from nvm, fnm or Volta when the shell's `node` is older.
- Plugin manifests for Claude Code and Codex; skills discoverable at `.claude/`, `.agents/`, `.opencode/`.
- `om claims` reads SQLite databases under `--source` (read-only) as evidence, and ignores class names, selectors, inline CSS and code fragments.
- Fixes from two end-to-end runs (the 45 s and 60 s examples): English starter, stills in `stills/`, a poster that is really settled, `--video-only`, a render listener leak, `--help` on every command, clearer skill precedence.
- `om export html` never ships secrets, dotfiles, databases, research folders, out-of-project links or files containing keys.
- Examples: Noor (30 s) and Novic (45 s, 60 s, feature films), 16:9 and 9:16.

Built on huashu-motion 0.1.1 (`5f2608c`) and /brag 0.4.0 (`069432c`).
