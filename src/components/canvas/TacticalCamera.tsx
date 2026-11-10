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
import { GRID_DEPTH, GRID_WIDTH, type GridSystem } from "../../core/GridSystem";
import type { FloorLevel } from "../../core/types";
import { useGameStore } from "../../store/useGameStore";
import { FLOOR_HEIGHT, gridToWorld, TILE_SIZE } from "./worldCoords";

function worldToGridXZ(wx: number, wz: number): { x: number; z: number } {
  return {
    x: Math.round(wx / TILE_SIZE + (GRID_WIDTH - 1) * 0.5),
    z: Math.round(wz / TILE_SIZE + (GRID_DEPTH - 1) * 0.5),
  };
}

function isWorldPointBlockedByWall(
  grid: GridSystem,
  wx: number,
  wz: number,
  floor: FloorLevel,
): boolean {
  const { x, z } = worldToGridXZ(wx, wz);
  const tile = grid.getTile({ x, y: floor, z });
  if (!tile) return false;
  return tile.obstacle === "high_wall" || tile.obstacle === "pillar";
}

/**
 * Vybere nejčistší boční odstup a rameno kamery tak, aby výhled na střelce,
 * letící projektil i zasažený cíl nebyl blokován vysokou zdí ani pilířem.
 */
function chooseSmartActionCamRig(
  grid: GridSystem,
  sx: number,
  sz: number,
  sFloor: FloorLevel,
  tx: number,
  tz: number,
  tFloor: FloorLevel,
  normX: number,
  normZ: number,
  rightX: number,
  rightZ: number,
  currentCamPos: THREE.Vector3,
): { sideSign: 1 | -1; backDist: number; sideDist: number } {
  const candidates: Array<{
    sideSign: 1 | -1;
    backDist: number;
    sideDist: number;
  }> = [
    { sideSign: 1, backDist: 3.5, sideDist: 1.95 },
    { sideSign: -1, backDist: 3.5, sideDist: 1.95 },
    { sideSign: 1, backDist: 2.2, sideDist: 2.85 },
    { sideSign: -1, backDist: 2.2, sideDist: 2.85 },
    { sideSign: 1, backDist: 2.4, sideDist: 1.35 },
    { sideSign: -1, backDist: 2.4, sideDist: 1.35 },
  ];

  let best = candidates[0]!;
  let bestScore = -Infinity;

  for (const cand of candidates) {
    const latX = rightX * cand.sideSign * cand.sideDist;
    const latZ = rightZ * cand.sideSign * cand.sideDist;

    const sCamX = sx - normX * cand.backDist + latX;
    const sCamZ = sz - normZ * cand.backDist + latZ;
    const tCamX = tx - normX * (cand.backDist * 0.88) + latX * 1.12;
    const tCamZ = tz - normZ * (cand.backDist * 0.88) + latZ * 1.12;

    let penalty = 0;
    if (isWorldPointBlockedByWall(grid, sCamX, sCamZ, sFloor)) penalty += 50;
    if (
      isWorldPointBlockedByWall(
        grid,
        (sCamX + sx) * 0.5,
        (sCamZ + sz) * 0.5,
        sFloor,
      )
    ) {
      penalty += 35;
    }
    if (isWorldPointBlockedByWall(grid, tCamX, tCamZ, tFloor)) penalty += 60;
    if (
      isWorldPointBlockedByWall(
        grid,
        (tCamX + tx) * 0.5,
        (tCamZ + tz) * 0.5,
        tFloor,
      )
    ) {
      penalty += 45;
    }

    // Preferujeme stranu bližší aktuální pozici kamery pro sametový nájezd bez překlápění o 180°
    const distToCurrent = Math.hypot(
      currentCamPos.x - tCamX,
      currentCamPos.z - tCamZ,
    );
    const score = -penalty - distToCurrent * 0.35;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  return best;
}

export function TacticalCamera() {
  const { camera, gl } = useThree();
  const grid = useGameStore((s) => s.grid);
  const cameraStep = useGameStore((s) => s.cameraStep);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const actionMode = useGameStore((s) => s.actionMode);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectedTargetId = useGameStore((s) => s.selectedTargetId);
  const units = useGameStore((s) => s.units);

  const activeProjectile = useGameStore((s) => s.activeProjectile);
  const activeMovement = useGameStore((s) => s.activeMovement);
  const actionCamEnabled = useGameStore((s) => s.actionCamEnabled);

  const orbitCenterRef = useRef(new THREE.Vector3(0, 0, 4.2));
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 4.2));
  const currentAngleRef = useRef(Math.PI * 0.25);
  const distanceRef = useRef(24);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const isRightDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lockedProjectileRigRef = useRef<{
    id: number;
    sideSign: 1 | -1;
    backDist: number;
    sideDist: number;
  } | null>(null);

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

    // 2. Kontrola, zda jsme v Režimu míření nebo právě letí projektil (Inteligentní 3-fázová Akční kamera)
    const shooter =
      actionMode === "shoot"
        ? units.find((u) => u.id === selectedUnitId && u.alive)
        : undefined;
    const target =
      actionMode === "shoot" && selectedTargetId
        ? units.find((u) => u.id === selectedTargetId && u.alive)
        : undefined;

    const isShootingCamera =
      (actionMode === "shoot" && !!shooter && !!target) || !!activeProjectile;

    if (isShootingCamera) {
      const fromCoord = activeProjectile ? activeProjectile.from : shooter!.pos;
      const toCoord = activeProjectile
        ? activeProjectile.hit === false && activeProjectile.missImpactCoord
          ? activeProjectile.missImpactCoord
          : activeProjectile.to
        : target!.pos;
      const unitTargetCoord = activeProjectile
        ? activeProjectile.to
        : target!.pos;

      const [sx, sy, sz] = gridToWorld(fromCoord);
      const [tx, ty, tz] = gridToWorld(unitTargetCoord);
      const [ix, iy, iz] = gridToWorld(toCoord);

      const dirX = tx - sx;
      const dirZ = tz - sz;
      const horizLen = Math.max(0.001, Math.hypot(dirX, dirZ));
      const normX = dirX / horizLen;
      const normZ = dirZ / horizLen;

      // Vektor kolmý na dráhu výstřelu
      const rightX = -normZ;
      const rightZ = normX;

      // Uzamkneme optimální nezakrytou stranu kamery pro daný výstřel
      let rig: { sideSign: 1 | -1; backDist: number; sideDist: number };
      if (activeProjectile) {
        if (
          !lockedProjectileRigRef.current ||
          lockedProjectileRigRef.current.id !== activeProjectile.id
        ) {
          const computed = chooseSmartActionCamRig(
            grid,
            sx,
            sz,
            fromCoord.y,
            ix,
            iz,
            toCoord.y,
            normX,
            normZ,
            rightX,
            rightZ,
            camera.position,
          );
          lockedProjectileRigRef.current = {
            id: activeProjectile.id,
            ...computed,
          };
        }
        rig = lockedProjectileRigRef.current;
      } else {
        rig = chooseSmartActionCamRig(
          grid,
          sx,
          sz,
          fromCoord.y,
          tx,
          tz,
          unitTargetCoord.y,
          normX,
          normZ,
          rightX,
          rightZ,
          camera.position,
        );
      }

      const latX = rightX * rig.sideSign * rig.sideDist;
      const latZ = rightZ * rig.sideSign * rig.sideDist;

      // Výchozí pozice kamery u ramene střelce (Fáze A: Míření a výstřel)
      const shooterCamX = sx - normX * rig.backDist + latX;
      const shooterCamY = Math.max(sy, ty * 0.45) + 2.85;
      const shooterCamZ = sz - normZ * rig.backDist + latZ;

      if (!activeProjectile) {
        // Režim míření (před výstřelem): klidný filmový záběr přes rameno střelce na cíl
        const desiredLookX = sx * 0.26 + tx * 0.74;
        const desiredLookY = sy * 0.26 + ty * 0.74 + 1.05;
        const desiredLookZ = sz * 0.26 + tz * 0.74;

        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          shooterCamX,
          9.5,
          dt,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          shooterCamY,
          9.5,
          dt,
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          shooterCamZ,
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

        orbitCenterRef.current.x = THREE.MathUtils.damp(
          orbitCenterRef.current.x,
          sx,
          4.5,
          dt,
        );
        orbitCenterRef.current.z = THREE.MathUtils.damp(
          orbitCenterRef.current.z,
          sz,
          4.5,
          dt,
        );

        camera.lookAt(currentLookAtRef.current);
        return;
      }

      // 3-fázová Kinematická kamera sledující let projektilu a detail zásahu / minutí (+90 % delší, C2-hladká)
      const totalDurationSec = Math.max(
        0.8,
        (activeProjectile.durationMs ?? 1780) / 1000,
      );
      const elapsedSec = Math.max(
        0,
        (performance.now() - activeProjectile.createdAt) / 1000,
      );
      const progress = THREE.MathUtils.clamp(elapsedSec / totalDurationSec, 0, 1);

      // Let projektilu trvá prvních 41 % sekvence (~730 ms), zbytek (~1050 ms) je detail zásahu, ztrát cíle a částic
      const rawFlightT = THREE.MathUtils.clamp(progress / 0.41, 0, 1);
      const flightT =
        THREE.MathUtils.smootherstep(rawFlightT, 0, 1) * 0.32 + rawFlightT * 0.68;
      const impactT = THREE.MathUtils.clamp((progress - 0.39) / 0.61, 0, 1);

      // Aktuální 3D pozice letící střely / petardy
      const muzzleX = sx + normX * 0.58 + rightX * 0.14;
      const muzzleY = sy + 1.06;
      const muzzleZ = sz + normZ * 0.58 + rightZ * 0.14;

      const endX =
        activeProjectile.hit === false && !activeProjectile.misfired
          ? tx * 0.35 + ix * 0.65
          : tx;
      const endY =
        activeProjectile.hit === false && !activeProjectile.misfired
          ? iy + 0.88
          : ty + (activeProjectile.kind === "grenade" ? 0.25 : 1.04);
      const endZ =
        activeProjectile.hit === false && !activeProjectile.misfired
          ? tz * 0.35 + iz * 0.65
          : tz;

      const arcLift =
        activeProjectile.kind === "grenade"
          ? Math.sin(flightT * Math.PI) * 3.1
          : 0;
      const bulletX = THREE.MathUtils.lerp(muzzleX, endX, flightT);
      const bulletY = THREE.MathUtils.lerp(muzzleY, endY, flightT) + arcLift;
      const bulletZ = THREE.MathUtils.lerp(muzzleZ, endZ, flightT);

      // Pomalý filmový příjezd (push-in) během Fáze C (detail zásahu a odečtu ztrát cíle)
      const impactPushIn =
        THREE.MathUtils.smootherstep(progress, 0.42, 0.96) * 0.46;
      const impactBack = Math.max(
        1.95,
        Math.min(3.35, Math.max(2.3, horizLen * 0.42)) - impactPushIn,
      );
      const impactCamX = endX - normX * impactBack + latX * 1.12;
      const impactCamY = Math.max(endY + 1.38, sy * 0.22 + endY * 0.78 + 1.52);
      const impactCamZ = endZ - normZ * impactBack + latZ * 1.12;

      // Dvoustupňový fyzikální otřes kamery s plynulým exponenciálním dozníváním:
      // 1) Zpětný ráz při výstřelu z hlavně (progress < 0.14)
      // 2) Otřes při dopadu kulky do těla / zbroje / zdiva (impactT ∈ [0, 0.34])
      let shakeX = 0;
      let shakeY = 0;
      if (progress < 0.14) {
        const muzzleShake = Math.pow(1 - progress / 0.14, 1.6) * 0.12;
        shakeX += Math.sin(elapsedSec * 78) * muzzleShake;
        shakeY += Math.cos(elapsedSec * 92) * muzzleShake * 0.8;
      }
      if (!activeProjectile.misfired && impactT > 0 && impactT < 0.34) {
        const severity = activeProjectile.bloodSeverity ?? 1;
        const baseImpactMag =
          activeProjectile.kind === "grenade" ||
          (activeProjectile.detonatedKegs?.length ?? 0) > 0
            ? 0.32
            : activeProjectile.hit
              ? severity >= 3
                ? 0.24
                : severity === 2
                  ? 0.17
                  : 0.11
              : 0.1;
        const env = Math.pow(1 - impactT / 0.34, 1.7) * baseImpactMag;
        shakeX += Math.sin(elapsedSec * 105) * env;
        shakeY += Math.cos(elapsedSec * 118) * env * 0.9;
      }

      if (activeProjectile.misfired) {
        // Při selhání doutnáku v dešti kamera zůstane u střelce
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          shooterCamX + shakeX,
          8.5,
          dt,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          shooterCamY + shakeY,
          8.5,
          dt,
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          shooterCamZ,
          8.5,
          dt,
        );
        currentLookAtRef.current.x = THREE.MathUtils.damp(
          currentLookAtRef.current.x,
          muzzleX,
          10.5,
          dt,
        );
        currentLookAtRef.current.y = THREE.MathUtils.damp(
          currentLookAtRef.current.y,
          muzzleY,
          10.5,
          dt,
        );
        currentLookAtRef.current.z = THREE.MathUtils.damp(
          currentLookAtRef.current.z,
          muzzleZ,
          10.5,
          dt,
        );
        camera.lookAt(currentLookAtRef.current);
        return;
      }

      // C2-hladký přelet kamery podél dráhy letící střely k cíli (Quintic Smootherstep Bullet-Tracking Rail)
      const trackAlpha = THREE.MathUtils.smootherstep(progress, 0.02, 0.46);
      const midFlightArc = Math.sin(flightT * Math.PI) * 0.62;

      const desiredCamX =
        THREE.MathUtils.lerp(shooterCamX, impactCamX, trackAlpha) +
        rightX * rig.sideSign * midFlightArc +
        shakeX;
      const desiredCamY =
        THREE.MathUtils.lerp(shooterCamY, impactCamY, trackAlpha) +
        arcLift * 0.35 +
        shakeY;
      const desiredCamZ =
        THREE.MathUtils.lerp(shooterCamZ, impactCamZ, trackAlpha) +
        rightZ * rig.sideSign * midFlightArc;

      // Bod pohledu (LookAt): během letu plynule sleduje samotnou letící kulku a v cíli mírně zvedne pohled (+0.32m),
      // aby byl přímo v rámu jak zasažený nepřítel, tak panel toho, co nepřítel ztrácí!
      const lookFocusAlpha = THREE.MathUtils.smootherstep(progress, 0.22, 0.44);
      const lossPanelLift = THREE.MathUtils.smootherstep(progress, 0.39, 0.62) * 0.34;
      const desiredLookX =
        THREE.MathUtils.lerp(bulletX, endX, lookFocusAlpha) + shakeX * 0.4;
      const desiredLookY =
        THREE.MathUtils.lerp(bulletY, endY + lossPanelLift, lookFocusAlpha) +
        shakeY * 0.4;
      const desiredLookZ = THREE.MathUtils.lerp(bulletZ, endZ, lookFocusAlpha);

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredCamX,
        9.8,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredCamY,
        9.8,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredCamZ,
        9.8,
        dt,
      );

      currentLookAtRef.current.x = THREE.MathUtils.damp(
        currentLookAtRef.current.x,
        desiredLookX,
        14.5,
        dt,
      );
      currentLookAtRef.current.y = THREE.MathUtils.damp(
        currentLookAtRef.current.y,
        desiredLookY,
        14.5,
        dt,
      );
      currentLookAtRef.current.z = THREE.MathUtils.damp(
        currentLookAtRef.current.z,
        desiredLookZ,
        14.5,
        dt,
      );

      // Plynulá synchronizace orbitCenterRef, aby po skončení výstřelu kamera plynule navázala
      const anchorX = activeProjectile.from.y === activeFloor ? sx : tx;
      const anchorZ = activeProjectile.from.y === activeFloor ? sz : tz;
      orbitCenterRef.current.x = THREE.MathUtils.damp(
        orbitCenterRef.current.x,
        anchorX,
        5.0,
        dt,
      );
      orbitCenterRef.current.z = THREE.MathUtils.damp(
        orbitCenterRef.current.z,
        anchorZ,
        5.0,
        dt,
      );

      camera.lookAt(currentLookAtRef.current);
      return;
    }

    // 3. Kinematická akční kamera při pohybu vojáka (XCOM Action Tracking Cam)
    if (activeMovement && actionCamEnabled) {
      const movingUnit = units.find((u) => u.id === activeMovement.unitId);
      // Cílová dlaždice, ke které voják právě míří
      const targetCoord =
        activeMovement.path[activeMovement.path.length - 1] ??
        activeMovement.from;
      const [tx, ty, tz] = gridToWorld(targetCoord);

      // Plynule uzamkneme střed otáčení kamery na pohybující se postavu a její patro
      orbitCenterRef.current.x = THREE.MathUtils.damp(
        orbitCenterRef.current.x,
        tx,
        7.5,
        dt,
      );
      orbitCenterRef.current.y = THREE.MathUtils.damp(
        orbitCenterRef.current.y,
        ty + 0.4,
        7.5,
        dt,
      );
      orbitCenterRef.current.z = THREE.MathUtils.damp(
        orbitCenterRef.current.z,
        tz,
        7.5,
        dt,
      );

      // Akční přiblížení kamery (o ~28 % blíže než standardní taktický odstup)
      const actionDistance = Math.max(12, distanceRef.current * 0.72);
      const pitch = Math.PI * 0.25; // Lehce plošší filmový úhel
      const horizDist = Math.cos(pitch) * actionDistance;
      const vertDist = Math.sin(pitch) * actionDistance;

      const desiredCamX =
        orbitCenterRef.current.x + Math.sin(currentAngleRef.current) * horizDist;
      const desiredCamY = orbitCenterRef.current.y + vertDist;
      const desiredCamZ =
        orbitCenterRef.current.z + Math.cos(currentAngleRef.current) * horizDist;

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredCamX,
        8.0,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredCamY,
        8.0,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredCamZ,
        8.0,
        dt,
      );

      currentLookAtRef.current.x = THREE.MathUtils.damp(
        currentLookAtRef.current.x,
        orbitCenterRef.current.x,
        9.0,
        dt,
      );
      currentLookAtRef.current.y = THREE.MathUtils.damp(
        currentLookAtRef.current.y,
        orbitCenterRef.current.y + 0.6,
        9.0,
        dt,
      );
      currentLookAtRef.current.z = THREE.MathUtils.damp(
        currentLookAtRef.current.z,
        orbitCenterRef.current.z,
        9.0,
        dt,
      );

      camera.lookAt(currentLookAtRef.current);
      return;
    }

    // 4. Standardní taktický izometrický/perspektivní pohled (mimo Režim střelby a akční sledování)
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
