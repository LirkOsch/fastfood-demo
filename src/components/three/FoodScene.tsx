"use client";

import {
  ContactShadows,
  OrbitControls,
  Preload,
  RoundedBox,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, memo, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MenuItem, Visual } from "@/lib/menu";
import { ALL_MODELS, modelPathForItem } from "./model-paths";
import type { CharacterSettings } from "@/lib/settings";

ALL_MODELS.forEach((path) => useGLTF.preload(path));

type Vec3 = [number, number, number];

function prepareModel(source: THREE.Object3D, item: MenuItem): THREE.Group {
  const clone = source.clone(true);
  const visual: Visual = item.visual ?? {};

  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const cloned = materials.map((material) => {
      const next = material.clone();
      if (object.name === "Cheese" && visual.cheese === false) object.visible = false;
      return next;
    });
    object.material = Array.isArray(object.material) ? cloned : cloned[0]!;
    if (cloned.some((material) => material.transparent)) object.castShadow = false;
  });

  const tint = (name: string, color: string | undefined) => {
    if (!color) return;
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.name !== name) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.set(color);
        }
      }
    });
  };
  tint("Patty", visual.patty);
  tint("Sauce", visual.sauce);
  tint("Topping", visual.topping);
  tint("Icing", visual.icing);
  tint("Liquid", visual.liquid);

  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 2.05 / maxDimension;
  clone.scale.setScalar(scale);
  clone.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(clone);
  const center = scaledBox.getCenter(new THREE.Vector3());
  clone.position.set(-center.x, -scaledBox.min.y, -center.z);

  const wrapper = new THREE.Group();
  wrapper.add(clone);
  return wrapper;
}

function FoodModel({
  item,
  reducedMotion,
}: {
  item: MenuItem;
  reducedMotion: boolean;
}) {
  const path = modelPathForItem(item);
  const gltf = useGLTF(path);
  const model = useMemo(() => prepareModel(gltf.scene, item), [gltf.scene, item]);
  const group = useRef<THREE.Group>(null);
  const progress = useRef(1);

  useEffect(() => {
    progress.current = reducedMotion ? 1 : 0;
    return () => {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      });
    };
  }, [model, reducedMotion]);

  useFrame((state, delta) => {
    if (!group.current) return;
    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta * 4.2);
    }
    const ease = 1 - (1 - progress.current) ** 3;
    const bob = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 1.05) * 0.025;
    group.current.scale.setScalar(0.93 + 0.07 * ease);
    group.current.position.y = 0.02 + bob - (1 - ease) * 0.12;
    group.current.rotation.y = (1 - ease) * -0.25;
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

const MascotBody = memo(function MascotBody({
  preset,
  faces,
  reducedMotion,
}: {
  preset: "boxy" | "bun";
  faces: boolean;
  reducedMotion: boolean;
}) {
  const eyes = useRef<THREE.Group>(null);
  const handLeft = useRef<THREE.Group>(null);
  const handRight = useRef<THREE.Group>(null);
  const nextBlink = useRef(3);
  const blinkUntil = useRef(0);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (!reducedMotion && time > nextBlink.current) {
      blinkUntil.current = time + 0.12;
      nextBlink.current = time + 4.5 + Math.random() * 4;
    }
    if (eyes.current) {
      const closed = !reducedMotion && time < blinkUntil.current;
      eyes.current.scale.y = closed ? 0.12 : 1;
    }
    if (!reducedMotion) {
      const wave = Math.sin(time * 0.55) > 0.9 ? Math.sin(time * 7) * 0.28 : 0;
      if (handRight.current) handRight.current.rotation.z = -0.12 - Math.max(0, wave);
      if (handLeft.current) handLeft.current.rotation.z = 0.12 + Math.max(0, -wave) * 0.4;
    }
  });

  const bodyColor = preset === "bun" ? "#e0a55c" : "#f1e2cb";
  const bandColor = preset === "bun" ? "#c94836" : "#e2542c";
  const faceZ = preset === "bun" ? 0.47 : 0.315;

  return (
    <group>
      {preset === "bun" ? (
        <group>
          <mesh castShadow receiveShadow position={[0, 0.58, 0]} scale={[1, 0.9, 0.92]}>
            <sphereGeometry args={[0.52, 40, 28]} />
            <meshStandardMaterial color={bodyColor} roughness={0.72} />
          </mesh>
          <mesh castShadow position={[0, 0.93, 0]} scale={[0.96, 0.45, 0.9]}>
            <sphereGeometry args={[0.52, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#f0bd72" roughness={0.7} />
          </mesh>
        </group>
      ) : (
        <group>
          <RoundedBox
            args={[0.82, 0.92, 0.58]}
            radius={0.1}
            smoothness={4}
            castShadow
            receiveShadow
            position={[0, 0.56, 0]}
          >
            <meshStandardMaterial color={bodyColor} roughness={0.76} />
          </RoundedBox>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.84, 0.16, 0.6]} />
            <meshStandardMaterial color={bandColor} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.98, 0]} rotation={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.5, 0.07, 0.05]} />
            <meshStandardMaterial color="#d6b387" roughness={0.8} />
          </mesh>
        </group>
      )}

      {faces ? (
        <group ref={eyes}>
          <group position={[-0.15, 0.7, faceZ]}>
            <mesh>
              <sphereGeometry args={[0.055, 18, 14]} />
              <meshStandardMaterial color="#27211c" roughness={0.35} />
            </mesh>
            <mesh position={[-0.015, 0.018, 0.038]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
          <group position={[0.15, 0.7, faceZ]}>
            <mesh>
              <sphereGeometry args={[0.055, 18, 14]} />
              <meshStandardMaterial color="#27211c" roughness={0.35} />
            </mesh>
            <mesh position={[-0.015, 0.018, 0.038]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
          <mesh position={[-0.15, 0.81, faceZ]} rotation={[0, 0, 0.08]}>
            <boxGeometry args={[0.11, 0.018, 0.018]} />
            <meshStandardMaterial color="#3a2d24" roughness={0.8} />
          </mesh>
          <mesh position={[0.15, 0.81, faceZ]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.11, 0.018, 0.018]} />
            <meshStandardMaterial color="#3a2d24" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.57, faceZ]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.085, 0.012, 8, 24, Math.PI]} />
            <meshStandardMaterial color="#3a2d24" roughness={0.8} />
          </mesh>
          <mesh position={[-0.25, 0.63, faceZ - 0.005]}>
            <circleGeometry args={[0.045, 16]} />
            <meshBasicMaterial color="#e8a79a" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0.25, 0.63, faceZ - 0.005]}>
            <circleGeometry args={[0.045, 16]} />
            <meshBasicMaterial color="#e8a79a" transparent opacity={0.55} />
          </mesh>
        </group>
      ) : null}

      <group ref={handLeft} position={[-0.5, 0.67, 0.01]} rotation={[0, 0, 0.14]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.24, 4, 10]} />
          <meshStandardMaterial color={bodyColor} roughness={0.7} />
        </mesh>
      </group>
      <group ref={handRight} position={[0.5, 0.67, 0.01]} rotation={[0, 0, -0.14]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.24, 4, 10]} />
          <meshStandardMaterial color={bodyColor} roughness={0.7} />
        </mesh>
      </group>

      <mesh position={[-0.18, 0.09, 0.08]} castShadow>
        <capsuleGeometry args={[0.08, 0.13, 4, 8]} />
        <meshStandardMaterial color={preset === "bun" ? "#c58a45" : "#c8a77f"} roughness={0.8} />
      </mesh>
      <mesh position={[0.18, 0.09, 0.08]} castShadow>
        <capsuleGeometry args={[0.08, 0.13, 4, 8]} />
        <meshStandardMaterial color={preset === "bun" ? "#c58a45" : "#c8a77f"} roughness={0.8} />
      </mesh>
    </group>
  );
});

function Mascot({
  settings,
  reducedMotion,
}: {
  settings: CharacterSettings;
  reducedMotion: boolean;
}) {
  const { size } = useThree();
  const narrow = size.width < 560;

  if (settings.preset === "none") return null;
  const preset = settings.preset === "bun" ? "bun" : "boxy";
  const scale = narrow ? 0.64 : 0.78;
  const position: Vec3 = narrow ? [1.55, 0.08, 1.0] : [1.95, 0.08, 0.7];

  return (
    <group position={position} scale={scale} rotation={[0, -0.2, 0]}>
      <MascotBody preset={preset} faces={settings.faces} reducedMotion={reducedMotion} />
    </group>
  );
}

function Podium({ accent }: { accent: string }) {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[2.05, 2.15, 0.18, 64]} />
        <meshStandardMaterial color="#e9dbc8" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[1.92, 1.92, 0.035, 64]} />
        <meshStandardMaterial color="#f7efdf" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.99, 0.012, 6, 64]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
    </group>
  );
}

function SoftDust({ accent, reducedMotion }: { accent: string; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: 11 }, (_, index) => ({
        position: [
          Math.cos(index * 2.2) * (2.5 + (index % 3) * 0.35),
          0.9 + (index % 5) * 0.33,
          Math.sin(index * 2.2) * (2.2 + (index % 4) * 0.3),
        ] as Vec3,
        scale: 0.035 + (index % 3) * 0.015,
        speed: 0.2 + (index % 4) * 0.08,
      })),
    [],
  );

  useFrame((state) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.03;
  });

  return (
    <group ref={ref}>
      {seeds.map((seed, index) => (
        <mesh key={index} position={seed.position} scale={seed.scale}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            color={index % 4 === 0 ? accent : "#f2d9a8"}
            roughness={0.7}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}

function SceneContent({
  item,
  character,
  accent,
  reducedMotion,
  controlsRef,
}: {
  item: MenuItem;
  character: CharacterSettings;
  accent: string;
  reducedMotion: boolean;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  return (
    <>
      <ambientLight intensity={0.72} />
      <hemisphereLight args={["#fff4e4", "#6b5643", 0.55]} />
      <directionalLight
        castShadow
        position={[4.5, 7.5, 5.5]}
        intensity={2.35}
        color="#fff3df"
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.55} color="#ffcba1" />
      <pointLight position={[0, 2.2, 3.5]} intensity={8} distance={8} color="#ffe9cf" />

      <Podium accent={accent} />
      <Suspense fallback={null}>
        <FoodModel item={item} reducedMotion={reducedMotion} />
      </Suspense>
      <Mascot settings={character} reducedMotion={reducedMotion} />
      <SoftDust accent={accent} reducedMotion={reducedMotion} />

      <ContactShadows
        position={[0, 0.005, 0]}
        opacity={0.26}
        scale={9}
        blur={2.8}
        far={4}
        color="#5b3b26"
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableDamping={!reducedMotion}
        dampingFactor={0.075}
        rotateSpeed={0.65}
        zoomSpeed={0.7}
        minDistance={4.4}
        maxDistance={9.2}
        minPolarAngle={0.38}
        maxPolarAngle={1.46}
        target={[0, 0.82, 0]}
      />
      <Preload all />
    </>
  );
}

function LoaderBadge() {
  const { active, progress } = useProgress();
  return (
    <div className={`stage-loader${active ? " is-active" : ""}`} aria-live="polite">
      <span className="stage-loader__dot" />
      {active ? `Собираем сцену ${Math.round(progress)}%` : "Сцена готова"}
    </div>
  );
}

export default function FoodScene({
  item,
  character,
  accent,
  reducedMotion,
  inView,
  onReady,
}: {
  item: MenuItem;
  character: CharacterSettings;
  accent: string;
  reducedMotion: boolean;
  inView: boolean;
  onReady?: () => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.7]}
        camera={{ position: [5.1, 3.35, 7.15], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={inView ? "always" : "never"}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          onReady?.();
        }}
        aria-label="Вращаемая 3D-модель блюда"
      >
        <SceneContent
          item={item}
          character={character}
          accent={accent}
          reducedMotion={reducedMotion}
          controlsRef={controlsRef}
        />
      </Canvas>
      <div className="stage-controls">
        <span className="stage-hint">
          <span className="stage-hint__gesture" aria-hidden="true">
            ↻
          </span>
          Вращайте пальцем или мышью
        </span>
        <button
          type="button"
          className="stage-reset"
          onClick={() => controlsRef.current?.reset()}
          aria-label="Сбросить ракурс"
        >
          Сбросить ракурс
        </button>
      </div>
      <LoaderBadge />
    </>
  );
}
