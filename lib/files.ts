import fs from 'fs';
import path from 'path';

export const SHARED_DIR = path.join(process.cwd(), 'shared_files');

export function ensureSharedDir() {
  if (!fs.existsSync(SHARED_DIR)) {
    fs.mkdirSync(SHARED_DIR, { recursive: true });
  }
}

export interface FileInfo {
  name: string;
  size: number;
  modified: string;
  ext: string;
  isDir: boolean;
}

export function listFiles(subfolder = ''): FileInfo[] {
  ensureSharedDir();
  const dir = subfolder ? path.join(SHARED_DIR, subfolder) : SHARED_DIR;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.map((entry) => {
    const filePath = path.join(dir, entry.name);
    const stat = fs.statSync(filePath);
    const ext = entry.isFile() ? path.extname(entry.name).toLowerCase().replace('.', '') : '';
    return {
      name: entry.name,
      size: stat.size,
      modified: stat.mtime.toISOString(),
      ext,
      isDir: entry.isDirectory(),
    };
  }).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}