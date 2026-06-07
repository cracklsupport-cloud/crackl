/**
 * CRACKL — Backend API helpers
 */
import { Platform } from 'react-native';
import { getAuthToken } from './authSession';

const isWeb = Platform.OS === 'web';
const configuredBackend = process.env.EXPO_PUBLIC_BACKEND_URL;

function resolveBackendUrl() {
  if (configuredBackend) return configuredBackend.replace(/\/$/, '');

  if (isWeb && typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const localHost = hostname === 'localhost' || hostname === '127.0.0.1';
    return localHost ? 'http://localhost:3000' : `${protocol}//${hostname}`;
  }

  return 'http://10.0.2.2:3000';
}

export const BACKEND = resolveBackendUrl();

export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${BACKEND}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...headers },
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

// Auto-attach stored auth token — use for any authenticated request
export async function authFetch(path, options = {}) {
  const token = await getAuthToken();
  return fetch(`${BACKEND}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(r => r.json());
}
