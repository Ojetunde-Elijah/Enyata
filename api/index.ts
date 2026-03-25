import express from 'express';
import { registerApiRoutes } from '../server/routes.js';

const app = express();
registerApiRoutes(app);

function asPathString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 1 && typeof v[0] === 'string') return v[0];
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return (v as string[]).join('/');
  return null;
}

// Vercel rewrite-forwarded API handler.
// It rewrites `/api/*` -> `/api/index?path=*`, then fixes `req.url` so Express routing still matches `/api/...`.
export default function handler(req: any, res: any): void {
  const pathParam = asPathString(req?.query?.path) ?? '';
  const finalPath = pathParam ? `/api/${pathParam.replace(/^\/+/, '')}` : '/api';

  // Preserve any additional query params (except `path`).
  const base = `http://localhost`;
  const u = new URL(req?.url ?? '/api/index', base);
  u.searchParams.delete('path');

  const search = u.searchParams.toString();
  req.url = `${finalPath}${search ? `?${search}` : ''}`;

  app(req, res);
}

