/**
 * Taktická a filmová kamera ve stylu XCOM 2 (/src/components/canvas/TacticalCamera.tsx).
 * Implementuje 4-stavový kamerový automat (Camera State Machine):
 * 1. TACTICAL_ISO: Ptačí izometrický pohled sledující 1 AP pohyb po mřížce v reálném čase
 *    (s dynamickým zprůhledněním střech dobových budov, pokud je jednotka uvnitř).
 * 2. ACTION_OTS_FOLLOW: Filmový průlet nízko za ramenem vojáka (Over-the-Shoulder Chase Cam)
 *    při 2 AP sprintu, vyražení dřevěných dveří, přeskoku nízkého krytu (vault) a běhu po schodišti,
 *    doplněný o krokový třes kamery (camera shake) a chytré vyhýbání se zdem/pilířům.
 * 3. EVENT INTERRUPTS:
 *    - INTERRUPT_POD_REVEAL: Rychlý přelet a přiblížení (Pan & Zoom) na nově odhalenou skupinu
 *      mušketýrů/pikenýrů během jejich "Scramble" animace do krytu a následný návrat.
 *    - INTERRUPT_OVERWATCH_SLOWMO: Zpomalený záběr na střelce v oblaku střelného prachu při
 *      reakčním výstřelu z hlídky a následné blízké sledování běžícího vojáka.
 * 4. COVER_SETTLE_RESET: Podržení záběru při zakleknutí vojáka do krytu a C2-hladký návrat
 *    zpět do taktického izometrického pohledu.
 * + AIM_OTS / PROJECTILE_TRACK: 3-fázová kamera při ručním míření a střelbě.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  liveMovementTelemetry,
  resolveActiveCameraState,
} from "../../core/CameraDirector";
import { GRID_DEPTH, GRID_WIDTH, type GridSystem } from "../../core/GridSystem";
import type { CardinalDir, FloorLevel } from "../../core/types";
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

function cardinalToUnitVec(dir: CardinalDir): [number, number] {
  switch (dir) {
    case "N":
      return [0, -1];
    case "S":
      return [0, 1];
    case "E":
      return [1, 0];
    case "W":
      return [-1, 0];
  }
}

/**
 * Vybere nejčistší boční odstup a rameno kamery pro střelbu (AIM_OTS / PROJECTILE_TRACK)
 * tak, aby výhled na střelce, letící projektil i cíl nebyl blokován vysokou zdí ani pilířem.
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

/**
 * Vybere optimální nízký Over-the-Shoulder úhel za ramenem běžícího hrdiny (ACTION_OTS_FOLLOW),
 * který neprochází vysokou zdí ani pilířem a minimalizuje skok při zatáčení.
 */
function chooseSmartSprintCamRig(
  grid: GridSystem,
  ux: number,
  uz: number,
  floor: FloorLevel,
  tanX: number,
  tanZ: number,
  currentCamPos: THREE.Vector3,
  preferredSide: 1 | -1,
): { sideSign: 1 | -1; backDist: number; sideDist: number } {
  const rightX = -tanZ;
  const rightZ = tanX;

  const candidates: Array<{
    sideSign: 1 | -1;
    backDist: number;
    sideDist: number;
  }> = [
    { sideSign: preferredSide, backDist: 2.95, sideDist: 0.92 },
    { sideSign: (preferredSide * -1) as 1 | -1, backDist: 2.95, sideDist: 0.92 },
    { sideSign: preferredSide, backDist: 2.25, sideDist: 1.35 },
    { sideSign: (preferredSide * -1) as 1 | -1, backDist: 2.25, sideDist: 1.35 },
    { sideSign: preferredSide, backDist: 1.75, sideDist: 0.62 },
    { sideSign: (preferredSide * -1) as 1 | -1, backDist: 1.75, sideDist: 0.62 },
  ];

  let best = candidates[0]!;
  let bestScore = -Infinity;

  for (const cand of candidates) {
    const camX =
      ux - tanX * cand.backDist + rightX * cand.sideSign * cand.sideDist;
    const camZ =
      uz - tanZ * cand.backDist + rightZ * cand.sideSign * cand.sideDist;

    let penalty = 0;
    if (isWorldPointBlockedByWall(grid, camX, camZ, floor)) penalty += 65;
    if (
      isWorldPointBlockedByWall(
        grid,
        (camX + ux) * 0.5,
        (camZ + uz) * 0.5,
        floor,
      )
    ) {
      penalty += 45;
    }

    const sameSideBonus = cand.sideSign === preferredSide ? 4.0 : 0;
    const distToCam = Math.hypot(
      currentCamPos.x - camX,
      currentCamPos.z - camZ,
    );
    const score = sameSideBonus - penalty - distToCam * 0.25;
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
  const cameraDirector = useGameStore((s) => s.cameraDirector);

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

  // Vyhlazená tečna pohybu a preferované rameno pro Over-the-Shoulder Sprint Cam (State 2)
  const smoothedMoveDirRef = useRef(new THREE.Vector2(0, -1));
  const preferredShoulderRef = useRef<1 | -1>(1);
  const lastTrackedMoveUnitRef = useRef<string | null>(null);

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
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    const now = performance.now();
    const elapsedClock = state.clock.elapsedTime;

    // 1. Plynulá interpolace základního izometrického úhlu kamery po 90° krocích (Q / E)
    const desiredAngle = Math.PI * 0.25 + cameraStep * (Math.PI * 0.5);
    currentAngleRef.current = THREE.MathUtils.damp(
      currentAngleRef.current,
      desiredAngle,
      8.5,
      dt,
    );

    const shooter =
      actionMode === "shoot"
        ? units.find((u) => u.id === selectedUnitId && u.alive)
        : undefined;
    const target =
      actionMode === "shoot" && selectedTargetId
        ? units.find((u) => u.id === selectedTargetId && u.alive)
        : undefined;

    // Vyhodnocení aktivního stavu kamerového automatu (State Machine)
    const activeState = resolveActiveCameraState({
      director: cameraDirector,
      actionCamEnabled,
      actionMode,
      hasValidAimTarget: !!shooter && !!target,
      hasActiveProjectile: !!activeProjectile,
      activeMovement,
    });

    // =========================================================================
    // STATE 3b: INTERRUPT_OVERWATCH_SLOWMO (Zpomalený přepad ze zálohy)
    // - Fáze A (SHOOTER_FOCUS): Kamera zabere střelce v oblaku střelného prachu
    // - Fáze B (RUNNER_TRACK): Pokud ještě neletí projektil, kamera zblízka zabere
    //   běžícího vojáka; jakmile vyletí projektil, plynule naváže sledování střely!
    // =========================================================================
    if (
      activeState === "INTERRUPT_OVERWATCH_SLOWMO" &&
      cameraDirector.overwatchSlowMo &&
      !activeProjectile
    ) {
      const ow = cameraDirector.overwatchSlowMo;
      const [wx, wy, wz] = gridToWorld(ow.watcherCoord);
      const [ax, ay, az] = gridToWorld(ow.ambushCoord);

      const dirX = ax - wx;
      const dirZ = az - wz;
      const horizLen = Math.max(0.001, Math.hypot(dirX, dirZ));
      const normX = dirX / horizLen;
      const normZ = dirZ / horizLen;
      const rightX = -normZ;
      const rightZ = normX;

      const rig = chooseSmartActionCamRig(
        grid,
        wx,
        wz,
        ow.watcherCoord.y,
        ax,
        az,
        ow.ambushCoord.y,
        normX,
        normZ,
        rightX,
        rightZ,
        camera.position,
      );

      // Jemným kmitáním podtrhneme napětí zpomaleného času (Slow-Mo)
      const slowPulse = Math.sin(elapsedClock * 3.2) * 0.08;

      if (ow.subPhase === "SHOOTER_FOCUS") {
        // Nízký dramatický záběr na mušketýra v oblaku černého prachu mířícího na běžící cíl
        const camX =
          wx - normX * 2.45 + rightX * rig.sideSign * (1.45 + slowPulse);
        const camY = wy + 1.72;
        const camZ =
          wz - normZ * 2.45 + rightZ * rig.sideSign * (1.45 + slowPulse);

        const lookX = wx * 0.62 + ax * 0.38;
        const lookY = wy * 0.65 + ay * 0.35 + 1.08;
        const lookZ = wz * 0.62 + az * 0.38;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, camX, 9.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, camY, 9.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, camZ, 9.5, dt);

        currentLookAtRef.current.x = THREE.MathUtils.damp(
          currentLookAtRef.current.x,
          lookX,
          11.0,
          dt,
        );
        currentLookAtRef.current.y = THREE.MathUtils.damp(
          currentLookAtRef.current.y,
          lookY,
          11.0,
          dt,
        );
        currentLookAtRef.current.z = THREE.MathUtils.damp(
          currentLookAtRef.current.z,
          lookZ,
          11.0,
          dt,
        );

        orbitCenterRef.current.x = THREE.MathUtils.damp(
          orbitCenterRef.current.x,
          ax,
          5.0,
          dt,
        );
        orbitCenterRef.current.z = THREE.MathUtils.damp(
          orbitCenterRef.current.z,
          az,
          5.0,
          dt,
        );

        camera.lookAt(currentLookAtRef.current);
        return;
      }
    }

    // =========================================================================
    // STATE 3a: INTERRUPT_POD_REVEAL (Rychlý přelet a zoom na odhalenou hlídku + Scramble)
    // =========================================================================
    if (activeState === "INTERRUPT_POD_REVEAL" && cameraDirector.podReveal) {
      const reveal = cameraDirector.podReveal;
      const [fx, fy, fz] = gridToWorld(reveal.focusCoord);
      const [sx, , sz] = gridToWorld(reveal.spotterCoord);

      // Vektor od hráče (spottera) k odhalené skupině mušketýrů/pikenýrů
      const dirX = fx - sx;
      const dirZ = fz - sz;
      const len = Math.max(0.001, Math.hypot(dirX, dirZ));
      const normX = dirX / len;
      const normZ = dirZ / len;
      const rightX = -normZ;
      const rightZ = normX;

      const revealElapsed = Math.max(0, (now - reveal.startedAt) / 1000);
      const zoomInPush = THREE.MathUtils.smootherstep(
        Math.min(1, revealElapsed / 0.55),
        0,
        1,
      );

      // Kamera přeletí do dramatičtějšího polodetailu před odhalenou hlídku, aby hráč viděl jejich Scramble do krytu
      const backOffset = 7.2 - zoomInPush * 1.45;
      const desiredCamX = fx - normX * backOffset + rightX * 2.8;
      const desiredCamY = fy + 5.2 - zoomInPush * 0.7;
      const desiredCamZ = fz - normZ * backOffset + rightZ * 2.8;

      // Jemný otřes při šokovém odhalení hlídky v prvních 220 ms
      const alertShake =
        revealElapsed < 0.24
          ? Math.pow(1 - revealElapsed / 0.24, 1.8) * 0.1
          : 0;
      const shakeX = Math.sin(revealElapsed * 85) * alertShake;
      const shakeY = Math.cos(revealElapsed * 95) * alertShake;

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredCamX + shakeX,
        9.2,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredCamY + shakeY,
        9.2,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredCamZ,
        9.2,
        dt,
      );

      currentLookAtRef.current.x = THREE.MathUtils.damp(
        currentLookAtRef.current.x,
        fx + shakeX * 0.5,
        11.5,
        dt,
      );
      currentLookAtRef.current.y = THREE.MathUtils.damp(
        currentLookAtRef.current.y,
        fy + 0.95 + shakeY * 0.5,
        11.5,
        dt,
      );
      currentLookAtRef.current.z = THREE.MathUtils.damp(
        currentLookAtRef.current.z,
        fz,
        11.5,
        dt,
      );

      // Plynule vracíme orbitCenter k odhalujícímu vojákovi pro hladký návrat kamery
      orbitCenterRef.current.x = THREE.MathUtils.damp(
        orbitCenterRef.current.x,
        sx,
        5.5,
        dt,
      );
      orbitCenterRef.current.y = THREE.MathUtils.damp(
        orbitCenterRef.current.y,
        fy,
        5.5,
        dt,
      );
      orbitCenterRef.current.z = THREE.MathUtils.damp(
        orbitCenterRef.current.z,
        sz,
        5.5,
        dt,
      );

      camera.lookAt(currentLookAtRef.current);
      return;
    }

    // =========================================================================
    // STATE AIM_OTS & PROJECTILE_TRACK (Ruční míření a 3-fázové sledování střely / Overwatch výstřelu)
    // =========================================================================
    const isShootingCamera =
      activeState === "AIM_OTS" ||
      activeState === "PROJECTILE_TRACK" ||
      (activeState === "INTERRUPT_OVERWATCH_SLOWMO" && !!activeProjectile);

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

      const shooterCamX = sx - normX * rig.backDist + latX;
      const shooterCamY = Math.max(sy, ty * 0.45) + 2.85;
      const shooterCamZ = sz - normZ * rig.backDist + latZ;

      if (!activeProjectile) {
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

      const totalDurationSec = Math.max(
        0.8,
        (activeProjectile.durationMs ?? 1780) / 1000,
      );
      const elapsedSec = Math.max(
        0,
        (now - activeProjectile.createdAt) / 1000,
      );
      const progress = THREE.MathUtils.clamp(
        elapsedSec / totalDurationSec,
        0,
        1,
      );

      const rawFlightT = THREE.MathUtils.clamp(progress / 0.41, 0, 1);
      const flightT =
        THREE.MathUtils.smootherstep(rawFlightT, 0, 1) * 0.32 +
        rawFlightT * 0.68;
      const impactT = THREE.MathUtils.clamp((progress - 0.39) / 0.61, 0, 1);

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

      const isOverwatchSlowMo = !!cameraDirector.overwatchSlowMo;
      // Při Overwatch Slow-Mo zabere kamera běžícího vojáka ještě blíže
      const baseImpactBack = isOverwatchSlowMo ? 1.65 : 1.95;
      const impactPushIn =
        THREE.MathUtils.smootherstep(progress, 0.42, 0.96) * 0.46;
      const impactBack = Math.max(
        baseImpactBack,
        Math.min(3.35, Math.max(2.3, horizLen * 0.42)) - impactPushIn,
      );
      const impactCamX = endX - normX * impactBack + latX * 1.12;
      const impactCamY = Math.max(
        endY + (isOverwatchSlowMo ? 1.18 : 1.38),
        sy * 0.22 + endY * 0.78 + 1.52,
      );
      const impactCamZ = endZ - normZ * impactBack + latZ * 1.12;

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

      const lookFocusAlpha = THREE.MathUtils.smootherstep(progress, 0.22, 0.44);
      const lossPanelLift =
        THREE.MathUtils.smootherstep(progress, 0.39, 0.62) * 0.34;
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

    // =========================================================================
    // STATE 2: ACTION_OTS_FOLLOW (Filmový let kamery nízko za ramenem hrdiny)
    // Aktivuje se při 2 AP sprintu (Yellow Zone), vyražení dveří, přeskoku (vault) a schodišti.
    // =========================================================================
    if (activeState === "ACTION_OTS_FOLLOW" && activeMovement) {
      const movingUnit = units.find((u) => u.id === activeMovement.unitId);
      const hasLiveTelemetry =
        liveMovementTelemetry.unitId === activeMovement.unitId;

      // Aktuální interpolovaná 3D pozice běžícího hrdiny v reálném čase
      const fallbackCoord =
        activeMovement.path[0] ?? activeMovement.from;
      const [fx, fy, fz] = gridToWorld(fallbackCoord);
      const ux = hasLiveTelemetry ? liveMovementTelemetry.worldPos[0] : fx;
      const uy = hasLiveTelemetry ? liveMovementTelemetry.worldPos[1] : fy;
      const uz = hasLiveTelemetry ? liveMovementTelemetry.worldPos[2] : fz;

      // Směrová tečna pohybu po A* trase
      const rawTanX = hasLiveTelemetry
        ? liveMovementTelemetry.tangentXZ[0]
        : movingUnit
          ? cardinalToUnitVec(movingUnit.facing)[0]
          : 0;
      const rawTanZ = hasLiveTelemetry
        ? liveMovementTelemetry.tangentXZ[1]
        : movingUnit
          ? cardinalToUnitVec(movingUnit.facing)[1]
          : -1;

      if (lastTrackedMoveUnitRef.current !== activeMovement.unitId) {
        lastTrackedMoveUnitRef.current = activeMovement.unitId;
        smoothedMoveDirRef.current.set(rawTanX, rawTanZ);
      } else {
        smoothedMoveDirRef.current.x = THREE.MathUtils.damp(
          smoothedMoveDirRef.current.x,
          rawTanX,
          7.2,
          dt,
        );
        smoothedMoveDirRef.current.y = THREE.MathUtils.damp(
          smoothedMoveDirRef.current.y,
          rawTanZ,
          7.2,
          dt,
        );
      }

      const dirLen = Math.max(
        0.001,
        Math.hypot(smoothedMoveDirRef.current.x, smoothedMoveDirRef.current.y),
      );
      const tanX = smoothedMoveDirRef.current.x / dirLen;
      const tanZ = smoothedMoveDirRef.current.y / dirLen;
      const rightX = -tanZ;
      const rightZ = tanX;

      const curFloor = Math.round(
        hasLiveTelemetry
          ? liveMovementTelemetry.continuousCoord.y
          : activeFloor,
      ) as FloorLevel;

      const sprintRig = chooseSmartSprintCamRig(
        grid,
        ux,
        uz,
        curFloor,
        tanX,
        tanZ,
        camera.position,
        preferredShoulderRef.current,
      );
      preferredShoulderRef.current = sprintRig.sideSign;

      // Jemný krokový třes kamery (Sprint Camera Shake) + ráz při vyražení dveří či přeskoku
      const stridePhase =
        (hasLiveTelemetry
          ? liveMovementTelemetry.segmentIndex +
            liveMovementTelemetry.segmentFraction
          : elapsedClock * 5.2) *
        Math.PI *
        2;
      let shakeVert = Math.sin(stridePhase) * 0.042;
      let shakeLat = Math.cos(stridePhase * 0.5) * 0.028;

      const impulseAgeSec =
        liveMovementTelemetry.interactionImpulseTs > 0
          ? (now - liveMovementTelemetry.interactionImpulseTs) / 1000
          : 999;
      if (impulseAgeSec >= 0 && impulseAgeSec < 0.36) {
        const impulseEnv = Math.pow(1 - impulseAgeSec / 0.36, 1.6) * 0.14;
        shakeVert += Math.cos(impulseAgeSec * 90) * impulseEnv;
        shakeLat += Math.sin(impulseAgeSec * 78) * impulseEnv;
      }

      const isStairClimb =
        hasLiveTelemetry &&
        liveMovementTelemetry.stepInteraction === "stairs";

      // Pozice kamery nízko za ramenem běžícího hrdiny (Over-the-Shoulder Chase Cam)
      const desiredCamX =
        ux -
        tanX * sprintRig.backDist +
        rightX * (sprintRig.sideSign * sprintRig.sideDist + shakeLat);
      const desiredCamY = uy + (isStairClimb ? 2.18 : 1.56) + shakeVert;
      const desiredCamZ =
        uz -
        tanZ * sprintRig.backDist +
        rightZ * (sprintRig.sideSign * sprintRig.sideDist + shakeLat);

      // Bod pohledu (LookAt) míří před běžícího vojáka ve směru běhu, takže hrdina je v dolní třetině záběru
      const lookAheadDist = isStairClimb ? 1.85 : 2.65;
      const desiredLookX =
        ux + tanX * lookAheadDist + rightX * sprintRig.sideSign * 0.18;
      const desiredLookY = uy + 1.12 + shakeVert * 0.45;
      const desiredLookZ =
        uz + tanZ * lookAheadDist + rightZ * sprintRig.sideSign * 0.18;

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredCamX,
        9.2,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredCamY,
        9.2,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredCamZ,
        9.2,
        dt,
      );

      currentLookAtRef.current.x = THREE.MathUtils.damp(
        currentLookAtRef.current.x,
        desiredLookX,
        12.5,
        dt,
      );
      currentLookAtRef.current.y = THREE.MathUtils.damp(
        currentLookAtRef.current.y,
        desiredLookY,
        12.5,
        dt,
      );
      currentLookAtRef.current.z = THREE.MathUtils.damp(
        currentLookAtRef.current.z,
        desiredLookZ,
        12.5,
        dt,
      );

      // Udržujeme orbitCenterRef synchronizovaný s běžícím hrdinou pro plynulý Reset na konci trasy
      orbitCenterRef.current.x = THREE.MathUtils.damp(
        orbitCenterRef.current.x,
        ux,
        8.5,
        dt,
      );
      orbitCenterRef.current.y = THREE.MathUtils.damp(
        orbitCenterRef.current.y,
        uy,
        8.5,
        dt,
      );
      orbitCenterRef.current.z = THREE.MathUtils.damp(
        orbitCenterRef.current.z,
        uz,
        8.5,
        dt,
      );

      camera.lookAt(currentLookAtRef.current);
      return;
    }

    lastTrackedMoveUnitRef.current = null;

    // =========================================================================
    // STATE 4: COVER_SETTLE_RESET (Zakleknutí do krytu a plynulý návrat do izometrického pohledu)
    // =========================================================================
    if (activeState === "COVER_SETTLE_RESET" && cameraDirector.coverSettle) {
      const settle = cameraDirector.coverSettle;
      const [cx, cy, cz] = gridToWorld(settle.coord);

      orbitCenterRef.current.x = THREE.MathUtils.damp(
        orbitCenterRef.current.x,
        cx,
        8.5,
        dt,
      );
      orbitCenterRef.current.y = THREE.MathUtils.damp(
        orbitCenterRef.current.y,
        cy * 0.65,
        8.5,
        dt,
      );
      orbitCenterRef.current.z = THREE.MathUtils.damp(
        orbitCenterRef.current.z,
        cz,
        8.5,
        dt,
      );

      const pitch = Math.PI * 0.27;
      const settleDist = distanceRef.current * 0.86;
      const horizDist = Math.cos(pitch) * settleDist;
      const vertDist = Math.sin(pitch) * settleDist;

      const desiredCamX =
        orbitCenterRef.current.x + Math.sin(currentAngleRef.current) * horizDist;
      const desiredCamY = orbitCenterRef.current.y + vertDist;
      const desiredCamZ =
        orbitCenterRef.current.z + Math.cos(currentAngleRef.current) * horizDist;

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredCamX,
        7.2,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredCamY,
        7.2,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredCamZ,
        7.2,
        dt,
      );

      currentLookAtRef.current.x = THREE.MathUtils.damp(
        currentLookAtRef.current.x,
        cx,
        9.0,
        dt,
      );
      currentLookAtRef.current.y = THREE.MathUtils.damp(
        currentLookAtRef.current.y,
        cy + 0.45,
        9.0,
        dt,
      );
      currentLookAtRef.current.z = THREE.MathUtils.damp(
        currentLookAtRef.current.z,
        cz,
        9.0,
        dt,
      );

      camera.lookAt(currentLookAtRef.current);
      return;
    }

    // =========================================================================
    // STATE 1: TACTICAL_ISO (Ptačí perspektiva + plynulé sledování 1 AP pohybu v reálném čase)
    // =========================================================================
    if (activeMovement && actionCamEnabled) {
      const hasLiveTelemetry =
        liveMovementTelemetry.unitId === activeMovement.unitId;
      const fallbackCoord =
        activeMovement.path[activeMovement.path.length - 1] ??
        activeMovement.from;
      const [fx, fy, fz] = gridToWorld(fallbackCoord);

      const trackX = hasLiveTelemetry ? liveMovementTelemetry.worldPos[0] : fx;
      const trackY = hasLiveTelemetry ? liveMovementTelemetry.worldPos[1] : fy;
      const trackZ = hasLiveTelemetry ? liveMovementTelemetry.worldPos[2] : fz;

      orbitCenterRef.current.x = THREE.MathUtils.damp(
        orbitCenterRef.current.x,
        trackX,
        8.5,
        dt,
      );
      orbitCenterRef.current.y = THREE.MathUtils.damp(
        orbitCenterRef.current.y,
        trackY * 0.65,
        8.5,
        dt,
      );
      orbitCenterRef.current.z = THREE.MathUtils.damp(
        orbitCenterRef.current.z,
        trackZ,
        8.5,
        dt,
      );
    } else {
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
    }

    const pitch = Math.PI * 0.29;
    const isoDist =
      activeMovement && actionCamEnabled
        ? Math.max(14, distanceRef.current * 0.88)
        : distanceRef.current;
    const horizDist = Math.cos(pitch) * isoDist;
    const vertDist = Math.sin(pitch) * isoDist;

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
