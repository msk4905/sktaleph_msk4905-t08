import { randomBytes } from 'node:crypto';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { query } from '../../lib/db.js';
import { HttpError, readBody, route, send } from '../../lib/http.js';
import { requireSession } from '../../lib/session.js';
import { storeChallenge } from '../../lib/challenge.js';
import { RP_ID, RP_NAME, OPTIONS_TIMEOUT_MS } from '../../lib/config.js';

function parseUsername(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_username');
  const username = value.normalize('NFC').trim();
  if (!/^[^\p{C}]{1,40}$/u.test(username)) throw new HttpError(400, 'invalid_username');
  return username;
}

export default route(['POST'], async (req, res) => {
  const body = readBody(req);

  let username;
  let userHandle;
  let excludeCredentials = [];
  let userId = null;
  let pendingUsername = null;
  let pendingUserHandle = null;

  if (body.mode === 'add') {
    const session = await requireSession(req);
    const { rows } = await query(
      `SELECT u.username, u.webauthn_user_id, c.credential_id, c.transports
         FROM users u
         LEFT JOIN credentials c ON c.user_id = u.id
        WHERE u.id = $1`,
      [session.userId],
    );
    username = rows[0].username;
    userHandle = Buffer.from(rows[0].webauthn_user_id, 'base64url');
    excludeCredentials = rows
      .filter((r) => r.credential_id)
      .map((r) => ({ id: r.credential_id, transports: r.transports }));
    userId = session.userId;
  } else if (body.mode === 'new-account') {
    username = parseUsername(body.username);
    const taken = await query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (taken.rows.length > 0) throw new HttpError(409, 'username_taken');
    userHandle = randomBytes(32);
    pendingUsername = username;
    pendingUserHandle = userHandle.toString('base64url');
  } else {
    throw new HttpError(400, 'invalid_mode');
  }

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    userDisplayName: username,
    userID: new Uint8Array(userHandle),
    attestationType: 'none',
    timeout: OPTIONS_TIMEOUT_MS,
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  await storeChallenge({
    challenge: options.challenge,
    purpose: 'register',
    userId,
    pendingUsername,
    pendingUserHandle,
  });

  send(res, 200, options);
});
