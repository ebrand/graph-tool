'use client';

import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphStore } from '@/store/graphStore';

export default function DragLine() {
  const dragState = useGraphStore((s) => s.dragState);

  if (!dragState) return null;

  const start = new THREE.Vector3(dragState.startPoint.x, dragState.startPoint.y, 0.05);
  const end = new THREE.Vector3(dragState.currentPoint.x, dragState.currentPoint.y, 0.05);

  return (
    <Line
      points={[start, end]}
      color="#60a5fa"
      lineWidth={2}
      dashed
      dashSize={0.1}
      gapSize={0.05}
    />
  );
}
