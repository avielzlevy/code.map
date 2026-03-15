export interface EnvConfig {
  apiKey: string | undefined;
}

const envConfig: EnvConfig = {
  apiKey: process.env.FLOW_MAP_API_KEY,
};

export default envConfig;
