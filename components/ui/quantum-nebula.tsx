import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// --- CONFIGURATION OBJECT V3.0 ---
const config = {
  particles: {
    count: 50000,
    size: 0.02,
    boxSize: 5,
  },
  colors: {
    baseHue: 200,
    hueVariance: 20,
  },
  simulation: {
    noiseSpeed: 0.1,
    noiseScale: 1.2,
    mouseRepulsion: 0.005,
    friction: 0.95,
  },
  bloom: {
    strength: 0.6,
    radius: 0.4,
    threshold: 0.1,
  },
  camera: {
    initialDistance: 5,
    parallaxIntensity: 0.005,
  },
};

// CPU-side simplified curl noise — drives swirling particle motion
function curlNoiseFn(
  p: THREE.Vector3,
  speed: number,
  scale: number
): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(p.y * scale + speed),
    Math.cos(p.z * scale + speed),
    Math.sin(p.x * scale + speed)
  ).normalize();
}

// v3.0: Interactive Particle Nebula Scene
export default function GenerativeArtSceneV3() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(0, 0));

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // --- CORE THREE.JS SETUP ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.z = config.camera.initialDistance;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);

    // --- POST-PROCESSING (bloom) ---
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight),
      config.bloom.strength,
      config.bloom.radius,
      config.bloom.threshold
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // --- PARTICLE SYSTEM ---
    const particleCount = config.particles.count;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3).fill(0);
    const baseColor = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * config.particles.boxSize;
      positions[i3 + 1] = (Math.random() - 0.5) * config.particles.boxSize;
      positions[i3 + 2] = (Math.random() - 0.5) * config.particles.boxSize;

      const hue =
        (config.colors.baseHue +
          (Math.random() - 0.5) * config.colors.hueVariance) /
        360;
      baseColor.setHSL(hue, 1.0, 0.6);
      colors[i3] = baseColor.r;
      colors[i3 + 1] = baseColor.g;
      colors[i3 + 2] = baseColor.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    particleGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3)
    );

    // --- SHADER MATERIAL ---
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_pointSize: {
          value: config.particles.size * renderer.getPixelRatio(),
        },
      },
      vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float u_pointSize;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = u_pointSize * (10.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float strength = distance(gl_PointCoord, vec2(0.5));
          strength = 1.0 - step(0.5, strength);
          if (strength < 0.01) discard;
          gl_FragColor = vec4(vColor, strength);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // --- ANIMATION LOOP ---
    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      const pos = particleSystem.geometry.attributes.position
        .array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const p = new THREE.Vector3(pos[i3], pos[i3 + 1], pos[i3 + 2]);

        // Curl noise swirl
        const curlForce = curlNoiseFn(
          p,
          elapsedTime * config.simulation.noiseSpeed,
          config.simulation.noiseScale
        );

        // Mouse repulsion
        const mouseTarget = new THREE.Vector3(
          mouseRef.current.x * (config.particles.boxSize / 2),
          mouseRef.current.y * (config.particles.boxSize / 2),
          0
        );
        const distanceToMouse = p.distanceTo(mouseTarget);
        const mouseForce = new THREE.Vector3();
        if (distanceToMouse < 2) {
          mouseForce
            .subVectors(p, mouseTarget)
            .normalize()
            .multiplyScalar(1 / (distanceToMouse + 0.1));
        }

        velocities[i3] +=
          curlForce.x * 0.001 +
          mouseForce.x * config.simulation.mouseRepulsion;
        velocities[i3 + 1] +=
          curlForce.y * 0.001 +
          mouseForce.y * config.simulation.mouseRepulsion;
        velocities[i3 + 2] +=
          curlForce.z * 0.001 +
          mouseForce.z * config.simulation.mouseRepulsion;

        velocities[i3] *= config.simulation.friction;
        velocities[i3 + 1] *= config.simulation.friction;
        velocities[i3 + 2] *= config.simulation.friction;

        pos[i3] += velocities[i3];
        pos[i3 + 1] += velocities[i3 + 1];
        pos[i3 + 2] += velocities[i3 + 2];

        // Wrap particles at box boundary
        const half = config.particles.boxSize / 2;
        if (Math.abs(pos[i3]) > half) pos[i3] *= -1;
        if (Math.abs(pos[i3 + 1]) > half) pos[i3 + 1] *= -1;
        if (Math.abs(pos[i3 + 2]) > half) pos[i3 + 2] *= -1;
      }

      particleSystem.geometry.attributes.position.needsUpdate = true;

      // Camera parallax
      camera.position.x +=
        (mouseRef.current.x * config.camera.parallaxIntensity -
          camera.position.x) *
        0.02;
      camera.position.y +=
        (-mouseRef.current.y * config.camera.parallaxIntensity -
          camera.position.y) *
        0.02;
      camera.lookAt(scene.position);

      composer.render();
      frameId = requestAnimationFrame(animate);
    };
    animate();

    // --- EVENT HANDLERS ---
    const handleResize = () => {
      const w = currentMount.clientWidth;
      const h = currentMount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full z-0" />;
}
