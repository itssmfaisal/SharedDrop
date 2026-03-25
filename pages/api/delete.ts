import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR } from '@/lib/files';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const { name, subfolder } = req.query;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'No filename' });

  const safe = path.basename(name);
  const base = subfolder && typeof subfolder === 'string'
    ? path.join(SHARED_DIR, path.normalize(subfolder).replace(/^(\.\.[/\\])+/, ''))
    : SHARED_DIR;
  const target = path.join(base, safe);

  if (!target.startsWith(SHARED_DIR)) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'Not found' });

  try {
    fs.rmSync(target, { recursive: true });
    res.status(200).json({ deleted: safe });
  } catch {
    res.status(500).json({ error: 'Delete failed' });
  }
}