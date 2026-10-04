import { query } from './db.js';
import { HttpError } from './http.js';
import { CHALLENGE_TTL_MS } from './config.js';

export async function storeChallenge({
  challenge,
  purpose,
  userId = null,
  pendingUsername = null,
  pendingUserHandle = null,
}) {
  await query('DELETE FROM challenges WHERE expires_at < now()');
  await query(
    `INSERT INTO challenges
       (challenge, purpose, user_id, pending_username, pending_user_handle, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [challenge, purpose, userId, pendingUsername, pendingUserHandle, new Date(Date.now() + CHALLENGE_TTL_MS)],
  );
}

export function challengeFromResponse(response) {
  try {
    const json = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8');
    const challenge = JSON.parse(json).challenge;
    if (typeof challenge === 'string' && challenge.length > 0 && challenge.length <= 200) {
      return challenge;
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, 'invalid_response');
}

export async function consumeChallenge(challenge, purpose, failStatus) {
  const { rows } = await query(
    `UPDATE challenges
        SET used_at = now()
      WHERE challenge = $1
        AND purpose = $2
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id, pending_username, pending_user_handle`,
    [challenge, purpose],
  );
  if (rows[0]) return rows[0];

  const existing = await query(
    'SELECT used_at FROM challenges WHERE challenge = $1 AND purpose = $2',
    [challenge, purpose],
  );
  if (existing.rows[0] && existing.rows[0].used_at) {
    throw new HttpError(failStatus, 'challenge_already_used');
  }
  throw new HttpError(failStatus, 'challenge_invalid_or_expired');
}
