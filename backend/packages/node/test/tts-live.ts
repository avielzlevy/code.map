/**
 * Live OpenAI TTS check — generates a real clip and plays it.
 * Run from backend/packages/node:
 *   OPENAI_API_KEY=sk-... npx ts-node test/tts-live.ts
 * Optional: CODEMAP_TTS_VOICE=nova CODEMAP_TTS_MODEL=tts-1
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { GuideTtsService } from '../src/guide/guide-tts.service';
import { GuideArtifact } from '../src/dto/code-map-config.dto';

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('✗ Set OPENAI_API_KEY first:  OPENAI_API_KEY=sk-... npx ts-node test/tts-live.ts');
    process.exit(1);
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-live-'));
  const artifact: GuideArtifact = {
    meta: { generatedAt: new Date().toISOString() },
    steps: [
      {
        nodeId: 'x',
        methodName: 'refund',
        file: 'orders.service.ts',
        type: 'service',
        changeType: 'edited',
        diff: { language: 'typescript', before: null, after: null },
        explanation: '',
        narration: [
          { text: "Before persisting, the service now asserts the order can actually be refunded." },
        ],
      },
    ],
  };

  const svc = new GuideTtsService();
  console.time('synthesis');
  await svc.attachAudio(root, artifact);
  console.timeEnd('synthesis');

  if (!artifact.audio) {
    console.error('✗ No audio generated — check the key, credits, or network (see warning above).');
    process.exit(1);
  }

  const url = Object.values(artifact.audio.clips)[0];
  const file = path.join(root, '.codemap/guides/audio', path.basename(url));
  const size = fs.statSync(file).size;
  console.log(`✓ voice=${artifact.audio.voice} model=${artifact.audio.model}`);
  console.log(`✓ clip: ${file} (${size} bytes)`);

  try {
    execSync(`afplay "${file}"`); // macOS audio player
    console.log('✓ played the clip — that\'s the voice you\'ll hear in guides.');
  } catch {
    console.log(`(couldn't auto-play; open it: ${file})`);
  }

  fs.rmSync(root, { recursive: true, force: true });
}

main();
