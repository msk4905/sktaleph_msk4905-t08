import { route, send } from '../../lib/http.js';
import { destroySession } from '../../lib/session.js';

export default route(['POST'], async (req, res) => {
  await destroySession(req, res);
  send(res, 200, { ok: true });
});
