import * as THREE from 'three';

export const ZOOM = 80;
export const NODE_HEIGHT = 0.6;
export const CORNER_RADIUS = 0.12;
export const NODE_FONT_SIZE = 0.16;
export const NODE_PADDING = 0.3;
export const MIN_NODE_WIDTH = 1.0;

/** Convert pixels to world units at default zoom */
export function pxToWorld(px: number): number {
  return px / ZOOM;
}

export function snapToGrid(pos: { x: number; y: number }, snapPx: number): { x: number; y: number } {
  const step = pxToWorld(snapPx);
  return {
    x: Math.round(pos.x / step) * step,
    y: Math.round(pos.y / step) * step,
  };
}

/** Estimate node width from its name. minWidthPx is in screen pixels. */
export function getNodeWidth(name: string, minWidthPx?: number): number {
  const textWidth = name.length * 0.09;
  const minWorld = minWidthPx != null ? pxToWorld(minWidthPx) : MIN_NODE_WIDTH;
  return Math.max(minWorld, textWidth + NODE_PADDING * 2);
}

function rectEdgeIntersection(
  center: { x: number; y: number },
  target: { x: number; y: number },
  halfW: number,
  halfH: number
): { x: number; y: number } {
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (dx === 0 && dy === 0) return { x: center.x, y: center.y };

  const sx = halfW / Math.abs(dx || 1e-10);
  const sy = halfH / Math.abs(dy || 1e-10);
  const s = Math.min(sx, sy);

  return {
    x: center.x + dx * s,
    y: center.y + dy * s,
  };
}

export function getEdgePoints(
  source: { x: number; y: number },
  target: { x: number; y: number },
  offset: number = 0,
  sourceWidth?: number,
  targetWidth?: number,
  gapPx?: number
): { start: THREE.Vector3; end: THREE.Vector3; mid: THREE.Vector3 } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    const v = new THREE.Vector3(source.x, source.y, 0);
    return { start: v, end: v, mid: v };
  }

  const nx = dx / dist;
  const ny = dy / dist;

  const px = -ny * offset;
  const py = nx * offset;

  const srcHalfW = (sourceWidth ?? MIN_NODE_WIDTH) / 2;
  const tgtHalfW = (targetWidth ?? MIN_NODE_WIDTH) / 2;
  const halfH = NODE_HEIGHT / 2;

  const sourceEdge = rectEdgeIntersection(source, target, srcHalfW, halfH);
  const targetEdge = rectEdgeIntersection(target, source, tgtHalfW, halfH);

  const gap = pxToWorld(gapPx ?? 5);
  const start = new THREE.Vector3(sourceEdge.x + nx * gap + px, sourceEdge.y + ny * gap + py, 0);
  const end = new THREE.Vector3(targetEdge.x - nx * gap + px, targetEdge.y - ny * gap + py, 0);
  const mid = new THREE.Vector3(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    0
  );

  return { start, end, mid };
}

const ARROW_SIZE = 0.105;
const ARROW_GAP = 0.0625; // 5px at zoom 80

export function getArrowHeadPoints(
  end: THREE.Vector3,
  start: THREE.Vector3,
): { points: THREE.Vector3[]; lineEnd: THREE.Vector3 } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return { points: [end, end, end], lineEnd: end };

  const nx = dx / dist;
  const ny = dy / dist;

  const left = new THREE.Vector3(
    end.x - nx * ARROW_SIZE + ny * ARROW_SIZE * 0.5,
    end.y - ny * ARROW_SIZE - nx * ARROW_SIZE * 0.5,
    0
  );
  const right = new THREE.Vector3(
    end.x - nx * ARROW_SIZE - ny * ARROW_SIZE * 0.5,
    end.y - ny * ARROW_SIZE + nx * ARROW_SIZE * 0.5,
    0
  );

  // Line should stop at arrow base + gap
  const lineEnd = new THREE.Vector3(
    end.x - nx * (ARROW_SIZE + ARROW_GAP),
    end.y - ny * (ARROW_SIZE + ARROW_GAP),
    0
  );

  return { points: [end, left, right], lineEnd };
}

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Returns a function that produces deterministic values in [-1, 1].
 */
function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1; // [-1, 1]
  };
}

/** Hash a string to a number for seeding. */
function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

const JIGGLE_AMOUNT = 0.012; // ~1px at zoom 80

/**
 * Generate jiggled points along a rounded rectangle outline.
 * Returns closed loop of THREE.Vector3 for use with Line.
 */
export function getJiggledRectPoints(
  w: number, h: number, r: number, seed: string, jiggle: boolean = true, segments: number = 48
): THREE.Vector3[] {
  const rng = seededRng(hashStr(seed));
  const hw = w / 2;
  const hh = h / 2;
  const points: THREE.Vector3[] = [];

  // Walk the perimeter: bottom edge, right edge, top edge, left edge with rounded corners
  // We'll parameterize as a series of straight + arc segments
  const addPoint = (x: number, y: number) => {
    const j = jiggle ? JIGGLE_AMOUNT : 0;
    points.push(new THREE.Vector3(
      x + rng() * j,
      y + rng() * j,
      0
    ));
  };

  const stepsPerSide = Math.floor(segments / 8);
  const stepsPerCorner = Math.max(3, Math.floor(segments / 16));

  // Bottom edge (left to right)
  for (let i = 0; i <= stepsPerSide; i++) {
    const t = i / stepsPerSide;
    addPoint(-hw + r + t * (w - 2 * r), -hh);
  }
  // Bottom-right corner
  for (let i = 0; i <= stepsPerCorner; i++) {
    const a = -Math.PI / 2 + (i / stepsPerCorner) * (Math.PI / 2);
    addPoint(hw - r + Math.cos(a) * r, -hh + r + Math.sin(a) * r);
  }
  // Right edge (bottom to top)
  for (let i = 1; i <= stepsPerSide; i++) {
    const t = i / stepsPerSide;
    addPoint(hw, -hh + r + t * (h - 2 * r));
  }
  // Top-right corner
  for (let i = 0; i <= stepsPerCorner; i++) {
    const a = 0 + (i / stepsPerCorner) * (Math.PI / 2);
    addPoint(hw - r + Math.cos(a) * r, hh - r + Math.sin(a) * r);
  }
  // Top edge (right to left)
  for (let i = 1; i <= stepsPerSide; i++) {
    const t = i / stepsPerSide;
    addPoint(hw - r - t * (w - 2 * r), hh);
  }
  // Top-left corner
  for (let i = 0; i <= stepsPerCorner; i++) {
    const a = Math.PI / 2 + (i / stepsPerCorner) * (Math.PI / 2);
    addPoint(-hw + r + Math.cos(a) * r, hh - r + Math.sin(a) * r);
  }
  // Left edge (top to bottom)
  for (let i = 1; i <= stepsPerSide; i++) {
    const t = i / stepsPerSide;
    addPoint(-hw, hh - r - t * (h - 2 * r));
  }
  // Bottom-left corner
  for (let i = 0; i <= stepsPerCorner; i++) {
    const a = Math.PI + (i / stepsPerCorner) * (Math.PI / 2);
    addPoint(-hw + r + Math.cos(a) * r, -hh + r + Math.sin(a) * r);
  }

  // Close the loop
  points.push(points[0].clone());
  return points;
}

/**
 * Generate jiggled points along a straight line between two Vector3s.
 */
export function getJiggledLinePoints(
  start: THREE.Vector3, end: THREE.Vector3, seed: string, jiggle: boolean = true, segments: number = 8
): THREE.Vector3[] {
  const rng = seededRng(hashStr(seed));
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const j = (jiggle && i > 0 && i < segments) ? JIGGLE_AMOUNT : 0;
    points.push(new THREE.Vector3(
      start.x + (end.x - start.x) * t + rng() * j,
      start.y + (end.y - start.y) * t + rng() * j,
      0
    ));
  }
  return points;
}

export function distanceToLineSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((point.x - a.x) ** 2 + (point.y - a.y) ** 2);

  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}
