'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas as R3FCanvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { MapControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore } from '@/store/dataStore';
import { getNodeWidth, getEdgePoints, snapToGrid, NODE_HEIGHT } from '@/utils/geometry';
import GraphNode from './GraphNode';
import GraphEdge from './GraphEdge';
import InstanceNode from './InstanceNode';
import DragLine from './DragLine';
import DashedGrid from './DashedGrid';
import SelectionRect from './SelectionRect';

function Scene() {
  const nodes = useGraphStore((s) => s.nodes);
  const relationships = useGraphStore((s) => s.relationships);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const selectedRelationshipIds = useGraphStore((s) => s.selectedRelationshipIds);
  const dragState = useGraphStore((s) => s.dragState);
  const nodeDragState = useGraphStore((s) => s.nodeDragState);
  const marqueeState = useGraphStore((s) => s.marqueeState);
  const theme = useGraphStore((s) => s.theme);
  const grid = useGraphStore((s) => s.grid);
  const nodeSettings = useGraphStore((s) => s.nodeSettings);
  const setDragState = useGraphStore((s) => s.setDragState);
  const setNodeDragState = useGraphStore((s) => s.setNodeDragState);
  const instanceDragState = useGraphStore((s) => s.instanceDragState);
  const setInstanceDragState = useGraphStore((s) => s.setInstanceDragState);
  const setMarqueeState = useGraphStore((s) => s.setMarqueeState);
  const updateNode = useGraphStore((s) => s.updateNode);
  const clearSelection = useGraphStore((s) => s.clearSelection);
  const selectMultiple = useGraphStore((s) => s.selectMultiple);
  const addNodeWithRelationship = useGraphStore((s) => s.addNodeWithRelationship);
  const setContextMenu = useGraphStore((s) => s.setContextMenu);

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const lastSelectionUpdate = useRef(0);

  const setCameraState = useGraphStore((s) => s.setCameraState);
  const mode = useDataStore((s) => s.mode);
  const isDataGraph = mode === 'data';
  const isDataEntry = mode === 'data-entry';
  const nodeInstances = useDataStore((s) => s.nodeInstances);
  const relationshipInstances = useDataStore((s) => s.relationshipInstances);
  const selectedInstanceId = useDataStore((s) => s.selectedInstanceId);
  const selectInstance = useDataStore((s) => s.selectInstance);
  const updateNodeInstance = useDataStore((s) => s.updateNodeInstance);

  const instanceCounts = useMemo(() => {
    if (!isDataEntry) return null;
    const counts = new Map<string, number>();
    for (const ni of nodeInstances) {
      counts.set(ni.schemaNodeId, (counts.get(ni.schemaNodeId) ?? 0) + 1);
    }
    return counts;
  }, [isDataEntry, nodeInstances]);

  // Keep camera up vector stable and restore saved camera position
  const { camera, gl } = useThree();
  const cameraInitialized = useRef(false);
  const controlsRef = useRef<any>(null);
  useEffect(() => {
    camera.up.set(0, 1, 0);
    if (!cameraInitialized.current) {
      const saved = useGraphStore.getState().cameraState;
      if (saved) {
        camera.position.set(saved.x, saved.y, 10);
        (camera as THREE.OrthographicCamera).zoom = saved.zoom;
        camera.updateProjectionMatrix();
      }
      cameraInitialized.current = true;
    }
  }, [camera]);

  // Trackpad two-finger scroll → pan; pinch (ctrlKey) → zoom (handled by MapControls)
  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-to-zoom: let MapControls handle it
      e.preventDefault();
      e.stopImmediatePropagation(); // prevent MapControls from zooming on scroll

      const cam = camera as THREE.OrthographicCamera;
      // deltaMode 1 = line units (~20px each), 0 = pixel units
      const scale = e.deltaMode === 1 ? 20 : 1;
      const dx = (e.deltaX * scale) / cam.zoom;
      const dy = (e.deltaY * scale) / cam.zoom;

      camera.position.x -= dx;
      camera.position.y += dy;
      // Keep controls target in sync so MapControls doesn't snap back
      if (controlsRef.current) {
        controlsRef.current.target.x -= dx;
        controlsRef.current.target.y += dy;
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => canvas.removeEventListener('wheel', onWheel, { capture: true });
  }, [camera, gl]);

  // Save camera state when it changes (throttled)
  const lastCameraSave = useRef(0);
  const lastCameraPos = useRef({ x: 0, y: 0, zoom: 80 });
  useFrame(() => {
    const cam = camera as THREE.OrthographicCamera;
    const now = Date.now();
    if (
      now - lastCameraSave.current > 500 &&
      (cam.position.x !== lastCameraPos.current.x ||
        cam.position.y !== lastCameraPos.current.y ||
        cam.zoom !== lastCameraPos.current.zoom)
    ) {
      lastCameraPos.current = { x: cam.position.x, y: cam.position.y, zoom: cam.zoom };
      lastCameraSave.current = now;
      setCameraState({ x: cam.position.x, y: cam.position.y, zoom: cam.zoom });
    }
  });

  const getNodesInRect = useCallback(
    (start: { x: number; y: number }, current: { x: number; y: number }) => {
      const minX = Math.min(start.x, current.x);
      const maxX = Math.max(start.x, current.x);
      const minY = Math.min(start.y, current.y);
      const maxY = Math.max(start.y, current.y);
      const ids: string[] = [];
      for (const node of nodes) {
        const w = getNodeWidth(node.name, nodeSettings.minWidthPx);
        const hw = w / 2;
        const hh = NODE_HEIGHT / 2;
        if (
          node.position.x - hw >= minX &&
          node.position.x + hw <= maxX &&
          node.position.y - hh >= minY &&
          node.position.y + hh <= maxY
        ) {
          ids.push(node.id);
        }
      }
      return ids;
    },
    [nodes, nodeSettings.minWidthPx]
  );

  const handleBgContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.nativeEvent.preventDefault();
      setContextMenu({
        worldX: e.point.x,
        worldY: e.point.y,
        screenX: e.nativeEvent.clientX,
        screenY: e.nativeEvent.clientY,
      });
    },
    [setContextMenu]
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Close context menu on left click
      setContextMenu(null);

      // Don't start marquee if a node/relationship drag was just initiated
      const state = useGraphStore.getState();
      if (state.nodeDragState || state.dragState) return;

      pointerDownPos.current = { x: e.point.x, y: e.point.y };
      setMarqueeState({
        start: { x: e.point.x, y: e.point.y },
        current: { x: e.point.x, y: e.point.y },
      });
    },
    [setMarqueeState, setContextMenu]
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (instanceDragState) {
        setInstanceDragState({ ...instanceDragState, currentPoint: { x: e.point.x, y: e.point.y } });
      } else if (dragState) {
        setDragState({
          ...dragState,
          currentPoint: { x: e.point.x, y: e.point.y },
        });
      } else if (nodeDragState) {
        const raw = {
          x: e.point.x - nodeDragState.offset.x,
          y: e.point.y - nodeDragState.offset.y,
        };
        const newPos = grid.snapEnabled ? snapToGrid(raw, grid.minorGridPx) : raw;
        if (isDataGraph) {
          // In data graph mode drag moves instance nodes
          updateNodeInstance(nodeDragState.nodeId, { position: newPos });
        } else {
          // Read fresh state to avoid stale closure
          const currentState = useGraphStore.getState();
          const anchorNode = currentState.nodes.find((n) => n.id === nodeDragState.nodeId);
          const selIds = currentState.selectedNodeIds;
          if (anchorNode && selIds.length > 1 && selIds.includes(nodeDragState.nodeId)) {
            const dx = newPos.x - anchorNode.position.x;
            const dy = newPos.y - anchorNode.position.y;
            if (dx !== 0 || dy !== 0) {
              for (const nid of selIds) {
                const node = currentState.nodes.find((n) => n.id === nid);
                if (node) {
                  updateNode(nid, {
                    position: { x: node.position.x + dx, y: node.position.y + dy },
                  });
                }
              }
            }
          } else {
            updateNode(nodeDragState.nodeId, { position: newPos });
          }
        }
      } else if (marqueeState) {
        const current = { x: e.point.x, y: e.point.y };
        setMarqueeState({ ...marqueeState, current });
        // Throttle live selection to avoid mass re-renders
        const now = Date.now();
        if (now - lastSelectionUpdate.current > 100) {
          lastSelectionUpdate.current = now;
          selectMultiple(getNodesInRect(marqueeState.start, current), []);
        }
      }
    },
    [dragState, nodeDragState, marqueeState, setDragState, updateNode, grid, setMarqueeState, selectMultiple, getNodesInRect, isDataGraph]
  );

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (dragState) {
        const raw = { x: e.point.x, y: e.point.y };
        addNodeWithRelationship(
          dragState.sourceNodeId,
          grid.snapEnabled ? snapToGrid(raw, grid.minorGridPx) : raw
        );
        setDragState(null);
        if (marqueeState) setMarqueeState(null);
        return;
      }
      if (nodeDragState) {
        setNodeDragState(null);
        // Clear any accidental marquee that started alongside the node drag
        if (marqueeState) setMarqueeState(null);
        return;
      }
      if (marqueeState) {
        const { start, current } = marqueeState;
        const dx = Math.abs(current.x - start.x);
        const dy = Math.abs(current.y - start.y);

        if (isDataGraph) {
          if (dx < 0.05 && dy < 0.05) selectInstance(null);
        } else if (dx < 0.05 && dy < 0.05) {
          clearSelection();
        } else {
          // Final selection pass to catch anything throttle missed
          selectMultiple(getNodesInRect(start, current), []);
        }
        setMarqueeState(null);
      }
    },
    [dragState, nodeDragState, marqueeState, grid, setDragState, setNodeDragState, setMarqueeState, clearSelection, selectMultiple, getNodesInRect, addNodeWithRelationship, isDataGraph]
  );

  // Safety net: clear drag/marquee state on any pointerup, even if it's over a node/edge.
  // Uses requestAnimationFrame so the R3F handler fires first.
  useEffect(() => {
    const handleGlobalUp = () => {
      requestAnimationFrame(() => {
        const state = useGraphStore.getState();
        if (state.marqueeState) setMarqueeState(null);
        if (state.dragState) setDragState(null);
        if (state.nodeDragState) setNodeDragState(null);
        if (state.instanceDragState) setInstanceDragState(null);
      });
    };
    window.addEventListener('pointerup', handleGlobalUp);
    return () => window.removeEventListener('pointerup', handleGlobalUp);
  }, [setMarqueeState, setDragState, setNodeDragState]);

  // Helper: is a single node selected (for edit mode / relationship display)
  const singleSelectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;

  return (
    <>
      <MapControls
        ref={controlsRef}
        enableRotate={false}
        enableDamping={false}
        screenSpacePanning
        mouseButtons={{
          LEFT: -1 as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: -1 as THREE.MOUSE,
        }}
      />

      {/* Background plane */}
      <mesh
        position={[0, 0, -1]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleBgContextMenu}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial color={theme.canvasBg} />
      </mesh>

      {/* Grid */}
      <DashedGrid size={40} majorColor={theme.canvasGridMajor} minorColor={theme.canvasGridMinor} minorPx={grid.minorGridPx} majorPx={grid.majorGridPx} />

      {/* ── Schema mode + Data Entry mode: schema graph ── */}
      {!isDataGraph && (
        <>
          {relationships.map((rel) => {
            const source = nodes.find((n) => n.id === rel.sourceId);
            const target = nodes.find((n) => n.id === rel.targetId);
            if (!source || !target) return null;
            const hasReverse = relationships.some(
              (r) => r.sourceId === rel.targetId && r.targetId === rel.sourceId
            );
            const sourceSelected = singleSelectedNodeId === rel.sourceId;
            const targetSelected = singleSelectedNodeId === rel.targetId;
            const isThisSelected = selectedRelationshipIds.includes(rel.id);
            const eitherEndSelected = sourceSelected || targetSelected;
            if (hasReverse && !eitherEndSelected && !isThisSelected && rel.sourceId > rel.targetId) return null;
            const biOffset = hasReverse && eitherEndSelected ? 0.08 : 0;
            const showDoubleArrow = hasReverse && !eitherEndSelected && !isThisSelected;
            return (
              <GraphEdge
                key={rel.id}
                id={rel.id}
                name={rel.name}
                sourcePosition={source.position}
                targetPosition={target.position}
                sourceWidth={getNodeWidth(source.name, nodeSettings.minWidthPx)}
                targetWidth={getNodeWidth(target.name, nodeSettings.minWidthPx)}
                isSelected={isThisSelected}
                sourceSelected={sourceSelected}
                targetSelected={targetSelected}
                isBidirectional={hasReverse}
                showDoubleArrow={showDoubleArrow}
                offset={biOffset}
                edgeGapPx={nodeSettings.edgeGapPx}
                highlightColor={theme.selectionHighlight}
                lineColor={theme.relationshipLine}
                textColor={theme.relationshipText}
                abstractColor={theme.abstractColor}
                sourceCardinality={rel.sourceCardinality}
                targetCardinality={rel.targetCardinality}
                kind={rel.kind}
              />
            );
          })}
          <Suspense fallback={null}>
            {nodes.map((node) => (
              <GraphNode
                key={node.id}
                id={node.id}
                name={node.name}
                color={node.color}
                textColor={theme.nodeForeground}
                borderColor={theme.nodeBorder}
                highlightColor={theme.selectionHighlight}
                abstractColor={theme.abstractColor}
                position={node.position}
                isSelected={selectedNodeIds.includes(node.id)}
                instanceCount={instanceCounts?.get(node.id)}
                isAbstract={node.abstract}
              />
            ))}
          </Suspense>
          <DragLine />
          <SelectionRect />
        </>
      )}

      {/* ── Data graph mode: instance graph ── */}
      {isDataGraph && (
        <>
          {relationshipInstances.map((ri) => {
            const srcInst = nodeInstances.find((ni) => ni.id === ri.sourceInstanceId);
            const tgtInst = nodeInstances.find((ni) => ni.id === ri.targetInstanceId);
            const schemaRel = relationships.find((r) => r.id === ri.schemaRelationshipId);
            if (!srcInst || !tgtInst || !schemaRel) return null;
            return (
              <GraphEdge
                key={ri.id}
                id={ri.id}
                name={schemaRel.name}
                sourcePosition={srcInst.position}
                targetPosition={tgtInst.position}
                sourceWidth={getNodeWidth(srcInst.label, nodeSettings.minWidthPx)}
                targetWidth={getNodeWidth(tgtInst.label, nodeSettings.minWidthPx)}
                isSelected={false}
                sourceSelected={false}
                targetSelected={false}
                isBidirectional={false}
                showDoubleArrow={false}
                offset={0}
                edgeGapPx={nodeSettings.edgeGapPx}
                highlightColor={theme.selectionHighlight}
                lineColor={theme.relationshipLine}
                textColor={theme.relationshipText}
                abstractColor={theme.abstractColor}
                kind={schemaRel.kind}
              />
            );
          })}
          <Suspense fallback={null}>
            {nodeInstances.map((ni) => {
              const schemaNode = nodes.find((n) => n.id === ni.schemaNodeId);
              return (
                <InstanceNode
                  key={ni.id}
                  id={ni.id}
                  schemaNodeId={ni.schemaNodeId}
                  label={ni.label}
                  typeName={schemaNode?.name ?? ''}
                  color={schemaNode?.color ?? theme.nodeBackground}
                  textColor={theme.nodeForeground}
                  borderColor={theme.nodeBorder}
                  highlightColor={theme.selectionHighlight}
                  position={ni.position}
                  isSelected={selectedInstanceId === ni.id}
                  readOnly={true}
                />
              );
            })}
          </Suspense>

          {/* Relationship drag line */}
          {instanceDragState && (
            <Line
              points={[
                new THREE.Vector3(instanceDragState.sourcePosition.x, instanceDragState.sourcePosition.y, 0.05),
                new THREE.Vector3(instanceDragState.currentPoint.x, instanceDragState.currentPoint.y, 0.05),
              ]}
              color="#60a5fa"
              lineWidth={2}
              dashed
              dashSize={0.1}
              gapSize={0.05}
            />
          )}
        </>
      )}
    </>
  );
}

function KeyboardBridge() {
  const { gl } = useThree();

  useEffect(() => {
    // The R3F canvas wrapper div captures keyboard focus.
    // Attach our handler to both the canvas and its parent to catch events.
    const targets = [gl.domElement, gl.domElement.parentElement, document];

    const handler = (e: Event) => {
      const ke = e as KeyboardEvent;
      const el = ke.target as HTMLElement;
      const isInput = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';

      if ((ke.key === 's' || ke.code === 'KeyS') && (ke.metaKey || ke.ctrlKey)) {
        ke.preventDefault();
        ke.stopPropagation();
        const { quickSaveSchema, quickSaveData } = require('@/components/FileMenu');
        const isSchema = useDataStore.getState().mode === 'schema';
        const name = isSchema
          ? quickSaveSchema(useGraphStore.getState().exportGraph)
          : quickSaveData();
        if (!name) {
          alert('No previous save found. Use File > Save first.');
        }
        return;
      }

      // Cmd/Ctrl+Z: undo, Cmd/Ctrl+Shift+Z: redo
      if ((ke.key === 'z' || ke.code === 'KeyZ') && (ke.metaKey || ke.ctrlKey)) {
        ke.preventDefault();
        ke.stopPropagation();
        if (ke.shiftKey) {
          useGraphStore.getState().redo();
        } else {
          useGraphStore.getState().undo();
        }
        return;
      }

      if ((ke.key === 'Delete' || ke.key === 'Backspace') && !isInput) {
        ke.preventDefault();
        useGraphStore.getState().deleteSelected();
      }
    };

    for (const t of targets) {
      t?.addEventListener('keydown', handler, true);
    }
    return () => {
      for (const t of targets) {
        t?.removeEventListener('keydown', handler, true);
      }
    };
  }, [gl]);

  return null;
}


export default function GraphCanvas() {
  const canvasBg = useGraphStore((s) => s.theme.canvasBg);

  return (
    <R3FCanvas
      orthographic
      camera={{ zoom: 80, position: [0, 0, 10], near: 0.1, far: 100 }}
      style={{ background: canvasBg }}
      gl={{ antialias: true }}
      tabIndex={-1}
    >
      <Suspense fallback={null}>
        <Scene />
        <KeyboardBridge />
      </Suspense>
    </R3FCanvas>
  );
}
