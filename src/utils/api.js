/**
 * CRACKL — Backend API helpers
 */

const BACKEND = 'http://localhost:3000';

export { BACKEND };

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  return res.json();
}

export async function apiPost(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiGet(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND}${path}`, { headers });
  return res.json();
}
