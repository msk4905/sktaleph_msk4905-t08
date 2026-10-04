import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { route, send } from '../../lib/http.js';
import { storeChallenge } from '../../lib/challenge.js';
import { RP_ID, OPTIONS_TIMEOUT_MS } from '../../lib/config.js';

export default route(['POST'], async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    timeout: OPTIONS_TIMEOUT_MS,
  });
  await storeChallenge({ challenge: options.challenge, purpose: 'login' });
  send(res, 200, options);
});
