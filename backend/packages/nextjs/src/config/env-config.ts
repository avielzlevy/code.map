import { AIProvider } from '../constants';

export interface EnvConfig {
  apiKey: string | undefined;
  port: number | undefined;
  provider: AIProvider | undefined;
}

const envConfig: EnvConfig = {
  apiKey: process.env.SUMMARIES_API_KEY,
  port: process.env.FLOW_MAP_PORT ? parseInt(process.env.FLOW_MAP_PORT, 10) : undefined,
  provider: process.env.SUMMARIES_PROVIDER as AIProvider | undefined,
};

export default envConfig;
