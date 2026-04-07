'use client';

import { Suspense, useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphStore } from '@/store/graphStore';
import { getEdgePoints, getArrowHeadPoints, getInheritanceArrowPoints, getJiggledLinePoints } from '@/utils/geometry';

interface GraphEdgeProps {
  id: string;
  name: string;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  sourceWidth: number;
  targetWidth: number;
  isSelected: boolean;
  sourceSelected: boolean;
  targetSelected: boolean;
  isBidirectional: boolean;
  showDoubleArrow: boolean;
  offset: number;
  kind: 'regular' | 'inherits-from';
  edgeGapPx: number;
  highlightColor: string;
  lineColor: string;
  textColor: string;
  abstractColor: string;
  sourceCardinality?: string;
  targetCardinality?: string;
}

export default function GraphEdge({
  id,
  name,
  sourcePosition,
  targetPosition,
  sourceWidth,
  targetWidth,
  isSelected,
  sourceSelected,
  targetSelected,
  isBidirectional,
  showDoubleArrow,
  offset,
  edgeGapPx,
  highlightColor,
  lineColor,
  textColor,
  abstractColor,
  sourceCardinality,
  targetCardinality,
  kind,
}: GraphEdgeProps) {
  const { selectRelationship, setContextMenu } = useGraphStore();
  const jiggle = useGraphStore((s) => s.nodeSettings.jiggleEnabled);
  const relTextT = useGraphStore((s) => s.nodeSettings.relTextPosition) / 100;

  const { start, end } = useMemo(
    () => getEdgePoints(sourcePosition, targetPosition, offset, sourceWidth, targetWidth, edgeGapPx),
    [sourcePosition, targetPosition, offset, sourceWidth, targetWidth, edgeGapPx]
  );
  const isInheritance = kind === 'inherits-from';

  const { points: arrowPoints, lineEnd } = useMemo(
    () => isInheritance ? getInheritanceArrowPoints(end, start) : getArrowHeadPoints(end, start),
    [start, end, isInheritance]
  );
  // Reverse arrowhead at the start (for double-arrow mode — not used for inheritance)
  const { points: reverseArrowPoints, lineEnd: reverseLineEnd } = useMemo(
    () => getArrowHeadPoints(start, end),
    [start, end]
  );

  // Always show arrow, show name only when source node selected or edge directly selected
  const showName = isSelected || sourceSelected || !isBidirectional;
  // Inheritance edges are never rendered as double-arrows
  const effectiveShowDoubleArrow = showDoubleArrow && !isInheritance;
  const visibleStart = effectiveShowDoubleArrow ? reverseLineEnd : start;
  const visibleEnd = lineEnd;

  // Dim this edge when the other direction in a bidirectional pair is active
  const dimmed = isBidirectional && targetSelected && !sourceSelected && !isSelected;
  const color = isSelected ? highlightColor : isInheritance ? abstractColor : lineColor;
  const lw = isSelected ? 3 : isInheritance ? 1.5 : 1.5;
  const opacity = dimmed ? 0.25 : 1;

  const LABEL_PADDING = 0.05; // fixed small clearance around the label text

  const { seg1, seg2 } = useMemo(() => {
    const dx = visibleEnd.x - visibleStart.x;
    const dy = visibleEnd.y - visibleStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Project the horizontal text bounding box onto the line direction
    const textW = name ? name.length * 0.07 : 0;
    const textH = 0.15; // approximate line height at fontSize 0.13
    const cosA = dist > 0 ? Math.abs(dx) / dist : 1;
    const sinA = dist > 0 ? Math.abs(dy) / dist : 0;
    const projectedHalf = showName && name
      ? (cosA * textW + sinA * textH) / 2 + LABEL_PADDING
      : 0;

    if (projectedHalf <= 0 || dist < projectedHalf * 2 + 0.1) {
      return {
        seg1: getJiggledLinePoints(visibleStart, visibleEnd, `edge-${id}-a`, jiggle),
        seg2: null,
      };
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const midX = visibleStart.x + dx * relTextT;
    const midY = visibleStart.y + dy * relTextT;

    const gapStart = new THREE.Vector3(midX - nx * projectedHalf, midY - ny * projectedHalf, 0);
    const gapEnd = new THREE.Vector3(midX + nx * projectedHalf, midY + ny * projectedHalf, 0);

    return {
      seg1: getJiggledLinePoints(visibleStart, gapStart, `edge-${id}-a`, jiggle),
      seg2: getJiggledLinePoints(gapEnd, visibleEnd, `edge-${id}-b`, jiggle),
    };
  }, [visibleStart, visibleEnd, showName, name, id, jiggle, relTextT]);

  const angle = useMemo(
    () => Math.atan2(end.y - start.y, end.x - start.x),
    [start, end]
  );
  const length = useMemo(
    () => Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2),
    [start, end]
  );

  // Positions for cardinality labels near each end of the line
  const cardinalityPositions = useMemo(() => {
    if (length < 0.5) return null;
    const nx = (end.x - start.x) / length;
    const ny = (end.y - start.y) / length;
    // Perpendicular (90° CCW) for consistent above-line placement
    const px = -ny * 0.15;
    const py = nx * 0.15;
    const along = Math.min(0.28, length * 0.25);
    return {
      src: { x: start.x + nx * along + px, y: start.y + ny * along + py },
      tgt: { x: end.x - nx * along + px, y: end.y - ny * along + py },
    };
  }, [start, end, length]);

  return (
    <group>
      {/* Invisible wide line for click target */}
      <mesh
        position={[(start.x + end.x) / 2, (start.y + end.y) / 2, -0.02]}
        rotation={[0, 0, angle]}
        onClick={(e) => {
          e.stopPropagation();
          selectRelationship(id);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
          setContextMenu({
            worldX: e.point.x,
            worldY: e.point.y,
            screenX: e.nativeEvent.clientX,
            screenY: e.nativeEvent.clientY,
            target: { kind: 'relationship', id },
          });
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <planeGeometry args={[length, 0.2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Visible edge line */}
      <Line
        points={seg1}
        color={color}
        lineWidth={lw}
        position={[0, 0, -0.01]}
        transparent={dimmed || isInheritance}
        opacity={opacity}
        dashed={isInheritance}
        dashSize={isInheritance ? 0.12 : undefined}
        gapSize={isInheritance ? 0.06 : undefined}
      />
      {seg2 && (
        <Line
          points={seg2}
          color={color}
          lineWidth={lw}
          position={[0, 0, -0.01]}
          transparent={dimmed || isInheritance}
          opacity={opacity}
          dashed={isInheritance}
          dashSize={isInheritance ? 0.12 : undefined}
          gapSize={isInheritance ? 0.06 : undefined}
        />
      )}

      {/* Arrow head at target end */}
      <ArrowHead points={arrowPoints} color={color} opacity={opacity} />

      {/* Reverse arrow head at source end (double-arrow mode, regular only) */}
      {effectiveShowDoubleArrow && (
        <ArrowHead points={reverseArrowPoints} color={color} opacity={opacity} />
      )}

      {/* Relationship name label */}
      {showName && name && (
        <Suspense fallback={null}>
          <Text
            position={[visibleStart.x + (visibleEnd.x - visibleStart.x) * relTextT, visibleStart.y + (visibleEnd.y - visibleStart.y) * relTextT, 0.01]}
            fontSize={0.13}
            color={isSelected ? highlightColor : textColor}
            anchorX="center"
            anchorY="middle"
          >
            {name}
          </Text>
        </Suspense>
      )}

      {/* Cardinality labels */}
      {cardinalityPositions && (sourceCardinality || targetCardinality) && (
        <Suspense fallback={null}>
          {sourceCardinality && (
            <Text
              position={[cardinalityPositions.src.x, cardinalityPositions.src.y, 0.01]}
              fontSize={0.085}
              color={isSelected ? highlightColor : textColor}
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.7}
            >
              {sourceCardinality}
            </Text>
          )}
          {targetCardinality && (
            <Text
              position={[cardinalityPositions.tgt.x, cardinalityPositions.tgt.y, 0.01]}
              fontSize={0.085}
              color={isSelected ? highlightColor : textColor}
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.7}
            >
              {targetCardinality}
            </Text>
          )}
        </Suspense>
      )}
    </group>
  );
}

function ArrowHead({ points, color, opacity = 1 }: { points: THREE.Vector3[]; color: string; opacity?: number }) {
  const linePoints = useMemo(
    () => [points[0], points[1], points[2], points[0]],
    [points]
  );

  return (
    <Line
      points={linePoints}
      color={color}
      lineWidth={1.5}
      position={[0, 0, -0.01]}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}
