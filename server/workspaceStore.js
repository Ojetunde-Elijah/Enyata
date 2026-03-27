import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Redis } from '@upstash/redis';

export const WORKSPACE_VERSION = 2; // bumped to 2 for wallet changes

// Local/demo fallback storage.
const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'workspace.json');
const WORKSPACE_KEY = 'kolet:workspace';

const hasUpstashRedis =
  typeof process.env.UPSTASH_REDIS_REST_URL === 'string' &&
  process.env.UPSTASH_REDIS_REST_URL.trim() !== '' &&
  typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string' &&
  process.env.UPSTASH_REDIS_REST_TOKEN.trim() !== '';

const redis = hasUpstashRedis ? Redis.fromEnv() : null;

export async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readWorkspace() {
  try {
    if (redis) {
      const raw = await redis.get(WORKSPACE_KEY);
      if (!raw) return null;
      let parsed;
      if (typeof raw === 'string') {
          parsed = JSON.parse(raw);
      } else {
          parsed = raw;
      }
      return parsed;
    }

    const raw = await readFile(FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWorkspace(data) {
  if (redis) {
    await redis.set(WORKSPACE_KEY, JSON.stringify(data));
    return;
  }

  await ensureDataDir();
  await writeFile(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

export function newSessionToken() {
  return randomBytes(32).toString('hex');
}

export function maskClientId(id) {
  const t = id.trim();
  if (t.length <= 4) return '••••';
  return `••••${t.slice(-4)}`;
}
