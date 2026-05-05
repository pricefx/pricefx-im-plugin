import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ENV_KEYS = {
  PFX_URL: "url",
  PFX_PARTITION: "partition",
  PFX_USERNAME: "username",
  PFX_PASSWORD: "password",
};

const PRICEFX_DISCRIMINATOR =
  "net.pricefx.integration.component.rest.domain.connection.PriceFxConnection";

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

function unquote(value) {
  if (!value) return value;
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseProperties(content) {
  const props = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = unquote(trimmed.slice(eqIndex + 1));
    props[key] = value;
  }
  return props;
}

function normalizePricefxUrl(uri) {
  // Strip trailing slashes and a trailing `/pricefx` segment so the client
  // (which appends `/pricefx/{partition}`) produces a correct base URL.
  return uri.replace(/\/+$/, "").replace(/\/pricefx$/, "");
}

function findPricefxConnectionFile(connectionsDir) {
  if (!existsSync(connectionsDir)) {
    throw new Error(`Connections directory not found: ${connectionsDir}`);
  }
  for (const name of readdirSync(connectionsDir)) {
    if (!name.endsWith(".json")) continue;
    const path = join(connectionsDir, name);
    let json;
    try {
      json = JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      continue;
    }
    if (json && json.discriminator === PRICEFX_DISCRIMINATOR) {
      return { path, json };
    }
  }
  throw new Error(
    `No Pricefx connection (discriminator ${PRICEFX_DISCRIMINATOR}) found in ${connectionsDir}`
  );
}

export function getProjectConnectionConfig(projectRoot = process.cwd()) {
  const root = resolve(projectRoot);
  const connectionsDir = join(root, "src/main/resources/repo/connections");
  const { path: connFile, json } = findPricefxConnectionFile(connectionsDir);

  const { id, uri, partition, username } = json;
  if (!uri || !partition || !username) {
    throw new Error(
      `Connection ${connFile} is missing one of: uri, partition, username`
    );
  }

  const secretsPath = join(root, "src/main/resources/local-secret.properties");
  if (!existsSync(secretsPath)) {
    throw new Error(`local-secret.properties not found at ${secretsPath}`);
  }
  const props = parseProperties(readFileSync(secretsPath, "utf-8"));

  const passwordKey = `connections.${id}.password`;
  const password = props[passwordKey];
  if (!password) {
    throw new Error(
      `Password not found in ${secretsPath} (expected key: ${passwordKey})`
    );
  }

  return {
    url: normalizePricefxUrl(uri),
    partition,
    username,
    password,
  };
}

/**
 * Resolve connection config, preferring the project's connection JSON +
 * local-secret.properties. Falls back to the .env-based config if the
 * project files are missing or incomplete.
 */
export function resolveConnectionConfig(projectRoot = process.cwd()) {
  try {
    return getProjectConnectionConfig(projectRoot);
  } catch (projectErr) {
    try {
      return getConnectionConfig();
    } catch (envErr) {
      throw new Error(
        `Could not resolve Pricefx connection.\n` +
        `  Project config: ${projectErr.message}\n` +
        `  .env fallback:  ${envErr.message}`
      );
    }
  }
}
