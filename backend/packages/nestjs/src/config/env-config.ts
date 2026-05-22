import { AIProvider } from '../constants';

export interface EnvConfig {
  apiKey: string | undefined;
  provider: AIProvider | undefined;
  ollamaHost: string | undefined;
}

const envConfig: EnvConfig = {
  apiKey: process.env.SUMMARIES_API_KEY,
  provider: process.env.SUMMARIES_PROVIDER as AIProvider | undefined,
  ollamaHost: process.env.SUMMARIES_OLLAMA_HOST,
};

export default envConfig;
