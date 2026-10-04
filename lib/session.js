import { createHash, randomBytes } from 'node:crypto';
import { query } from './db.js';
import { HttpError } from './http.js';
import { SECURE_COOKIE, SESSION_TTL_MS } from './config.js';

const COOKIE_NAME = 'sid';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function readToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === COOKIE_NAME) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

function cookieString(value, maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (SECURE_COOKIE) parts.push('Secure');
  return parts.join('; ');
}

export async function createSession(res, userId) {
  await query('DELETE FROM sessions WHERE expires_at < now()');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(token), userId, expiresAt],
  );
  res.setHeader('Set-Cookie', cookieString(token, SESSION_TTL_MS / 1000));
}

export async function getSession(req) {
  const token = readToken(req);
  if (!token) return null;
  const { rows } = await query(
    `SELECT u.id AS user_id, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  if (!rows[0]) return null;
  return { userId: rows[0].user_id, username: rows[0].username };
}

export async function requireSession(req) {
  const session = await getSession(req);
  if (!session) throw new HttpError(401, 'not_authenticated');
  return session;
}

export async function destroySession(req, res) {
  const token = readToken(req);
  if (token) {
    await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }
  res.setHeader('Set-Cookie', cookieString('', 0));
}
