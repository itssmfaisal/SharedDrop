import { NextApiRequest, NextApiResponse } from 'next';
import os from 'os';

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
  const ip = getLocalIP();
  const port = process.env.PORT || '3000';
  res.status(200).json({ ip, port, url: `http://${ip}:${port}` });
}
