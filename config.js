import { Platform } from 'react-native';

function resolveBackendUrl() {
  const configuredBackend = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (configuredBackend) return configuredBackend.replace(/\/$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const localHost = hostname === 'localhost' || hostname === '127.0.0.1';
    return localHost ? 'http://localhost:3000' : `${protocol}//${hostname}`;
  }

  return 'http://10.0.2.2:3000';
}

export const CONFIG = {
  BACKEND_URL: resolveBackendUrl(),
};
