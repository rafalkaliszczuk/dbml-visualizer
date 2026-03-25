import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { ParsedSchema, DBTable, DBRelationship } from './types';
import { getTableColor } from './colors';

export const NODE_WIDTH = 280;
export const HEADER_HEIGHT = 44;
export const FIELD_HEIGHT = 36;

export function getNodeHeight(table: DBTable): number {
  return HEADER_HEIGHT + table.fields.length * FIELD_HEIGHT;
}

export interface TableNodeData {
  table: DBTable;
  color: string;
  [key: string]: unknown;
}

// ─── Connected component detection (union-find) ───────────────────────────────

function findConnectedComponents(tables: DBTable[], rels: DBRelationship[]): string[][] {
  const parent = new Map<string, string>();

  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x)!;
    if (p !== x) parent.set(x, find(p));
    return parent.get(x)!;
  };

  tables.forEach((t) => find(t.id));
  rels.forEach((r) => {
    const ra = find(r.fromTable);
    const rb = find(r.toTable);
    if (ra !== rb) parent.set(ra, rb);
  });

  const groups = new Map<string, string[]>();
  tables.forEach((t) => {
    const root = find(t.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(t.id);
  });

  return Array.from(groups.values()).sort((a, b) => b.length - a.length);
}

// ─── Layout a single connected component with dagre ───────────────────────────

function layoutComponent(
  tables: DBTable[],
  rels: DBRelationship[],
  colorMap: Map<string, string>
): { nodes: Node<TableNodeData>[]; w: number; h: number } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 150, marginx: 20, marginy: 20 });

  tables.forEach((t) => g.setNode(t.id, { width: NODE_WIDTH, height: getNodeHeight(t) }));
  rels.forEach((r) => g.setEdge(r.fromTable, r.toTable));
  dagre.layout(g);

  const gi = g.graph() as { width?: number; height?: number };

  const nodes: Node<TableNodeData>[] = tables.map((t) => {
    const pos = g.node(t.id);
    return {
      id: t.id,
      type: 'tableNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - getNodeHeight(t) / 2 },
      data: { table: t, color: colorMap.get(t.id) ?? '#6366f1' },
    };
  });

  return { nodes, w: gi.width ?? NODE_WIDTH, h: gi.height ?? getNodeHeight(tables[0]) };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildNodesAndEdges(schema: ParsedSchema): {
  nodes: Node<TableNodeData>[];
  edges: Edge[];
} {
  const colorMap = new Map<string, string>();
  schema.tables.forEach((t, i) => colorMap.set(t.id, getTableColor(i)));

  const validIds = new Set(schema.tables.map((t) => t.id));
  const validRels = schema.relationships.filter(
    (r) => validIds.has(r.fromTable) && validIds.has(r.toTable)
  );

  const components = findConnectedComponents(schema.tables, validRels);
  const multiComponents = components.filter((c) => c.length > 1);
  const isolatedIds = components.filter((c) => c.length === 1).map((c) => c[0]);

  const COMP_GAP = 80;
  const ROW_GAP = 100;
  const MAX_ROW_W = 2800;

  const allNodes: Node<TableNodeData>[] = [];
  let rowX = 0;
  let rowY = 0;
  let rowH = 0;

  // Layout connected components in rows
  for (const ids of multiComponents) {
    const tables = schema.tables.filter((t) => ids.includes(t.id));
    const rels = validRels.filter(
      (r) => ids.includes(r.fromTable) && ids.includes(r.toTable)
    );
    const { nodes: compNodes, w, h } = layoutComponent(tables, rels, colorMap);

    if (rowX > 0 && rowX + w > MAX_ROW_W) {
      rowY += rowH + ROW_GAP;
      rowX = 0;
      rowH = 0;
    }

    compNodes.forEach((n) => {
      n.position.x += rowX;
      n.position.y += rowY;
    });

    allNodes.push(...compNodes);
    rowX += w + COMP_GAP;
    rowH = Math.max(rowH, h);
  }

  // Isolated tables in a horizontal grid (4 columns)
  if (isolatedIds.length > 0) {
    const COLS = 4;
    const COL_W = NODE_WIDTH + 60;
    let currentGridY = rowY + rowH + (rowH > 0 ? ROW_GAP : 0);

    for (let i = 0; i < isolatedIds.length; i += COLS) {
      const rowIds = isolatedIds.slice(i, i + COLS);
      const rowHeight = Math.max(
        ...rowIds.map((id) => {
          const t = schema.tables.find((t) => t.id === id)!;
          return getNodeHeight(t);
        })
      );

      rowIds.forEach((id, col) => {
        const table = schema.tables.find((t) => t.id === id)!;
        allNodes.push({
          id,
          type: 'tableNode',
          position: { x: col * COL_W, y: currentGridY },
          data: { table, color: colorMap.get(id) ?? '#6366f1' },
        });
      });

      currentGridY += rowHeight + ROW_GAP;
    }
  }

  const edges: Edge[] = validRels.map((rel) => ({
    id: rel.id,
    source: rel.fromTable,
    target: rel.toTable,
    ...(rel.fromField ? { sourceHandle: rel.fromField } : {}),
    ...(rel.toField ? { targetHandle: rel.toField } : {}),
    type: 'smoothstep',
    style: { stroke: '#4d5566', strokeWidth: 1.5 },
  }));

  return { nodes: allNodes, edges };
}
