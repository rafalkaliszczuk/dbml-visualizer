export const TABLE_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#a855f7',
];

export function getTableColor(index: number): string {
  return TABLE_COLORS[index % TABLE_COLORS.length];
}
