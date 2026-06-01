import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import envConfig from '../src/config/env-config';
import { GuideTtsService } from '../src/guide/guide-tts.service';
import { GuideArtifact } from '../src/dto/code-map-config.dto';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('  ✗ ' + msg);
    process.exitCode = 1;
  } else {
    console.log('  ✓ ' + msg);
  }
}

function makeArtifact(): GuideArtifact {
  return {
    meta: { generatedAt: new Date().toISOString() },
    overview: { before: ['Before sentence one.'], change: ['Change sentence one.'] },
    steps: [
      {
        nodeId: 'a.ts:A#m',
        methodName: 'm',
        file: 'a.ts',
        type: 'service',
        changeType: 'edited',
        diff: { language: 'typescript', before: null, after: null },
        explanation: 'Step says hi.',
        narration: [
          { text: 'Step says hi.' },
          { text: 'Before sentence one.' }, // duplicate of overview → should dedupe
        ],
      },
    ],
  };
}

let fetchCalls = 0;
// Mock OpenAI: return a tiny fake mp3 buffer.
(globalThis as unknown as { fetch: unknown }).fetch = async () => {
  fetchCalls++;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => new Uint8Array([0x49, 0x44, 0x33]).buffer,
  };
};

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-tts-'));
  const svc = new GuideTtsService();

  console.log('no key → no-op:');
  envConfig.tts.apiKey = undefined;
  const a0 = makeArtifact();
  await svc.attachAudio(root, a0);
  assert(a0.audio === undefined, 'no audio manifest when key absent');
  assert(fetchCalls === 0, 'no TTS calls when key absent');

  console.log('with key → generates + caches:');
  envConfig.tts.apiKey = 'test-key';
  const a1 = makeArtifact();
  await svc.attachAudio(root, a1);
  assert(!!a1.audio, 'audio manifest attached');
  const uniqueTexts = 3; // 2 overview + 2 step narration, minus 1 dup = 3
  assert(Object.keys(a1.audio!.clips).length === uniqueTexts, `manifest has ${uniqueTexts} clips (deduped)`);
  assert(fetchCalls === uniqueTexts, `synthesized ${uniqueTexts} unique sentences`);
  assert(
    Object.values(a1.audio!.clips).every((u) => /\/guide\/audio\/[a-f0-9]{64}\.mp3$/.test(u)),
    'clip URLs point at hashed mp3 files',
  );
  const files = fs.readdirSync(path.join(root, '.codemap/guides/audio'));
  assert(files.length === uniqueTexts, 'wrote one cached file per unique sentence');

  console.log('re-author → cache hit, no new calls:');
  fetchCalls = 0;
  const a2 = makeArtifact();
  await svc.attachAudio(root, a2);
  assert(fetchCalls === 0, 'reused cached audio (0 new TTS calls)');
  assert(Object.keys(a2.audio!.clips).length === uniqueTexts, 'manifest still complete from cache');

  fs.rmSync(root, { recursive: true, force: true });
  console.log(process.exitCode ? '\nFAILED' : '\nALL PASSED');
}

main();
