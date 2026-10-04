import { query, withTransaction } from '../lib/db.js';
import { HttpError, route, send } from '../lib/http.js';
import { requireSession } from '../lib/session.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default route(['GET', 'DELETE'], async (req, res) => {
  const session = await requireSession(req);

  if (req.method === 'GET') {
    const { rows } = await query(
      'SELECT id, name, created_at FROM credentials WHERE user_id = $1 ORDER BY created_at',
      [session.userId],
    );
    return send(res, 200, { count: rows.length, passkeys: rows });
  }

  const id = req.query.id;
  if (typeof id !== 'string' || !UUID.test(id)) throw new HttpError(400, 'invalid_id');

  const remaining = await withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [session.userId]);
    const own = await client.query(
      'SELECT id FROM credentials WHERE id = $1 AND user_id = $2',
      [id, session.userId],
    );
    if (own.rows.length === 0) throw new HttpError(404, 'not_found');
    const count = await client.query(
      'SELECT count(*)::int AS n FROM credentials WHERE user_id = $1',
      [session.userId],
    );
    if (count.rows[0].n <= 1) throw new HttpError(409, 'last_passkey');
    await client.query('DELETE FROM credentials WHERE id = $1', [id]);
    return count.rows[0].n - 1;
  });
  send(res, 200, { ok: true, remaining });
});
