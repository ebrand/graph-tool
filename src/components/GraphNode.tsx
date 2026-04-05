'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphStore } from '@/store/graphStore';
import { NODE_HEIGHT, CORNER_RADIUS, NODE_FONT_SIZE, getNodeWidth, getJiggledRectPoints } from '@/utils/geometry';

interface GraphNodeProps {
  id: string;
  name: string;
  color: string;
  textColor: string;
  borderColor: string;
  highlightColor: string;
  position: { x: number; y: number };
  isSelected: boolean;
}

function makeRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

export default function GraphNode({ id, name, color, textColor, borderColor, highlightColor, position, isSelected }: GraphNodeProps) {
  const [hovered, setHovered] = useState(false);

  const selectNode = useGraphStore((s) => s.selectNode);
  const toggleNodeSelection = useGraphStore((s) => s.toggleNodeSelection);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const setDragState = useGraphStore((s) => s.setDragState);
  const setNodeDragState = useGraphStore((s) => s.setNodeDragState);
  const dragState = useGraphStore((s) => s.dragState);
  const addRelationship = useGraphStore((s) => s.addRelationship);

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
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerUp={(e) => {
          onNodePointerUp(e);
        }}
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

      {/* Node border — thickens and changes color on select/hover */}
      <Line
        points={borderPoints}
        color={isSelected ? highlightColor : hovered ? '#94a3b8' : borderColor}
        lineWidth={isSelected ? 3 : hovered ? 2 : 1.5}
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
    </group>
  );
}
