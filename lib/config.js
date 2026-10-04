const onVercel = Boolean(process.env.VERCEL);

export const RP_ID = process.env.RP_ID || (onVercel ? '' : 'localhost');
export const ORIGIN = process.env.RP_ORIGIN || (onVercel ? '' : 'http://localhost:3000');
export const RP_NAME = '김민석 소개 페이지';
export const SECURE_COOKIE = ORIGIN.startsWith('https://');

export const CHALLENGE_TTL_MS = 2 * 60 * 1000;
export const OPTIONS_TIMEOUT_MS = 60 * 1000;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
