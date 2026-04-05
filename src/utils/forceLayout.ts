import { GraphNode, Relationship } from '@/types';
import { getNodeWidth, NODE_HEIGHT, snapToGrid } from './geometry';

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
}

interface LayoutOptions {
  iterations?: number;
  repulsionStrength?: number;
  attractionStrength?: number;
  idealDistance?: number;
  damping?: number;
  snapPx?: number | null;
}

export function forceDirectedLayout(
  nodes: GraphNode[],
  relationships: Relationship[],
  minWidthPx: number,
  options: LayoutOptions = {}
): { id: string; position: { x: number; y: number } }[] {
  const {
    iterations = 300,
    repulsionStrength = 2.0,
    attractionStrength = 0.05,
    idealDistance = 2.5,
    damping = 0.95,
    snapPx = null,
  } = options;

  // Initialize layout nodes from current positions
  const layoutNodes: LayoutNode[] = nodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    vx: 0,
    vy: 0,
    width: getNodeWidth(n.name, minWidthPx),
  }));

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations; // cooling: 1 → 0

    // Repulsion: every pair of nodes pushes apart
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i];
        const b = layoutNodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          dist = 0.1;
        }

        const force = (repulsionStrength / (dist * dist)) * temp;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction: connected nodes pull together
    for (const rel of relationships) {
      const source = nodeMap.get(rel.sourceId);
      const target = nodeMap.get(rel.targetId);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.01) continue;

      const displacement = dist - idealDistance;
      const force = displacement * attractionStrength * temp;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Node overlap repulsion (based on actual node dimensions)
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i];
        const b = layoutNodes[j];
        const minDistX = (a.width + b.width) / 2 + 0.3;
        const minDistY = NODE_HEIGHT + 0.3;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = minDistX - Math.abs(dx);
        const overlapY = minDistY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          // Push apart on the axis with less overlap
          if (overlapX < overlapY) {
            const push = overlapX * 0.5 * temp;
            const sign = dx > 0 ? 1 : -1;
            a.vx -= sign * push;
            b.vx += sign * push;
          } else {
            const push = overlapY * 0.5 * temp;
            const sign = dy > 0 ? 1 : -1;
            a.vy -= sign * push;
            b.vy += sign * push;
          }
        }
      }
    }

    // Apply velocities with damping
    for (const node of layoutNodes) {
      node.vx *= damping;
      node.vy *= damping;

      // Clamp max velocity
      const maxV = 0.5 * temp + 0.05;
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > maxV) {
        node.vx = (node.vx / speed) * maxV;
        node.vy = (node.vy / speed) * maxV;
      }

      node.x += node.vx;
      node.y += node.vy;
    }
  }

  // Return final positions
  return layoutNodes.map((n) => ({
    id: n.id,
    position: snapPx ? snapToGrid({ x: n.x, y: n.y }, snapPx) : { x: n.x, y: n.y },
  }));
}
