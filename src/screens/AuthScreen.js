import React, { useState, useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { BACKEND } from '../utils/api';
import { useLoginTheme } from '../utils/useLoginTheme';
import AuthThemeDefault from './auth/AuthThemeDefault';
import AuthThemeAlternate from './auth/AuthThemeAlternate';
import { LEGAL_UPDATED_AT } from '../legal/legalContent';

WebBrowser.maybeCompleteAuthSession();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;
const KNOWN_COLLEGES = [
  'BMS College of Engineering',
  'BMS Institute of Technology and Management',
  'R. V. College of Engineering',
];

const normalizeEmail = (value) => value.trim().toLowerCase();
const normalizeUsername = (value) => value.trim();
const isValidEmail = (value) => EMAIL_PATTERN.test(normalizeEmail(value));
const isValidUsername = (value) => USERNAME_PATTERN.test(normalizeUsername(value));

export default function AuthScreen({ onLogin, onSignup, openLegal }) {
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
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [tagAvail, setTagAvail] = useState(null);
  const [tagStatus, setTagStatus] = useState('idle');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const tagRequestId = useRef(0);

  const themeIndex = useLoginTheme();
  const clickPlayer = useAudioPlayer('https://actions.google.com/sounds/v1/interfaces/button_push.ogg', { updateInterval: 1000 });

  async function clickSound() {
    try {
      clickPlayer.seekTo(0).catch(() => {});
      clickPlayer.play();
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
      setLegalAccepted(false);
    }
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' })
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

  async function postAuth(path, body) {
    const res = await fetch(`${BACKEND}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Server returned an invalid response');
    }

    if (!res.ok && data.success !== false) {
      return { success: false, error: data.error || 'Request failed. Please try again.' };
    }
    return data;
  }

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '390951190011-kbr163o37gut8kldjekp48pisdh8j5i1.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
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
    if (loading) return;
    clickSound();
    clearMessages();
    setLoading(true);
    let completedAuth = false;

    try {
      if (step === 'login') {
        const login = loginId.trim();
        if (!login || !pass) { setErr('Fill in all fields'); return; }
        const data = await postAuth('/auth/login', { loginId: login, password: pass });
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
        if (!legalAccepted) { setErr('Accept the Terms, Privacy, Fair Play, and Rewards rules to create an account.'); return; }
        const resolvedCollege = KNOWN_COLLEGES.find(c => c.toLowerCase() === collegeName.toLowerCase()) || 'Other';
        const data = await postAuth('/auth/signup', {
          username,
          email: safeEmail,
          password: pass,
          college: resolvedCollege,
          legalAccepted: true,
          legalVersion: LEGAL_UPDATED_AT,
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
    showPass, setShowPass, remember, setRemember, legalAccepted, setLegalAccepted,
    loading, err, notice, tagAvail, tagStatus,
    switchStep, checkTag, handleAction, promptAsync, request, handleGoogleSignIn,
    handleAppleSignIn, openLegal,
    fadeAnim,
  };

  const ThemeComponent = themeIndex === 0 ? AuthThemeDefault : AuthThemeAlternate;
  return <ThemeComponent {...themeProps} />;
}
