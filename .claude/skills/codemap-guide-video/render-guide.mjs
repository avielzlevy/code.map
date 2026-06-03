// Render a saved code-map guide to an mp4 by recording its live auto-play.
//
// Records the guide playing in headless Chrome (over CDP — zero npm deps, uses
// Node's built-in WebSocket/fetch), then composes the audio track from the guide's
// own pre-rendered narration clips (synced by play timestamp) and muxes with ffmpeg.
// Nothing is captured from the browser's audio device.
//
//   node render-guide.mjs <slug> [base-url] [out.mp4]
//   CHROME_PATH=/path/to/chrome  (override browser autodetect)
//
// Requires: a running code-map sidecar with <slug> already authored, plus
// Google Chrome/Chromium and ffmpeg on the system.
import { spawn, execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const slug = process.argv[2];
const BASE = process.argv[3] || "http://localhost:4567";
const OUT = path.resolve(process.argv[4] || `${slug || "guide"}.mp4`);
const PORT = 9300 + Math.floor(Math.random() * 400);
const W = 1280, H = 720, FPS = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("•", ...a);

if (!slug) {
  console.error("usage: node render-guide.mjs <slug> [base-url] [out.mp4]");
  process.exit(2);
}

function resolveChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("Chrome not found — install Google Chrome/Chromium or set CHROME_PATH");
}
function assertFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); }
  catch { throw new Error("ffmpeg not found on PATH — install it (e.g. `brew install ffmpeg`)"); }
}

const CHROME = resolveChrome();
let chromeProc = null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "guide-render-"));
const framesDir = path.join(tmp, "frames");
fs.mkdirSync(framesDir);

// Injected before the app loads: log when each narration clip starts playing,
// so the audio track can be rebuilt in sync without capturing browser audio.
const HOOK = `(function(){
  window.__sched = []; window.__t0 = performance.now();
  var O = window.Audio;
  function Hooked(src){ var a = new O(src); var p = a.play.bind(a);
    a.play = function(){ try { window.__sched.push({ src: a.src || src, t: performance.now() }); } catch(e){} return p(); };
    return a; }
  Hooked.prototype = O.prototype; window.Audio = Hooked;
})();`;

async function connectBrowser() {
  let ver;
  for (let i = 0; i < 60 && !ver; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); }
    catch { await sleep(250); }
  }
  if (!ver) throw new Error("Chrome devtools endpoint never came up");
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method) listeners.forEach((l) => l(m));
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const i = ++id; pending.set(i, { res, rej });
      const msg = { id: i, method, params };
      if (sessionId) msg.sessionId = sessionId;
      ws.send(JSON.stringify(msg));
    });
  return { send, on: (fn) => listeners.push(fn) };
}

async function main() {
  assertFfmpeg();
  // record=1 tells the player to never pause on a blocked clip (we force autoplay
  // and compose the audio from the clips ourselves).
  const url = `${BASE}/app?guide=${encodeURIComponent(slug)}&record=1`;

  // how many narrated clips should play (so we know when the guide is truly done)
  const res = await fetch(`${BASE}/api/flow-map/guide/saved/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`guide "${slug}" not found at ${BASE} (author it first; is the sidecar running?)`);
  const art = (await res.json()).data;
  let expected = 0;
  if (art.overview) expected += (art.overview.before?.length || 0) + (art.overview.change?.length || 0);
  for (const s of art.steps) expected += s.narration.length;
  if (art.closing) expected += 1;
  log("expecting", expected, "narrated clips");

  log("launching Chrome →", url);
  chromeProc = spawn(CHROME, [
    "--headless", `--remote-debugging-port=${PORT}`,
    "--autoplay-policy=no-user-gesture-required",
    `--window-size=${W},${H}`, "--hide-scrollbars", "--disable-gpu", "about:blank",
  ], { stdio: "ignore" });
  await sleep(1500); // let the initial page target become active

  const { send: raw, on } = await connectBrowser();
  const { targetInfos } = await raw("Target.getTargets");
  const pg = targetInfos.find((t) => t.type === "page");
  if (!pg) throw new Error("no Chrome page target");
  const { sessionId } = await raw("Target.attachToTarget", { targetId: pg.targetId, flatten: true });
  const send = (m, p = {}) => raw(m, p, sessionId);
  const evalJS = async (expr) =>
    (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });

  const frames = [];
  on((m) => {
    if (m.method === "Page.screencastFrame" && m.sessionId === sessionId) {
      const { data, sessionId: sid, metadata } = m.params;
      const file = path.join(framesDir, `f${String(frames.length).padStart(5, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(data, "base64"));
      frames.push({ file, ts: metadata.timestamp });
      send("Page.screencastFrameAck", { sessionId: sid });
    }
  });

  log("recording the live playthrough…");
  await send("Page.startScreencast", { format: "jpeg", quality: 75, everyNthFrame: 1 });
  await send("Page.navigate", { url });

  // play until all expected clips have played (then a short tail), or a long stall
  let last = -1, lastChange = Date.now();
  for (let i = 0; i < 1800; i++) {
    await sleep(400);
    const len = await evalJS("(window.__sched||[]).length").catch(() => last);
    if (len !== last) {
      log(`clip ${len}/${expected}`);
      last = len; lastChange = Date.now();
    }
    if (len >= expected && expected > 0) { await sleep(1800); break; }
    if (Date.now() - lastChange > 20000) { log("playback stalled — stopping"); break; }
  }

  const plays = JSON.parse((await evalJS("JSON.stringify(window.__sched||[])")) || "[]");
  await send("Page.stopScreencast").catch(() => {});
  log(`captured ${frames.length} frames, ${plays.length} audio plays`);
  if (frames.length === 0) throw new Error("no frames captured");
  chromeProc.kill();
  await sleep(300);

  // ── assemble video: resample timestamped frames to constant 30fps ─────────
  const firstTs = frames[0].ts;
  const total = frames[frames.length - 1].ts - firstTs;
  const N = Math.max(1, Math.round(total * FPS));
  const seqDir = path.join(tmp, "seq");
  fs.mkdirSync(seqDir);
  let j = 0;
  for (let k = 0; k < N; k++) {
    const t = firstTs + k / FPS;
    while (j < frames.length - 1 && frames[j + 1].ts <= t) j++;
    fs.copyFileSync(frames[j].file, path.join(seqDir, `s${String(k).padStart(6, "0")}.jpg`));
  }
  const videoOnly = path.join(tmp, "video.mp4");
  execFileSync("ffmpeg", ["-y", "-framerate", String(FPS), "-i", path.join(seqDir, "s%06d.jpg"),
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", // even dims for h264
    "-c:v", "libx264", "-preset", "veryfast", videoOnly], { stdio: ["ignore", "ignore", "pipe"] });
  log(`video assembled (${total.toFixed(1)}s @ ${FPS}fps)`);

  // ── build the audio track from the pre-rendered clips, aligned to the video ─
  if (plays.length === 0) {
    fs.copyFileSync(videoOnly, OUT); // no narration audio — ship the silent video
  } else {
    const LEAD = 700; // page load + first-screen reveal before narration begins
    const c0 = plays[0].t;
    const inputs = [], filters = [];
    for (let i = 0; i < plays.length; i++) {
      const buf = Buffer.from(await (await fetch(plays[i].src)).arrayBuffer());
      const cf = path.join(tmp, `clip${i}.mp3`);
      fs.writeFileSync(cf, buf);
      const offset = Math.max(0, LEAD + Math.round(plays[i].t - c0));
      inputs.push("-i", cf);
      filters.push(`[${i + 1}:a]adelay=${offset}|${offset}[a${i}]`);
    }
    const mix = `${filters.join(";")};${plays.map((_, i) => `[a${i}]`).join("")}amix=inputs=${plays.length}:normalize=0:dropout_transition=0[aout]`;
    execFileSync("ffmpeg", ["-y", "-i", videoOnly, ...inputs, "-filter_complex", mix,
      "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", OUT], { stdio: "ignore" });
  }

  log(`DONE → ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((e) => {
  console.error("✗", e.message);
  try { chromeProc?.kill(); } catch { /* ignore */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(1);
});
