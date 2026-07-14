"use client";

// Нүүрний hero-гийн Three.js амьд дэвсгэр: алтлаг кино-тоос (dust) зөөлөн хөвж,
// хулганы хөдөлгөөнийг дагаж бага зэрэг эргэдэг. Lazy (dynamic ssr:false)
// ачаалагддаг тул эхний render-ийг удаашруулахгүй.
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroDust() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      el.clientWidth / Math.max(el.clientHeight, 1),
      0.1,
      100,
    );
    camera.position.z = 10;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const N = 140;
    const pos = new Float32Array(N * 3);
    const speeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 13;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      speeds[i] = 0.1 + Math.random() * 0.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xf0b45a, // кино-amber
      size: 0.09,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let mx = 0;
    let my = 0;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMove);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      const p = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 1] += Math.sin(t * 0.4 + i) * 0.001 + speeds[i] * 0.004;
        if (p[i * 3 + 1] > 7) p[i * 3 + 1] = -7;
      }
      geo.attributes.position.needsUpdate = true;
      points.rotation.y += (mx * 0.35 - points.rotation.y) * 0.02;
      points.rotation.x += (my * 0.2 - points.rotation.x) * 0.02;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      camera.aspect = el.clientWidth / Math.max(el.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0" />
  );
}
