import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { query, withTransaction } from '../../lib/db.js';
import { HttpError, readBody, route, send } from '../../lib/http.js';
import { createSession, requireSession } from '../../lib/session.js';
import { challengeFromResponse, consumeChallenge } from '../../lib/challenge.js';
import { RP_ID, ORIGIN } from '../../lib/config.js';

function parseName(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_name');
  const name = value.normalize('NFC').trim();
  if (!/^[^\p{C}]{1,40}$/u.test(name)) throw new HttpError(400, 'invalid_name');
  return name;
}

const INSERT_CREDENTIAL = `
  INSERT INTO credentials
    (user_id, credential_id, public_key, counter, transports, device_type, backed_up, name)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

export default route(['POST'], async (req, res) => {
  const body = readBody(req);
  const name = parseName(body.name);
  const response = body.response;
  if (!response || typeof response !== 'object') throw new HttpError(400, 'invalid_response');

  const challenge = challengeFromResponse(response);
  const row = await consumeChallenge(challenge, 'register', 400);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch {
    throw new HttpError(400, 'verification_failed');
  }
  if (!verification.verified) throw new HttpError(400, 'verification_failed');

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const credentialValues = [
    credential.id,
    Buffer.from(credential.publicKey),
    credential.counter,
    credential.transports ?? [],
    credentialDeviceType,
    credentialBackedUp,
    name,
  ];

  if (row.user_id) {
    const session = await requireSession(req);
    if (session.userId !== row.user_id) throw new HttpError(403, 'forbidden');
    try {
      await query(INSERT_CREDENTIAL, [row.user_id, ...credentialValues]);
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'credential_already_registered');
      throw err;
    }
    return send(res, 201, { ok: true, name });
  }

  let userId;
  try {
    userId = await withTransaction(async (client) => {
      const inserted = await client.query(
        'INSERT INTO users (username, webauthn_user_id) VALUES ($1, $2) RETURNING id',
        [row.pending_username, row.pending_user_handle],
      );
      await client.query(INSERT_CREDENTIAL, [inserted.rows[0].id, ...credentialValues]);
      return inserted.rows[0].id;
    });
  } catch (err) {
    if (err.code === '23505') {
      const dup = String(err.constraint || '').includes('credential')
        ? 'credential_already_registered'
        : 'username_taken';
      throw new HttpError(409, dup);
    }
    throw err;
  }
  await createSession(res, userId);
  send(res, 201, { ok: true, name, username: row.pending_username });
});
