'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { pxToWorld } from '@/utils/geometry';

interface DashedGridProps {
  size: number;
  majorColor: string;
  minorColor: string;
  minorPx: number;
  majorPx: number;
}

export default function DashedGrid({ size, majorColor, minorColor, minorPx, majorPx }: DashedGridProps) {
  const half = size / 2;
  const minorStep = pxToWorld(minorPx);
  const majorStep = pxToWorld(majorPx);

  const minorGeo = useMemo(() => {
    const vertices: number[] = [];
    if (minorStep < 0.001) return new THREE.BufferGeometry();
    for (let pos = -half; pos <= half; pos += minorStep) {
      const rounded = Math.round(pos / majorStep) * majorStep;
      if (Math.abs(pos - rounded) < 0.001) continue;
      vertices.push(-half, pos, 0, half, pos, 0);
      vertices.push(pos, -half, 0, pos, half, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  }, [size, half, minorStep, majorStep]);

  const majorGeo = useMemo(() => {
    const vertices: number[] = [];
    for (let pos = -half; pos <= half; pos += majorStep) {
      vertices.push(-half, pos, 0, half, pos, 0);
      vertices.push(pos, -half, 0, pos, half, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  }, [size, half, majorStep]);

  return (
    <group position={[0, 0, -0.5]}>
      <lineSegments geometry={minorGeo}>
        <lineBasicMaterial color={minorColor} />
      </lineSegments>
      <lineSegments geometry={majorGeo}>
        <lineBasicMaterial color={majorColor} />
      </lineSegments>
    </group>
  );
}
