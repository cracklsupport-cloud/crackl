import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Platform, KeyboardAvoidingView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icons from '../../components/Icons';
import { isWeb, BrainImage, GlassLabel, GlassField } from './authShared';

export default function AuthThemeDefault(props) {
  const {
    step, loginId, setLoginId, email, setEmail, tag, pass, setPass, pass2, setPass2, otp, setOtp,
    showPass, remember, setRemember, loading, err, tagAvail,
    switchStep, checkTag, handleAction, promptAsync, request,
    fadeAnim,
  } = props;

  return (
    <View style={{ width: isWeb ? '100vw' : '100%', height: isWeb ? '100vh' : '100%', flexDirection: isWeb ? 'row' : 'column', backgroundColor: '#000000', overflow: 'hidden' }}>
      {/* ═══ LEFT PANEL (60%) ═══ */}
      <View style={{ width: isWeb ? '60%' : '100%', height: isWeb ? '100%' : 'auto', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden', backgroundColor: '#000000' }}>
        <View style={{ position: isWeb ? 'absolute' : 'relative', top: isWeb ? 48 : 24, left: isWeb ? 48 : 24, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 52, height: 52, backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center', padding: 4 }}>
            <Image source={BrainImage} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
          </View>
          <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontWeight: 'bold', letterSpacing: 2, fontSize: 20, color: '#9ca3af' }}>
            CRACKL <Text style={{ color: '#a855f7' }}>V5.0</Text>
          </Text>
        </View>

        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 10, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={BrainImage}
            style={{
              width: isWeb ? '9000%' : '1000%',
              maxWidth: 920000000,
              height: undefined,
              aspectRatio: 1,
              resizeMode: 'contain',
              opacity: 0.98,
              transform: [{ translateX: 270 }, { scale: isWeb ? 1 : 1.06 }],
              ...(isWeb ? { imageRendering: 'auto' } : {}),
            }}
          />
        </View>

        <View style={{ position: 'relative', zIndex: 20, maxWidth: 576, paddingLeft: isWeb ? 48 : 24, paddingRight: isWeb ? 48 : 24, marginTop: isWeb ? 0 : 32 }}>
          <View style={{ marginBottom: 24, maxWidth: isWeb ? 680 : undefined }}>
            {['THE ULTIMATE', 'BRAIN CRACK', 'ARENA'].map((line) => (
              <Text
                key={line}
                numberOfLines={1}
                ellipsizeMode="clip"
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[
                  {
                    fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
                    fontSize: isWeb ? 56 : 48,
                    fontWeight: 'bold',
                    lineHeight: isWeb ? 66 : 52,
                    textTransform: 'uppercase',
                    letterSpacing: -1,
                    color: '#ffffff',
                    flexShrink: 0,
                  },
                  isWeb
                    ? { textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', wordBreak: 'keep-all' }
                    : { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
                ]}
              >
                {line}
              </Text>
            ))}
          </View>

          <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 12, color: '#6b7280', letterSpacing: 1, lineHeight: 22, marginBottom: 40, textTransform: 'uppercase' }}>
            Outsmart the architect.{'\n'}Claim the arena. Win real cash.
          </Text>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            {[
              { label: 'ACTIVE', value: '👥 12.4K' },
              { label: 'LATENCY', value: '⏱ 14ms' },
              { label: 'PROTOCOL', value: '🔒 AES-256' },
            ].map(stat => (
              <View key={stat.label} style={[{ backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 4, paddingHorizontal: 20, paddingVertical: 12, minWidth: 120 }, isWeb ? { backdropFilter: 'blur(12px)' } : {}]}>
                <Text style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{stat.label}</Text>
                <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 14, color: stat.label === 'LATENCY' ? '#c084fc' : '#e5e7eb' }}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ═══ RIGHT PANEL (40%) ═══ */}
      <View style={[{ width: isWeb ? '40%' : '100%', height: isWeb ? '100%' : 'auto', backgroundColor: '#000000', borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', paddingHorizontal: isWeb ? 56 : 24, paddingVertical: isWeb ? 48 : 28, zIndex: 30 }, isWeb ? { boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)' } : {}]}>
        <Animated.View style={{ opacity: fadeAnim, flex: 1, justifyContent: 'center' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}>
            <View style={[{ width: '100%', borderRadius: 14, paddingHorizontal: 26, paddingVertical: 28, backgroundColor: 'rgba(15,15,26,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, isWeb ? { backdropFilter: 'blur(16px)', boxShadow: '0 20px 40px rgba(0,0,0,0.45)' } : {}]}>

              <View style={{ marginBottom: 48 }}>
                <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 }}>
                  <Text style={{ color: '#a855f7', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>{'>_ '}</Text>
                  {step === 'login' ? 'Initialize Session' : step === 'signup' ? 'Create Identity' : step === 'forgot' ? 'Override Protocol' : 'Decrypt Protocol'}
                </Text>
                <Text style={{ color: '#6b7280', fontSize: 14, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, letterSpacing: -0.5 }}>
                  {step === 'login' ? 'Enter your credentials to access the arena.' : step === 'signup' ? 'Forge your alias. 100 starting credits.' : 'Follow the recovery process.'}
                </Text>
              </View>

              {err ? (
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{err}</Text>
                </View>
              ) : null}

              {step === 'login' && (
                <View>
                  <GlassLabel>Gamer Tag or Email</GlassLabel>
                  <GlassField placeholder="Identity code..." value={loginId} onChangeText={setLoginId} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
                    <GlassLabel>Access Key</GlassLabel>
                    <TouchableOpacity onPress={() => switchStep('forgot')} style={{ marginBottom: 8 }}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 10 }}>FORGOT?</Text>
                    </TouchableOpacity>
                  </View>
                  <GlassField placeholder="••••••••" value={pass} onChangeText={setPass} secure={!showPass} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} onSubmitEditing={handleAction} />
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 24 }} onPress={() => setRemember(!remember)}>
                    <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#374151', backgroundColor: remember ? '#9333ea' : '#111827', alignItems: 'center', justifyContent: 'center' }}>
                      {remember && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                    </View>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#9ca3af', fontSize: 12 }}>Stay synced</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAction} disabled={loading} style={[{ marginTop: 24, borderRadius: 4, opacity: loading ? 0.6 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(139,92,246,0.3)', cursor: 'pointer', transition: 'all 0.3s ease' } : {}]}>
                    <LinearGradient colors={['#9333ea', '#6b21a8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 4, paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 2 }}>{'>_ LOGIN TO CRACKL ->'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 32, marginBottom: 24 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: 16 }}>Social Link</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  </View>
                  <TouchableOpacity onPress={() => promptAsync()} disabled={!request} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 4, paddingVertical: 16 }}>
                    <Icons.GoogleIcon size={16} />
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#d1d5db', fontSize: 14 }}>Google</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 40 }}>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 11 }}>New contender? </Text>
                    <TouchableOpacity onPress={() => switchStep('signup')}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 11, transition: isWeb ? 'color 0.2s' : undefined }}>Create an account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {step === 'signup' && (
                <View>
                  <GlassLabel>Gamer Tag</GlassLabel>
                  <GlassField placeholder="InvinciblePlayer" value={tag} onChangeText={checkTag} icon={<Icons.UserIcon size={14} color="#4b5563" />} />
                  <GlassLabel>Secure Email</GlassLabel>
                  <GlassField placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>} />
                  <GlassLabel>Access Key</GlassLabel>
                  <GlassField placeholder="•••••••••" value={pass} onChangeText={setPass} secure icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} />
                  <GlassLabel>Confirm Key</GlassLabel>
                  <GlassField placeholder="•••••••••" value={pass2} onChangeText={setPass2} secure onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} />
                  <TouchableOpacity onPress={handleAction} disabled={loading || tagAvail === false} style={[{ marginTop: 32, borderRadius: 4, opacity: loading || tagAvail === false ? 0.6 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(139,92,246,0.3)', cursor: 'pointer', transition: 'all 0.3s ease' } : {}]}>
                    <LinearGradient colors={['#9333ea', '#6b21a8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 4, paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 2 }}>{'>_ REGISTER IDENTITY ->'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 40 }}>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 11 }}>Already established? </Text>
                    <TouchableOpacity onPress={() => switchStep('login')}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 11, transition: isWeb ? 'color 0.2s' : undefined }}>Initialize Session</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {step === 'forgot' && (
                <View>
                  <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text>
                  </TouchableOpacity>
                  <GlassLabel>Secure Email</GlassLabel>
                  <GlassField placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>} />
                  <TouchableOpacity onPress={handleAction} disabled={loading || !email} style={[{ marginTop: 32, borderRadius: 4, opacity: loading || !email ? 0.6 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(139,92,246,0.3)', cursor: 'pointer', transition: 'all 0.3s ease' } : {}]}>
                    <LinearGradient colors={['#9333ea', '#6b21a8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 4, paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 2 }}>{'>_ REQUEST TOKEN ->'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {step === 'forgot_sent' && (
                <View>
                  <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text>
                  </TouchableOpacity>
                  <GlassLabel>Encrypted Token (OTP)</GlassLabel>
                  <GlassField placeholder="000000" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>#</Text>} />
                  <GlassLabel>New Access Key</GlassLabel>
                  <GlassField placeholder="•••••••••" value={pass} onChangeText={setPass} secure icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} />
                  <GlassLabel>Confirm New Key</GlassLabel>
                  <GlassField placeholder="•••••••••" value={pass2} onChangeText={setPass2} secure onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} />
                  <TouchableOpacity onPress={handleAction} disabled={loading || otp.length < 5} style={[{ marginTop: 32, borderRadius: 4, opacity: loading || otp.length < 5 ? 0.6 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(139,92,246,0.3)', cursor: 'pointer', transition: 'all 0.3s ease' } : {}]}>
                    <LinearGradient colors={['#9333ea', '#6b21a8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 4, paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 2 }}>{'>_ CONFIRM OVERRIDE ->'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </View>
  );
}
