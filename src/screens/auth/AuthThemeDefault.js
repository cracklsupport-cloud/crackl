import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Platform, KeyboardAvoidingView, Image, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icons from '../../components/Icons';
import { isWeb, BrainImage, GlassLabel, GlassField } from './authShared';

// --- FEATURE TOGGLES ---
// Set to false to instantly remove these effects per user request
const ENABLE_HEX_REVEAL = true;
const ENABLE_GLITCH = true;
// -----------------------

// ─── Responsive hook: returns live { width, height } on every resize ───
function useResponsiveDimensions() {
  const [dims, setDims] = useState(() => {
    if (isWeb && typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    const d = Dimensions.get('window');
    return { width: d.width, height: d.height };
  });

  useEffect(() => {
    if (isWeb && typeof window !== 'undefined') {
      const onResize = () => setDims({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    } else {
      const sub = Dimensions.addEventListener('change', ({ window: w }) => {
        setDims({ width: w.width, height: w.height });
      });
      return () => sub?.remove?.();
    }
  }, []);

  return dims;
}

// ─── Breakpoint helpers ───
const BP_COMPACT = 768;   // phones & small tablets
const BP_TWO_COL = 1180;  // wide enough for hero, brain, and login pane

function HexRevealParallax() {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!isWeb || !ENABLE_HEX_REVEAL) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const colSize = 24;
    const rowSize = 24;
    let cols = 0;
    let rows = 0;
    let cells = [];
    
    const chars = '0123456789ABCDEF@%$#*X'.split('');

    const resize = () => {
       canvas.width = window.innerWidth;
       canvas.height = window.innerHeight;
       cols = Math.ceil(canvas.width / colSize) + 1;
       rows = Math.ceil(canvas.height / rowSize) + 1;
       cells = [];
       for (let c=0; c<cols; c++) {
         for (let r=0; r<rows; r++) {
            cells.push({
               x: c * colSize,
               y: r * rowSize,
               char: chars[Math.floor(Math.random()*chars.length)],
               timer: Math.random() * 100
            })
         }
       }
    }
    resize();
    window.addEventListener('resize', resize);
    
    const mouseRef = { x: -9999, y: -9999 };
    const onMouse = (e) => { mouseRef.x = e.clientX; mouseRef.y = e.clientY; };
    window.addEventListener('mousemove', onMouse);
    
    let animFrame;
    const animate = () => {
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       
       ctx.font = '14px "JetBrains Mono", monospace';
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       
       for (let i=0; i<cells.length; i++) {
         const cell = cells[i];
         cell.timer--;
         if (cell.timer <= 0) {
           cell.char = chars[Math.floor(Math.random()*chars.length)];
           cell.timer = Math.random() * 200 + 50;
         }
         
         const dist = Math.hypot(cell.x - mouseRef.x, cell.y - mouseRef.y);
         const maxDist = 220; // radius of flashlight
         
         if (dist < maxDist) {
           const opacity = Math.max(0, 1 - Math.pow(dist/maxDist, 1.5));
           ctx.fillStyle = `rgba(168, 85, 247, ${opacity * 0.65})`;
           ctx.fillText(cell.char, cell.x, cell.y);
         }
       }
       animFrame = requestAnimationFrame(animate);
    }
    animate();
    
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(animFrame);
    }
  }, []);

  if (!isWeb || !ENABLE_HEX_REVEAL) return null;
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1, pointerEvents: 'none' }} />;
}

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
      {...(isWeb ? {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
      } : {})}
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
        }, isWeb ? { transition: 'all 0.3s ease' } : {}]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={{
              fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 14,
              letterSpacing: 1,
              textAlign: 'center',
            }}
          >
            {text}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const KNOWN_COLLEGES = [
  { key: 'bmsce', label: 'BMS College of Engineering' },
  { key: 'bmsit', label: 'BMS Institute of Technology and Management' },
  { key: 'rvce', label: 'R. V. College of Engineering' },
];

function CollegeAutocomplete({ value, onChangeText }) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const safeValue = value || '';

  const filtered = safeValue.trim()
    ? KNOWN_COLLEGES.filter(c => {
        const q = safeValue.toLowerCase();
        return c.label.toLowerCase().includes(q) || c.key.includes(q);
      })
    : [];

  const focusColor = '#a855f7';
  const hexToRgba = (hex, alpha) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 7) { r = parseInt(hex.substring(1,3),16); g = parseInt(hex.substring(3,5),16); b = parseInt(hex.substring(5,7),16); }
    return `rgba(${r},${g},${b},${alpha})`;
  };
  const focusBg = hexToRgba(focusColor, 0.05);
  const glowShadow = hexToRgba(focusColor, 0.15);

  return (
    <View style={{ position: 'relative', zIndex: 50 }}>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 16, zIndex: 10, height: '100%', justifyContent: 'center' }}>
          <Text style={{ color: isFocused ? focusColor : '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 14 }}>🎓</Text>
        </View>
        {isWeb ? (
          <input
            type="text"
            value={safeValue}
            onChange={(e) => { onChangeText(e.target.value); setShowSuggestions(true); }}
            onFocus={() => { setIsFocused(true); setShowSuggestions(true); }}
            onBlur={() => { setIsFocused(false); setTimeout(() => setShowSuggestions(false), 200); }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            placeholder="College"
            autoComplete="off"
            style={{
              backgroundColor: isFocused ? focusBg : (isHovered ? 'rgba(255,255,255,0.03)' : '#050505'),
              border: `2px solid ${isFocused ? focusColor : (isHovered ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)')}`,
              borderRadius: 12,
              paddingTop: 16, paddingBottom: 16,
              paddingLeft: 48, paddingRight: 16,
              color: '#ffffff',
              fontSize: 14,
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: 1,
              outline: 'none',
              transition: 'all 0.3s ease',
              width: '100%',
              boxSizing: 'border-box',
              boxShadow: isFocused ? `0 0 15px ${glowShadow}` : 'none',
            }}
          />
        ) : (
          <GlassField
            placeholder="College"
            value={safeValue}
            onChangeText={(v) => { onChangeText(v); setShowSuggestions(true); }}
            onFocus={() => { setIsFocused(true); setShowSuggestions(true); }}
            onBlur={() => { setIsFocused(false); setTimeout(() => setShowSuggestions(false), 200); }}
            returnKeyType="next"
            icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🎓</Text>}
          />
        )}
      </View>

      {/* Suggestions dropdown */}
      {showSuggestions && filtered.length > 0 && (
        <View style={{
          position: 'absolute',
          top: '100%',
          left: 0, right: 0,
          zIndex: 999,
          marginTop: 4,
          borderRadius: 10,
          overflow: 'hidden',
          ...(isWeb ? {
            backgroundColor: 'rgba(15, 15, 15, 0.95)',
            border: '1px solid rgba(168,85,247,0.3)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 15px rgba(168,85,247,0.15)',
          } : {
            backgroundColor: '#0f0f0f',
            borderWidth: 1,
            borderColor: 'rgba(168,85,247,0.3)',
          }),
        }}>
          {filtered.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => { onChangeText(item.label); setShowSuggestions(false); }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                borderBottomColor: 'rgba(255,255,255,0.06)',
                ...(isWeb ? { cursor: 'pointer', transition: 'background 0.2s' } : {}),
              }}
              {...(isWeb ? {
                onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.12)'; },
                onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = 'transparent'; },
              } : {})}
            >
              <Text style={{
                color: '#e2e8f0',
                fontSize: 13,
                fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
                letterSpacing: 0.5,
              }}>
                {item.label}
              </Text>
              <Text style={{
                color: '#6b7280',
                fontSize: 10,
                fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
                marginTop: 2,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>
                {item.key.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AuthThemeDefault(props) {
  const {
    step, loginId, setLoginId, email, setEmail, tag, pass, setPass, pass2, setPass2, otp, setOtp,
    college, setCollege,
    showPass, setShowPass, remember, setRemember, loading, err, notice, tagAvail, tagStatus,
    switchStep, checkTag, handleAction, handleGoogleSignIn, handleAppleSignIn, request,
    fadeAnim,
  } = props;

  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });
  const { width: vw } = useResponsiveDimensions();

  // ─── Responsive breakpoints ───
  const isCompact = vw < BP_COMPACT;      // phones – single column, form only
  const isTablet  = vw >= BP_COMPACT && vw < BP_TWO_COL; // tablet/narrow laptop - stacked but hero visible
  const isDesktop = vw >= BP_TWO_COL;      // wide desktop - side-by-side
  const isTwoCol  = isDesktop;

  // ─── Responsive values ───
  const heroFontSize    = isCompact ? 28 : isTablet ? 38 : 56;
  const heroLineHeight  = isCompact ? 34 : isTablet ? 46 : 66;
  const sidePadding     = isCompact ? 20 : isTablet ? 32 : 48;
  const formPadH        = isCompact ? 24 : isTablet ? 40 : 40;
  const formPadV        = isCompact ? 24 : isTablet ? 36 : 48;
  const rightPaneWidth  = isTwoCol ? Math.min(430, Math.max(380, vw * 0.32)) : '100%';
  const rightPaneWidthPx = typeof rightPaneWidth === 'number' ? rightPaneWidth : 0;
  const leftPanePixels  = isTwoCol ? vw - rightPaneWidthPx : vw;
  const leftPaneWidth   = isTwoCol ? `${100 - (rightPaneWidthPx / vw * 100)}%` : '100%';
  const heroCopyMaxWidth = isCompact ? '100%' : isTwoCol ? Math.min(520, leftPanePixels * 0.56) : 576;
  const heroCopyWidthPx = typeof heroCopyMaxWidth === 'number' ? heroCopyMaxWidth : 0;

  // Center the brain in the open lane between the hero copy and the login pane.
  const brainLaneGap    = 32;
  const brainLaneLeft   = heroCopyWidthPx + brainLaneGap;
  const brainLaneRight  = leftPanePixels - brainLaneGap;
  const brainLaneWidth  = isTwoCol ? Math.max(260, brainLaneRight - brainLaneLeft) : 0;
  const brainPanelClearance = isTwoCol ? Math.min(80, leftPanePixels * 0.08) : 0;
  const brainRightNudge = isTwoCol ? 16 : 0;
  const brainOffset     = isCompact ? 0 : isTablet ? 40 : (brainLaneLeft + brainLaneWidth / 2) - (leftPanePixels / 2) - brainPanelClearance + brainRightNudge;
  const brainScale      = isCompact ? 0.6 : isTablet ? 0.8 : 1.06;
  const brainMaxWidth   = isCompact ? 200 : isTablet ? 500 : 900;
  const canShowAppleSignIn = Platform.OS === 'ios';
  const tagFeedback = {
    idle: '',
    invalid: 'Use 3-20 letters, numbers, or underscores.',
    checking: 'Checking availability...',
    available: 'Gamer Tag is available.',
    taken: 'Gamer Tag is taken.',
    error: 'Could not verify Gamer Tag yet.',
  }[tagStatus] || '';
  const tagFeedbackColor = tagStatus === 'available'
    ? '#22c55e'
    : tagStatus === 'taken' || tagStatus === 'invalid'
      ? '#ef4444'
      : '#9ca3af';

  useEffect(() => {
    if (!isWeb) return;
    const fn = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  // ─── Dynamic glitch keyframes (responsive offsets) ───
  const glitchCSS = isWeb && ENABLE_GLITCH ? `
    @keyframes holo-glitch {
      0%, 93%, 100% { transform: translateX(${brainOffset}px) scale(${brainScale}); filter: none; opacity: 0.98; }
      94% { transform: translateX(${brainOffset + 8}px) translateY(-4px) scale(${brainScale + 0.04}) skewX(5deg); filter: drop-shadow(-8px 2px 0 rgba(255,0,0,0.9)) drop-shadow(6px -2px 0 rgba(0,255,255,0.9)); opacity: 0.7; }
      95% { transform: translateX(${brainOffset - 10}px) translateY(4px) scale(${brainScale - 0.04}) skewX(-4deg); filter: drop-shadow(10px -5px 0 rgba(255,0,255,0.9)) drop-shadow(-10px 5px 0 rgba(0,255,0,0.9)); opacity: 0.9; }
      96% { transform: translateX(${brainOffset}px) scale(${brainScale}); filter: none; opacity: 0.98; }
      97% { transform: translateX(${brainOffset - 4}px) translateY(3px) scale(${brainScale + 0.02}) skewX(2deg); filter: drop-shadow(-5px 3px 0 rgba(255,255,0,0.8)); opacity: 0.8; }
      98% { transform: translateX(${brainOffset + 6}px) translateY(-3px) scale(${brainScale - 0.02}) skewY(-2deg); filter: drop-shadow(6px 0 0 rgba(0,0,255,0.8)) drop-shadow(-6px 0 0 rgba(255,0,0,0.8)); opacity: 0.6; }
      99% { transform: translateX(${brainOffset}px) scale(${brainScale}); filter: none; opacity: 0.98; }
    }
    .glitch-active {
      animation: holo-glitch 5.5s infinite;
    }
  ` : '';

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
      {!isCompact && <ParticleLiftoff />}
      {!isCompact && <HexRevealParallax />}

      {/* ─── MAIN LAYOUT: stacks on compact/tablet, side-by-side on desktop ─── */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          flexDirection: isTwoCol ? 'row' : 'column',
          minHeight: isWeb ? '100vh' : '100%',
        }}
        style={{ flex: 1, zIndex: 10 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ─── LEFT PANE (hero / branding) ─── */}
        {/* On compact screens: show a slim header with logo + compact tagline */}
        {/* On tablet+: show the full hero area */}
        <View style={{
          width: isTwoCol ? leftPaneWidth : '100%',
          height: isTwoCol ? '100vh' : 'auto',
          minHeight: isTwoCol ? '100vh' : (isCompact ? 'auto' : 340),
          flexDirection: 'column',
          justifyContent: isCompact ? 'flex-start' : 'center',
          position: 'relative',
          backgroundColor: 'transparent',
          pointerEvents: 'box-none',
        }}>

          {/* Logo bar */}
          <View style={{
            position: isTwoCol ? 'absolute' : 'relative',
            top: isTwoCol ? sidePadding : (isCompact ? 16 : 24),
            left: isTwoCol ? sidePadding : (isCompact ? 16 : 24),
            zIndex: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: isCompact ? 10 : 16,
          }}>
            <View style={{
              width: isCompact ? 40 : 52,
              height: isCompact ? 40 : 52,
              backgroundColor: '#0a0a0a',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              borderRadius: 6,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}>
              <Image source={BrainImage} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
            </View>
            <Text style={{
              fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
              fontWeight: 'bold',
              letterSpacing: 2,
              fontSize: isCompact ? 16 : 20,
              color: '#9ca3af',
            }}>
              CRACKL <Text style={{ color: '#a855f7' }}>V5.0</Text>
            </Text>
          </View>

          {/* THE BLACK BOX FIX: Using a raw HTML <img> to guarantee mixBlendMode works on the web */}
          {/* Hide brain image on very small screens to save space */}
          {!isCompact && (
            <View pointerEvents="none" style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isWeb && ENABLE_GLITCH && (
                <style>{glitchCSS}</style>
              )}
              {isWeb ? (
                <img
                  src={BrainImage}
                  className={ENABLE_GLITCH ? 'glitch-active' : ''}
                  style={{
                    width: '100%',
                    maxWidth: brainMaxWidth,
                    height: 'auto',
                    objectFit: 'contain',
                    opacity: 0.98,
                    mixBlendMode: 'screen',
                    transform: `translateX(${brainOffset}px) scale(${brainScale})`,
                  }}
                  alt="Brain"
                />
              ) : (
                <Image
                  source={BrainImage}
                  style={{
                    width: Math.min(vw * 0.9, 520),
                    height: Math.min(vw * 0.9, 520),
                    aspectRatio: 1,
                    resizeMode: 'contain',
                    opacity: 0.98,
                    transform: [{ translateX: brainOffset }, { scale: brainScale }],
                  }}
                />
              )}
            </View>
          )}

          {/* Hero text */}
          <View style={{
            position: 'relative',
            zIndex: 20,
            maxWidth: heroCopyMaxWidth,
            paddingLeft: isCompact ? 16 : sidePadding,
            paddingRight: isCompact ? 16 : sidePadding,
            marginTop: isCompact ? 16 : (isTwoCol ? 0 : 32),
            marginBottom: isCompact ? 8 : 0,
          }}>
            <View style={{ marginBottom: isCompact ? 8 : 24, maxWidth: !isCompact ? heroCopyMaxWidth : undefined }}>
              {isCompact ? (
                /* On phones: single-line compact tagline */
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={{
                    fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
                    fontSize: heroFontSize,
                    fontWeight: 'bold',
                    lineHeight: heroLineHeight,
                    textTransform: 'uppercase',
                    letterSpacing: -1,
                    color: '#ffffff',
                    ...(isWeb ? { textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' } : { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 }),
                  }}
                >
                  THE BRAIN CRACK ARENA
                </Text>
              ) : (
                ['THE ULTIMATE', 'BRAIN CRACK', 'ARENA'].map((line) => (
                  <Text key={line} numberOfLines={1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.75} style={[{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: heroFontSize, fontWeight: 'bold', lineHeight: heroLineHeight, textTransform: 'uppercase', letterSpacing: -1, color: '#ffffff', flexShrink: 0 }, isWeb ? { textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', wordBreak: 'keep-all' } : { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 }]}>{line}</Text>
                ))
              )}
            </View>
            {!isCompact && (
              <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 12, color: '#6b7280', letterSpacing: 1, lineHeight: 22, textTransform: 'uppercase', marginBottom: isTablet ? 16 : 40 }}>Outsmart the architect.{'\n'}Claim the arena. Win real cash.</Text>
            )}
          </View>
        </View>

        {/* ─── RIGHT PANE (Login Form) ─── */}
        <View style={{
          width: rightPaneWidth,
          height: isTwoCol ? '100vh' : 'auto',
          minHeight: isTwoCol ? '100vh' : undefined,
          position: 'relative',
          zIndex: 30,
          flex: isTwoCol ? undefined : 1,
        }}>
          
          {/* BULLETPROOF GLASS BACKGROUND FOR WEB */}
          {isWeb && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderLeft: isTwoCol ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
              borderTop: !isTwoCol ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
              borderTopLeftRadius: isTwoCol ? 40 : 24,
              borderBottomLeftRadius: isTwoCol ? 40 : 0,
              borderTopRightRadius: !isTwoCol ? 24 : 0,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: isTwoCol ? '-20px 0 60px rgba(0,0,0,0.6)' : '0 -20px 60px rgba(0,0,0,0.6)',
              zIndex: -1,
              pointerEvents: 'none'
            }} />
          )}

          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: formPadH,
              paddingVertical: formPadV,
            }}
            keyboardShouldPersistTaps="handled"
            style={!isWeb ? { backgroundColor: '#000000' } : {}}
            showsVerticalScrollIndicator={false}
          >
          <Animated.View style={{ opacity: fadeAnim, flex: 1, justifyContent: 'center' }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0} style={{ width: '100%', maxWidth: isTwoCol ? 360 : 460, alignSelf: 'center' }}>
              <View style={[{ width: '100%', backgroundColor: 'transparent' }]}>

                <View style={{ marginBottom: isCompact ? 24 : 48 }}>
                  <Text style={{ fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: isCompact ? 20 : 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 }}>
                    {step === 'login' ? 'Initialize Session' : step === 'signup' ? 'Create Identity' : step === 'forgot' ? 'Override Protocol' : 'Decrypt Protocol'}
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: isCompact ? 12 : 14, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, letterSpacing: -0.5 }}>
                    {step === 'login' ? 'Enter your credentials to access the arena.' : step === 'signup' ? 'Forge your alias. 100 starting credits.' : 'Follow the recovery process.'}
                  </Text>
                </View>

                {notice ? (
                  <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', padding: 12, borderRadius: 6, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.25)' }}>
                    <Text style={{ color: '#86efac', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{notice}</Text>
                  </View>
                ) : null}
                {err ? (
                  <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 6, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.22)' }}>
                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{err}</Text>
                  </View>
                ) : null}

                {step === 'login' && (
                  <View>
                    <GlassLabel>Gamer Tag or Email</GlassLabel>
                    <GlassField
                      placeholder="Identity code..."
                      value={loginId}
                      onChangeText={setLoginId}
                      keyboardType="email-address"
                      autoComplete="username"
                      textContentType="username"
                      returnKeyType="next"
                      icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
                      <GlassLabel>Access Key</GlassLabel>
                      <TouchableOpacity onPress={() => switchStep('forgot')} style={{ marginBottom: 8 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 10 }}>FORGOT?</Text></TouchableOpacity>
                    </View>
                    <GlassField placeholder="••••••••" value={pass} onChangeText={setPass} secure={!showPass} autoComplete="current-password" textContentType="password" returnKeyType="go" icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} onSubmitEditing={handleAction} rightElement={
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
                    <TouchableOpacity onPress={handleGoogleSignIn} disabled={!request || loading} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 4, paddingVertical: 16, opacity: !request || loading ? 0.6 : 1 }}>
                      <Icons.GoogleIcon size={16} /><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#d1d5db', fontSize: 14 }}>Google</Text>
                    </TouchableOpacity>
                    {canShowAppleSignIn && (
                      <TouchableOpacity onPress={handleAppleSignIn} disabled={loading} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 4, paddingVertical: 16, marginTop: 12, opacity: loading ? 0.6 : 1 }}>
                        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800' }}>A</Text>
                        <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#d1d5db', fontSize: 14 }}>Apple</Text>
                      </TouchableOpacity>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 40 }}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 13 }}>New contender? </Text>
                      <TouchableOpacity onPress={() => switchStep('signup')}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 13, transition: isWeb ? 'color 0.2s' : undefined }}>Create an account</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
                {step === 'signup' && (
                  <View>
                    <GlassLabel>Gamer Tag</GlassLabel>
                    <GlassField
                      placeholder="InvinciblePlayer"
                      value={tag}
                      onChangeText={checkTag}
                      autoComplete="username"
                      textContentType="username"
                      returnKeyType="next"
                      maxLength={20}
                      icon={<Icons.UserIcon size={14} color="#4b5563" />}
                    />
                    {tagFeedback ? (
                      <Text style={{ marginTop: 8, marginLeft: 4, color: tagFeedbackColor, fontSize: 11, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>
                        {tagFeedback}
                      </Text>
                    ) : null}
                    <GlassLabel>Secure Email</GlassLabel>
                    <GlassField
                      placeholder="your@email.com"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="next"
                      icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>}
                    />
                    <GlassLabel>College / Institution</GlassLabel>
                    <CollegeAutocomplete value={college} onChangeText={setCollege} />
                    <GlassLabel>Access Key</GlassLabel>
                    <GlassField placeholder="•••••••••" value={pass} onChangeText={setPass} secure={!showPass} autoComplete="new-password" textContentType="newPassword" returnKeyType="next" icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <GlassLabel>Confirm Key</GlassLabel>
                    <GlassField placeholder="•••••••••" value={pass2} onChangeText={setPass2} secure={!showPass} autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <HoverGradientButton onPress={handleAction} disabled={loading || tagStatus === 'checking' || tagStatus === 'invalid' || tagAvail === false} loading={loading} text="REGISTER IDENTITY ->" />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 40 }}>
                      <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#4b5563', fontSize: 13 }}>Already registered? </Text>
                      <TouchableOpacity onPress={() => switchStep('login')}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 13, transition: isWeb ? 'color 0.2s' : undefined }}>Sign in</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
                {step === 'forgot' && (
                  <View>
                    <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text></TouchableOpacity>
                    <GlassLabel>Secure Email</GlassLabel>
                    <GlassField placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>@</Text>} />
                    <HoverGradientButton onPress={handleAction} disabled={loading || !email} loading={loading} text="REQUEST TOKEN ->" />
                  </View>
                )}
                {step === 'forgot_sent' && (
                  <View>
                    <TouchableOpacity onPress={() => switchStep('login')} style={{ marginBottom: 24 }}><Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#a855f7', fontSize: 12, fontWeight: 'bold' }}>{'< BACK TO LOGIN'}</Text></TouchableOpacity>
                    <GlassLabel>Encrypted Token (OTP)</GlassLabel>
                    <GlassField placeholder="000000" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, ''))} keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" returnKeyType="next" maxLength={6} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>#</Text>} />
                    <GlassLabel>New Access Key</GlassLabel>
                    <GlassField placeholder="•••••••••" value={pass} onChangeText={setPass} secure={!showPass} autoComplete="new-password" textContentType="newPassword" returnKeyType="next" icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <GlassLabel>Confirm New Key</GlassLabel>
                    <GlassField placeholder="•••••••••" value={pass2} onChangeText={setPass2} secure={!showPass} autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={handleAction} icon={<Text style={{ color: '#4b5563', fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined }}>🔒</Text>} rightElement={
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4, cursor: isWeb ? 'pointer' : undefined }}>
                        {showPass ? <Icons.EyeOffIcon size={16} color="#a855f7" /> : <Icons.EyeIcon size={16} color="#4b5563" />}
                      </TouchableOpacity>
                    } />
                    <HoverGradientButton onPress={handleAction} disabled={loading || otp.length < 6} loading={loading} text="CONFIRM OVERRIDE ->" />
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}
