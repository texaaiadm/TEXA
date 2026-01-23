
import React, { useEffect, useRef } from 'react';

interface PrismProps {
  animationType?: 'rotate' | 'float';
  timeScale?: number;
  height?: number;
  baseWidth?: number;
  scale?: number;
  hueShift?: number;
  colorFrequency?: number;
  noise?: number;
  glow?: number;
}

const Prism: React.FC<PrismProps> = ({
  animationType = 'rotate',
  timeScale = 0.5,
  height = 3.5,
  baseWidth = 5.5,
  scale = 3.6,
  hueShift = 0,
  colorFrequency = 1,
  noise = 0.5,
  glow = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vertexSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float hueShift;
      uniform float colorFreq;
      uniform float noiseAmount;
      uniform float glowAmount;
      uniform float scale;

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.y, resolution.x);
        uv *= scale;

        float d = length(uv);
        float angle = atan(uv.y, uv.x);
        
        // Refraction/Prism logic
        float orbit = angle + time * 0.2;
        float r = 0.5 + 0.5 * sin(orbit * 3.0 + time);
        
        vec3 color = vec3(0.0);
        for(float i = 0.0; i < 3.0; i++) {
          float shift = i * 0.1;
          float t = time * 0.5 + shift;
          vec2 p = uv + vec2(cos(t), sin(t)) * 0.2;
          float f = 0.01 / abs(length(p) - 0.5);
          color[int(i)] = f;
        }

        float noise = random(uv + time) * noiseAmount;
        vec3 baseColor = hsv2rgb(vec3(fract(time * 0.05 + hueShift), 0.7, 0.8));
        
        gl_FragColor = vec4((color * baseColor + noise) * glowAmount, 1.0);
        gl_FragColor.rgb *= (1.0 - d * 0.3); // Vignette
      }
    `;

    function createShader(gl: WebGLRenderingContext, type: number, source: string) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, 'resolution');
    const timeLoc = gl.getUniformLocation(program, 'time');
    const hueLoc = gl.getUniformLocation(program, 'hueShift');
    const freqLoc = gl.getUniformLocation(program, 'colorFreq');
    const noiseLoc = gl.getUniformLocation(program, 'noiseAmount');
    const glowLoc = gl.getUniformLocation(program, 'glowAmount');
    const scaleLoc = gl.getUniformLocation(program, 'scale');

    let animationFrameId: number;
    let lastWidth = 0;
    let lastHeight = 0;
    let lastDpr = 0;

    const render = (now: number) => {
      const t = now * 0.001 * timeScale;
      
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);

      if (width > 0 && height > 0 && (width !== lastWidth || height !== lastHeight || dpr !== lastDpr)) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        lastWidth = width;
        lastHeight = height;
        lastDpr = dpr;
      }

      gl.useProgram(program);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, t);
      gl.uniform1f(hueLoc, hueShift);
      gl.uniform1f(freqLoc, colorFrequency);
      gl.uniform1f(noiseLoc, noise);
      gl.uniform1f(glowLoc, glow);
      gl.uniform1f(scaleLoc, scale);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [timeScale, hueShift, colorFrequency, noise, glow, scale]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};

export default Prism;
