import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FluidBackgroundProps {
  customWallpaper?: string;
  blur?: number; // In px
  dim?: number;  // In percentage (0-90)
}

/**
 * Lightweight GPU WebGL Background with Custom Wallpaper Support
 * When a custom wallpaper is provided, it smoothly layers behind glassmorphism
 * with adjustable blur and dimming. If no wallpaper is active, the GPU shader mesh renders.
 */
export const FluidBackground: React.FC<FluidBackgroundProps> = ({
  customWallpaper,
  blur = 6,
  dim = 40,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If a custom wallpaper is provided, bypass WebGL shader to save 100% GPU cycles
    if (customWallpaper) return;

    const container = containerRef.current;
    if (!container) return;

    const isLowPower = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isLowPower) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });

    renderer.setPixelRatio(0.75);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float u_time;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        float t = u_time * 0.08;

        float wave1 = sin(uv.x * 2.5 + t) * cos(uv.y * 2.0 + t * 0.8);
        float wave2 = cos(uv.x * 1.5 - t * 0.6) * sin(uv.y * 3.0 + t);
        float intensity = clamp(wave1 * 0.25 + wave2 * 0.25 + 0.4, 0.0, 1.0);

        vec3 darkObsidian = vec3(0.039, 0.043, 0.055);
        vec3 slateTint     = vec3(0.065, 0.075, 0.098);
        vec3 platinumHighlight = vec3(0.095, 0.105, 0.135);

        vec3 color = mix(darkObsidian, slateTint, intensity);
        color = mix(color, platinumHighlight, pow(intensity, 3.5) * 0.4);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const uniforms = {
      u_time: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationId: number;
    let lastTime = 0;
    const interval = 1000 / 30; // 30 FPS throttle

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    const animate = (currentTime: number) => {
      animationId = requestAnimationFrame(animate);
      const delta = currentTime - lastTime;
      if (delta > interval) {
        lastTime = currentTime - (delta % interval);
        uniforms.u_time.value = currentTime * 0.001;
        renderer.render(scene, camera);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [customWallpaper]);

  // If user has uploaded or set a custom wallpaper
  if (customWallpaper) {
    return (
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-cover bg-center transition-all duration-700 ease-out"
        style={{
          backgroundImage: `url(${customWallpaper})`,
          filter: `blur(${blur}px)`,
          transform: 'scale(1.05)', // Prevent blur edge artifacts
        }}
        aria-hidden="true"
      >
        {/* Dimming layer to preserve readability of glass panels */}
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: dim / 100 }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-90 transition-opacity duration-1000"
      aria-hidden="true"
    />
  );
};
