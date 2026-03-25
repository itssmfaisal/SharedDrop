import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR, ensureSharedDir } from '@/lib/files';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  ensureSharedDir();

  const { name, subfolder } = req.body as { name: string; subfolder?: string };
  if (!name) return res.status(400).json({ error: 'Missing name' });

  const safeName = path.basename(name);
  const base = subfolder ? path.join(SHARED_DIR, path.normalize(subfolder).replace(/^(\.\.[/\\])+/, '')) : SHARED_DIR;
  const target = path.join(base, safeName);

  if (!target.startsWith(SHARED_DIR)) return res.status(403).json({ error: 'Forbidden' });
  if (fs.existsSync(target)) return res.status(409).json({ error: 'Already exists' });

  try {
    fs.mkdirSync(target, { recursive: true });
    res.status(200).json({ created: safeName });
  } catch {
    res.status(500).json({ error: 'Failed to create folder' });
  }
}
