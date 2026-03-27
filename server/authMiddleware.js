import { getUserBySession } from './workspaceStore.js';

export async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = h.slice(7).trim();
  const user = await getUserBySession(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  req.workspace = user;
  next();
}
