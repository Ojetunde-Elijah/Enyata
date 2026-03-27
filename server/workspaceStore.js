import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Redis } from '@upstash/redis';

export const WORKSPACE_VERSION = 2; // bumped to 2 for wallet changes

// Local/demo fallback storage.
const isVercel = process.env.VERCEL === '1' || !!process.env.NOW_REGION;
const DATA_DIR = isVercel 
  ? path.join(tmpdir(), 'kolet-paye-data')
  : path.join(process.cwd(), 'data');

const FILE_PREFIX = 'user_';
const SESSION_PREFIX = 'kolet:session:';
const USER_PREFIX = 'kolet:user:';
const hasUpstashRedis =
  typeof process.env.UPSTASH_REDIS_REST_URL === 'string' &&
  process.env.UPSTASH_REDIS_REST_URL.trim() !== '' &&
  typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string' &&
  process.env.UPSTASH_REDIS_REST_TOKEN.trim() !== '';

const redis = hasUpstashRedis ? Redis.fromEnv() : null;

if (redis) {
  console.log('[Storage] Multi-user Redis storage initialized.');
} else {
  console.log('[Storage] Falling back to local/ephemeral storage.');
}

function localFile(email) {
  const safe = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return path.join(DATA_DIR, `${FILE_PREFIX}${safe}.json`);
}

export async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readUser(email) {
  if (!email) return null;
  try {
    if (redis) {
      const raw = await redis.get(`${USER_PREFIX}${email.toLowerCase()}`);
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    const raw = await readFile(localFile(email), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeUser(data) {
  const email = data.email?.toLowerCase();
  if (!email) throw new Error('Email is required to save user');

  if (redis) {
    await redis.set(`${USER_PREFIX}${email}`, JSON.stringify(data));
    return;
  }

  await ensureDataDir();
  await writeFile(localFile(email), JSON.stringify(data, null, 2), 'utf-8');
}

export async function saveSession(token, email) {
  if (redis) {
    await redis.set(`${SESSION_PREFIX}${token}`, email.toLowerCase());
    return;
  }
  // Local fallback: we'll just use a shared sessions file for simplicity in dev
  const sessFile = path.join(DATA_DIR, 'sessions.json');
  let sessions = {};
  try {
    sessions = JSON.parse(await readFile(sessFile, 'utf-8'));
  } catch {}
  sessions[token] = email.toLowerCase();
  await ensureDataDir();
  await writeFile(sessFile, JSON.stringify(sessions));
}

export async function getUserBySession(token) {
  if (!token) return null;
  try {
    let email = null;
    if (redis) {
      email = await redis.get(`${SESSION_PREFIX}${token}`);
    } else {
      const sessFile = path.join(DATA_DIR, 'sessions.json');
      const sessions = JSON.parse(await readFile(sessFile, 'utf-8'));
      email = sessions[token];
    }
    if (!email) return null;
    return await readUser(email);
  } catch {
    return null;
  }
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
