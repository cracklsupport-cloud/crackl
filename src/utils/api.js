/**
 * CRACKL — Backend API helpers
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';
const configuredBackend = process.env.EXPO_PUBLIC_BACKEND_URL;
export const BACKEND = configuredBackend || (isWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000');

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
  const token = await AsyncStorage.getItem('crackl_token');
  return fetch(`${BACKEND}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(r => r.json());
}
