// Character-select portraits, rendered from the real 3D models once per
// session into small PNGs (head and shoulders, three-quarter view).

import * as THREE from "three";
import { characters } from "../content/characters";
import { worldTheme } from "../config/theme";
import { createCharacter } from "./characterModel";
import { rimUniforms } from "./materials";

const size = 192;
let portraits: Map<string, string> | null = null;

function renderAll(): Map<string, string> {
  const result = new Map<string, string>();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return result;
  }
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a48, 1.1));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(-1.5, 2.5, -2.5);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
  const savedRim = rimUniforms.rimColor.value.clone();
  rimUniforms.rimColor.value.setHex(0xfff3dd);

  for (const definition of characters) {
    const view = createCharacter(definition, worldTheme.teamA);
    view.root.rotation.y = -0.38;
    view.update(0);
    // Hide the floor ring and contact shadow.
    for (const child of view.root.children) if (child instanceof THREE.Mesh) child.visible = false;
    scene.add(view.root);
    // Frame on the actual head position so every height fits the same way.
    const head = new THREE.Vector3();
    view.root.updateMatrixWorld(true);
    view.head.getWorldPosition(head);
    camera.position.set(head.x + 0.16, head.y + 0.03, head.z - 1.15);
    camera.lookAt(head.x, head.y - 0.09, head.z);
    renderer.render(scene, camera);
    result.set(definition.id, renderer.domElement.toDataURL("image/png"));
    scene.remove(view.root);
  }
  rimUniforms.rimColor.value.copy(savedRim);
  renderer.dispose();
  renderer.forceContextLoss();
  return result;
}

export function portraitFor(characterId: string): string {
  if (!portraits) portraits = renderAll();
  return portraits.get(characterId) ?? "";
}
