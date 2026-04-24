import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Platform, KeyboardAvoidingView, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icons from '../../components/Icons';
import { isWeb, BrainImage, GlassLabel, GlassField } from './authShared';

function ParticleLiftoff() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const stateRef = useRef({ 
    x: -9999, y: -9999, 
    targetX: -9999, targetY: -9999,
    lastTargetX: -9999, lastTargetY: -9999,
    idleTime: 0,
    collapseProgress: 0,
  });

  useEffect(() => {
    if (!isWeb) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (stateRef.current.targetX === -9999) {
        stateRef.current.x = window.innerWidth / 2;
        stateRef.current.y = window.innerHeight / 2;
        stateRef.current.targetX = window.innerWidth / 2;
        stateRef.current.targetY = window.innerHeight / 2;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Brand hues: Purple/Violet
    const baseHues = [270, 285, 300]; 

    // Pre-calculate highly randomized field
    const rings = [];
    const numRings = 11;
    const ringSpacing = 28; 
    const dotSpacing = 32;  

    for (let r = 1; r <= numRings; r++) {
      const baseRadius = r * ringSpacing;
      const numDots = Math.max(1, Math.floor((2 * Math.PI * baseRadius) / dotSpacing));
      const dots = [];
      for (let i = 0; i < numDots; i++) {
        dots.push({
          angle: (i / numDots) * Math.PI * 2,
          angleOffset: (Math.random() - 0.5) * 0.45, 
          radiusOffset: (Math.random() - 0.5) * ringSpacing * 0.45, 
          baseHue: baseHues[Math.floor(Math.random() * baseHues.length)],
          baseSize: Math.random() * 1.2 + 1.8, 
        });
      }
      rings.push({ r_index: r, baseRadius, dots });
    }

    const handler = (e) => {
      stateRef.current.targetX = e.clientX;
      stateRef.current.targetY = e.clientY;
    };
    window.addEventListener('mousemove', handler);

    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const st = stateRef.current;
      
      st.x += (st.targetX - st.x) * 0.04;
      st.y += (st.targetY - st.y) * 0.04;

      if (st.lastTargetX !== -9999) {
        const dx = st.targetX - st.lastTargetX;
        const dy = st.targetY - st.lastTargetY;
        const distMove = Math.sqrt(dx * dx + dy * dy);
        
        if (distMove > 0.5) {
          st.idleTime = 0;
        } else {
          st.idleTime += 0.02;
        }
      }
      st.lastTargetX = st.targetX;
      st.lastTargetY = st.targetY;
      
      const distToMass = Math.sqrt(Math.pow(st.targetX - st.x, 2) + Math.pow(st.targetY - st.y, 2));

      if (st.idleTime > 0.1 && distToMass < 12.0) {
        st.collapseProgress = Math.min(1.0, st.collapseProgress + 0.002);
      } else {
        st.collapseProgress = Math.max(0.0, st.collapseProgress - 0.008); 
      }
      
      time += 0.02; 
      
      for (let r = 0; r < rings.length; r++) {
        const ring = rings[r];
        const depthRatio = ring.r_index / numRings; 
        
        const wavePhase = time * 1.5 - ring.r_index * 0.6;
        const waveFactor = Math.sin(wavePhase); 
        const waveOffset = waveFactor * (5 + 35 * Math.pow(depthRatio, 1.5)); 
        
        const opacityDropPhase = Math.max(0, waveFactor); 
        const fadeMultiplier = Math.max(0, (depthRatio - 0.4) / 0.6); 
        const baseOpacity = 1.0 - (opacityDropPhase * fadeMultiplier); 
        
        for (let i = 0; i < ring.dots.length; i++) {
          const dot = ring.dots[i];
          
          const stableRandom = Math.abs(Math.sin(ring.r_index * 12.34 + i * 56.78));
          const distanceWeight = (ring.r_index - 1) / (numRings - 1); 
          
          const dotCollapseStart = distanceWeight * 0.35 + stableRandom * 0.15; 
          
          const dotDriftProgress = Math.max(0, Math.min(1, (st.collapseProgress - dotCollapseStart) / 0.5));
          
          const easeDrift = dotDriftProgress * dotDriftProgress * (3 - 2 * dotDriftProgress);
          
          const rotSpeed = 0.03 / ring.r_index;
          const currentAngle = dot.angle + dot.angleOffset + time * rotSpeed * (ring.r_index % 2 === 0 ? 1 : -1);
          
          const amoebaDeform = (Math.sin(currentAngle * 2 + time) + Math.cos(currentAngle * 4 - time * 0.8)) * 12 * depthRatio;
          
          let baseActualRadius = ring.baseRadius + dot.radiusOffset + waveOffset + amoebaDeform;
          baseActualRadius = Math.max(12, baseActualRadius); 
          
          const isFullyCollapsed = easeDrift === 1.0;
          const trembleIntensity = Math.min(1.0, Math.pow(st.collapseProgress, 4));
          const tremblePulse = isFullyCollapsed ? Math.sin(time * 60 + dot.angleOffset * 15) * 1.5 * trembleIntensity : 0;
          
          const targetCollapsedRadius = (ring.r_index * 0.4) + tremblePulse;
          
          let actualRadius = baseActualRadius * (1 - easeDrift) + targetCollapsedRadius * easeDrift;

          actualRadius = Math.max(0.1, actualRadius);
          
          const px = st.x + Math.cos(currentAngle) * actualRadius;
          const py = st.y + Math.sin(currentAngle) * actualRadius;
          
          const dotSize = Math.max(0.1, dot.baseSize) * (0.5 + 0.9 * depthRatio);

          const radiusX = dotSize * 1.25; 
          const radiusY = dotSize * 1.0; 
          const rotation = currentAngle; 

          const currentHue = dot.baseHue + Math.sin(time + currentAngle) * 20;
          
          const depthOpacity = 1 - (depthRatio * 0.4);
          const finalOpacity = baseOpacity * depthOpacity;

          ctx.beginPath();
          if (ctx.ellipse) {
             ctx.ellipse(px, py, radiusX, radiusY, rotation, 0, Math.PI * 2);
          } else {
             ctx.arc(px, py, dotSize, 0, Math.PI * 2);
          }
          ctx.globalAlpha = Math.max(0, finalOpacity);
          ctx.fillStyle = `hsl(${currentHue}, 95%, 65%)`; 
          ctx.fill();
          ctx.globalAlpha = 1.0; 
        }
      }
      
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handler);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  if (!isWeb) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 5,        
      }}
    />
  );
}

function HoverGradientButton({ onPress, disabled, loading, text }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={disabled}
      onMouseEnter={() => isWeb && setIsHovered(true)}
      onMouseLeave={() => isWeb && setIsHovered(false)}
      style={[{ 
        marginTop: 32, 
        borderRadius: 4, 
        opacity: disabled ? 0.6 : 1,
      }, 
      isWeb ? { 
        cursor: disabled ? 'default' : 'pointer', 
        transition: 'all 0.3s ease',
        transform: isHovered && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: isHovered && !disabled ? '0 0 25px rgba(168, 85, 247, 0.9)' : '0 0 20px rgba(139,92,246,0.3)',
      } : {}]}
    >
      <LinearGradient 
        colors={['#9333ea', '#6b21a8']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 0 }} 
        style={[{
          borderRadius: 4, 
          paddingVertical: 16, 
          alignItems: 'center', 
          width: '100%',
          borderWidth: 1,
          borderColor: isHovered && !disabled ? 'rgba(255,255,255,0.4)' : 'transparent',
          transition: 'all 0.3s ease'
        }]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 2 }}>{text}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function AuthThemeDefault(props) {
  const {
    step, loginId, setLoginId, email, setEmail, tag, pass, setPass, pass2, setPass2, otp, setOtp,
    showPass, setShowPass, remember, setRemember, loading, err, tagAvail,
    switchStep, checkTag, handleAction, promptAsync, request,
    fadeAnim,
  } = props;

  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    if (!isWeb) return;
    const fn = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  return (
    <View style={{ width: isWeb ? '100vw' : '100%', height: isWeb ? '100vh' : '100%', position: 'relative', backgroundColor: '#000000', overflow: 'hidden' }}>

      {/* ── Mouse tracking glow ── */}
      {isWeb && (
        <div style={{
          position: 'fixed', width: 600, height: 600, borderRadius: '50%',
          backgroundColor: '#9333ea', opacity: 0.15,
          filter: 'blur(160px)', mixBlendMode: 'screen',
          pointerEvents: 'none', zIndex: 0,
          transform: `translate(${mousePos.x - 300}px, ${mousePos.y - 300}px)`,
          transition: 'transform 0.1s ease-out',
        }} />
      )}

      {/* Particle Liftoff */}
      <ParticleLiftoff />

      <View style={{ flex: 1, flexDirection: isWeb ? 'row' : 'column', zIndex: 10, pointerEvents: 'box-none' }}>

        {/* LEFT PANE */}
        <View style={{ width: isWeb ? '65%' : '100%', height: isWeb ? '100%' : 'auto', flexDirection: 'column', justifyContent: 'center', position: 'relative', backgroundColor: 'transparent', pointerEvents: 'box-none' }}>

          <View style={{ position: isWeb ? 'absolute' : 'relative', top: isWeb ? 48 : 24, left: isWeb ? 48 : 24, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 52, height: 52, backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center', padding: 4 }}>
              <Image source={BrainImage} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
            </View>
            <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontWeight: 'bold', letterSpacing: 2, fontSize: 20, color: '#9ca3af' }}>
              CRACKL <Text style={{ color: '#a855f7' }}>V5.0</Text>
            </Text>
          </View>

          {/* THE BLACK BOX FIX: Using a raw HTML <img> to guarantee mixBlendMode works on the web */}
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 10, alignItems: 'center', justifyContent: 'center' }}>
            {isWeb ? (
              <img
                src={BrainImage}
                style={{
                  width: '100%',
                  maxWidth: '900px',
                  height: 'auto',
                  objectFit: 'contain',
                  opacity: 0.98,
                  mixBlendMode: 'screen'
                }}
                alt="Brain"
              />
            ) : (
              <Image
                source={BrainImage}
                style={{ width: '1000%', height: undefined, aspectRatio: 1, resizeMode: 'contain', opacity: 0.98, transform: [{ scale: 1.06 }] }}
              />
            )}
          </View>

          <View style={{ position: 'relative', zIndex: 20, maxWidth: 576, paddingLeft: isWeb ? 48 : 24, paddingRight: isWeb ? 48 : 24, marginTop: isWeb ? 0 : 32 }}>
            <View style={{ marginBottom: 24, maxWidth: isWeb ? 680 : undefined }}>
              {['THE ULTIMATE', 'BRAIN CRACK', 'ARENA'].map((line) => (
                <Text key={line} numberOfLines={1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.75} style={[{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: isWeb ? 56 : 48, fontWeight: 'bold', lineHeight: isWeb ? 66 : 52, textTransform: 'uppercase', letterSpacing: -1, color: '#ffffff', flexShrink: 0 }, isWeb ? { textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', wordBreak: 'keep-all' } : { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 }]}>{line}</Text>
              ))}
            </View>
            <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 12, color: '#6b7280', letterSpacing: 1, lineHeight: 22, textTransform: 'uppercase', marginBottom: 40 }}>Outsmart the architect.{'\n'}Claim the arena. Win real cash.</Text>
          </View>
        </View>

        {/* RIGHT PANE */}
        <View style={[{ width: isWeb ? 480 : '100%', height: isWeb ? '100%' : 'auto', backgroundColor: isWeb ? 'rgba(15,15,22,0.65)' : '#000000', borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderTopLeftRadius: isWeb ? 40 : 0, borderBottomLeftRadius: isWeb ? 40 : 0, zIndex: 30, overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', boxShadow: '-20px 0 60px rgba(0,0,0,0.6)' } : {}]}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: isWeb ? 56 : 24, paddingVertical: isWeb ? 48 : 28 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim, flex: 1, justifyContent: 'center' }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}>
              <View style={[{ width: '100%', backgroundColor: 'transparent' }]}>

                <View style={{ marginBottom: 48 }}>
                  <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 }}>
                    {step === 'login' ? 'Initialize Session' : step === 'signup' ? 'Create Identity' : step === 'forgot' ? 'Override Protocol' : 'Decrypt Protocol'}
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 14, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, letterSpacing: -0.5 }}>
                    {step === 'login' ? 'Enter your credentials to access the arena.' : step === 'signup' ? 'Forge your alias. 100 starting credits.' : 'Follow the recovery process.'}
                  </Text>
                </View>

                {err ? <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 6, marginBottom: 16 }}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{err}</Text></View> : null}

                {step === 'login' && (
                  <View>
                    <GlassLabel>Gamer Tag or Email</GlassLabel>
                    <GlassField placeholder="Identity code..." value={loginId} onChangeText={setLoginId} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
                      <GlassLabel>Access Key</GlassLabel>
                      <TouchableOpacity onPress={() => switchStep('forgot')} style={{ marginBottom: 8 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 10 }}>FORGOT?</Text></TouchableOpacity>
                    </View>
                    <GlassField placeholder="••••••••" value={pass} onChangeText={setPass} secure={!showPass} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} onSubmitEditing={handleAction} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 24, cursor: isWeb ? 'pointer' : undefined }} onPress={() => setRemember(!remember)}>
                      <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#374151', backgroundColor: remember ? '#9333ea' : '#111827', alignItems: 'center', justifyContent: 'center' }}>{remember && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}</View>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#9ca3af', fontSize: 12 }}>Stay synced</Text>
                    </TouchableOpacity>
                    <HoverGradientButton onPress={handleAction} disabled={loading} loading={loading} text="LOGIN TO CRACKL ->" />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 32, marginBottom: 24 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: 16 }}>Social Link</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    </View>
                    <TouchableOpacity onPress={() => promptAsync()} disabled={!request} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 4, paddingVertical: 16 }}>
                      <Icons.GoogleIcon size={16} /><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#d1d5db', fontSize: 14 }}>Google</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 40 }}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 13 }}>New contender? </Text>
                      <TouchableOpacity onPress={() => switchStep('signup')}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 13, transition: isWeb ? 'color 0.2s' : undefined }}>Create an account</Text></TouchableOpacity>
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
                    <GlassField placeholder="•••••••••" value={pass} onChangeText={setPass} secure={!showPass} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <GlassLabel>Confirm Key</GlassLabel>
                    <GlassField placeholder="•••••••••" value={pass2} onChangeText={setPass2} secure={!showPass} onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <HoverGradientButton onPress={handleAction} disabled={loading || tagAvail === false} loading={loading} text="REGISTER IDENTITY ->" />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 40 }}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 13 }}>Already registered? </Text>
                      <TouchableOpacity onPress={() => switchStep('login')}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 13, transition: isWeb ? 'color 0.2s' : undefined }}>Sign in</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
                {step === 'forgot' && (
                  <View>
                    <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text></TouchableOpacity>
                    <GlassLabel>Secure Email</GlassLabel>
                    <GlassField placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>} />
                    <HoverGradientButton onPress={handleAction} disabled={loading || !email} loading={loading} text="REQUEST TOKEN ->" />
                  </View>
                )}
                {step === 'forgot_sent' && (
                  <View>
                    <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text></TouchableOpacity>
                    <GlassLabel>Encrypted Token (OTP)</GlassLabel>
                    <GlassField placeholder="000000" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>#</Text>} />
                    <GlassLabel>New Access Key</GlassLabel>
                    <GlassField placeholder="•••••••••" value={pass} onChangeText={setPass} secure={!showPass} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <GlassLabel>Confirm New Key</GlassLabel>
                    <GlassField placeholder="•••••••••" value={pass2} onChangeText={setPass2} secure={!showPass} onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <HoverGradientButton onPress={handleAction} disabled={loading || otp.length < 5} loading={loading} text="CONFIRM OVERRIDE ->" />
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
