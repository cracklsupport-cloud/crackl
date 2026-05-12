import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Platform, KeyboardAvoidingView, Image, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icons from '../../components/Icons';
import { isWeb, BrainImage, GlassLabel, GlassField } from './authShared';

/* ── Crosshair Icon (SVG Replacement) ── */
function CrosshairIcon({ style }) {
  if (!isWeb) return null;
  return (
    <div style={{ ...style, width: 12, height: 12, color: 'rgba(255,255,255,0.2)' }}>
      <svg width="100%" height="100%" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 0V12" stroke="currentColor" strokeWidth="1" />
        <path d="M0 6H12" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}

/* ── Corner brackets (Bento Style) ── */
export function CornerBrackets() {
  const s = { position: 'absolute', width: 12, height: 12, borderColor: 'rgba(255,255,255,0.2)', zIndex: 10 };
  return (
    <>
      <View style={{ ...s, top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <View style={{ ...s, top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 }} />
      <View style={{ ...s, bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <View style={{ ...s, bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 }} />
    </>
  );
}

/* ── Stat block ── */
function StatBlock({ icon: IconComp, iconColor, label, value }) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 8,
    }, isWeb ? { backdropFilter: 'blur(12px)' } : {}]}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
        <IconComp size={14} color={iconColor} />
      </View>
      <View>
        <Text style={{ fontSize: 8, color: '#64748b', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 14, color: '#fff', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontWeight: '900', letterSpacing: 1 }}>{value}</Text>
      </View>
    </View>
  );
}

/* ═══ MAIN COMPONENT ═══ */
export default function AuthThemeDefault(props) {
  const {
    step, loginId, setLoginId, email, setEmail, tag, pass, setPass, pass2, setPass2, otp, setOtp,
    showPass, remember, setRemember, loading, err, tagAvail,
    switchStep, checkTag, handleAction, promptAsync, request,
    fadeAnim,
  } = props;

  const { width: winW } = useWindowDimensions();
  const isMobile = winW < 768;
  const isCompact = winW < 1100;

  const rightPaneW = isMobile ? '100%' : '50%';
  const hPad = isMobile ? 24 : isCompact ? 36 : 48;
  const heroFont = isMobile ? 40 : isCompact ? 56 : 72;
  const heroLine = isMobile ? 44 : isCompact ? 60 : 76;
  const formMb = 36;

  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });
  useEffect(() => {
    if (!isWeb) return;
    const fn = e => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
  const grotesk = isWeb ? '"Space Grotesk", sans-serif' : undefined;

  const [hoverBtn, setHoverBtn] = useState(false);

  return (
    <View style={{ width: isWeb ? '100vw' : '100%', height: isWeb ? '100vh' : '100%', flexDirection: isMobile ? 'column' : 'row', backgroundColor: '#050505', overflow: 'hidden' }}>

      {/* ── Film grain overlay ── */}
      {isWeb && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, opacity: 0.15, mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      )}

      {/* ── Mouse tracking glow ── */}
      {isWeb && !isMobile && (
        <div style={{
          position: 'fixed', width: 600, height: 600, borderRadius: '50%',
          backgroundColor: '#00ffd0', opacity: 0.2,
          filter: 'blur(150px)', mixBlendMode: 'screen',
          pointerEvents: 'none', zIndex: 0,
          transform: `translate(${mousePos.x - 300}px, ${mousePos.y - 300}px)`,
          transition: 'transform 1s cubic-bezier(0.17, 0.55, 0.55, 1)',
        }} />
      )}

      {/* ── Grid Elements (Static) ── */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', height: '100%', width: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <CrosshairIcon style={{ position: 'absolute', transform: [{ scale: 1.5 }] }} />
      </View>

      {/* ── LEFT PANE: BRANDING ── */}
      {!isMobile && (
        <View style={{
          flex: 1, height: '100%', flexDirection: 'column', position: 'relative',
          borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 10,
        }}>
          {/* Subtle bg gradient */}
          <LinearGradient colors={['#050505', '#0a0a0c']} style={{ position: 'absolute', inset: 0 }} />

          {/* Logo top-left */}
          <Animated.View style={{ zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 64, marginLeft: 64 }}>
            <View style={[{ width: 48, height: 48, backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, isWeb ? { boxShadow: '0 0 20px rgba(0,255,208,0.1)' } : {}]}>
              <Image source={BrainImage} style={{ width: 48 * 1.6, height: 48 * 1.6, resizeMode: 'cover' }} />
            </View>
            <View>
              <Text style={{ fontFamily: grotesk, fontWeight: '900', letterSpacing: 4, fontSize: 24, color: '#fff', textTransform: 'uppercase' }}>
                CRACKL <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: mono, fontSize: 14 }}>V5.0</Text>
              </Text>
            </View>
          </Animated.View>

          {/* Hero Copy */}
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 64, zIndex: 20 }}>
            {['The Ultimate', 'Brain Crack', 'Arena'].map((line) => (
              <Text
                key={line}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={[{
                  fontFamily: grotesk, fontSize: heroFont, fontWeight: '900',
                  lineHeight: heroLine, textTransform: 'uppercase',
                  letterSpacing: -2, flexShrink: 0,
                },
                isWeb ? {
                  background: 'linear-gradient(135deg, #ffffff 0%, #64748b 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text', textShadow: 'none',
                  whiteSpace: 'nowrap',
                } : {
                  color: '#ffffff',
                  textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 12,
                }]}
              >{line}</Text>
            ))}

            <View style={{ borderLeftWidth: 2, borderColor: 'rgba(0,255,208,0.5)', paddingLeft: 16, paddingVertical: 4, marginTop: 32, marginBottom: 48 }}>
              <Text style={{ fontFamily: mono, fontSize: 14, color: '#94a3b8', letterSpacing: 2, lineHeight: 28, textTransform: 'uppercase' }}>
                Outsmart the architect.{'\n'}Claim the arena.{'\n'}Win real cash.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <StatBlock icon={Icons.UsersIcon} iconColor='#00ffd0' label="Active" value="12.4K" />
              <StatBlock icon={Icons.ActivityIcon} iconColor='#a855f7' label="Latency" value="14ms" />
              <StatBlock icon={Icons.ShieldIcon} iconColor='#fbbf24' label="Protocol" value="AES-256" />
            </View>
          </View>

          {/* Brain Image (Cyberpunk style — prominent, centred-right with radial fade) */}
          <View pointerEvents="none" style={{ position: 'absolute', right: -60, top: '15%', bottom: '15%', justifyContent: 'center', alignItems: 'center', zIndex: 10, opacity: 0.85 }}>
            <Image
              source={BrainImage}
              style={{
                width: 480, height: 480, resizeMode: 'contain',
                ...(isWeb ? { filter: 'saturate(1.8) contrast(1.3) brightness(1.1)', mixBlendMode: 'screen', maskImage: 'radial-gradient(ellipse at center, black 50%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 50%, transparent 75%)' } : { opacity: 0.5, tintColor: '#00ffd0' }),
              }}
            />
          </View>
        </View>
      )}

      {/* ── RIGHT PANE — scrollable form ── */}
      <ScrollView
        style={[{
          width: rightPaneW,
          zIndex: 30,
          backgroundColor: 'transparent',
        }]}
        contentContainerStyle={{ minHeight: '100%', justifyContent: 'center', alignItems: 'center', paddingHorizontal: hPad, paddingVertical: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, width: '100%', maxWidth: 460 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>

            {/* Mobile logo */}
            {isMobile && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40, alignSelf: 'center' }}>
                <View style={{ width: 44, height: 44, backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <Image source={BrainImage} style={{ width: 44 * 1.6, height: 44 * 1.6, resizeMode: 'cover' }} />
                </View>
                <Text style={{ fontFamily: grotesk, fontWeight: '900', letterSpacing: 3, fontSize: 20, color: '#fff' }}>
                  CRACKL <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: mono, fontSize: 12 }}>V5.0</Text>
                </Text>
              </View>
            )}

            {/* Form card (Bento) */}
            <View style={[{
              width: '100%', borderRadius: 24,
              paddingHorizontal: 32, paddingVertical: 40,
              backgroundColor: 'rgba(10,10,12,0.8)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
              overflow: 'hidden', position: 'relative',
            }, isWeb ? { backdropFilter: 'blur(30px)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' } : {}]}>

              <CornerBrackets />

              {/* Form header */}
              <View style={{ marginBottom: formMb }}>
                <Text style={{ fontFamily: mono, fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: -1 }}>
                  <Text style={{ color: '#00ffd0' }}>{'>_ '}</Text>
                  {step === 'login' ? 'Initialize Session' :
                    step === 'signup' ? 'Create Identity' :
                      step === 'forgot' ? 'Override Protocol' : 'Decrypt Protocol'}
                </Text>
                <Text style={{ color: '#64748b', fontSize: 10, fontFamily: mono, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {step === 'login' ? 'Enter credentials to access the arena.' :
                    step === 'signup' ? 'Forge your alias. 100 starting credits.' : 'Follow recovery process.'}
                </Text>
              </View>

              {/* Error */}
              {err ? (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '900', textAlign: 'center', fontFamily: mono, letterSpacing: 1 }}>{err}</Text>
                </View>
              ) : null}

              {/* ── LOGIN ── */}
              {step === 'login' && (
                <View>
                  <GlassLabel>Gamer Tag or Email</GlassLabel>
                  <GlassField
                    placeholder="sys_admin@crackl.net"
                    value={loginId} onChangeText={setLoginId}
                    autoComplete="username"
                    textContentType="username"
                    nativeID="crackl-login-id"
                    name="login-id"
                    focusColor="#00ffd0"
                    icon={<Text style={{ color: '#64748b', fontFamily: mono }}>@</Text>}
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
                    <GlassLabel>Access Key</GlassLabel>
                    <TouchableOpacity onPress={() => switchStep('forgot')} style={{ marginBottom: 8, marginRight: 4 }}>
                      <Text style={{ fontFamily: mono, color: '#a855f7', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>Forgot?</Text>
                    </TouchableOpacity>
                  </View>
                  <GlassField
                    placeholder="••••••••••••••••"
                    value={pass} onChangeText={setPass}
                    secure={!showPass}
                    autoComplete="current-password"
                    textContentType="password"
                    nativeID="crackl-login-password"
                    name="login-password"
                    focusColor="#a855f7"
                    icon={<Icons.LockIcon size={14} color="#64748b" />}
                    onSubmitEditing={handleAction}
                  />

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 24, marginLeft: 4 }}
                    onPress={() => setRemember(!remember)}
                    activeOpacity={0.8}
                  >
                    <View style={[{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: remember ? '#9333ea' : 'rgba(255,255,255,0.2)', backgroundColor: remember ? '#9333ea' : '#050505', alignItems: 'center', justifyContent: 'center' }, isWeb ? { transition: 'all 0.2s ease' } : {}]}>
                      {remember && <Icons.CheckIcon size={12} color="#fff" />}
                    </View>
                    <Text style={{ fontFamily: mono, color: '#cbd5e1', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Stay synced</Text>
                  </TouchableOpacity>

                  {/* Login button */}
                  <TouchableOpacity
                    onPress={handleAction} disabled={loading}
                    onMouseEnter={() => setHoverBtn(true)}
                    onMouseLeave={() => setHoverBtn(false)}
                    style={[{ marginTop: 8, borderRadius: 12, overflow: 'hidden', opacity: loading ? 0.6 : 1 }, isWeb ? { boxShadow: hoverBtn ? '0 0 30px rgba(168,85,247,0.5)' : '0 0 20px rgba(168,85,247,0.3)', cursor: 'pointer', transition: 'all 0.3s ease' } : {}]}
                  >
                    <LinearGradient colors={hoverBtn && isWeb ? ['#8b5cf6', '#7e22ce'] : ['#9333ea', '#6b21a8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: 'center', width: '100%', flexDirection: 'row', justifyItems: 'center', justifyContent: 'center', gap: 12 }}>
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <>
                          <Text style={[{ fontFamily: mono, color: 'rgba(255,255,255,0.7)', fontWeight: '900' }, isWeb ? { filter: hoverBtn ? 'brightness(1.5)' : 'brightness(1)', transition: 'all 0.3s ease' } : {}]}>{'>_ '}</Text>
                          <Text style={{ fontFamily: grotesk, color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' }}>Login to CRACKL</Text>
                          <View style={isWeb && hoverBtn ? { transform: [{ translateX: 8 }], transition: 'transform 0.3s ease' } : { transition: 'transform 0.3s ease' }}>
                            <Icons.ChevronRightIcon size={16} color="#fff" />
                          </View>
                        </>
                      }
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 32, marginBottom: 32 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <Text style={{ fontFamily: mono, color: '#64748b', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', paddingHorizontal: 16 }}>Social Link</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  </View>

                  {/* Google */}
                  <TouchableOpacity
                    onPress={() => promptAsync()} disabled={!request}
                    style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 16 }, isWeb ? { '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' } } : {}]}
                  >
                    <Icons.GoogleIcon size={16} />
                    <Text style={{ fontFamily: mono, color: '#cbd5e1', fontSize: 12, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>Google</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32 }}>
                    <Text style={{ fontFamily: mono, color: '#64748b', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>New contender? </Text>
                    <TouchableOpacity onPress={() => switchStep('signup')}>
                      <Text style={{ fontFamily: mono, color: '#a855f7', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '900' }}>Create account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── SIGNUP ── */}
              {step === 'signup' && (
                <View>
                  <GlassLabel>Gamer Tag</GlassLabel>
                  <GlassField placeholder="InvinciblePlayer" value={tag} onChangeText={checkTag} focusColor="#00ffd0" icon={<Icons.UserIcon size={14} color="#64748b" />} />
                  {tagAvail === true && <Text style={{ color: '#10b981', fontSize: 10, fontFamily: mono, marginTop: 4, marginLeft: 4, letterSpacing: 1 }}>✓ Tag available</Text>}
                  {tagAvail === false && <Text style={{ color: '#ef4444', fontSize: 10, fontFamily: mono, marginTop: 4, marginLeft: 4, letterSpacing: 1 }}>✗ Tag taken</Text>}
                  
                  <GlassLabel>Secure Email</GlassLabel>
                  <GlassField placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" focusColor="#00ffd0" icon={<Text style={{ color: '#64748b', fontFamily: mono }}>@</Text>} />
                  
                  <GlassLabel>Access Key</GlassLabel>
                  <GlassField placeholder="••••••••••••" value={pass} onChangeText={setPass} secure focusColor="#a855f7" icon={<Icons.LockIcon size={14} color="#64748b" />} />
                  
                  <GlassLabel>Confirm Key</GlassLabel>
                  <GlassField placeholder="••••••••••••" value={pass2} onChangeText={setPass2} secure onSubmitEditing={handleAction} focusColor="#a855f7" icon={<Icons.LockIcon size={14} color="#64748b" />} />
                  
                  <TouchableOpacity
                    onPress={handleAction} disabled={loading || tagAvail === false}
                    style={[{ marginTop: 32, borderRadius: 12, overflow: 'hidden', opacity: loading || tagAvail === false ? 0.5 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(168,85,247,0.3)', cursor: 'pointer' } : {}]}
                  >
                    <LinearGradient colors={['#9333ea', '#6b21a8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 12, paddingVertical: 18, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: grotesk, color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' }}>{'>_ Register Identity'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32 }}>
                    <Text style={{ fontFamily: mono, color: '#64748b', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Already established? </Text>
                    <TouchableOpacity onPress={() => switchStep('login')}>
                      <Text style={{ fontFamily: mono, color: '#00ffd0', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '900' }}>Sign in</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── FORGOT ── */}
              {step === 'forgot' && (
                <View>
                  <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 32 }}>
                    <Text style={{ fontFamily: mono, color: '#00ffd0', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>{'← BACK TO LOGIN'}</Text>
                  </TouchableOpacity>
                  
                  <GlassLabel>Secure Email</GlassLabel>
                  <GlassField placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" onSubmitEditing={handleAction} focusColor="#00ffd0" icon={<Text style={{ color: '#64748b', fontFamily: mono }}>@</Text>} />
                  
                  <TouchableOpacity
                    onPress={handleAction} disabled={loading || !email}
                    style={[{ marginTop: 32, borderRadius: 12, overflow: 'hidden', opacity: loading || !email ? 0.5 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(168,85,247,0.3)', cursor: 'pointer' } : {}]}
                  >
                    <LinearGradient colors={['#9333ea', '#6b21a8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: grotesk, color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' }}>{'>_ Request Token'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── FORGOT SENT ── */}
              {step === 'forgot_sent' && (
                <View>
                  <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 32 }}>
                    <Text style={{ fontFamily: mono, color: '#00ffd0', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>{'← BACK TO LOGIN'}</Text>
                  </TouchableOpacity>
                  
                  <GlassLabel>Encrypted Token (OTP)</GlassLabel>
                  <GlassField placeholder="000000" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} focusColor="#00ffd0" icon={<Text style={{ color: '#64748b', fontFamily: mono }}>#</Text>} />
                  
                  <GlassLabel>New Access Key</GlassLabel>
                  <GlassField placeholder="••••••••••••" value={pass} onChangeText={setPass} secure focusColor="#a855f7" icon={<Icons.LockIcon size={14} color="#64748b" />} />
                  
                  <GlassLabel>Confirm New Key</GlassLabel>
                  <GlassField placeholder="••••••••••••" value={pass2} onChangeText={setPass2} secure onSubmitEditing={handleAction} focusColor="#a855f7" icon={<Icons.LockIcon size={14} color="#64748b" />} />
                  
                  <TouchableOpacity
                    onPress={handleAction} disabled={loading || otp.length < 5}
                    style={[{ marginTop: 32, borderRadius: 12, overflow: 'hidden', opacity: loading || otp.length < 5 ? 0.5 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(168,85,247,0.3)', cursor: 'pointer' } : {}]}
                  >
                    <LinearGradient colors={['#9333ea', '#6b21a8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: grotesk, color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' }}>{'>_ Confirm Override'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </ScrollView>

    </View>
  );
}
