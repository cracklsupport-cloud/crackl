import React, { useRef, useState, useEffect } from 'react';
import { View, Image as RNImage, StyleSheet, Platform, Animated, Easing } from 'react-native';

// Dynamically use framer-motion only on the web to prevent Native crashes
let motion = null;
let useMotionValue = null;
let useSpring = null;
let useTransform = null;

if (Platform.OS === 'web') {
  const framerMotion = require('motion/react');
  motion = framerMotion.motion;
  useMotionValue = framerMotion.useMotionValue;
  useSpring = framerMotion.useSpring;
  useTransform = framerMotion.useTransform;
}

export default function BrainCard3D() {
  const brainLogo = require('../../assets/brain_logo.png');

  // NATIVE FALLBACK: simple floating animation
  if (Platform.OS !== 'web') {
    const floatAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -20, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' })
        ])
      ).start();
    }, []);

    return (
      <View style={styles.nativeContainer}>
        <Animated.Image 
          source={brainLogo} 
          style={[styles.logo, { transform: [{ translateY: floatAnim }] }]} 
          resizeMode="contain"
        />
      </View>
    );
  }

  // WEB IMPLEMENTATION: Interactive 3D Card
  const cardRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth rotation physics (heavy, fluid feel)
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  // Map standardized coordinates (-0.5 to 0.5) to degrees (-25deg to 25deg)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["30deg", "-30deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-30deg", "30deg"]);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    
    // Calculate cursor position relative to the center
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / rect.width - 0.5;
    const yPct = mouseY / rect.height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  // Ensure Expo web correctly retrieves the image URL
  const logoUri = typeof brainLogo === 'string' 
    ? brainLogo 
    : (RNImage.resolveAssetSource 
        ? RNImage.resolveAssetSource(brainLogo).uri 
        : brainLogo.uri || brainLogo);

  return (
    <div style={styles.webContainer}>
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: 400,
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: 1200,
          position: 'relative',
          cursor: 'pointer'
        }}
      >
        <motion.div
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            borderRadius: '24px',
            transformStyle: 'preserve-3d',
            rotateX: rotateX,
            rotateY: rotateY,
          }}
          animate={{
            y: isHovered ? 0 : [0, -15, 0],
          }}
          transition={{
            y: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
        >
          {/* 3D Container (No Glass Backplate) */}
          <div style={styles.glassCard}>
            {/* Pop out Logo */}
            <motion.img
              src={logoUri}
              style={{
                width: 320,
                height: 320,
                objectFit: 'contain',
                transform: 'translateZ(80px)', 
                mixBlendMode: 'screen', // Crucial to seamlessly strip the black background!
                WebkitMixBlendMode: 'screen'
              }}
              animate={{
                filter: isHovered 
                  ? 'brightness(1.5)' 
                  : 'brightness(1)'
              }}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

const styles = StyleSheet.create({
  nativeContainer: {
    width: 400,
    height: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 250,
    height: 250,
  },
  webContainer: {
    width: 500,
    height: 500,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10, // Ensure it stays on top of grid lines
  },
  glassCard: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transformStyle: 'preserve-3d',
  }
});
