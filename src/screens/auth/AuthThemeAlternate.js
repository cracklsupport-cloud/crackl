/**
 * ALTERNATE LOGIN THEME — CRACKL 12.0 Cyber-Noir
 * Shows every 12 hours (alternating with AuthThemeDefault).
 * Design: Dark charcoal, gold accent, circuit board bg, hexagonal brain frame.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Platform, KeyboardAvoidingView, Image, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icons from '../../components/Icons';
import { isWeb, BrainImage } from './authShared';

const AltLabel = ({ children }) => (
  <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#6b7280', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>{children}</Text>
);

const AltField = ({ value, onChangeText, placeholder, secure, keyboardType, autoCapitalize, maxLength, onSubmitEditing, leftIcon, rightElement, isWeb }) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      {leftIcon && (
        <View style={{ position: 'absolute', left: 16, zIndex: 10, height: '100%', justifyContent: 'center' }}>{leftIcon}</View>
      )}
      {rightElement && (
        <View style={{ position: 'absolute', right: 16, zIndex: 10, height: '100%', justifyContent: 'center' }}>{rightElement}</View>
      )}
      <TextInput
        style={[{
          backgroundColor: isFocused ? 'rgba(197, 160, 112, 0.06)' : '#000000',
          borderWidth: 1,
          borderColor: isFocused ? '#C5A070' : 'rgba(255,255,255,0.08)',
          borderRadius: 10,
          paddingVertical: 16,
          paddingLeft: leftIcon ? 48 : 16,
          paddingRight: rightElement ? 48 : 16,
          color: '#ffffff',
          fontSize: 14,
          fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
          outlineStyle: 'none',
        }, isFocused && isWeb ? { boxShadow: '0 0 12px rgba(197,160,112,0.15)' } : {}]}
        placeholder={placeholder}
        placeholderTextColor="#4b5563"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'none'}
        maxLength={maxLength}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </View>
  );
};

export default function AuthThemeAlternate(props) {
  const {
    step, loginId, setLoginId, email, setEmail, tag, pass, setPass, pass2, setPass2, otp, setOtp,
    showPass, setShowPass, remember, setRemember, loading, err, tagAvail,
    switchStep, checkTag, handleAction, promptAsync, request,
    fadeAnim,
  } = props;

  const gold = '#C5A070';
  const purpleStart = '#9333ea';
  const purpleEnd = '#6b21a8';

  const bg = '#000000';

  return (
    <View style={{ width: isWeb ? '100vw' : '100%', height: isWeb ? '100vh' : '100%', flexDirection: isWeb ? 'row' : 'column', backgroundColor: bg, overflow: 'hidden' }}>
      {/* LEFT PANEL */}
      <View style={{ width: isWeb ? '60%' : '100%', height: isWeb ? '100%' : 'auto', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden', backgroundColor: bg, zIndex: 2 }}>
        <View style={{ position: isWeb ? 'absolute' : 'relative', top: isWeb ? 48 : 24, left: isWeb ? 48 : 24, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 52, height: 52, backgroundColor: bg, borderColor: 'rgba(197,160,112,0.3)', borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 4 }}>
            <Image source={BrainImage} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
          </View>
          <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontWeight: 'bold', letterSpacing: 2, fontSize: 20, color: '#9ca3af' }}>
            CRACKL <Text style={{ color: gold }}>12.0</Text>
          </Text>
        </View>

        {/* Brain centered - no hexagon */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
          <Image
            source={BrainImage}
            style={{
              width: 2200,
              height: undefined,
              aspectRatio: 1,
              resizeMode: 'contain',
              opacity: 1,
              transform: [{ translateX: 200 }],
              backgroundColor: bg,
            }}
          />
        </View>

        <View style={{ position: 'relative', zIndex: 20, maxWidth: 576, paddingLeft: isWeb ? 48 : 24, paddingRight: isWeb ? 48 : 24, marginTop: isWeb ? 0 : 32 }}>
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: isWeb ? 48: 24, fontWeight: 'bold', lineHeight: isWeb ? 56 : 46, textTransform: 'uppercase', letterSpacing: -0.5, color: '#ffffff' }}>
              THE ULTIMATE
            </Text>
            <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: isWeb ? 48 : 24, fontWeight: 'bold', lineHeight: isWeb ? 56 : 46, textTransform: 'uppercase', letterSpacing: -0.5, color: gold }}>
              BRAIN CRACK
            </Text>
            <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: isWeb ? 48: 24, fontWeight: 'bold', lineHeight: isWeb ? 56 : 46, textTransform: 'uppercase', letterSpacing: -0.5, color: '#ffffff' }}>
              ARENA
            </Text>
          </View>

          <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 12, color: '#6b7280', letterSpacing: 1, lineHeight: 22, marginBottom: 40, textTransform: 'uppercase' }}>
            Outsmart the architect.{'\n'}Claim the arena. Win real cash.
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { label: 'STATUS', value: '12 n/h', icon: '▲' },
              { label: 'SESSION', value: 'DIRECT', icon: '🔒' },
              { label: 'MISSIONS', value: '100', icon: '👤' },
            ].map(stat => (
              <View key={stat.label} style={[{ backgroundColor: bg, borderWidth: 1, borderColor: 'rgba(197,160,112,0.15)', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 14, minWidth: 110 }, isWeb ? { backdropFilter: 'blur(12px)' } : {}]}>
                <Text style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>{stat.label}</Text>
                <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 13, color: gold }}>{stat.icon} {stat.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* RIGHT PANEL */}
      <View style={{ width: isWeb ? '40%' : '100%', height: isWeb ? '100%' : 'auto', backgroundColor: bg, justifyContent: 'center', paddingHorizontal: isWeb ? 48 : 24, paddingVertical: isWeb ? 48 : 28, zIndex: 30 }}>
        <Animated.View style={{ opacity: fadeAnim, flex: 1, justifyContent: 'center' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
            <View style={[{ width: '100%', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 28, backgroundColor: bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }, isWeb ? { boxShadow: '0 4px 24px rgba(0,0,0,0.3)' } : {}]}>

              <View style={{ marginBottom: 32 }}>
                <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 6 }}>
                  <Text style={{ color: gold, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>{'> '}</Text>
                  {step === 'login' ? 'Initialize Session' : step === 'signup' ? 'Create Identity' : step === 'forgot' ? 'Override Protocol' : 'Decrypt Protocol'}
                </Text>
                <Text style={{ color: '#6b7280', fontSize: 13, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, letterSpacing: -0.5 }}>
                  {step === 'login' ? 'Enter your credentials to access the arena.' : step === 'signup' ? 'Forge your alias. 100 starting credits.' : 'Follow the recovery process.'}
                </Text>
              </View>

              {err ? (
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{err}</Text>
                </View>
              ) : null}

              {step === 'login' && (
                <View>
                  <AltLabel>USER ID / EMAIL</AltLabel>
                  <AltField placeholder="Identity / Login" value={loginId} onChangeText={setLoginId} leftIcon={<Icons.UserIcon size={14} color="#6b7280" />} isWeb={isWeb} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
                    <AltLabel>PASSWORD</AltLabel>
                    <TouchableOpacity onPress={() => switchStep('forgot')} style={{ marginBottom: 8 }}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: gold, fontSize: 10 }}>FORGOT?</Text>
                    </TouchableOpacity>
                  </View>
                  <AltField
                    placeholder="••••••••"
                    value={pass}
                    onChangeText={setPass}
                    secure={!showPass}
                    leftIcon={<Icons.LockIcon size={14} color="#6b7280" />}
                    rightElement={
                      <TouchableOpacity onPress={() => setShowPass && setShowPass(!showPass)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#6b7280" /> : <Icons.EyeIcon size={16} color="#6b7280" />}
                      </TouchableOpacity>
                    }
                    onSubmitEditing={handleAction}
                    isWeb={isWeb}
                  />

                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 24 }} onPress={() => setRemember(!remember)}>
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: gold, backgroundColor: remember ? gold : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {remember && <Text style={{ color: '#121212', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#9ca3af', fontSize: 12 }}>Stay connected</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleAction} disabled={loading} style={[{ marginTop: 24, borderRadius: 10, opacity: loading ? 0.6 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(147,51,234,0.25)', cursor: 'pointer' } : {}]}>
                    <LinearGradient colors={[purpleStart, purpleEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 10, paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 }}>{'> LOGIN TO CRACKL -'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 20 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(197,160,112,0.2)' }} />
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: 14 }}>Social Link</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(197,160,112,0.2)' }} />
                  </View>

                  <TouchableOpacity onPress={() => promptAsync()} disabled={!request} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingVertical: 16 }}>
                    <Icons.GoogleIcon size={18} />
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#d1d5db', fontSize: 14 }}>Login with Google</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 36 }}>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 11 }}>New contender? </Text>
                    <TouchableOpacity onPress={() => switchStep('signup')}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: gold, fontSize: 11 }}>Get in to connect</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {step === 'signup' && (
                <View>
                  <AltLabel>Gamer Tag</AltLabel>
                  <AltField placeholder="InvinciblePlayer" value={tag} onChangeText={checkTag} leftIcon={<Icons.UserIcon size={14} color="#6b7280" />} isWeb={isWeb} />
                  <AltLabel>Secure Email</AltLabel>
                  <AltField placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" leftIcon={<Text style={{ color: '#6b7280', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 14 }}>@</Text>} isWeb={isWeb} />
                  <AltLabel>Access Key</AltLabel>
                  <AltField placeholder="•••••••••" value={pass} onChangeText={setPass} secure leftIcon={<Icons.LockIcon size={14} color="#6b7280" />} isWeb={isWeb} />
                  <AltLabel>Confirm Key</AltLabel>
                  <AltField placeholder="•••••••••" value={pass2} onChangeText={setPass2} secure onSubmitEditing={handleAction} leftIcon={<Icons.LockIcon size={14} color="#6b7280" />} isWeb={isWeb} />
                  <TouchableOpacity onPress={handleAction} disabled={loading || tagAvail === false} style={[{ marginTop: 32, borderRadius: 10, opacity: loading || tagAvail === false ? 0.6 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(147,51,234,0.25)', cursor: 'pointer' } : {}]}>
                    <LinearGradient colors={[purpleStart, purpleEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 10, paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 }}>{'> REGISTER IDENTITY ->'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 36 }}>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 11 }}>Already established? </Text>
                    <TouchableOpacity onPress={() => switchStep('login')}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: gold, fontSize: 11 }}>Initialize Session</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {step === 'forgot' && (
                <View>
                  <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: gold, fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text>
                  </TouchableOpacity>
                  <AltLabel>Secure Email</AltLabel>
                  <AltField placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" onSubmitEditing={handleAction} leftIcon={<Text style={{ color: '#6b7280', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 14 }}>@</Text>} isWeb={isWeb} />
                  <TouchableOpacity onPress={handleAction} disabled={loading || !email} style={[{ marginTop: 32, borderRadius: 10, opacity: loading || !email ? 0.6 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(147,51,234,0.25)', cursor: 'pointer' } : {}]}>
                    <LinearGradient colors={[purpleStart, purpleEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 10, paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 }}>{'> REQUEST TOKEN ->'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {step === 'forgot_sent' && (
                <View>
                  <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}>
                    <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: gold, fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text>
                  </TouchableOpacity>
                  <AltLabel>Encrypted Token (OTP)</AltLabel>
                  <AltField placeholder="000000" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} leftIcon={<Text style={{ color: '#6b7280', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 14 }}>#</Text>} isWeb={isWeb} />
                  <AltLabel>New Access Key</AltLabel>
                  <AltField placeholder="•••••••••" value={pass} onChangeText={setPass} secure leftIcon={<Icons.LockIcon size={14} color="#6b7280" />} isWeb={isWeb} />
                  <AltLabel>Confirm New Key</AltLabel>
                  <AltField placeholder="•••••••••" value={pass2} onChangeText={setPass2} secure onSubmitEditing={handleAction} leftIcon={<Icons.LockIcon size={14} color="#6b7280" />} isWeb={isWeb} />
                  <TouchableOpacity onPress={handleAction} disabled={loading || otp.length < 5} style={[{ marginTop: 32, borderRadius: 10, opacity: loading || otp.length < 5 ? 0.6 : 1 }, isWeb ? { boxShadow: '0 0 20px rgba(147,51,234,0.25)', cursor: 'pointer' } : {}]}>
                    <LinearGradient colors={[purpleStart, purpleEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 10, paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 }}>{'> CONFIRM OVERRIDE ->'}</Text>}
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
