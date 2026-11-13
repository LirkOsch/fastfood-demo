/**
 * Собирает оригинальные GLB-модели «Тёплого бокса» из простых примитивов Three.js.
 * Запуск: npm run models
 *
 * Ассеты оригинальные, созданы для этого демо. Внешние текстуры и чужие модели
 * не используются; исходник генератора прилагается для передачи заказчику.
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}
// GLTFExporter в браузере использует FileReader; в Node его нужно подменить.
(globalThis as unknown as { FileReader: typeof NodeFileReader }).FileReader = NodeFileReader;

const OUT = path.resolve(process.cwd(), "public", "models");
const BUN = "#dfa55c";
const BUN_DARK = "#c58a45";
const SESAME = "#f3dfad";
const BEEF = "#6f3b24";
const CHICKEN = "#c58a52";
const VEGGIE = "#6f7d4a";
const CHEESE = "#efb43e";
const LETTUCE = "#6e9a4f";
const TOMATO = "#c94836";
const SAUCE = "#d96b35";
const KRAFT = "#c9a06b";
const CREAM = "#f4e8d4";
const INK = "#28221d";

interface ModelSpec {
  name: string;
  build: () => THREE.Object3D;
}

function mat(
  color: string,
  roughness = 0.72,
  metalness = 0,
  options: Partial<THREE.MeshStandardMaterialParameters> = {},
) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name?: string,
) {
  const result = new THREE.Mesh(geometry, material);
  if (name) result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function add(group: THREE.Object3D, child: THREE.Object3D) {
  group.add(child);
  return child;
}

function mergeNamed(
  name: string,
  geometryList: THREE.BufferGeometry[],
  material: THREE.Material,
): THREE.Mesh {
  const merged = mergeGeometries(geometryList, false);
  if (!merged) throw new Error(`Не удалось объединить геометрию ${name}`);
  return mesh(merged, material, name);
}

function buildBurger(options: {
  patty: string;
  doublePatty?: boolean;
  cheese?: boolean;
  veggie?: boolean;
}): THREE.Group {
  const group = new THREE.Group();
  const pattyColor = options.patty;

  add(group, mesh(new THREE.CylinderGeometry(0.95, 0.9, 0.28, 48), mat(BUN, 0.78))).position.y = 0.14;
  add(
    group,
    mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.035, 48), mat(SAUCE, 0.4)),
  ).position.y = 0.3;

  const lettuceGeometry: THREE.BufferGeometry[] = [];
  const lettuceRing = new THREE.TorusGeometry(0.84, 0.11, 8, 40);
  lettuceRing.scale(1, 0.35, 1);
  lettuceRing.translate(0, 0.37, 0);
  lettuceGeometry.push(lettuceRing);
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const leaf = new THREE.SphereGeometry(0.19, 10, 8);
    leaf.scale(1.25, 0.32, 0.8);
    leaf.rotateY(angle);
    leaf.translate(Math.cos(angle) * 0.88, 0.37, Math.sin(angle) * 0.88);
    lettuceGeometry.push(leaf);
  }
  add(group, mergeNamed("Lettuce", lettuceGeometry, mat(LETTUCE, 0.8)));

  for (let index = 0; index < 3; index += 1) {
    const tomato = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 24), mat(TOMATO, 0.65));
    tomato.position.set(-0.36 + index * 0.36, 0.44, 0.04 * (index % 2 === 0 ? 1 : -1));
    add(group, tomato);
  }

  if (options.cheese !== false) {
    const cheese = mesh(new RoundedBoxGeometry(1.72, 0.065, 1.72, 2, 0.03), mat(CHEESE, 0.55));
    cheese.rotation.y = Math.PI / 4;
    cheese.position.y = 0.5;
    add(group, cheese);
  }

  const pattyY = options.cheese === false ? 0.5 : 0.55;
  const patty = mesh(
    new THREE.CylinderGeometry(1.02, 1.0, 0.26, 48),
    mat(pattyColor, 0.9),
    "Patty",
  );
  patty.position.y = pattyY + 0.09;
  add(group, patty);

  if (options.doublePatty) {
    const cheese2 = mesh(new RoundedBoxGeometry(1.68, 0.06, 1.68, 2, 0.03), mat(CHEESE, 0.55));
    cheese2.rotation.y = -Math.PI / 6;
    cheese2.position.y = pattyY + 0.25;
    add(group, cheese2);
    const patty2 = mesh(new THREE.CylinderGeometry(1.0, 0.99, 0.25, 48), mat(pattyColor, 0.9));
    patty2.position.y = pattyY + 0.4;
    add(group, patty2);
  }

  const domeBase = pattyY + (options.doublePatty ? 0.58 : 0.29);
  const dome = new THREE.SphereGeometry(0.99, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.58, 1);
  const topBun = mesh(dome, mat(BUN, 0.72), "TopBun");
  topBun.position.y = domeBase;
  add(group, topBun);
  const rim = mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 48), mat(BUN_DARK, 0.78));
  rim.position.y = domeBase + 0.04;
  add(group, rim);

  const seeds: THREE.BufferGeometry[] = [];
  const seedGeometry = new THREE.SphereGeometry(0.05, 8, 6);
  const seedCount = 30;
  for (let index = 0; index < seedCount; index += 1) {
    const phi = Math.acos(1 - ((index + 0.5) / seedCount) * 0.82);
    const theta = index * 2.399963;
    const radius = 0.97;
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const z = Math.sin(phi) * Math.sin(theta) * radius;
    const y = Math.cos(phi) * 0.58;
    const geometry = seedGeometry.clone();
    geometry.scale(1.1, 0.5, 0.72);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(x, y + 0.1, z).normalize(),
    );
    geometry.applyQuaternion(quaternion);
    geometry.translate(x, domeBase + y + 0.03, z);
    seeds.push(geometry);
  }
  add(group, mergeNamed("Sesame", seeds, mat(SESAME, 0.7)));

  return group;
}

function buildShawarma(): THREE.Group {
  const group = new THREE.Group();
  const wrap = mesh(new THREE.CylinderGeometry(0.36, 0.32, 1.35, 32, 1, false), mat(KRAFT, 0.85));
  wrap.rotation.z = -0.18;
  wrap.position.y = 0.75;
  add(group, wrap);

  const paper = mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.55, 32, 1, true), mat(CREAM, 0.9));
  paper.rotation.z = -0.18;
  paper.position.y = 0.45;
  add(group, paper);

  const filling: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const radius = 0.2 + (index % 3) * 0.03;
    const cube = new THREE.BoxGeometry(0.1, 0.15, 0.1);
    cube.rotateY(angle);
    cube.translate(Math.cos(angle) * radius, 1.42 + (index % 4) * 0.03, Math.sin(angle) * radius);
    filling.push(cube);
  }
  add(group, mergeNamed("Filling", filling, mat("#c75e38", 0.8)));
  add(group, mesh(new THREE.SphereGeometry(0.27, 16, 12), mat("#e7d5b6", 0.9))).position.y = 1.45;

  for (let index = 0; index < 4; index += 1) {
    const mark = mesh(new THREE.BoxGeometry(0.34, 0.02, 0.07), mat("#8d5a32", 0.95));
    mark.rotation.z = -0.18;
    mark.position.set(0, 0.42 + index * 0.2, 0.34);
    add(group, mark);
  }

  add(
    group,
    mesh(new THREE.TorusGeometry(0.36, 0.012, 6, 32), mat("#a97c4d", 0.9)),
  ).position.y = 1.2;
  group.children[group.children.length - 1]!.rotation.x = Math.PI / 2;
  return group;
}

function buildPizza(): THREE.Group {
  const group = new THREE.Group();
  const radius = 1.45;
  const halfAngle = 0.46;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(Math.cos(-halfAngle) * radius, Math.sin(-halfAngle) * radius);
  shape.absarc(0, 0, radius, -halfAngle, halfAngle, false);
  shape.lineTo(0, 0);
  const base = mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      bevelSegments: 2,
    }),
    mat("#d7a15b", 0.85),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.12;
  add(group, base);

  const cheeseShape = new THREE.Shape();
  cheeseShape.moveTo(0, 0);
  cheeseShape.lineTo(Math.cos(-halfAngle + 0.06) * (radius - 0.1), Math.sin(-halfAngle + 0.06) * (radius - 0.1));
  cheeseShape.absarc(0, 0, radius - 0.1, -halfAngle + 0.06, halfAngle - 0.06, false);
  cheeseShape.lineTo(0, 0);
  const cheese = mesh(
    new THREE.ExtrudeGeometry(cheeseShape, { depth: 0.035, bevelEnabled: false }),
    mat("#e9b84d", 0.6),
    "Topping",
  );
  cheese.rotation.x = -Math.PI / 2;
  cheese.position.y = 0.17;
  add(group, cheese);

  const crust = mesh(
    new THREE.TorusGeometry(radius - 0.02, 0.11, 10, 28, halfAngle * 2),
    mat("#bd8242", 0.9),
  );
  crust.rotation.x = Math.PI / 2;
  crust.rotation.z = Math.PI / 2 - halfAngle;
  crust.position.y = 0.15;
  add(group, crust);

  for (let index = 0; index < 7; index += 1) {
    const angle = -0.3 + index * 0.1;
    const r = 0.5 + (index % 3) * 0.22;
    const pepperoni = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 20), mat("#b63a2c", 0.6), "Pepperoni");
    pepperoni.position.set(Math.cos(angle) * r, 0.22, Math.sin(angle) * r);
    add(group, pepperoni);
  }

  const basil = mesh(new THREE.SphereGeometry(0.16, 10, 8), mat("#4d7a3e", 0.8));
  basil.scale.set(1.3, 0.2, 0.8);
  basil.position.set(0.55, 0.23, 0.1);
  add(group, basil);

  group.rotation.y = -0.25;
  return group;
}

function buildFries(): THREE.Group {
  const group = new THREE.Group();
  const carton = mesh(new THREE.CylinderGeometry(0.58, 0.42, 1.02, 4, 1), mat("#d94e32", 0.8), "Carton");
  carton.rotation.y = Math.PI / 4;
  carton.position.y = 0.51;
  add(group, carton);

  const band = mesh(new THREE.BoxGeometry(0.98, 0.2, 0.98), mat(CREAM, 0.85));
  band.position.y = 0.66;
  band.rotation.y = Math.PI / 4;
  add(group, band);

  const fries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 22; index += 1) {
    const angle = (index / 22) * Math.PI * 2;
    const r = 0.08 + (index % 5) * 0.075;
    const geometry = new THREE.BoxGeometry(0.085, 0.95 + (index % 3) * 0.12, 0.085);
    geometry.rotateZ((index % 7 - 3) * 0.035);
    geometry.rotateY(angle);
    geometry.translate(Math.cos(angle) * r, 1.12 + (index % 4) * 0.04, Math.sin(angle) * r);
    fries.push(geometry);
  }
  add(group, mergeNamed("Fries", fries, mat("#edc05a", 0.82)));

  const sauceCup = mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.14, 24), mat("#f1e7d6", 0.7));
  sauceCup.position.set(0.88, 0.08, 0.55);
  add(group, sauceCup);
  const sauce = mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.04, 24), mat(SAUCE, 0.4), "Sauce");
  sauce.position.set(0.88, 0.16, 0.55);
  add(group, sauce);

  return group;
}

function buildDrink(): THREE.Group {
  const group = new THREE.Group();
  const cup = mesh(
    new THREE.CylinderGeometry(0.5, 0.36, 1.4, 40, 1, true),
    mat("#f7efe2", 0.2, 0, { transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
    "Cup",
  );
  cup.position.y = 0.7;
  add(group, cup);

  const liquid = mesh(new THREE.CylinderGeometry(0.45, 0.32, 1.0, 32), mat("#e7c94f", 0.35), "Liquid");
  liquid.position.y = 0.58;
  add(group, liquid);

  const lid = mesh(new THREE.CylinderGeometry(0.52, 0.5, 0.09, 40), mat(CREAM, 0.5));
  lid.position.y = 1.43;
  add(group, lid);

  const straw = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 12), mat("#e2542c", 0.4));
  straw.rotation.z = 0.22;
  straw.position.set(0.12, 1.78, 0);
  add(group, straw);

  const band = mesh(new THREE.CylinderGeometry(0.485, 0.43, 0.22, 40, 1, true), mat(CREAM, 0.7));
  band.position.y = 0.9;
  add(group, band);

  for (let index = 0; index < 3; index += 1) {
    const ice = mesh(
      new RoundedBoxGeometry(0.18, 0.18, 0.18, 2, 0.04),
      mat("#dff2f0", 0.2, 0, { transparent: true, opacity: 0.6 }),
    );
    ice.position.set(-0.12 + index * 0.12, 0.85 + index * 0.07, 0.1 - index * 0.08);
    ice.rotation.set(index * 0.4, index * 0.7, 0);
    add(group, ice);
  }

  return group;
}

function buildDonut(): THREE.Group {
  const group = new THREE.Group();
  const dough = mesh(new THREE.TorusGeometry(0.58, 0.25, 20, 48), mat("#c88b4e", 0.85));
  dough.rotation.x = Math.PI / 2;
  dough.position.y = 0.3;
  add(group, dough);

  const icing = mesh(new THREE.TorusGeometry(0.58, 0.255, 20, 48), mat("#e9a7a0", 0.35), "Icing");
  icing.rotation.x = Math.PI / 2;
  icing.scale.set(1, 1, 0.72);
  icing.position.y = 0.38;
  add(group, icing);

  const sprinkles: THREE.BufferGeometry[] = [];
  const colors = ["#f7e7b2", "#e2542c", "#7fa06b", "#f5f0e8"];
  for (let index = 0; index < 26; index += 1) {
    const angle = index * 2.399;
    const radius = 0.5 + (index % 3) * 0.03;
    const geometry = new THREE.BoxGeometry(0.09, 0.035, 0.035);
    geometry.rotateY(angle);
    geometry.rotateZ(angle * 1.7);
    geometry.translate(
      Math.cos(angle) * radius,
      0.53 + (index % 2) * 0.015,
      Math.sin(angle) * radius,
    );
    sprinkles.push(geometry);
  }
  // Отдельные группы по цветам, чтобы сохранить палитру без текстур.
  for (let colorIndex = 0; colorIndex < colors.length; colorIndex += 1) {
    const selected = sprinkles.filter((_, index) => index % colors.length === colorIndex);
    add(group, mergeNamed(`Sprinkles-${colorIndex}`, selected, mat(colors[colorIndex]!, 0.5)));
  }

  return group;
}

function buildBox(): THREE.Group {
  const group = new THREE.Group();
  const base = mesh(new RoundedBoxGeometry(1.5, 0.42, 1.15, 3, 0.05), mat(KRAFT, 0.92));
  base.position.y = 0.21;
  add(group, base);

  const lid = mesh(new RoundedBoxGeometry(1.56, 0.18, 1.2, 3, 0.05), mat("#d7b17e", 0.9));
  lid.position.set(0, 0.52, -0.06);
  lid.rotation.x = -0.12;
  add(group, lid);

  const band = mesh(new THREE.BoxGeometry(1.53, 0.2, 1.18), mat("#e2542c", 0.75));
  band.position.y = 0.22;
  add(group, band);

  const label = mesh(new THREE.BoxGeometry(0.62, 0.36, 0.02), mat(CREAM, 0.7));
  label.position.set(0, 0.4, 0.59);
  add(group, label);

  const handle = mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 24, Math.PI), mat("#9b7147", 0.9));
  handle.rotation.z = Math.PI;
  handle.position.set(0, 0.64, -0.06);
  add(group, handle);

  return group;
}

function buildTray(): THREE.Group {
  const group = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(3.0, 0.16, 2.0, 4, 0.14), mat("#c94b38", 0.6));
  body.position.y = 0.08;
  add(group, body);

  const top = mesh(
    new THREE.PlaneGeometry(2.7, 1.7),
    mat("#f3e7d2", 0.65, 0, { side: THREE.DoubleSide }),
    "TrayTop",
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.17;
  add(group, top);

  const rim = mesh(new THREE.TorusGeometry(1.35, 0.04, 8, 48), mat("#a83a2b", 0.5));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 0.72, 1);
  rim.position.y = 0.17;
  add(group, rim);

  return group;
}

const MODELS: ModelSpec[] = [
  {
    name: "burger-beef",
    build: () => buildBurger({ patty: BEEF, cheese: true }),
  },
  {
    name: "burger-double",
    build: () => buildBurger({ patty: BEEF, cheese: true, doublePatty: true }),
  },
  {
    name: "burger-chicken",
    build: () => buildBurger({ patty: CHICKEN, cheese: false }),
  },
  {
    name: "burger-veggie",
    build: () => buildBurger({ patty: VEGGIE, cheese: false }),
  },
  { name: "shawarma", build: buildShawarma },
  { name: "pizza", build: buildPizza },
  { name: "fries", build: buildFries },
  { name: "drink", build: buildDrink },
  { name: "donut", build: buildDonut },
  { name: "box", build: buildBox },
  { name: "tray", build: buildTray },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const exporter = new GLTFExporter();
  const manifest: Array<{
    file: string;
    bytes: number;
    sha256: string;
    license: string;
    source: string;
  }> = [];

  for (const spec of MODELS) {
    const scene = new THREE.Scene();
    scene.name = spec.name;
    const model = spec.build();
    model.name = spec.name;
    scene.add(model);
    scene.updateMatrixWorld(true);
    const result = await exporter.parseAsync(scene, {
      binary: true,
      onlyVisible: true,
      truncateDrawRange: true,
      copyright: "© 2026 Тёплый бокс. Оригинальные демо-ассеты, созданы для этого проекта.",
    });
    const buffer = Buffer.from(result as ArrayBuffer);
    const file = `${spec.name}.glb`;
    await writeFile(path.join(OUT, file), buffer);
    manifest.push({
      file,
      bytes: buffer.byteLength,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      license: "Original work / demo asset, передаётся вместе с исходниками",
      source: "scripts/build-models.ts",
    });
    console.log(`${file.padEnd(20)} ${(buffer.byteLength / 1024).toFixed(1)} KB`);
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        generator: "scripts/build-models.ts",
        note: "Геометрия собрана из примитивов Three.js, внешние модели и текстуры не используются. Тени, материалы и анимации настраиваются в приложении.",
        models: manifest,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
