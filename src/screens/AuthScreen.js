import React, { useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Audio } from 'expo-av';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { BACKEND } from '../utils/api';
import { useLoginTheme } from '../utils/useLoginTheme';
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

export default function AuthScreen({ onLogin, onSignup }) {
  const [step, setStep] = useState('login');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [tag, setTag] = useState('');
  const [college, setCollege] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [otp, setOtp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [tagAvail, setTagAvail] = useState(null);
  const [tagStatus, setTagStatus] = useState('idle');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const themeIndex = useLoginTheme();

  async function clickSound() {
    try {
      const { sound: s } = await Audio.Sound.createAsync({
        uri: 'https://actions.google.com/sounds/v1/interfaces/button_push.ogg'
      });
      s.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) s.unloadAsync().catch(() => {});
      });
      await s.playAsync();
    } catch { }
  }

  const clearMessages = () => {
    setErr('');
    setNotice('');
  };

  const resetSensitiveFields = () => {
    setPass('');
    setPass2('');
    setOtp('');
    setShowPass(false);
  };

  const switchStep = (newStep) => {
    if (loading) return;
    clickSound();
    clearMessages();
    resetSensitiveFields();
    if (newStep === 'forgot' && isValidEmail(loginId)) {
      setEmail(normalizeEmail(loginId));
    }
    if (newStep === 'signup') {
      setTagAvail(null);
      setTagStatus('idle');
    }
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
    setStep(newStep);
  };

  const checkTag = async (val) => {
    setTag(val);
    setTagAvail(null);
    const username = normalizeUsername(val);
    if (!username) {
      setTagStatus('idle');
      return;
    }
    if (!isValidUsername(username)) {
      setTagStatus('invalid');
      return;
    }

    const requestId = tagRequestId.current + 1;
    tagRequestId.current = requestId;
    setTagStatus('checking');
    try {
      const data = await postAuth('/auth/check-username', { username });
      if (tagRequestId.current !== requestId) return;
      if (data.success === false) {
        setTagStatus('error');
        return;
      }
      setTagAvail(Boolean(data.available));
      setTagStatus(data.available ? 'available' : 'taken');
    } catch {
      if (tagRequestId.current === requestId) setTagStatus('error');
    }
  };

  const extra = Constants.expoConfig?.extra || {};
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: extra.googleWebClientId || '',
    iosClientId: extra.googleIosClientId || undefined,
    androidClientId: extra.googleAndroidClientId || undefined,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.idToken || response.authentication?.accessToken;
      if (!token) {
        setErr('Google did not return a sign-in token. Please try again.');
        return;
      }
      handleOAuthBackendSync('google', token);
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
      setErr(response.error?.message || 'Google Auth cancelled');
    }
  }, [response]);

  async function handleOAuthBackendSync(provider, token) {
    if (!token || loading) return;
    setLoading(true);
    clearMessages();
    let completedAuth = false;
    try {
      const data = await postAuth('/auth/oauth', { provider, token });
      if (data.success) {
        completedAuth = true;
        onLogin(data.user, data.token);
      } else {
        setErr(data.error || 'OAuth failed');
      }
    } catch (e) {
      setErr(e.message || 'Connection error');
    } finally {
      if (!completedAuth) setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (loading) return;
    try {
      clearMessages();
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        setErr('Apple Sign In is available on supported Apple devices.');
        return;
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });
      handleOAuthBackendSync('apple', credential.identityToken);
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') setErr('Apple Sign In failed');
    }
  }

  async function handleGoogleSignIn() {
    if (loading) return;
    clearMessages();
    if (!request) {
      setErr('Google Sign In is still preparing. Please try again.');
      return;
    }
    try {
      await promptAsync();
    } catch {
      setErr('Google Sign In failed to start.');
    }
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
      try {
        const res = await fetch(`${BACKEND}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: tag.trim(), email: email.trim(), password: pass }) });
        const data = await res.json();
        if (data.success) {
          completedAuth = true;
          onLogin(data.user, remember ? data.token : null);
        } else {
          setErr(data.error || 'Invalid credentials');
        }
      } else if (step === 'signup') {
        const username = normalizeUsername(tag);
        const safeEmail = normalizeEmail(email);
        const collegeName = college.trim();
        if (!username || !safeEmail || !pass || !pass2 || !collegeName) { setErr('Fill in all fields'); return; }
        if (!isValidUsername(username)) { setErr('Gamer Tag must be 3-20 letters, numbers, or underscores.'); return; }
        if (!isValidEmail(safeEmail)) { setErr('Enter a valid email address.'); return; }
        if (pass.length < MIN_PASSWORD_LENGTH) { setErr(`Access Key must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
        if (pass !== pass2) { setErr('Passwords do not match'); return; }
        if (tagStatus === 'checking') { setErr('Still checking Gamer Tag availability.'); return; }
        if (tagAvail === false || tagStatus === 'taken') { setErr('Gamer Tag is taken'); return; }
        const resolvedCollege = KNOWN_COLLEGES.find(c => c.toLowerCase() === collegeName.toLowerCase()) || 'Other';
        const data = await postAuth('/auth/signup', {
          username,
          email: safeEmail,
          password: pass,
          college: resolvedCollege,
        });
        if (data.success) {
          completedAuth = true;
          if (onSignup) onSignup(data.user, data.token);
          else onLogin(data.user, data.token);
        } else {
          setErr(data.error || 'Sign up failed');
        }
      } else if (step === 'forgot') {
        const safeEmail = normalizeEmail(email);
        if (!safeEmail) { setErr('Enter your email'); return; }
        if (!isValidEmail(safeEmail)) { setErr('Enter a valid email address.'); return; }
        const data = await postAuth('/auth/forgot-password', { email: safeEmail });
        if (data.success) {
          setEmail(safeEmail);
          resetSensitiveFields();
          setStep('forgot_sent');
          setNotice(data.message || 'If that email exists, an OTP was sent.');
        } else {
          setErr(data.error || 'Could not send reset token');
        }
      } else if (step === 'forgot_sent') {
        const safeEmail = normalizeEmail(email);
        const code = otp.trim();
        if (!safeEmail || !code || !pass || !pass2) { setErr('Fill in all fields'); return; }
        if (!/^\d{6}$/.test(code)) { setErr('Enter the 6-digit OTP code.'); return; }
        if (pass.length < MIN_PASSWORD_LENGTH) { setErr(`New Access Key must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
        if (pass !== pass2) { setErr('Passwords do not match'); return; }
        const data = await postAuth('/auth/reset-password', { email: safeEmail, otp: code, newPassword: pass });
        if (data.success) {
          resetSensitiveFields();
          setStep('login');
          setNotice(data.message || 'Password reset complete. Please sign in.');
        } else {
          setErr(data.error || 'Password reset failed');
        }
      }
    } catch (e) {
      setErr(e.message || 'Connection Error');
    } finally {
      if (!completedAuth) setLoading(false);
    }
  }

  const themeProps = {
    step, loginId, setLoginId, email, setEmail, tag, pass, setPass, pass2, setPass2, otp, setOtp,
    college, setCollege,
    showPass, setShowPass, remember, setRemember, loading, err, notice, tagAvail, tagStatus,
    switchStep, checkTag, handleAction, promptAsync, request, handleGoogleSignIn,
    handleAppleSignIn,
    fadeAnim,
  };

  const ThemeComponent = themeIndex === 0 ? AuthThemeDefault : AuthThemeAlternate;
  return <ThemeComponent {...themeProps} />;
}
