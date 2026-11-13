"use client";

import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const SIZE = 512;
const CLEAN_RADIUS = 34;
const TARGET = 96;

type Mode = "clean" | "rotate";

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function paintStains(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, SIZE, SIZE);
  const random = seeded(20261112);
  const palette = ["#b63b27", "#d9552f", "#e8b34a", "#7a4328", "#c9452f"];

  for (let blob = 0; blob < 9; blob += 1) {
    const cx = 74 + random() * (SIZE - 148);
    const cy = 74 + random() * (SIZE - 148);
    const base = 15 + random() * 22;
    const color = palette[Math.floor(random() * palette.length)]!;
    context.fillStyle = color;
    context.globalAlpha = 0.86;
    const lobes = 5 + Math.floor(random() * 6);
    for (let lobe = 0; lobe < lobes; lobe += 1) {
      const angle = random() * Math.PI * 2;
      const distance = random() * base * 0.9;
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      const radius = base * (0.35 + random() * 0.55);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    for (let dot = 0; dot < 7; dot += 1) {
      const angle = random() * Math.PI * 2;
      const distance = base * (0.9 + random() * 1.3);
      context.globalAlpha = 0.55 + random() * 0.3;
      context.beginPath();
      context.arc(
        cx + Math.cos(angle) * distance,
        cy + Math.sin(angle) * distance,
        1.5 + random() * 4,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
  context.globalAlpha = 1;
}

function alphaCount(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;
  const data = context.getImageData(0, 0, SIZE, SIZE).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 16) {
    if (data[index]! > 24) count += 1;
  }
  return count;
}

function Tray({
  texture,
  mode,
  completed,
  onDraw,
}: {
  texture: THREE.CanvasTexture | null;
  mode: Mode;
  completed: boolean;
  onDraw: (u: number, v: number) => void;
}) {
  const gltf = useGLTF("/models/tray.glb");
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.name === "TrayTop") object.visible = false;
    });
    return clone;
  }, [gltf.scene]);

  const drawing = useRef(false);

  useEffect(() => {
    const stop = () => {
      drawing.current = false;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    if (mode !== "clean" || completed) return;
    event.stopPropagation();
    drawing.current = true;
    if (event.uv) onDraw(event.uv.x, event.uv.y);
  };

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (!drawing.current || mode !== "clean" || completed) return;
    event.stopPropagation();
    if (event.uv) onDraw(event.uv.x, event.uv.y);
  };

  return (
    <group>
      <primitive object={scene} />
      <mesh
        position={[0, 0.174, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
      >
        <planeGeometry args={[2.7, 1.7]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          transparent
          depthWrite={false}
          roughness={0.72}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}

function Scene({
  texture,
  mode,
  completed,
  onDraw,
  onReady,
}: {
  texture: THREE.CanvasTexture | null;
  mode: Mode;
  completed: boolean;
  onDraw: (u: number, v: number) => void;
  onReady: () => void;
}) {
  return (
    <>
      <ambientLight intensity={1.1} />
      <hemisphereLight args={["#fff4e2", "#4a2c1d", 0.7]} />
      <directionalLight
        castShadow
        position={[3.5, 6, 3.5]}
        intensity={2.4}
        color="#fff2dc"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#ffc59c" />
      <Suspense fallback={null}>
        <Tray texture={texture} mode={mode} completed={completed} onDraw={onDraw} />
      </Suspense>
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.4}
        scale={8}
        blur={2.6}
        far={3.4}
        color="#2a170d"
      />
      <OrbitControls
        enabled={mode === "rotate"}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        minDistance={3.8}
        maxDistance={7.2}
        minPolarAngle={0.28}
        maxPolarAngle={1.28}
        target={[0, 0, 0]}
      />
      <FrameReady onReady={onReady} />
    </>
  );
}

function FrameReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onReady, 80);
    return () => clearTimeout(timer);
  }, [onReady]);
  return null;
}

export default function TrayGame({
  onFinished,
  busy = false,
  error = null,
}: {
  onFinished: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const initialRef = useRef(1);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [mode, setMode] = useState<Mode>("clean");
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const finishedRef = useRef(false);
  const lastSample = useRef(0);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    paintStains(canvas);
    canvasRef.current = canvas;
    initialRef.current = Math.max(1, alphaCount(canvas));
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.needsUpdate = true;
    textureRef.current = nextTexture;
    setTexture(nextTexture);

    return () => {
      nextTexture.dispose();
      textureRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!completed && progress >= TARGET && !finishedRef.current) {
      finishedRef.current = true;
      setCompleted(true);
      onFinished();
    }
  }, [progress, completed, onFinished]);

  const drawAt = (u: number, v: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const x = u * SIZE;
    const y = (1 - v) * SIZE;
    const previous = lastPoint.current ?? { x, y };
    const distance = Math.hypot(x - previous.x, y - previous.y);
    const steps = Math.max(1, Math.ceil(distance / (CLEAN_RADIUS * 0.42)));
    context.globalCompositeOperation = "destination-out";
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      const cx = previous.x + (x - previous.x) * ratio;
      const cy = previous.y + (y - previous.y) * ratio;
      const gradient = context.createRadialGradient(
        cx,
        cy,
        CLEAN_RADIUS * 0.18,
        cx,
        cy,
        CLEAN_RADIUS,
      );
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(0.62, "rgba(0,0,0,0.9)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(cx, cy, CLEAN_RADIUS, 0, Math.PI * 2);
      context.fill();
    }
    context.globalCompositeOperation = "source-over";
    lastPoint.current = { x, y };
    if (textureRef.current) textureRef.current.needsUpdate = true;

    const now = performance.now();
    if (now - lastSample.current > 140) {
      lastSample.current = now;
      const current = alphaCount(canvas);
      const next = Math.max(
        0,
        Math.min(100, Math.round((1 - current / initialRef.current) * 100)),
      );
      setProgress(next);
      setDirty((value) => (value + 1) % 1000);
    }
  };

  const stopDrawing = () => {
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = alphaCount(canvas);
    const next = Math.max(
      0,
      Math.min(100, Math.round((1 - current / initialRef.current) * 100)),
    );
    setProgress(next);
  };

  const reset = () => {
    if (completed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    paintStains(canvas);
    initialRef.current = Math.max(1, alphaCount(canvas));
    if (textureRef.current) textureRef.current.needsUpdate = true;
    lastPoint.current = null;
    finishedRef.current = false;
    setProgress(0);
    setCompleted(false);
    setDirty((value) => value + 1);
  };

  const switchMode = (next: Mode) => {
    lastPoint.current = null;
    setMode(next);
  };

  return (
    <div className="game-canvas-wrap">
      <Canvas
        camera={{ position: [0, 3.75, 4.35], fov: 38 }}
        dpr={[1, 1.5]}
        shadows
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onPointerLeave={stopDrawing}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Scene
          texture={texture}
          mode={mode}
          completed={completed}
          onDraw={drawAt}
          onReady={() => setReady(true)}
        />
      </Canvas>

      <div className="game-hud">
        <div className="game-mode" role="group" aria-label="Режим игры">
          <button
            type="button"
            aria-pressed={mode === "clean"}
            onClick={() => switchMode("clean")}
          >
            Чистить
          </button>
          <button
            type="button"
            aria-pressed={mode === "rotate"}
            onClick={() => switchMode("rotate")}
          >
            Вращать
          </button>
        </div>
        <div className="game-progress" aria-live="polite">
          <span>Чистота {progress}%</span>
          <span className="game-progress__track" aria-hidden="true">
            <span
              className="game-progress__fill"
              style={{ width: `${progress}%` }}
            />
          </span>
        </div>
      </div>

      <div className="game-hint">
        <span>
          {mode === "clean"
            ? "Зажмите и проведите по соусу"
            : "Потяните, чтобы осмотреть поднос"}
        </span>
        <span>{busy ? "Проверяем результат…" : `Цель — ${TARGET}%`}</span>
      </div>

      {!ready || !texture ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#f7eddd",
            fontSize: "0.8rem",
            background: "rgba(20,14,10,0.35)",
          }}
        >
          <span className="spinner" aria-hidden="true" />
        </div>
      ) : null}

      {completed ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(20,14,10,0.58)",
            backdropFilter: "blur(4px)",
            color: "#f7eddd",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}>
              Поднос чистый
            </p>
            <p style={{ fontSize: "0.78rem", opacity: 0.72, marginTop: 4 }}>
              {busy ? "Выдаём бонус…" : "Смотрим результат"}
            </p>
            <span className="spinner" aria-hidden="true" style={{ margin: "14px auto 0" }} />
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 46,
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(20,14,10,0.72)",
            color: "#ffb4a8",
            fontSize: "0.7rem",
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={reset}
        disabled={completed}
        style={{
          position: "absolute",
          right: 12,
          top: 56,
          padding: "5px 9px",
          borderRadius: 999,
          border: "1px solid rgba(255,250,242,0.16)",
          background: "rgba(20,14,10,0.5)",
          color: "rgba(255,250,242,0.72)",
          fontSize: "0.63rem",
        }}
      >
        Начать заново
      </button>
      <span className="sr-only">{dirty}</span>
    </div>
  );
}
