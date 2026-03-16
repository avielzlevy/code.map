export interface EnvConfig {
  apiKey: string | undefined;
  port: number | undefined;
}

const envConfig: EnvConfig = {
  apiKey: process.env.FLOW_MAP_API_KEY,
  port: process.env.FLOW_MAP_PORT ? parseInt(process.env.FLOW_MAP_PORT, 10) : undefined,
};

export default envConfig;
