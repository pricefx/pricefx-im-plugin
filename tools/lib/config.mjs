import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_KEYS = {
  PFX_URL: "url",
  PFX_PARTITION: "partition",
  PFX_USERNAME: "username",
  PFX_PASSWORD: "password",
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return {};

  const env = {};
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key in ENV_KEYS) {
      env[ENV_KEYS[key]] = value;
    }
  }
  return env;
}

export function getConnectionConfig() {
  const fileEnv = loadEnvFile();
  // process.env takes precedence over .env file
  const url = process.env.PFX_URL || fileEnv.url;
  const partition = process.env.PFX_PARTITION || fileEnv.partition;
  const username = process.env.PFX_USERNAME || fileEnv.username;
  const password = process.env.PFX_PASSWORD || fileEnv.password;

  if (!url || !partition || !username || !password) {
    const missing = [];
    if (!url) missing.push("PFX_URL");
    if (!partition) missing.push("PFX_PARTITION");
    if (!username) missing.push("PFX_USERNAME");
    if (!password) missing.push("PFX_PASSWORD");
    throw new Error(
      `Missing connection settings: ${missing.join(", ")}. Set them in a .env file in the project root.`
    );
  }

  return { url, partition, username, password };
}
