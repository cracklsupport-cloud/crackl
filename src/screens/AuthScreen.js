import React, { useState, useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { BACKEND } from '../utils/api';
import { useLoginTheme } from '../utils/useLoginTheme';
import { LEGAL_UPDATED_AT } from '../legal/legalContent';
import AuthThemeDefault from './auth/AuthThemeDefault';
import AuthThemeAlternate from './auth/AuthThemeAlternate';

WebBrowser.maybeCompleteAuthSession();

const readWebInputValue = (selectors) => {
  if (typeof document === 'undefined') return '';
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (input?.value) return input.value;
  }
  return '';
};

export default function AuthScreen({ onLogin, onSignup, openLegal }) {
  const [step, setStep] = useState('login');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [tag, setTag] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [otp, setOtp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [tagAvail, setTagAvail] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const themeIndex = useLoginTheme();
  const clickPlayer = useAudioPlayer('https://actions.google.com/sounds/v1/interfaces/button_push.ogg', { updateInterval: 1000 });

  async function clickSound() {
    try {
      clickPlayer.seekTo(0).catch(() => {});
      clickPlayer.play();
    } catch { }
  }

  const switchStep = (newStep) => {
    clickSound();
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
    setErr(''); setStep(newStep);
  };

  const checkTag = async (val) => {
    setTag(val); setTagAvail(null);
    if (val.length < 3) return;
    try { const res = await fetch(`${BACKEND}/auth/check-username`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: val }) }); const data = await res.json(); setTagAvail(data.available); } catch { }
  };

  const extra = Constants.expoConfig?.extra || {};
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: extra.googleWebClientId || '',
    iosClientId: extra.googleIosClientId || undefined,
    androidClientId: extra.googleAndroidClientId || undefined,
  });

  useEffect(() => { if (response?.type === 'success') handleOAuthBackendSync('google', response.authentication.idToken || response.authentication.accessToken); }, [response]);

  async function handleOAuthBackendSync(provider, token) {
    if (!token) return; setLoading(true); setErr('');
    try { const res = await fetch(`${BACKEND}/auth/oauth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, token }) }); const data = await res.json(); if (data.success) onLogin(data.user, data.token); else setErr(data.error || 'OAuth failed'); } catch { setErr('Connection error'); }
    setLoading(false);
  }

  async function handleAppleSignIn() {
    try { const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] }); handleOAuthBackendSync('apple', credential.identityToken); } catch (e) { if (e.code !== 'ERR_REQUEST_CANCELED') setErr('Apple Sign In failed'); }
  }

  async function handleAction() {
    clickSound(); setErr(''); setLoading(true);
    if (step === 'login') {
      const resolvedLoginId = (loginId || readWebInputValue(['#crackl-login-id', '[data-field="login-id"]', 'input[autocomplete="username"]'])).trim();
      const resolvedPass = pass || readWebInputValue(['#crackl-login-password', '[data-field="login-password"]', 'input[autocomplete="current-password"]', 'input[type="password"]']);
      if (resolvedLoginId && resolvedLoginId !== loginId) setLoginId(resolvedLoginId);
      if (resolvedPass && resolvedPass !== pass) setPass(resolvedPass);
      if (!resolvedLoginId || !resolvedPass) { setErr('Fill in all fields'); setLoading(false); return; }
      try { const res = await fetch(`${BACKEND}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: resolvedLoginId, password: resolvedPass }) }); const data = await res.json(); if (data.success) onLogin(data.user, data.token); else setErr(data.error); } catch { setErr('Connection Error'); }
    } else if (step === 'signup') {
      if (!tag.trim() || !email.trim() || !pass || !pass2) { setErr('Fill in all fields'); setLoading(false); return; }
      if (pass !== pass2) { setErr('Passwords do not match'); setLoading(false); return; }
      if (tagAvail === false) { setErr('Gamer Tag is taken'); setLoading(false); return; }
      if (!legalAccepted) { setErr('Accept the Terms, Privacy, Fair Play, and Rewards rules.'); setLoading(false); return; }
      try {
        const res = await fetch(`${BACKEND}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: tag.trim(), email: email.trim(), password: pass, legalAccepted: true, legalVersion: LEGAL_UPDATED_AT }) });
        const data = await res.json();
        if (data.success) {
          if (onSignup) onSignup(data.user, data.token);
          else onLogin(data.user, data.token);
        } else setErr(data.error);
      } catch { setErr('Connection Error'); }
    } else if (step === 'forgot') {
      if (!email.trim()) { setErr('Enter your email'); setLoading(false); return; }
      try { const res = await fetch(`${BACKEND}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) }); const data = await res.json(); if (data.success) { setErr(''); setStep('forgot_sent'); } else setErr(data.error); } catch { setErr('Connection Error'); }
    } else if (step === 'forgot_sent') {
      if (!otp.trim() || !pass || !pass2) { setErr('Fill in all fields'); setLoading(false); return; }
      if (pass !== pass2) { setErr('Passwords do not match'); setLoading(false); return; }
      try { const res = await fetch(`${BACKEND}/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword: pass }) }); const data = await res.json(); if (data.success) { setErr('Password reset complete. Initialize session.'); setStep('login'); } else setErr(data.error); } catch { setErr('Connection Error'); }
    }
    setLoading(false);
  }

  const themeProps = {
    step, loginId, setLoginId, email, setEmail, tag, pass, setPass, pass2, setPass2, otp, setOtp,
    showPass, setShowPass, remember, setRemember, loading, err, tagAvail,
    legalAccepted, setLegalAccepted,
    switchStep, checkTag, handleAction, promptAsync, request,
    handleAppleSignIn,
    fadeAnim,
    openLegal,
  };

  const ThemeComponent = themeIndex === 0 ? AuthThemeDefault : AuthThemeAlternate;
  return <ThemeComponent {...themeProps} />;
}
