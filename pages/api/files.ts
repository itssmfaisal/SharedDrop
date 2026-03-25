import { NextApiRequest, NextApiResponse } from 'next';
import { listFiles, SHARED_DIR } from '@/lib/files';
import path from 'path';
import fs from 'fs';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { subfolder } = req.query;
  let subfolderStr = '';

  if (subfolder && typeof subfolder === 'string') {
    subfolderStr = path.normalize(subfolder).replace(/^(\.\.[/\\])+/, '');
    const target = path.join(SHARED_DIR, subfolderStr);
    if (!target.startsWith(SHARED_DIR)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Not found' });
  }

  try {
    const files = listFiles(subfolderStr);
    res.status(200).json({ files });
  } catch {
    res.status(500).json({ error: 'Failed to list files' });
  }
}
