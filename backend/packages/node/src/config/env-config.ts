import { AIProvider } from '../constants';

export interface EnvConfig {
  apiKey: string | undefined;
  provider: AIProvider | undefined;
  ollamaHost: string | undefined;
  /** Guide narration TTS (OpenAI). Audio is pre-rendered at author time when set. */
  tts: {
    apiKey: string | undefined;
    voice: string | undefined;
    model: string | undefined;
  };
}

const envConfig: EnvConfig = {
  apiKey: process.env.SUMMARIES_API_KEY,
  provider: process.env.SUMMARIES_PROVIDER as AIProvider | undefined,
  ollamaHost: process.env.SUMMARIES_OLLAMA_HOST,
  tts: {
    apiKey: process.env.OPENAI_API_KEY,
    voice: process.env.CODEMAP_TTS_VOICE,
    model: process.env.CODEMAP_TTS_MODEL,
  },
};

export default envConfig;
