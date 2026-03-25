import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR } from '@/lib/files';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { from, to } = req.body as { from: string; to: string };
  if (!from || !to) return res.status(400).json({ error: 'Missing from/to' });

  // Normalize user-supplied paths and resolve against SHARED_DIR
  const normalizedFrom = path.normalize(from).replace(/^([/\\])+/, '');
  const normalizedTo = path.normalize(to).replace(/^([/\\])+/, '');

  const srcPath = path.resolve(SHARED_DIR, normalizedFrom);
  const dstPath = path.resolve(SHARED_DIR, normalizedTo);

  // Ensure both paths are inside SHARED_DIR
  const sharedDirResolved = path.resolve(SHARED_DIR);
  if (!srcPath.startsWith(sharedDirResolved + path.sep) && srcPath !== sharedDirResolved)
    return res.status(403).json({ error: 'Forbidden' });
  if (!dstPath.startsWith(sharedDirResolved + path.sep) && dstPath !== sharedDirResolved)
    return res.status(403).json({ error: 'Forbidden' });

  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Not found' });
  if (fs.existsSync(dstPath)) return res.status(409).json({ error: 'Name already exists' });

  // Ensure destination directory exists
  const dstDir = path.dirname(dstPath);
  if (!fs.existsSync(dstDir)) return res.status(400).json({ error: 'Destination directory does not exist' });

  try {
    fs.renameSync(srcPath, dstPath);
    res.status(200).json({ renamed: path.relative(sharedDirResolved, dstPath) });
  } catch (err) {
    console.error('rename error', err);
    res.status(500).json({ error: 'Rename failed' });
  }
}
