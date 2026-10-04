import { route, send } from '../lib/http.js';
import { getSession } from '../lib/session.js';

export default route(['GET'], async (req, res) => {
  const session = await getSession(req);
  if (!session) return send(res, 200, { authenticated: false });
  send(res, 200, { authenticated: true, username: session.username });
});
