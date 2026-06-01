import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import envConfig from '../config/env-config';
import { FlowLogger } from '../logger/flow-logger';
import {
  GUIDE_AUDIO_DIR,
  GUIDE_TTS_ENDPOINT,
  GUIDE_TTS_MODEL,
  GUIDE_TTS_VOICE,
  SIDECAR_API_PREFIX,
} from '../constants';
import { GuideArtifact } from '../dto/code-map-config.dto';

const LOGGER_CONTEXT = 'GuideTtsService';

/**
 * Pre-renders guide narration to audio at AUTHOR time (not playback), so the
 * browser just plays a cached clip — zero generation latency, one-time cost, and
 * the audio is portable with the guide. Each unique sentence is synthesized once
 * and cached on disk by a (model+voice+text) hash; re-authoring reuses the cache.
 *
 * No-ops cleanly when no TTS key is configured — the player falls back to the
 * browser's local Web Speech voice.
 */
export class GuideTtsService {
  /** Generate/cache audio for every narration sentence and attach the manifest. */
  async attachAudio(repoRoot: string, artifact: GuideArtifact): Promise<void> {
    const apiKey = envConfig.tts.apiKey;
    if (!apiKey) {
      FlowLogger.info(LOGGER_CONTEXT, 'No TTS key set; skipping audio pre-render');
      return;
    }
    const voice = envConfig.tts.voice || GUIDE_TTS_VOICE;
    const model = envConfig.tts.model || GUIDE_TTS_MODEL;

    const texts = this.collectTexts(artifact);
    if (texts.length === 0) return;

    const dir = path.join(repoRoot, GUIDE_AUDIO_DIR);
    fs.mkdirSync(dir, { recursive: true });

    const clips: Record<string, string> = {};
    let generated = 0;
    for (const text of texts) {
      const file = `${this.hash(model, voice, text)}.mp3`;
      const abs = path.join(dir, file);
      if (!fs.existsSync(abs)) {
        const audio = await this.synthesize(apiKey, model, voice, text);
        if (!audio) continue; // synthesis failed — leave this sentence to Web Speech
        fs.writeFileSync(abs, audio);
        generated++;
      }
      clips[text] = `${SIDECAR_API_PREFIX}/guide/audio/${file}`;
    }

    if (Object.keys(clips).length > 0) {
      artifact.audio = { voice, model, clips };
    }
    FlowLogger.info(LOGGER_CONTEXT, 'Pre-rendered narration audio', {
      sentences: texts.length,
      generated,
      cached: texts.length - generated,
      voice,
      model,
    });
  }

  /** Every narration sentence in the guide (overview briefing + step narration), deduped. */
  private collectTexts(artifact: GuideArtifact): string[] {
    const texts = new Set<string>();
    if (artifact.overview) {
      for (const t of artifact.overview.before) texts.add(t);
      for (const t of artifact.overview.change) texts.add(t);
    }
    for (const step of artifact.steps) {
      for (const segment of step.narration) texts.add(segment.text);
    }
    if (artifact.closing) texts.add(artifact.closing);
    return [...texts].filter((t) => t.trim().length > 0);
  }

  private hash(model: string, voice: string, text: string): string {
    return crypto.createHash('sha256').update(`${model}:${voice}:${text}`, 'utf8').digest('hex');
  }

  /** One OpenAI speech call → mp3 buffer, or null on failure (caller falls back). */
  private async synthesize(
    apiKey: string,
    model: string,
    voice: string,
    text: string,
  ): Promise<Buffer | null> {
    try {
      const res = await fetch(GUIDE_TTS_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voice, input: text, response_format: 'mp3' }),
      });
      if (!res.ok) {
        FlowLogger.warn(LOGGER_CONTEXT, 'TTS request failed', {
          status: res.status,
          statusText: res.statusText,
        });
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      FlowLogger.warn(LOGGER_CONTEXT, 'TTS request errored', { error: (err as Error).message });
      return null;
    }
  }
}
