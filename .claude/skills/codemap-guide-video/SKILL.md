---
name: codemap-guide-video
description: Render a saved code-map guide to a shareable mp4 (narrated walkthrough with before/after code) by recording its live playback. Use after authoring a guide when the user wants a video — "render the guide to mp4", "make a video of the walkthrough", "export the guide as video".
---

# code-map guide → video

Turns a saved code-map guide into a self-contained **mp4** — the narrated, animated walkthrough as a video you can drop in a PR, Slack, or a doc. It records the guide playing in headless Chrome and muxes the guide's own pre-rendered narration audio back on, perfectly synced. No server changes, no editor — one bundled script.

This pairs with the **codemap-guide** skill: author the guide first (that writes the walkthrough + the voice clips), then render it here.

## Prerequisites
- The guide must already be **authored and saved** (run `codemap-guide` first). Render works against the saved artifact.
- The **code-map sidecar must be running** for the project. Default `http://localhost:4567` (call it `$BASE`); ask the user for the port if it differs.
- **Google Chrome / Chromium** installed (override with `CHROME_PATH=...`), and **ffmpeg** on `PATH`.
- Best voice: the guide was authored with `OPENAI_API_KEY` set, so narration clips exist. Without them the video still renders, using whatever audio the guide has (or silent).

## Steps

### 1. Confirm the slug
You need the guide's slug (the same one `codemap-guide` wrote, e.g. `refund-flow`). If unsure, list saved guides: `curl -s "$BASE/api/flow-map/guide/saved"`.

### 2. Render it
Locate `render-guide.mjs` by finding the directory that contains this SKILL.md file (`<skill-dir>`); the script sits next to it. If you can't determine that path, ask the user for it before running the command.

Derive the output filename from the slug, but **sanitize it first**: replace any non-alphanumeric character (spaces, slashes, etc.) with hyphens to get `<safe-slug>`, then use `<safe-slug>.mp4`. Pass the original slug to the script as the guide identifier.
```bash
node "<skill-dir>/render-guide.mjs" <slug> "$BASE" "<safe-slug>.mp4"
```
e.g.
```bash
node "<skill-dir>/render-guide.mjs" refund-flow http://localhost:4567 refund-flow.mp4
```
It will:
- open the guide and **record the live auto-play** (so it captures exactly what a viewer sees — voice timing, before/after reveal, the focus walking the change),
- rebuild the audio from the guide's narration clips, synced by play timestamp,
- write an `<safe-slug>.mp4` (h264 + aac).

It runs in **real time** — roughly the length of the guide (a 2-minute walkthrough takes ~2 minutes) — and prints progress (`clip N/total`) then `DONE → <path>`.

**If it fails:** if the script exits without printing `DONE → <path>` (e.g. non-zero exit, Chrome crash, ffmpeg encode failure), capture its stderr and surface it to the user verbatim — e.g. "Render failed: `<stderr>`. Check that Chrome/ffmpeg are installed and that the code-map sidecar is running." Don't claim success.

### 3. Hand over the file
Give the user the mp4 path. It's Slack/Loom-ready — and dragged into a GitHub PR/issue or Slack it plays inline.

## Notes
- **Zero npm deps.** The script drives Chrome over the DevTools protocol using Node's built-in `WebSocket`/`fetch` (Node ≥ 22), and shells out to the system `ffmpeg`. It changes nothing in the sidecar or the player.
- **Audio is never captured from the browser** (headless has no audio device). It's composed from the guide's cached narration mp3s and muxed by timestamp, so it's the real HD voice, exactly aligned.
- **Local, author-time.** Render where the guide was authored; commit/attach the mp4. Nothing needs hosting.
- **Rough edges** (fine for most uses): audio sync uses a fixed ~700ms lead-in anchor; capture is real-time. Subtitles aren't burned in yet — the narration text lives in the guide JSON if you want to add them.
- Troubleshooting: "guide not found" → author it first / check the port. "Chrome not found" → set `CHROME_PATH`. "ffmpeg not found" → install ffmpeg. Playback "stalled" → the guide opened but didn't auto-play; confirm `$BASE/app?guide=<slug>` plays in a real browser.
