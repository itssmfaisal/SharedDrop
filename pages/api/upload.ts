import { NextApiRequest, NextApiResponse } from 'next';
import formidable, { Fields, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR, ensureSharedDir } from '@/lib/files';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  ensureSharedDir();

  const subfolder = req.query.subfolder as string | undefined;
  let uploadDir = SHARED_DIR;

  if (subfolder) {
    const safe = path.normalize(subfolder).replace(/^(\.\.[/\\])+/, '');
    uploadDir = path.join(SHARED_DIR, safe);
    if (!uploadDir.startsWith(SHARED_DIR)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 500 * 1024 * 1024,
  });

  form.parse(req, (err: Error | null, _fields: Fields, files: Files) => {
    if (err) return res.status(500).json({ error: err.message });

    const uploaded: string[] = [];
    const fileArray = Array.isArray(files.file) ? files.file : files.file ? [files.file] : [];

    for (const file of fileArray) {
      const originalName = file.originalFilename || file.newFilename;
      const dest = path.join(uploadDir, originalName);
      const finalDest = fs.existsSync(dest)
        ? path.join(uploadDir, `${Date.now()}_${originalName}`)
        : dest;
      fs.renameSync(file.filepath, finalDest);
      uploaded.push(path.basename(finalDest));
    }

    res.status(200).json({ uploaded });
  });
}
