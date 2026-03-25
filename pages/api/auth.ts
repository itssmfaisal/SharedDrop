import { NextApiRequest, NextApiResponse } from 'next';

// PIN stored in env var SHAREDDROP_PIN. If not set, auth is disabled.
export const PIN = process.env.SHAREDDROP_PIN || '';

export function isPinEnabled() {
  return PIN.length > 0;
}

export function isAuthed(req: NextApiRequest): boolean {
  if (!isPinEnabled()) return true;
  const cookie = req.cookies?.['shareddrop_auth'];
  return cookie === PIN;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!isPinEnabled()) {
    return res.status(200).json({ ok: true, pinEnabled: false });
  }

  const { pin } = req.body as { pin: string };
  if (pin === PIN) {
    res.setHeader('Set-Cookie', `shareddrop_auth=${PIN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: 'Wrong PIN' });
}
