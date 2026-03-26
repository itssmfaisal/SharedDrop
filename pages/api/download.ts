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
  if (!target.startsWith(SHARED_DIR)) return res.status(404).end();

  // If an .mkv was requested but a .mp4 counterpart exists (from background transcode), serve that instead
  let actualTarget = target;
  let safeName = safe;
  let ext = path.extname(safe).toLowerCase();
  if (ext === '.mkv') {
    const mp4Alt = target.replace(/\.mkv$/i, '.mp4');
    if (fs.existsSync(mp4Alt)) {
      actualTarget = mp4Alt;
      safeName = path.basename(mp4Alt);
      ext = '.mp4';
    }
  }

  if (!fs.existsSync(actualTarget)) return res.status(404).end();
  const stat = fs.statSync(actualTarget);

  // Detect mime type manually (no external dep needed for preview)
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg', '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf', '.txt': 'text/plain',
  };
  const mimeType = mimeMap[ext] || 'application/octet-stream';

  // For preview: inline. For unknown types: attachment (download)
  const disposition = mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')
    ? 'inline'
    : `attachment; filename="${safeName}"`;

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', disposition);
  res.setHeader('Accept-Ranges', 'bytes');

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    if (isNaN(start) || isNaN(end) || start >= stat.size) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }
    const chunkSize = (end - start) + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', String(chunkSize));
    const stream = fs.createReadStream(actualTarget, { start, end });
    stream.pipe(res);
  } else {
    res.setHeader('Content-Length', String(stat.size));
    const stream = fs.createReadStream(actualTarget);
    stream.pipe(res);
  }
}
