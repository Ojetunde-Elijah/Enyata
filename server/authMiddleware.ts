import type { NextFunction, Request, Response } from 'express';
import { readWorkspace, type WorkspaceData } from './workspaceStore.js';

export type AuthedRequest = Request & { workspace: WorkspaceData };

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = h.slice(7);
  const w = await readWorkspace();
  if (!w || w.sessionToken !== token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as AuthedRequest).workspace = w;
  next();
}
