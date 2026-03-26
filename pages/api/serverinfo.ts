import { NextApiRequest, NextApiResponse } from 'next';
import os from 'os';
import { ensureSharedDir, SHARED_DIR } from '../../lib/files';

function getLocalIP(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  // Ensure the shared directory exists on each info request/startup
  try { ensureSharedDir(); } catch (err) { /* ignore */ }

  const ip = getLocalIP();
  const port = process.env.PORT || '3000';
  const path = require('path');
  const sharedDirAbsolute = path.resolve(SHARED_DIR);
  // Return the absolute path for display (no ~ or ./ shortening)
  res.status(200).json({ ip, port, url: `http://${ip}:${port}`, sharedDir: sharedDirAbsolute, sharedDirDisplay: sharedDirAbsolute });
}
