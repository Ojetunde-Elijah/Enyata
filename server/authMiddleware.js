import { readWorkspace } from './workspaceStore.js';

export async function authMiddleware(req, res, next) {
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
  req.workspace = w;
  next();
}
