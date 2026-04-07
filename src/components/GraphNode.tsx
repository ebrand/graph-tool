'use client';

import { useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore } from '@/store/dataStore';
import { NODE_HEIGHT, CORNER_RADIUS, NODE_FONT_SIZE, getNodeWidth, getJiggledRectPoints, makeRoundedRectShape } from '@/utils/geometry';

interface GraphNodeProps {
  id: string;
  name: string;
  color: string;
  textColor: string;
  borderColor: string;
  highlightColor: string;
  abstractColor: string;
  position: { x: number; y: number };
  isSelected: boolean;
  instanceCount?: number;
  isAbstract?: boolean;
}

export default function GraphNode({ id, name, color, textColor, borderColor, highlightColor, abstractColor, position, isSelected, instanceCount, isAbstract }: GraphNodeProps) {
  const [hovered, setHovered] = useState(false);
  const clickStart = useRef<{ x: number; y: number } | null>(null);

  const selectNode = useGraphStore((s) => s.selectNode);
  const toggleNodeSelection = useGraphStore((s) => s.toggleNodeSelection);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const setDragState = useGraphStore((s) => s.setDragState);
  const setNodeDragState = useGraphStore((s) => s.setNodeDragState);
  const dragState = useGraphStore((s) => s.dragState);
  const addRelationship = useGraphStore((s) => s.addRelationship);
  const setContextMenu = useGraphStore((s) => s.setContextMenu);

  const dataEntryMode = useDataStore((s) => s.mode === 'data-entry');
  const openAddModal = useDataStore((s) => s.setAddingInstanceForNodeId);

  const minWidthPx = useGraphStore((s) => s.nodeSettings.minWidthPx);
  const jiggle = useGraphStore((s) => s.nodeSettings.jiggleEnabled);
  const shadows = useGraphStore((s) => s.nodeSettings.shadowsEnabled);
  const nodeWidth = useMemo(() => getNodeWidth(name, minWidthPx), [name, minWidthPx]);

  const nodeShape = useMemo(
    () => makeRoundedRectShape(nodeWidth, NODE_HEIGHT, CORNER_RADIUS),
    [nodeWidth]
  );

  const borderPoints = useMemo(
    () => getJiggledRectPoints(nodeWidth + 0.03, NODE_HEIGHT + 0.03, CORNER_RADIUS + 0.01, `border-${id}`, jiggle),
    [nodeWidth, id, jiggle]
  );


  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    clickStart.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    if (e.nativeEvent.button === 2) return; // right-click handled by onContextMenu

    if (e.nativeEvent.altKey) {
      setDragState({
        sourceNodeId: id,
        startPoint: { x: position.x, y: position.y },
        currentPoint: { x: position.x, y: position.y },
      });
      selectNode(id);
    } else if (e.nativeEvent.shiftKey) {
      // Shift-click: toggle this node in/out of multi-selection
      toggleNodeSelection(id);
    } else {
      setNodeDragState({
        nodeId: id,
        offset: {
          x: e.point.x - position.x,
          y: e.point.y - position.y,
        },
      });
      // If this node is already part of a multi-selection, keep the selection
      if (!selectedNodeIds.includes(id)) {
        selectNode(id);
      }
    }
  }, [id, position, selectNode, toggleNodeSelection, selectedNodeIds, setDragState, setNodeDragState]);

  const onContextMenu = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    setContextMenu({
      worldX: position.x,
      worldY: position.y,
      screenX: e.nativeEvent.clientX,
      screenY: e.nativeEvent.clientY,
      target: { kind: 'node', id },
    });
  }, [id, position, setContextMenu]);

  const onNodePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (dragState && dragState.sourceNodeId !== id) {
      e.stopPropagation();
      addRelationship(dragState.sourceNodeId, id);
      setDragState(null);
    }
  }, [dragState, id, addRelationship, setDragState]);

  return (
    <group position={[position.x, position.y, 0]}>
      {/* Drop shadow — stacked layers for soft blur effect */}
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

      {/* Main rounded rectangle */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          if (dataEntryMode) {
            // Suppress if the pointer moved (was a drag, not a click)
            const start = clickStart.current;
            if (start) {
              const dx = e.nativeEvent.clientX - start.x;
              const dy = e.nativeEvent.clientY - start.y;
              if (dx * dx + dy * dy > 25) return; // moved > 5px
            }
            openAddModal(id);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerUp={(e) => {
          onNodePointerUp(e);
        }}
        onContextMenu={onContextMenu}
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <shapeGeometry args={[nodeShape]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Node border — thickens and changes color on select/hover; dashed violet for abstract nodes */}
      <Line
        points={borderPoints}
        color={isSelected ? highlightColor : isAbstract ? abstractColor : hovered ? '#94a3b8' : borderColor}
        lineWidth={isSelected ? 3 : hovered ? 2 : 1.5}
        dashed={isAbstract && !isSelected}
        dashSize={0.1}
        gapSize={0.05}
        position={[0, 0, 0.002]}
      />

      {/* Node label */}
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.01]}
          fontSize={NODE_FONT_SIZE}
          color={textColor}
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
      </Suspense>

      {/* Instance count badge (data mode) */}
      {instanceCount !== undefined && instanceCount > 0 && (
        <InstanceBadge count={instanceCount} nodeWidth={nodeWidth} />
      )}
    </group>
  );
}

function InstanceBadge({ count, nodeWidth }: { count: number; nodeWidth: number }) {
  const hw = nodeWidth / 2;
  const hh = NODE_HEIGHT / 2;
  const label = count > 999 ? '999+' : String(count);
  // Position at top-right corner, overlapping the node edge
  const bx = hw - 0.06;
  const by = hh;

  return (
    <group position={[bx, by, 0.03]}>
      <mesh>
        <circleGeometry args={[0.13, 20]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.005]}
          fontSize={0.085}
          color="#000000"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  );
}
