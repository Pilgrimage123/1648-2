/**
 * Taktická kamera (/src/components/canvas/TacticalCamera.tsx).
 * Podporuje:
 * 1. Izometrický / perspektivní pohled s plynulým posunem (WASD / pravé tlačítko myši),
 *    zoomem (kolečko) a otáčením po 90° krocích (klávesy Q a E).
 * 2. Plynulý přelet kamery za rameno střelce (Over-the-Shoulder Aiming Camera) při přepnutí
 *    do Režimu míření (`actionMode === "shoot"`) a při přepínání cílů přes `Tab` / Target Ribbon.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../store/useGameStore";
import { FLOOR_HEIGHT, gridToWorld } from "./worldCoords";

export function TacticalCamera() {
  const { camera, gl } = useThree();
  const cameraStep = useGameStore((s) => s.cameraStep);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const actionMode = useGameStore((s) => s.actionMode);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const units = useGameStore((s) => s.units);

  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const turn = useGameStore((s) => s.turn);

  const orbitCenterRef = useRef(new THREE.Vector3(0, 0, 4.2));
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 4.2));
  const currentAngleRef = useRef(Math.PI * 0.25);
  const distanceRef = useRef(24);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const isRightDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const dom = gl.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      keysPressedRef.current.add(key);

      if (key === "q" && !e.repeat) {
        useGameStore.getState().rotateCamera(-1);
      } else if (key === "e" && !e.repeat) {
        useGameStore.getState().rotateCamera(1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.key.toLowerCase());
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2 || e.button === 1) {
        isRightDraggingRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isRightDraggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      const panScale = distanceRef.current * 0.0018;
      const angle = currentAngleRef.current;
      const forwardX = -Math.sin(angle);
      const forwardZ = -Math.cos(angle);
      const rightX = Math.cos(angle);
      const rightZ = -Math.sin(angle);

      orbitCenterRef.current.x = THREE.MathUtils.clamp(
        orbitCenterRef.current.x - (rightX * dx - forwardX * dy) * panScale,
        -17,
        17,
      );
      orbitCenterRef.current.z = THREE.MathUtils.clamp(
        orbitCenterRef.current.z - (rightZ * dx - forwardZ * dy) * panScale,
        -20,
        20,
      );
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2 || e.button === 1) {
        isRightDraggingRef.current = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.altKey || e.shiftKey) {
        const state = useGameStore.getState();
        const deltaFloor = e.deltaY < 0 ? 1 : -1;
        const nextFloor = Math.max(
          0,
          Math.min(2, state.activeFloor + deltaFloor),
        ) as 0 | 1 | 2;
        if (nextFloor !== state.activeFloor) {
          state.setActiveFloor(nextFloor);
        }
        return;
      }
      distanceRef.current = THREE.MathUtils.clamp(
        distanceRef.current + e.deltaY * 0.015,
        10,
        42,
      );
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("contextmenu", onContextMenu);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);

    // 1. Plynulá interpolace úhlu kamery po 90° krocích (Q / E)
    const desiredAngle = Math.PI * 0.25 + cameraStep * (Math.PI * 0.5);
    currentAngleRef.current = THREE.MathUtils.damp(
      currentAngleRef.current,
      desiredAngle,
      8.5,
      dt,
    );

    // 2. Kontrola, zda jsme v Režimu míření nebo právě probíhá výstřel (Over-the-Shoulder XCOM 2 kamera)
    const shooter =
      actionMode === "shoot"
        ? units.find((u) => u.id === selectedUnitId && u.alive)
        : undefined;
    const target =
      actionMode === "shoot" && selectedTargetId
        ? units.find((u) => u.id === selectedTargetId && u.alive)
        : undefined;

    const isShootingCamera =
      (actionMode === "shoot" && !!shooter && !!target) ||
      (turn === "player" &&
        !!activeProjectile &&
        activeProjectile.kind !== "grenade");

    if (isShootingCamera) {
      const fromCoord =
        activeProjectile && turn === "player"
          ? activeProjectile.from
          : shooter!.pos;
      const toCoord =
        activeProjectile && turn === "player"
          ? activeProjectile.to
          : target!.pos;

      const [sx, sy, sz] = gridToWorld(fromCoord);
      const [tx, ty, tz] = gridToWorld(toCoord);

      const dirX = tx - sx;
      const dirZ = tz - sz;
      const horizLen = Math.max(0.001, Math.hypot(dirX, dirZ));
      const normX = dirX / horizLen;
      const normZ = dirZ / horizLen;

      // Vektor doprava od střelce (pro pohled přes pravé rameno)
      const rightX = -normZ;
      const rightZ = normX;

      // Jemný zpětný ráz kamery (camera shake) v okamžiku výstřelu
      let shakeX = 0;
      let shakeY = 0;
      if (activeProjectile) {
        const elapsed = (performance.now() - activeProjectile.createdAt) / 1000;
        if (elapsed >= 0 && elapsed < 0.35) {
          const intensity = (1 - elapsed / 0.35) * 0.16;
          shakeX = Math.sin(elapsed * 95) * intensity;
          shakeY = Math.cos(elapsed * 110) * intensity * 0.8;
        }
      }

      // Pozice kamery: za střelcem, lehce vpravo u ramene a vyvýšená, aby bylo vidět střelce, dráhu střely i cíl
      const desiredCamX = sx - normX * 4.2 + rightX * 1.65 + shakeX;
      const desiredCamY = Math.max(sy, ty * 0.55) + 3.15 + shakeY;
      const desiredCamZ = sz - normZ * 4.2 + rightZ * 1.65;

      // Bod pohledu: směrem k cíli (cca 72 % vzdálenosti od střelce k cíli ve výšce hrudi)
      const desiredLookX = sx * 0.28 + tx * 0.72 + shakeX * 0.5;
      const desiredLookY = sy * 0.28 + ty * 0.72 + 1.05 + shakeY * 0.5;
      const desiredLookZ = sz * 0.28 + tz * 0.72;

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredCamX,
        9.5,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredCamY,
        9.5,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredCamZ,
        9.5,
        dt,
      );

      currentLookAtRef.current.x = THREE.MathUtils.damp(
        currentLookAtRef.current.x,
        desiredLookX,
        10.5,
        dt,
      );
      currentLookAtRef.current.y = THREE.MathUtils.damp(
        currentLookAtRef.current.y,
        desiredLookY,
        10.5,
        dt,
      );
      currentLookAtRef.current.z = THREE.MathUtils.damp(
        currentLookAtRef.current.z,
        desiredLookZ,
        10.5,
        dt,
      );

      // Plynule synchronizujeme orbitCenterRef se střelcem, aby při návratu z režimu míření (Esc)
      // kamera plynule odcouvala k aktivnímu vojákovi a neskákala na staré souřadnice
      orbitCenterRef.current.x = THREE.MathUtils.damp(orbitCenterRef.current.x, sx, 4.5, dt);
      orbitCenterRef.current.z = THREE.MathUtils.damp(orbitCenterRef.current.z, sz, 4.5, dt);

      camera.lookAt(currentLookAtRef.current);
      return;
    }

    // 3. Standardní taktický izometrický/perspektivní pohled (mimo Režim střelby)
    const desiredY = activeFloor * FLOOR_HEIGHT * 0.65;
    orbitCenterRef.current.y = THREE.MathUtils.damp(
      orbitCenterRef.current.y,
      desiredY,
      6.5,
      dt,
    );

    const keys = keysPressedRef.current;
    let moveForward = 0;
    let moveRight = 0;
    if (keys.has("w") || keys.has("arrowup")) moveForward += 1;
    if (keys.has("s") || keys.has("arrowdown")) moveForward -= 1;
    if (keys.has("d") || keys.has("arrowright")) moveRight += 1;
    if (keys.has("a") || keys.has("arrowleft")) moveRight -= 1;

    if (moveForward !== 0 || moveRight !== 0) {
      const len = Math.hypot(moveForward, moveRight);
      moveForward /= len;
      moveRight /= len;

      const panSpeed = 12 * dt;
      const angle = currentAngleRef.current;
      const forwardX = -Math.sin(angle);
      const forwardZ = -Math.cos(angle);
      const rightX = Math.cos(angle);
      const rightZ = -Math.sin(angle);

      orbitCenterRef.current.x = THREE.MathUtils.clamp(
        orbitCenterRef.current.x +
          (forwardX * moveForward + rightX * moveRight) * panSpeed,
        -17,
        17,
      );
      orbitCenterRef.current.z = THREE.MathUtils.clamp(
        orbitCenterRef.current.z +
          (forwardZ * moveForward + rightZ * moveRight) * panSpeed,
        -20,
        20,
      );
    }

    const pitch = Math.PI * 0.29;
    const horizDist = Math.cos(pitch) * distanceRef.current;
    const vertDist = Math.sin(pitch) * distanceRef.current;

    const desiredIsoCamX =
      orbitCenterRef.current.x + Math.sin(currentAngleRef.current) * horizDist;
    const desiredIsoCamY = orbitCenterRef.current.y + vertDist;
    const desiredIsoCamZ =
      orbitCenterRef.current.z + Math.cos(currentAngleRef.current) * horizDist;

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      desiredIsoCamX,
      7.5,
      dt,
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      desiredIsoCamY,
      7.5,
      dt,
    );
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      desiredIsoCamZ,
      7.5,
      dt,
    );

    currentLookAtRef.current.x = THREE.MathUtils.damp(
      currentLookAtRef.current.x,
      orbitCenterRef.current.x,
      8.0,
      dt,
    );
    currentLookAtRef.current.y = THREE.MathUtils.damp(
      currentLookAtRef.current.y,
      orbitCenterRef.current.y,
      8.0,
      dt,
    );
    currentLookAtRef.current.z = THREE.MathUtils.damp(
      currentLookAtRef.current.z,
      orbitCenterRef.current.z,
      8.0,
      dt,
    );

    camera.lookAt(currentLookAtRef.current);
  });

  return null;
}
