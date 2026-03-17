import { AIProvider } from '../constants';

export interface EnvConfig {
  apiKey: string | undefined;
  provider: AIProvider | undefined;
}

const envConfig: EnvConfig = {
  apiKey: process.env.SUMMARIES_API_KEY,
  provider: process.env.SUMMARIES_PROVIDER as AIProvider | undefined,
};

export default envConfig;
