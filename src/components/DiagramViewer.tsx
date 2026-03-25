import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ParsedSchema, DBTable, DBField, DBRelationship } from '../utils/types';
import { buildNodesAndEdges, type TableNodeData } from '../utils/diagramLayout';
import TableNode from './TableNode';

const nodeTypes: NodeTypes = { tableNode: TableNode };

// ─── Field tooltip (rendered as portal over everything) ───────────────────────

interface TooltipState {
  field: DBField;
  x: number;
  y: number;
}

function FieldTooltip({ tip }: { tip: TooltipState }) {
  const constraints: string[] = [];
  if (tip.field.isPrimaryKey) constraints.push('PRIMARY KEY');
  if (tip.field.isUnique && !tip.field.isPrimaryKey) constraints.push('UNIQUE');
  if (tip.field.isNotNull && !tip.field.isPrimaryKey) constraints.push('NOT NULL');
  if (tip.field.isIncrement) constraints.push('AUTO INCREMENT');

  const safeX = Math.min(tip.x, window.innerWidth - 240);
  const safeY = Math.min(tip.y, window.innerHeight - 160);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: safeX,
        top: safeY,
        backgroundColor: '#1c2128',
        border: '1px solid #30363d',
        borderRadius: 8,
        padding: '10px 14px',
        zIndex: 99999,
        maxWidth: 260,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 600, color: '#e6edf3', fontSize: 13, marginBottom: 4 }}>
        {tip.field.name}
      </div>

      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          color: '#8b949e',
          backgroundColor: '#0d1117',
          padding: '2px 6px',
          borderRadius: 4,
          display: 'inline-block',
        }}
      >
        {tip.field.type}
      </span>

      {constraints.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {constraints.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 10,
                color: '#8b949e',
                backgroundColor: '#30363d',
                padding: '2px 6px',
                borderRadius: 3,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {tip.field.defaultValue !== undefined && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
          default:{' '}
          <code style={{ color: '#a78bfa', fontFamily: 'monospace' }}>
            {tip.field.defaultValue}
          </code>
        </div>
      )}

      {tip.field.note && (
        <div
          style={{
            fontSize: 12,
            color: '#9ca3af',
            marginTop: 7,
            lineHeight: 1.5,
            borderTop: '1px solid #30363d',
            paddingTop: 7,
          }}
        >
          {tip.field.note}
        </div>
      )}
    </div>,
    document.body
  );
}

// ─── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99998,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 12,
          padding: '24px 28px',
          maxWidth: 380,
          width: '90%',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600, fontSize: 15, color: '#e6edf3', marginBottom: 10 }}>
          Load new schema?
        </div>
        <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.6, marginBottom: 22 }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px',
              backgroundColor: 'transparent',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#8b949e',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 16px',
              backgroundColor: '#6366f1',
              border: '1px solid #6366f1',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Markdown note ────────────────────────────────────────────────────────────

function MarkdownNote({ text, style }: { text: string; style?: React.CSSProperties }) {
  const html = useMemo(
    () => marked.parse(text, { async: false }) as string,
    [text]
  );
  return (
    <div
      className="md-note"
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── Unified left panel ────────────────────────────────────────────────────────

interface UnifiedPanelProps {
  tables: DBTable[];
  relationships: DBRelationship[];
  selectedTableId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onTableClick: (id: string) => void;
  onTableClose: () => void;
}

function UnifiedPanel({
  tables,
  relationships,
  selectedTableId,
  searchQuery,
  onSearchChange,
  onTableClick,
  onTableClose,
}: UnifiedPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [panelWidth, setPanelWidth] = useState(320);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  const filtered = searchQuery.trim()
    ? tables.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tables;

  const toggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getRelCount = (tableId: string) =>
    relationships.filter((r) => r.fromTable === tableId || r.toTable === tableId).length;

  const startResize = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startW: panelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const next = Math.max(240, Math.min(640, dragRef.current.startW + ev.clientX - dragRef.current.startX));
      setPanelWidth(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      style={{
        width: panelWidth,
        position: 'relative',
        borderRight: '1px solid #30363d',
        backgroundColor: '#161b22',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 4,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 10,
        }}
      />

      {/* Search — always visible at panel top */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #21262d', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#8b949e', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search tables…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '5px 26px 5px 28px',
              fontSize: 12,
              color: '#e6edf3',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 2, lineHeight: 1 }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {selectedTable ? (
        /* ── Detail view ── */
        <>
          {/* Back button header */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #21262d',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onTableClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: '3px 6px 3px 3px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              All tables
            </button>
            <div style={{ width: 1, height: 14, backgroundColor: '#30363d' }} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedTable.name}
            </span>
          </div>

          {/* Detail content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {selectedTable.note && (
              <MarkdownNote
                text={selectedTable.note}
                style={{
                  backgroundColor: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: '8px 10px',
                  marginBottom: 14,
                }}
              />
            )}

            <SectionLabel>Fields ({selectedTable.fields.length})</SectionLabel>

            {selectedTable.fields.map((field) => (
              <div
                key={field.name}
                style={{ padding: '6px 0', borderBottom: '1px solid #21262d' }}
              >
                {/* Single row: icon · name · flex spacer · badges · type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {/* Constraint icon */}
                  <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {field.isPrimaryKey ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <circle cx="7" cy="8" r="4" stroke="#f59e0b" strokeWidth="2" />
                        <path d="M11 8h8M16 6v4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : field.isUnique ? (
                      <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>U</span>
                    ) : field.isNotNull ? (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4d5566' }} />
                    ) : (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#2d3139' }} />
                    )}
                  </div>

                  {/* Field name */}
                  <span
                    style={{
                      fontSize: 12,
                      color: field.isPrimaryKey ? '#f59e0b' : '#e6edf3',
                      fontWeight: field.isPrimaryKey ? 500 : 400,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {field.name}
                  </span>

                  {/* Right-side badges + type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {field.isIncrement && <Chip color="#34d399" title="Auto Increment">AI</Chip>}
                    {field.isPrimaryKey && <Chip color="#f59e0b" title="Primary Key">PK</Chip>}
                    {field.isUnique && !field.isPrimaryKey && <Chip color="#60a5fa" title="Unique">UQ</Chip>}
                    {field.isNotNull && !field.isPrimaryKey && <Chip color="#6b7280" title="Not Null">NN</Chip>}
                    <span
                      style={{
                        fontSize: 10,
                        color: '#8b949e',
                        backgroundColor: '#0d1117',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'monospace',
                        maxWidth: 90,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {field.type}
                    </span>
                  </div>
                </div>

                {/* Default value */}
                {field.defaultValue !== undefined && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, paddingLeft: 20 }}>
                    default:{' '}
                    <code style={{ color: '#a78bfa', fontFamily: 'monospace' }}>
                      {field.defaultValue}
                    </code>
                  </div>
                )}

                {/* Note */}
                {field.note && (
                  <MarkdownNote text={field.note} style={{ marginTop: 8, paddingLeft: 20 }} />
                )}
              </div>
            ))}

            {/* Relationships for this table */}
            {(() => {
              const outbound = relationships.filter((r) => r.fromTable === selectedTable.id);
              const inbound = relationships.filter((r) => r.toTable === selectedTable.id);
              if (outbound.length === 0 && inbound.length === 0) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <SectionLabel>Relationships</SectionLabel>
                  {outbound.map((rel) => (
                    <div
                      key={rel.id}
                      style={{
                        fontSize: 12,
                        padding: '4px 0',
                        color: '#8b949e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: '#e6edf3' }}>{rel.fromField}</span>
                      <span style={{ color: '#4d5566' }}>→</span>
                      <span style={{ color: '#6366f1' }}>{rel.toTable}</span>
                      <span style={{ color: '#4d5566' }}>.</span>
                      <span>{rel.toField}</span>
                      {rel.cardinality !== '1:N' && (
                        <span
                          style={{
                            fontSize: 10,
                            color: '#8b949e',
                            backgroundColor: '#21262d',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}
                        >
                          {rel.cardinality}
                        </span>
                      )}
                    </div>
                  ))}
                  {inbound.map((rel) => (
                    <div
                      key={rel.id}
                      style={{
                        fontSize: 12,
                        padding: '4px 0',
                        color: '#8b949e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: '#6366f1' }}>{rel.fromTable}</span>
                      <span style={{ color: '#4d5566' }}>.</span>
                      <span>{rel.fromField}</span>
                      <span style={{ color: '#4d5566' }}>→</span>
                      <span style={{ color: '#e6edf3' }}>{rel.toField}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </>
      ) : (
        /* ── Table list view ── */
        <>
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #21262d',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: '#8b949e',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Tables ({filtered.length})
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map((table) => {
              const isSelected = table.id === selectedTableId;
              const isExpanded = expandedIds.has(table.id);
              const relCount = getRelCount(table.id);

              return (
                <div key={table.id}>
                  <div
                    onClick={() => onTableClick(table.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 8px 6px 10px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#1f2937' : 'transparent',
                      borderLeft: `2px solid ${isSelected ? '#6366f1' : 'transparent'}`,
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#1c2128';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <button
                      onClick={(e) => toggle(table.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 2,
                        cursor: 'pointer',
                        color: '#4d5566',
                        lineHeight: 1,
                        flexShrink: 0,
                        width: 16,
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        style={{
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s',
                          display: 'block',
                        }}
                      >
                        <path
                          d="M3 2l4 3-4 3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    <span
                      style={{
                        fontSize: 12,
                        color: isSelected ? '#e6edf3' : '#c9d1d9',
                        fontWeight: isSelected ? 500 : 400,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={table.name}
                    >
                      {table.name}
                    </span>

                    <span
                      style={{
                        fontSize: 10,
                        color: '#6b7280',
                        backgroundColor: '#21262d',
                        padding: '1px 5px',
                        borderRadius: 99,
                        flexShrink: 0,
                      }}
                    >
                      {table.fields.length}
                    </span>
                    {relCount > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#6366f1',
                          backgroundColor: '#6366f115',
                          border: '1px solid #6366f130',
                          padding: '1px 5px',
                          borderRadius: 99,
                          flexShrink: 0,
                        }}
                      >
                        {relCount}
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        backgroundColor: '#0d1117',
                        borderBottom: '1px solid #21262d',
                      }}
                    >
                      {/* Table note */}
                      {table.note && (
                        <MarkdownNote
                          text={table.note}
                          style={{
                            margin: '8px 12px 4px',
                            padding: '7px 10px',
                            backgroundColor: '#161b22',
                            border: '1px solid #21262d',
                            borderRadius: 6,
                          }}
                        />
                      )}

                      {table.fields.map((field) => (
                        <div
                          key={field.name}
                          style={{
                            padding: '6px 12px 6px 28px',
                            borderBottom: '1px solid #1c2128',
                          }}
                        >
                          {/* Name + type row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{ flexShrink: 0, width: 14, display: 'flex', alignItems: 'center' }}
                            >
                              {field.isPrimaryKey ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                                  <circle cx="7" cy="8" r="4" stroke="#f59e0b" strokeWidth="2" />
                                  <path d="M11 8h8M16 6v4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              ) : field.isUnique ? (
                                <span style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700 }}>U</span>
                              ) : field.isNotNull ? (
                                <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#4d5566' }} />
                              ) : (
                                <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#2d3139' }} />
                              )}
                            </span>

                            <span
                              style={{
                                fontSize: 12,
                                color: field.isPrimaryKey ? '#f59e0b' : '#c9d1d9',
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: field.isPrimaryKey ? 500 : 400,
                              }}
                            >
                              {field.name}
                            </span>

                            <span
                              style={{
                                fontSize: 10,
                                color: '#6b7280',
                                fontFamily: 'monospace',
                                backgroundColor: '#1c2128',
                                padding: '1px 5px',
                                borderRadius: 3,
                                flexShrink: 0,
                                maxWidth: 90,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {field.type}
                            </span>
                          </div>

                          {/* Description */}
                          {field.note && (
                            <MarkdownNote
                              text={field.note}
                              style={{ marginTop: 4, paddingLeft: 20 }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: '#8b949e',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Chip({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      style={{
        fontSize: 10,
        fontWeight: 600,
        color,
        backgroundColor: `${color}1a`,
        border: `1px solid ${color}40`,
        padding: '1px 5px',
        borderRadius: 4,
        cursor: title ? 'default' : undefined,
      }}
    >
      {children}
    </span>
  );
}

// ─── Flow canvas (inside ReactFlowProvider) ───────────────────────────────────

interface FlowCanvasProps {
  schema: ParsedSchema;
  selectedTableId: string | null;
  onTableSelect: (id: string | null) => void;
  searchQuery: string;
  focusTableId: string | null;
  onFocusComplete: () => void;
}

function FlowCanvas({
  schema,
  selectedTableId,
  onTableSelect,
  searchQuery,
  focusTableId,
  onFocusComplete,
}: FlowCanvasProps) {
  const { fitView } = useReactFlow();
  const prevFocusId = useRef<string | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildNodesAndEdges(schema),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Auto-arrange triggered from toolbar via window event
  useEffect(() => {
    const handler = () => {
      const { nodes: newNodes, edges: newEdges } = buildNodesAndEdges(schema);
      setNodes(newNodes);
      setEdges(newEdges);
      setTimeout(() => fitView({ padding: 0.12, duration: 500 }), 60);
    };
    window.addEventListener('dbml:autoarrange', handler);
    return () => window.removeEventListener('dbml:autoarrange', handler);
  }, [schema, setNodes, setEdges, fitView]);

  // Focus on specific table when triggered from sidebar
  useEffect(() => {
    if (!focusTableId || focusTableId === prevFocusId.current) return;
    prevFocusId.current = focusTableId;
    fitView({
      nodes: [{ id: focusTableId }],
      padding: 0.35,
      duration: 600,
      maxZoom: 1.2,
    });
    setTimeout(onFocusComplete, 700);
  }, [focusTableId, fitView, onFocusComplete]);

  // Dim non-matching nodes during search
  const displayNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.map((node) => ({
      ...node,
      style: {
        opacity: (node.data as TableNodeData).table.name.toLowerCase().includes(q) ? 1 : 0.1,
      },
    }));
  }, [nodes, searchQuery]);

  // Highlight edges connected to selected table
  const displayEdges = useMemo(() => {
    if (!selectedTableId) return edges;
    return edges.map((edge) => {
      const active = edge.source === selectedTableId || edge.target === selectedTableId;
      return {
        ...edge,
        style: {
          stroke: active ? '#6366f1' : '#4d5566',
          strokeWidth: active ? 2.5 : 1.5,
          opacity: active ? 1 : 0.2,
        },
      };
    });
  }, [edges, selectedTableId]);

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={displayEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onTableSelect(node.id)}
      onPaneClick={() => onTableSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.05}
      maxZoom={2}
      colorMode="dark"
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#21262d" />
      <Controls style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}>
        <ControlButton
          onClick={() => window.dispatchEvent(new Event('dbml:autoarrange'))}
          title="Auto arrange"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
          </svg>
        </ControlButton>
      </Controls>
      <MiniMap
        style={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}
        nodeColor="#30363d"
        maskColor="rgba(13,17,23,0.7)"
      />
    </ReactFlow>
  );
}

// ─── Main DiagramViewer ────────────────────────────────────────────────────────

interface DiagramViewerProps {
  schema: ParsedSchema;
  onReset?: () => void;
}

export default function DiagramViewer({ schema, onReset }: DiagramViewerProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusTableId, setFocusTableId] = useState<string | null>(null);
  const [fieldTooltip, setFieldTooltip] = useState<TooltipState | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Listen for field hover events from TableNode
  useEffect(() => {
    const handler = (e: Event) =>
      setFieldTooltip((e as CustomEvent).detail as TooltipState | null);
    window.addEventListener('dbml:field-hover', handler);
    return () => window.removeEventListener('dbml:field-hover', handler);
  }, []);

  const handleSidebarTableClick = useCallback((id: string) => {
    setSelectedTableId(id);
    setFocusTableId(id);
  }, []);

  const handleCanvasTableSelect = useCallback((id: string | null) => {
    setSelectedTableId(id);
  }, []);

  const handleFocusComplete = useCallback(() => setFocusTableId(null), []);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0d1117' }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px',
          height: 48,
          backgroundColor: '#161b22',
          borderBottom: '1px solid #30363d',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#6366f1" />
            <rect x="6" y="8" width="20" height="3" rx="1.5" fill="white" />
            <rect x="6" y="14" width="20" height="3" rx="1.5" fill="white" fillOpacity="0.7" />
            <rect x="6" y="20" width="14" height="3" rx="1.5" fill="white" fillOpacity="0.4" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>DBML Visualizer</span>
        </div>

        <div style={{ width: 1, height: 16, backgroundColor: '#30363d' }} />

        <span style={{ fontSize: 12, color: '#8b949e' }}>
          <span style={{ color: '#e6edf3', fontWeight: 500 }}>{schema.tables.length}</span> tables
          &nbsp;&nbsp;
          <span style={{ color: '#e6edf3', fontWeight: 500 }}>{schema.relationships.length}</span>{' '}
          refs
        </span>

        <div style={{ marginLeft: 'auto' }} />
        {onReset && (
          <ToolbarBtn
            onClick={() => setShowConfirm(true)}
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 12H5M5 12L12 19M5 12L12 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            New Schema
          </ToolbarBtn>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Unified left panel */}
        <UnifiedPanel
          tables={schema.tables}
          relationships={schema.relationships}
          selectedTableId={selectedTableId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onTableClick={handleSidebarTableClick}
          onTableClose={() => setSelectedTableId(null)}
        />

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlowProvider>
            <FlowCanvas
              schema={schema}
              selectedTableId={selectedTableId}
              onTableSelect={handleCanvasTableSelect}
              searchQuery={searchQuery}
              focusTableId={focusTableId}
              onFocusComplete={handleFocusComplete}
            />
          </ReactFlowProvider>
        </div>
      </div>

      {/* Field tooltip portal */}
      {fieldTooltip && <FieldTooltip tip={fieldTooltip} />}

      {/* New Schema confirmation */}
      {showConfirm && (
        <ConfirmDialog
          message="The current schema will be discarded. Are you sure you want to load a new one?"
          onConfirm={() => {
            setShowConfirm(false);
            onReset?.();
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

function ToolbarBtn({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        backgroundColor: 'transparent',
        border: `1px solid ${hovered ? '#4d5566' : '#30363d'}`,
        borderRadius: 6,
        color: hovered ? '#e6edf3' : '#8b949e',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'border-color 0.1s, color 0.1s',
      }}
    >
      {icon}
      {children}
    </button>
  );
}
