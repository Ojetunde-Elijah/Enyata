import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Redis } from '@upstash/redis';
import type { Customer, Invoice, Product } from '../src/types.ts';

export const WORKSPACE_VERSION = 1 as const;

export interface WorkspaceInterswitch {
  merchantCode: string;
  payItemId: string;
  clientId: string;
  secretKey: string;
  mode: 'TEST' | 'LIVE';
  tillAlias: string;
  dataRef: string;
}

export interface WorkspaceProfile {
  businessLegalName: string;
  registeredAddress: string;
  interswitch: WorkspaceInterswitch;
}

export interface WorkspaceData {
  version: typeof WORKSPACE_VERSION;
  email: string;
  passwordHash: string;
  sessionToken: string;
  profile: WorkspaceProfile;
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'workspace.json');
const WORKSPACE_KEY = 'kolet:workspace';

const hasUpstashRedis =
  typeof process.env.UPSTASH_REDIS_REST_URL === 'string' &&
  process.env.UPSTASH_REDIS_REST_URL.trim() !== '' &&
  typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string' &&
  process.env.UPSTASH_REDIS_REST_TOKEN.trim() !== '';

// Use Redis in Vercel/serverless for reliable persistence; fall back to local filesystem for dev.
const redis = hasUpstashRedis ? Redis.fromEnv() : null;

export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readWorkspace(): Promise<WorkspaceData | null> {
  try {
    if (redis) {
      const raw = await redis.get<string>(WORKSPACE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WorkspaceData;
      if (parsed.version !== WORKSPACE_VERSION) return null;
      return parsed;
    }

    const raw = await readFile(FILE, 'utf-8');
    const parsed = JSON.parse(raw) as WorkspaceData;
    if (parsed.version !== WORKSPACE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWorkspace(data: WorkspaceData): Promise<void> {
  if (redis) {
    await redis.set(WORKSPACE_KEY, JSON.stringify(data));
    return;
  }

  await ensureDataDir();
  await writeFile(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function maskClientId(id: string): string {
  const t = id.trim();
  if (t.length <= 4) return '••••';
  return `••••${t.slice(-4)}`;
}
