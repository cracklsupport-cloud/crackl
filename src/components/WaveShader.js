/**
 * CRACKL v5 — Interactive WebGL Sine-Wave Shader
 * 
 * Full-screen animated sine wave with chromatic aberration.
 * Responds to mouse movement: X controls frequency, Y controls amplitude.
 * Uses CRACKL's purple/cyan color palette.
 * Web-only — returns null on native platforms.
 */
import React, { useRef, useEffect } from 'react';
import { Platform, View, Text } from 'react-native';

const isWeb = Platform.OS === 'web';

/* ── GLSL Shaders ── */
const VERT = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform float u_xScale;
  uniform float u_yScale;
  uniform float u_distortion;

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
    
    float d = length(p) * u_distortion;
    
    float rx = p.x * (1.0 + d);
    float gx = p.x;
    float bx = p.x * (1.0 - d);

    float r = 0.06 / abs(p.y + sin((rx + u_time) * u_xScale) * u_yScale);
    float g = 0.06 / abs(p.y + sin((gx + u_time * 1.1) * u_xScale) * u_yScale);
    float b = 0.06 / abs(p.y + sin((bx + u_time * 0.9) * u_xScale) * u_yScale);
    
    float purple = (r * 0.58 + b * 0.42);
    float cyan   = (g * 0.45 + b * 0.55);
    
    vec3 col = vec3(
      purple * 0.55,
      cyan * 0.85,
      max(purple, cyan) * 1.0
    );
    
    float vig = 1.0 - length(p) * 0.35;
    col *= vig;
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

function compileShader(gl, src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function WaveShader({ opacity = 0.6 }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
      <Text style={{ position: 'absolute', top: 100, left: 100, color: 'white', fontSize: 30, zIndex: 9999 }}>
        WAVE IS DEFINITELY MOUNTED
      </Text>
    </View>
  );
}

export default WaveShader;
