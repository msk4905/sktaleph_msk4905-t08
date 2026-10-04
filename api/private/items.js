import { query } from '../../lib/db.js';
import { HttpError, readBody, route, send } from '../../lib/http.js';
import { requireSession } from '../../lib/session.js';

export default route(['GET', 'POST'], async (req, res) => {
  const session = await requireSession(req);

  if (req.method === 'GET') {
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
