/**
 * CRACKL v5 — Interactive WebGL Sine-Wave Shader
 * 
 * Full-screen animated sine wave with chromatic aberration.
 * Responds to mouse movement: X controls frequency, Y controls amplitude.
 * Uses CRACKL's purple/cyan color palette.
 * Web-only — returns null on native platforms.
 */
import React, { useRef, useEffect } from 'react';
import { Platform } from 'react-native';

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
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function WaveShader({ opacity = 0.6 }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!isWeb || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return undefined;

    const vertex = compileShader(gl, VERT, gl.VERTEX_SHADER);
    const fragment = compileShader(gl, FRAG, gl.FRAGMENT_SHADER);
    if (!vertex || !fragment) return undefined;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      mouse: gl.getUniformLocation(program, 'u_mouse'),
      xScale: gl.getUniformLocation(program, 'u_xScale'),
      yScale: gl.getUniformLocation(program, 'u_yScale'),
      distortion: gl.getUniformLocation(program, 'u_distortion'),
    };

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth || window.innerWidth);
      const height = Math.max(1, canvas.clientHeight || window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const handleMouse = (event) => {
      mouseRef.current = {
        x: event.clientX / Math.max(1, window.innerWidth),
        y: event.clientY / Math.max(1, window.innerHeight),
      };
    };

    let raf = 0;
    const startedAt = performance.now();
    const draw = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const mouse = mouseRef.current;
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, elapsed * 0.45);
      gl.uniform2f(uniforms.mouse, mouse.x, mouse.y);
      gl.uniform1f(uniforms.xScale, 5 + mouse.x * 8);
      gl.uniform1f(uniforms.yScale, 0.08 + mouse.y * 0.12);
      gl.uniform1f(uniforms.distortion, 0.12);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouse);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  if (!isWeb) return null;
  return React.createElement('canvas', {
    ref: canvasRef,
    'aria-hidden': true,
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      opacity,
      pointerEvents: 'none',
      zIndex: 0,
    },
  });
}

export default WaveShader;
