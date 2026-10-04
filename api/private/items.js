import { query } from '../../lib/db.js';
import { HttpError, readBody, route, send } from '../../lib/http.js';
import { requireSession } from '../../lib/session.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default route(['GET', 'POST'], async (req, res) => {
  const session = await requireSession(req);

  if (req.method === 'GET') {
    const id = req.query.id;
    if (id !== undefined) {
      if (typeof id !== 'string' || !UUID.test(id)) throw new HttpError(400, 'invalid_id');
      const found = await query(
        'SELECT id, user_id, title, body, created_at FROM private_items WHERE id = $1',
        [id],
      );
      const row = found.rows[0];
      if (!row) throw new HttpError(404, 'not_found');
      if (row.user_id !== session.userId) throw new HttpError(403, 'forbidden');
      return send(res, 200, {
        item: { id: row.id, title: row.title, body: row.body, created_at: row.created_at },
      });
    }

    const { rows } = await query(
      `SELECT id, title, body, created_at
         FROM private_items
        WHERE user_id = $1
        ORDER BY created_at`,
      [session.userId],
    );
    return send(res, 200, { count: rows.length, items: rows });
  }

  const { title, body } = readBody(req);
  if (typeof title !== 'string' || typeof body !== 'string') throw new HttpError(400, 'invalid_item');
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (cleanTitle.length < 1 || cleanTitle.length > 100 || cleanBody.length < 1 || cleanBody.length > 1000) {
    throw new HttpError(400, 'invalid_item');
  }
  const { rows } = await query(
    `INSERT INTO private_items (user_id, title, body)
     VALUES ($1, $2, $3)
     RETURNING id, title, body, created_at`,
    [session.userId, cleanTitle, cleanBody],
  );
  send(res, 201, { item: rows[0] });
});
