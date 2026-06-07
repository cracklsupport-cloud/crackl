import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = 'crackl_user';
const TOKEN_KEY = 'crackl_token';
const isWeb = Platform.OS === 'web';

function webSession() {
  if (!isWeb || typeof window === 'undefined' || !window.sessionStorage) return null;
  return window.sessionStorage;
}

function hasWebSessionAuth(session) {
  return !!(session?.getItem(USER_KEY) || session?.getItem(TOKEN_KEY));
}

export async function getAuthToken() {
  const session = webSession();
  if (session) {
    return hasWebSessionAuth(session) ? session.getItem(TOKEN_KEY) : null;
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getStoredUser() {
  const session = webSession();
  if (session) {
    return hasWebSessionAuth(session) ? session.getItem(USER_KEY) : null;
  }
  return AsyncStorage.getItem(USER_KEY);
}

export async function saveAuthSession(user, token) {
  const serializedUser = JSON.stringify(user);
  const session = webSession();
  if (session) {
    session.setItem(USER_KEY, serializedUser);
    if (token) session.setItem(TOKEN_KEY, token);
    else session.removeItem(TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(USER_KEY, serializedUser);
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function saveSessionUser(user) {
  if (!user) return;
  const serializedUser = JSON.stringify(user);
  const session = webSession();
  if (session) {
    session.setItem(USER_KEY, serializedUser);
    return;
  }
  await AsyncStorage.setItem(USER_KEY, serializedUser);
}

export async function clearAuthSession() {
  const session = webSession();
  if (session) {
    session.removeItem(USER_KEY);
    session.removeItem(TOKEN_KEY);
  }
  await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
}
