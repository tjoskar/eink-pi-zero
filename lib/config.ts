interface Config {
  logPath: string;
}

let config: Config | null = null;

export function setConfig(newConfig: Config): void {
  config = newConfig;
}

export function getConfig(): Config {
  if (!config) {
    throw new Error("Config not set. Please call setConfig() before using.");
  }
  return config;
}
