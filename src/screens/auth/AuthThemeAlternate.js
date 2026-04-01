import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Platform, KeyboardAvoidingView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as THREE from 'three';
import Icons from '../../components/Icons';
import { isWeb, BrainImage, GlassLabel, GlassField } from './authShared';

/* ═══════════════════════════════════════════════════════════════
   EXACT ANTIGRAVITY WEBGL GALAXY
   - Full 100vw x 100vh coverage
   - Custom GLSL Shaders for soft, glowing points
   - Google Brand Palette
   ═══════════════════════════════════════════════════════════════ */
function ThreeBackground() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0006);

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 3000);
    camera.position.z = 1000;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // 2. Google Color Palette
    const palette = [
      new THREE.Color('#4285F4'), // Blue
      new THREE.Color('#EA4335'), // Red
      new THREE.Color('#FBBC05'), // Yellow
      new THREE.Color('#34A853'), // Green
      new THREE.Color('#ffffff'), // White
      new THREE.Color('#a855f7'), // Crackl Purple
    ];

    const particleCount = 0; // Removed background static dots requested by user
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // Distribute in a massive swirling sphere
    for (let i = 0; i < particleCount; i++) {
      const r = 200 + Math.random() * 1200;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = Math.random() * 3.0 + 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // 3. Custom GLSL Shaders
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          // Scale by depth so closer particles are larger
          gl_PointSize = size * (1200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          // Perfect, soft-edged circle
          vec2 xy = gl_PointCoord.xy - vec2(0.5);
          float ll = length(xy);
          if (ll > 0.5) discard;
          
          float alpha = pow(1.0 - (ll * 2.0), 1.5);
          gl_FragColor = vec4(vColor, alpha * 0.9);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 4. Parallax & Animation Loop
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    function onMouseMove(event) {
      mouseX = (event.clientX - width / 2) * 0.001;
      mouseY = (event.clientY - height / 2) * 0.001;
    }
    window.addEventListener('mousemove', onMouseMove);

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize);

    let animationFrameId;
    const clock = new THREE.Clock();

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      material.uniforms.time.value = elapsedTime;

      targetX = mouseX * 0.5;
      targetY = mouseY * 0.5;

      camera.position.x += (targetX * 800 - camera.position.x) * 0.02;
      camera.position.y += (-targetY * 800 - camera.position.y) * 0.02;
      camera.lookAt(scene.position);

      // Orbital rotation
      particles.rotation.y = elapsedTime * 0.03;
      particles.rotation.x = elapsedTime * 0.015;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onWindowResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  if (Platform.OS !== 'web') return null;
  return <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }} />;
}

function ParticleLiftoff() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const stateRef = useRef({ 
    x: -9999, y: -9999, 
    targetX: -9999, targetY: -9999
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

    // Brand hues: Shades of Blue
    const baseHues = [230, 210, 190]; 

    // Pre-calculate highly randomized field
    const rings = [];
    const numRings = 11;
    const ringSpacing = 28; // Max radius roughly 310px
    const dotSpacing = 32;  // Balanced spacing without overcrowding

    for (let r = 1; r <= numRings; r++) {
      const baseRadius = r * ringSpacing;
      const numDots = Math.max(1, Math.floor((2 * Math.PI * baseRadius) / dotSpacing));
      const dots = [];
      for (let i = 0; i < numDots; i++) {
        dots.push({
          angle: (i / numDots) * Math.PI * 2,
          angleOffset: (Math.random() - 0.5) * 0.45, // Break concentric rigidity
          radiusOffset: (Math.random() - 0.5) * ringSpacing * 0.45, // Organic stagger
          baseHue: baseHues[Math.floor(Math.random() * baseHues.length)],
          baseSize: Math.random() * 0.8 + 1.2, // Tiny base dots
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
      
      // Heavy delay (friction) so the particle mass trails majestically behind the cursor
      st.x += (st.targetX - st.x) * 0.012;
      st.y += (st.targetY - st.y) * 0.012;
      
      time += 0.02; // Slightly faster majestic progression
      
      for (let r = 0; r < rings.length; r++) {
        const ring = rings[r];
        const depthRatio = ring.r_index / numRings; 
        
        // Beautiful 3D wave moving back and forth (heartbeat)
        const wavePhase = time * 1.5 - ring.r_index * 0.6;
        const waveFactor = Math.sin(wavePhase); // -1 (inward) to 1 (outward)
        const waveOffset = waveFactor * (5 + 35 * Math.pow(depthRatio, 1.5)); // Inner layers barely move
        
        // Inner layers retain EXACTLY 100% opacity, only outer layers ever fade to 0
        const opacityDropPhase = Math.max(0, waveFactor); 
        const fadeMultiplier = Math.max(0, (depthRatio - 0.4) / 0.6); // 0 until 40% out, then ramps to 1
        const baseOpacity = 1.0 - (opacityDropPhase * fadeMultiplier); 
        
        for (let i = 0; i < ring.dots.length; i++) {
          const dot = ring.dots[i];
          
          const rotSpeed = 0.03 / ring.r_index;
          const currentAngle = dot.angle + dot.angleOffset + time * rotSpeed * (ring.r_index % 2 === 0 ? 1 : -1);
          
          // Gentle organic sweep so it doesn't look purely mathematical
          const amoebaDeform = (Math.sin(currentAngle * 2 + time) + Math.cos(currentAngle * 4 - time * 0.8)) * 12 * depthRatio;
          
          let actualRadius = ring.baseRadius + dot.radiusOffset + waveOffset + amoebaDeform;
          actualRadius = Math.max(12, actualRadius); // CRITICAL: Stop dots from converging into the dead center and disappearing
          
          const px = st.x + Math.cos(currentAngle) * actualRadius;
          const py = st.y + Math.sin(currentAngle) * actualRadius;
          
          // Size scales up from core to outer edge
          const dotSize = Math.max(0.1, dot.baseSize) * (0.5 + 0.9 * depthRatio);

          // More circular shape (less elongated pill)
          const radiusX = dotSize * 1.25; 
          const radiusY = dotSize * 1.0; 
          const rotation = currentAngle; // Radially facing outwards

          // Dynamic colors bounding around the base brand hue based on time and angle
          const currentHue = dot.baseHue + Math.sin(time + currentAngle) * 20;
          
          // Edge rings fade slightly more to build the sphere edge falloff
          const depthOpacity = 1 - (depthRatio * 0.4);
          const finalOpacity = baseOpacity * depthOpacity;

          ctx.beginPath();
          if (ctx.ellipse) {
             ctx.ellipse(px, py, radiusX, radiusY, rotation, 0, Math.PI * 2);
          } else {
             ctx.arc(px, py, dotSize, 0, Math.PI * 2);
          }
          ctx.globalAlpha = Math.max(0, finalOpacity);
          ctx.fillStyle = `hsl(${currentHue}, 80%, 65%)`; // Vivid, saturated glows
          ctx.fill();
          ctx.globalAlpha = 1.0; // Reset for next iteration
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
        zIndex: 5,        // above grid (0), below left pane (10), below right pane (30)
      }}
    />
  );
}

/* ═══ AUTH THEME DEFAULT ═══ */
export default function AuthThemeDefault(props) {
  const {
    step, loginId, setLoginId, email, setEmail, tag, pass, setPass, pass2, setPass2, otp, setOtp,
    showPass, remember, setRemember, loading, err, tagAvail,
    switchStep, checkTag, handleAction, promptAsync, request,
    fadeAnim,
  } = props;

  return (
    // Root container with relative positioning
    <View style={{ width: isWeb ? '100vw' : '100%', height: isWeb ? '100vh' : '100%', position: 'relative', backgroundColor: '#000000', overflow: 'hidden' }}>

      {/* 1. FULL SCREEN 3D WEBGL GALAXY - Mounted at the absolute root */}
      <ThreeBackground />

      <ParticleLiftoff />

      {/* 2. CONTENT WRAPPER - Lays out the left and right panes OVER the background */}
      <View style={{ flex: 1, flexDirection: isWeb ? 'row' : 'column', zIndex: 10, pointerEvents: 'box-none' }}>

        {/* LEFT PANE - Completely transparent */}
        <View style={{ width: isWeb ? '60%' : '100%', height: isWeb ? '100%' : 'auto', flexDirection: 'column', justifyContent: 'center', position: 'relative', backgroundColor: 'transparent', pointerEvents: 'box-none' }}>

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
                  transform: 'translateX(270px)',
                  mixBlendMode: 'screen'
                }}
                alt="Brain"
              />
            ) : (
              <Image
                source={BrainImage}
                style={{ width: '1000%', height: undefined, aspectRatio: 1, resizeMode: 'contain', opacity: 0.98, transform: [{ translateX: 270 }, { scale: 1.06 }] }}
              />
            )}
          </View>

          <View style={{ position: 'relative', zIndex: 20, maxWidth: 576, paddingLeft: isWeb ? 48 : 24, paddingRight: isWeb ? 48 : 24, marginTop: isWeb ? 0 : 32 }}>
            <View style={{ marginBottom: 24, maxWidth: isWeb ? 680 : undefined }}>
              {['THE ULTIMATE', 'BRAIN CRACK', 'ARENA'].map((line) => (
                <Text key={line} numberOfLines={1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.75} style={[{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: isWeb ? 56 : 48, fontWeight: 'bold', lineHeight: isWeb ? 66 : 52, textTransform: 'uppercase', letterSpacing: -1, color: '#ffffff', flexShrink: 0 }, isWeb ? { textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', wordBreak: 'keep-all' } : { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 }]}>{line}</Text>
              ))}
            </View>
            <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 12, color: '#6b7280', letterSpacing: 1, lineHeight: 22, marginBottom: 40, textTransform: 'uppercase' }}>Outsmart the architect.{'\n'}Claim the arena. Win real cash.</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {[{ label: 'ACTIVE', value: '👥 12.4K' }, { label: 'LATENCY', value: '⏱ 14ms' }, { label: 'PROTOCOL', value: '🔒 AES-256' }].map(stat => (
                <View key={stat.label} style={[{ backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 4, paddingHorizontal: 20, paddingVertical: 12, minWidth: 120 }, isWeb ? { backdropFilter: 'blur(12px)' } : {}]}>
                  <Text style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{stat.label}</Text>
                  <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 14, color: stat.label === 'LATENCY' ? '#c084fc' : '#e5e7eb' }}>{stat.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* RIGHT PANE - Transparent black with blur to see 3D effect behind it */}
        <View style={[{ width: isWeb ? '40%' : '100%', height: isWeb ? '100%' : 'auto', backgroundColor: isWeb ? 'rgba(0,0,0,0.4)' : '#000000', borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', paddingHorizontal: isWeb ? 56 : 24, paddingVertical: isWeb ? 48 : 28, zIndex: 30 }, isWeb ? { backdropFilter: 'blur(20px)', boxShadow: '-10px 0 50px rgba(0, 0, 0, 0.5)' } : {}]}>
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

                {err ? <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 6, marginBottom: 16 }}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{err}</Text></View> : null}

                {step === 'login' && (
                  <View>
                    <GlassLabel>Gamer Tag or Email</GlassLabel>
                    <GlassField placeholder="Identity code..." value={loginId} onChangeText={setLoginId} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
                      <GlassLabel>Access Key</GlassLabel>
                      <TouchableOpacity onPress={() => switchStep('forgot')} style={{ marginBottom: 8 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 10 }}>FORGOT?</Text></TouchableOpacity>
                    </View>
                    <GlassField placeholder="••••••••" value={pass} onChangeText={setPass} secure={!showPass} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} onSubmitEditing={handleAction} />
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 24 }} onPress={() => setRemember(!remember)}>
                      <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#374151', backgroundColor: remember ? '#9333ea' : '#111827', alignItems: 'center', justifyContent: 'center' }}>{remember && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}</View>
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
                      <Icons.GoogleIcon size={16} /><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#d1d5db', fontSize: 14 }}>Google</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 40 }}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 11 }}>New contender? </Text>
                      <TouchableOpacity onPress={() => switchStep('signup')}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 11, transition: isWeb ? 'color 0.2s' : undefined }}>Create an account</Text></TouchableOpacity>
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
                      <TouchableOpacity onPress={() => switchStep('login')}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 11, transition: isWeb ? 'color 0.2s' : undefined }}>Initialize Session</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
                {step === 'forgot' && (
                  <View>
                    <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text></TouchableOpacity>
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
                    <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text></TouchableOpacity>
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
    </View>
  );
}