import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { query } from '../../lib/db.js';
import { HttpError, readBody, route, send } from '../../lib/http.js';
import { createSession } from '../../lib/session.js';
import { challengeFromResponse, consumeChallenge } from '../../lib/challenge.js';
import { RP_ID, ORIGIN } from '../../lib/config.js';

export default route(['POST'], async (req, res) => {
  const { response } = readBody(req);
  if (!response || typeof response !== 'object' || typeof response.id !== 'string') {
    throw new HttpError(400, 'invalid_response');
  }

  const challenge = challengeFromResponse(response);
  await consumeChallenge(challenge, 'login', 401);

  const { rows } = await query(
    `SELECT id, user_id, credential_id, public_key, counter, transports
       FROM credentials
      WHERE credential_id = $1`,
    [response.id],
  );
  const stored = rows[0];
  if (!stored) throw new HttpError(401, 'unknown_credential');

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(stored.public_key),
        counter: Number(stored.counter),
        transports: stored.transports,
      },
    });
  } catch {
    throw new HttpError(401, 'verification_failed');
  }
  if (!verification.verified) throw new HttpError(401, 'verification_failed');

  await query('UPDATE credentials SET counter = $1 WHERE id = $2', [
    verification.authenticationInfo.newCounter,
    stored.id,
  ]);
  await createSession(res, stored.user_id);
  send(res, 200, { ok: true });
});
