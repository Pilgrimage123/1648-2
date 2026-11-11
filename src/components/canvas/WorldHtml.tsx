/**
 * Lightweight 3D-to-2D HTML overlay component (/src/components/canvas/WorldHtml.tsx).
 * Replaces @react-three/drei's <Html> to avoid React 19 synchronous root unmount
 * race conditions ("Attempted to synchronously unmount a root while React was already rendering")
 * by mounting into the stable canvas parent element in a passive useEffect and deferring
 * root.unmount() outside the R3F reconciler commit phase.
 */

import { useFrame, useThree } from "@react-three/fiber";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import * as THREE from "three";

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

function calculateScreenPosition(
  el: THREE.Object3D,
  camera: THREE.Camera,
  size: { width: number; height: number },
): [number, number] {
  const objectPos = _v1.setFromMatrixPosition(el.matrixWorld);
  objectPos.project(camera);
  const widthHalf = size.width / 2;
  const heightHalf = size.height / 2;
  return [
    objectPos.x * widthHalf + widthHalf,
    -(objectPos.y * heightHalf) + heightHalf,
  ];
}

function isObjectBehindCamera(
  el: THREE.Object3D,
  camera: THREE.Camera,
): boolean {
  const objectPos = _v1.setFromMatrixPosition(el.matrixWorld);
  const cameraPos = _v2.setFromMatrixPosition(camera.matrixWorld);
  const deltaCamObj = objectPos.sub(cameraPos);
  const camDir = camera.getWorldDirection(_v3);
  return deltaCamObj.angleTo(camDir) > Math.PI / 2;
}

function computeObjectScale(el: THREE.Object3D, camera: THREE.Camera): number {
  if (camera instanceof THREE.OrthographicCamera) {
    return camera.zoom;
  }
  if (camera instanceof THREE.PerspectiveCamera) {
    const objectPos = _v1.setFromMatrixPosition(el.matrixWorld);
    const cameraPos = _v2.setFromMatrixPosition(camera.matrixWorld);
    const vFOV = (camera.fov * Math.PI) / 180;
    const dist = Math.max(0.1, objectPos.distanceTo(cameraPos));
    const scaleFOV = 2 * Math.tan(vFOV / 2) * dist;
    return 1 / scaleFOV;
  }
  return 1;
}

function computeObjectZIndex(
  el: THREE.Object3D,
  camera: THREE.Camera,
  zIndexRange: [number, number],
): number | undefined {
  if (
    camera instanceof THREE.PerspectiveCamera ||
    camera instanceof THREE.OrthographicCamera
  ) {
    const objectPos = _v1.setFromMatrixPosition(el.matrixWorld);
    const cameraPos = _v2.setFromMatrixPosition(camera.matrixWorld);
    const dist = objectPos.distanceTo(cameraPos);
    const A = (zIndexRange[1] - zIndexRange[0]) / (camera.far - camera.near);
    const B = zIndexRange[1] - A * camera.far;
    return Math.round(A * dist + B);
  }
  return undefined;
}

export interface WorldHtmlProps {
  children?: ReactNode;
  position?: [number, number, number];
  center?: boolean;
  anchor?: "center" | "bottom" | "none";
  distanceFactor?: number;
  minScale?: number;
  maxScale?: number;
  zIndexRange?: [number, number];
  style?: CSSProperties;
  className?: string;
  eps?: number;
}

export function WorldHtml({
  children,
  position = [0, 0, 0],
  center = false,
  anchor,
  distanceFactor,
  minScale = 0.55,
  maxScale = 1.25,
  zIndexRange = [16777271, 0],
  style,
  className,
  eps = 0.001,
}: WorldHtmlProps) {
  const { gl, camera, scene, size } = useThree();
  const [el] = useState(() => document.createElement("div"));
  const rootRef = useRef<Root | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const oldZoomRef = useRef(0);
  const oldScaleRef = useRef(0);
  const oldPositionRef = useRef<[number, number]>([0, 0]);
  const visibleRef = useRef(true);

  const target = gl.domElement.parentElement;

  const initializedRef = useRef(false);

  const resolvedAnchor = anchor ?? (center ? "center" : "none");

  const innerStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      transform:
        resolvedAnchor === "bottom"
          ? "translate3d(-50%,-100%,0)"
          : resolvedAnchor === "center"
            ? "translate3d(-50%,-50%,0)"
            : "none",
      ...style,
    }),
    [resolvedAnchor, style],
  );

  useEffect(() => {
    if (!groupRef.current || !target) return;

    scene.updateMatrixWorld();
    const vec = calculateScreenPosition(groupRef.current, camera, size);
    const rawScale =
      distanceFactor === undefined
        ? 1
        : computeObjectScale(groupRef.current, camera) * distanceFactor;
    const scale =
      distanceFactor === undefined
        ? 1
        : THREE.MathUtils.clamp(rawScale, minScale, maxScale);
    el.style.cssText = `position:absolute;top:0;left:0;transform:translate3d(${vec[0]}px,${vec[1]}px,0) scale(${scale});transform-origin:0 0;pointer-events:none;`;
    target.appendChild(el);

    const root = createRoot(el);
    rootRef.current = root;
    initializedRef.current = false;
    root.render(
      <div style={innerStyle} className={className}>
        {children}
      </div>,
    );

    return () => {
      rootRef.current = null;
      if (el.parentNode === target) {
        target.removeChild(el);
      }
      // Defer root.unmount() to a macrotask so it never executes synchronously
      // while the R3F / React reconciler is mid-render.
      setTimeout(() => {
        root.unmount();
      }, 0);
    };
    // Only depend on target and el so the DOM root is created once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, el]);

  useEffect(() => {
    rootRef.current?.render(
      <div style={innerStyle} className={className}>
        {children}
      </div>,
    );
  }, [children, innerStyle, className]);

  useFrame(() => {
    const grp = groupRef.current;
    if (!grp) return;

    camera.updateMatrixWorld();
    grp.updateWorldMatrix(true, false);

    const vec = calculateScreenPosition(grp, camera, size);
    const rawScale =
      distanceFactor === undefined
        ? 1
        : computeObjectScale(grp, camera) * distanceFactor;
    const scale =
      distanceFactor === undefined
        ? 1
        : THREE.MathUtils.clamp(rawScale, minScale, maxScale);

    if (
      !initializedRef.current ||
      Math.abs(oldZoomRef.current - camera.zoom) > eps ||
      Math.abs(oldScaleRef.current - scale) > eps ||
      Math.abs(oldPositionRef.current[0] - vec[0]) > eps ||
      Math.abs(oldPositionRef.current[1] - vec[1]) > eps
    ) {
      initializedRef.current = true;
      const behind = isObjectBehindCamera(grp, camera);
      const nowVisible = !behind;
      if (visibleRef.current !== nowVisible) {
        visibleRef.current = nowVisible;
        el.style.display = nowVisible ? "block" : "none";
      }

      const zIdx = computeObjectZIndex(grp, camera, zIndexRange);
      if (zIdx !== undefined) {
        el.style.zIndex = `${zIdx}`;
      }

      el.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0) scale(${scale})`;

      oldPositionRef.current = vec;
      oldZoomRef.current = camera.zoom;
      oldScaleRef.current = scale;
    }
  });

  return <group ref={groupRef} position={position} />;
}
