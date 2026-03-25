import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR } from '@/lib/files';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { from, to } = req.body as { from: string; to: string };
  if (!from || !to) return res.status(400).json({ error: 'Missing from/to' });

  const safeFrom = path.basename(from);
  const safeTo = path.basename(to);

  if (!safeTo || safeTo.includes('/') || safeTo.includes('\\'))
    return res.status(400).json({ error: 'Invalid name' });

  const srcPath = path.join(SHARED_DIR, safeFrom);
  const dstPath = path.join(SHARED_DIR, safeTo);

  if (!srcPath.startsWith(SHARED_DIR) || !dstPath.startsWith(SHARED_DIR))
    return res.status(403).json({ error: 'Forbidden' });

  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Not found' });
  if (fs.existsSync(dstPath)) return res.status(409).json({ error: 'Name already exists' });

  try {
    fs.renameSync(srcPath, dstPath);
    res.status(200).json({ renamed: safeTo });
  } catch {
    res.status(500).json({ error: 'Rename failed' });
  }
}
