import { RP_ID, ORIGIN } from './config.js';

export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function route(methods, handler) {
  return async function wrapped(req, res) {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        throw new HttpError(405, 'method_not_allowed');
      }
      if (!RP_ID || !ORIGIN) {
        throw new Error('RP_ID / RP_ORIGIN is not set');
      }
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        return send(res, err.status, { error: err.code });
      }
      console.error(err);
      return send(res, 500, { error: 'server_error' });
    }
  };
}

export function readBody(req) {
  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  return {};
}
