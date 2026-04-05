'use client';

import { useMemo } from 'react';
import { useGraphStore } from '@/store/graphStore';

export default function SelectionRect() {
  const marqueeState = useGraphStore((s) => s.marqueeState);

  const rect = useMemo(() => {
    if (!marqueeState) return null;
    const { start, current } = marqueeState;
    const x = (start.x + current.x) / 2;
    const y = (start.y + current.y) / 2;
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    return { x, y, w, h };
  }, [marqueeState]);

  if (!rect || rect.w < 0.01) return null;

  return (
    <mesh position={[rect.x, rect.y, 0.1]}>
      <planeGeometry args={[rect.w, rect.h]} />
      <meshBasicMaterial color="#3b82f6" opacity={0.15} transparent />
    </mesh>
  );
}
