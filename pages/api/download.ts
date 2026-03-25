import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR } from '@/lib/files';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { name, subfolder } = req.query;
  if (!name || typeof name !== 'string') return res.status(400).end();

  const safe = path.basename(name);
  const base = subfolder && typeof subfolder === 'string'
    ? path.join(SHARED_DIR, path.normalize(subfolder).replace(/^(\.\.[/\\])+/, ''))
    : SHARED_DIR;
  const target = path.join(base, safe);

  if (!target.startsWith(SHARED_DIR) || !fs.existsSync(target)) return res.status(404).end();

  const stat = fs.statSync(target);

  // Detect mime type manually (no external dep needed for preview)
  const ext = path.extname(safe).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
    '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf', '.txt': 'text/plain',
  };
  const mimeType = mimeMap[ext] || 'application/octet-stream';

  // For preview: inline. For unknown types: attachment (download)
  const disposition = mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')
    ? 'inline'
    : `attachment; filename="${safe}"`;

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', disposition);
  res.setHeader('Accept-Ranges', 'bytes');

  const stream = fs.createReadStream(target);
  stream.pipe(res);
}
