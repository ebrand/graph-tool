'use client';

import { useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore } from '@/store/dataStore';
import {
  NODE_HEIGHT, CORNER_RADIUS, NODE_FONT_SIZE,
  getNodeWidth, getJiggledRectPoints, makeRoundedRectShape,
} from '@/utils/geometry';

interface InstanceNodeProps {
  id: string;
  schemaNodeId: string;
  label: string;
  typeName: string;
  color: string;
  textColor: string;
  borderColor: string;
  highlightColor: string;
  position: { x: number; y: number };
  isSelected: boolean;
  readOnly?: boolean;
}

export default function InstanceNode({
  id, schemaNodeId, label, typeName, color, textColor, borderColor, highlightColor, position, isSelected, readOnly,
}: InstanceNodeProps) {
  const [hovered, setHovered] = useState(false);
  const clickStart = useRef<{ x: number; y: number } | null>(null);

  const selectInstance = useDataStore((s) => s.selectInstance);
  const selectedInstanceIds = useDataStore((s) => s.selectedInstanceIds);
  const toggleInstanceSelection = useDataStore((s) => s.toggleInstanceSelection);
  const setNodeDragState = useGraphStore((s) => s.setNodeDragState);
  const setInstanceDragState = useGraphStore((s) => s.setInstanceDragState);

  const minWidthPx = useGraphStore((s) => s.nodeSettings.minWidthPx);
  const jiggle = useGraphStore((s) => s.nodeSettings.jiggleEnabled);
  const shadows = useGraphStore((s) => s.nodeSettings.shadowsEnabled);

  const nodeWidth = useMemo(() => getNodeWidth(label, minWidthPx), [label, minWidthPx]);
  const nodeShape = useMemo(() => makeRoundedRectShape(nodeWidth, NODE_HEIGHT, CORNER_RADIUS), [nodeWidth]);
  const borderPoints = useMemo(
    () => getJiggledRectPoints(nodeWidth + 0.03, NODE_HEIGHT + 0.03, CORNER_RADIUS + 0.01, `inst-${id}`, jiggle),
    [nodeWidth, id, jiggle],
  );

  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    clickStart.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    if (e.nativeEvent.button === 2) return;

    if (!readOnly && e.nativeEvent.altKey) {
      // Alt+drag: start drawing a relationship to another instance
      setInstanceDragState({
        sourceInstanceId: id,
        sourcePosition: { x: position.x, y: position.y },
        currentPoint: { x: position.x, y: position.y },
      });
      selectInstance(id);
    } else if (e.nativeEvent.shiftKey) {
      // Shift+click: toggle in/out of multi-selection
      toggleInstanceSelection(id);
    } else {
      setNodeDragState({ nodeId: id, offset: { x: e.point.x - position.x, y: e.point.y - position.y } });
      // Preserve multi-selection if this node is already selected
      if (!selectedInstanceIds.includes(id)) {
        selectInstance(id);
      }
    }
  }, [id, position, readOnly, selectInstance, selectedInstanceIds, toggleInstanceSelection, setNodeDragState, setInstanceDragState]);

  const onPointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (readOnly) return;
    const instDrag = useGraphStore.getState().instanceDragState;
    if (!instDrag || instDrag.sourceInstanceId === id) return;
    e.stopPropagation();

    // Find a valid schema relationship between the two instance types
    const { relationships } = useGraphStore.getState();
    const srcSchemaId = useDataStore.getState().nodeInstances.find((ni) => ni.id === instDrag.sourceInstanceId)?.schemaNodeId;
    if (!srcSchemaId) return;

    // Direct direction: src → tgt
    let rel = relationships.find(
      (r) => r.sourceId === srcSchemaId && r.targetId === schemaNodeId && r.kind !== 'inherits-from'
    );
    let srcInstId = instDrag.sourceInstanceId;
    let tgtInstId = id;

    // Try reversed direction
    if (!rel) {
      rel = relationships.find(
        (r) => r.sourceId === schemaNodeId && r.targetId === srcSchemaId && r.kind !== 'inherits-from'
      );
      if (rel) { srcInstId = id; tgtInstId = instDrag.sourceInstanceId; }
    }

    if (rel) {
      useDataStore.getState().addRelationshipInstance(rel.id, srcInstId, tgtInstId, []);
    }
    useGraphStore.getState().setInstanceDragState(null);
  }, [id, schemaNodeId, readOnly]);

  return (
    <group position={[position.x, position.y, 0]}>
      {/* Drop shadow */}
      {shadows && (
        <>
          {[
            { scale: 1.08, offset: 0.06, opacity: 0.08 },
            { scale: 1.05, offset: 0.05, opacity: 0.12 },
            { scale: 1.02, offset: 0.04, opacity: 0.15 },
          ].map((s, i) => (
            <mesh key={i} position={[s.offset, -s.offset, -0.02 - i * 0.001]} scale={[s.scale, s.scale, 1]}>
              <shapeGeometry args={[nodeShape]} />
              <meshBasicMaterial color="#000000" opacity={s.opacity} transparent />
            </mesh>
          ))}
        </>
      )}

      {/* Body */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          const start = clickStart.current;
          if (start) {
            const dx = e.nativeEvent.clientX - start.x;
            const dy = e.nativeEvent.clientY - start.y;
            if (dx * dx + dy * dy > 25) return;
          }
          selectInstance(id);
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <shapeGeometry args={[nodeShape]} />
        <meshBasicMaterial color={color} opacity={0.8} transparent />
      </mesh>

      {/* Border */}
      <Line
        points={borderPoints}
        color={isSelected ? highlightColor : hovered ? '#94a3b8' : borderColor}
        lineWidth={isSelected ? 3 : hovered ? 2 : 1.5}
        position={[0, 0, 0.002]}
      />

      {/* Instance label */}
      <Suspense fallback={null}>
        <Text position={[0, 0.08, 0.01]} fontSize={NODE_FONT_SIZE} color={textColor} anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Suspense>

      {/* Type name in smaller text below label */}
      <Suspense fallback={null}>
        <Text
          position={[0, -0.13, 0.01]}
          fontSize={NODE_FONT_SIZE * 0.65}
          color={textColor}
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.5}
        >
          {typeName}
        </Text>
      </Suspense>
    </group>
  );
}
