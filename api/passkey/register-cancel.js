import { query } from '../../lib/db.js';
import { HttpError, readBody, route, send } from '../../lib/http.js';

export default route(['POST'], async (req, res) => {
  const { challenge } = readBody(req);
  if (typeof challenge !== 'string' || challenge.length === 0 || challenge.length > 200) {
    throw new HttpError(400, 'invalid_challenge');
  }
  const result = await query(
    `DELETE FROM challenges
      WHERE challenge = $1 AND purpose = 'register' AND used_at IS NULL`,
    [challenge],
  );
  send(res, 200, { ok: true, removed: result.rowCount });
});
