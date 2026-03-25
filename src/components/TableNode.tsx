import { memo, Fragment } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { TableNodeData } from '../utils/diagramLayout';
import { HEADER_HEIGHT, FIELD_HEIGHT } from '../utils/diagramLayout';
import type { DBField } from '../utils/types';

type TableNodeType = Node<TableNodeData, 'tableNode'>;

const NODE_WIDTH = 280;

function TableNode({ data, selected }: NodeProps<TableNodeType>) {
  const { table, color } = data;

  const handleFieldEnter = (field: DBField, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent('dbml:field-hover', {
        detail: { field, x: rect.right + 10, y: rect.top },
      })
    );
  };

  const handleFieldLeave = () => {
    window.dispatchEvent(new CustomEvent('dbml:field-hover', { detail: null }));
  };

  return (
    /*
     * Outer div must NOT have overflow:hidden.
     * Per-field handles are positioned absolutely here; overflow:hidden would clip them.
     */
    <div style={{ position: 'relative', width: NODE_WIDTH }}>
      {/* Per-field handles — siblings of the visual box, NOT inside overflow:hidden */}
      {table.fields.map((field, index) => {
        const top = HEADER_HEIGHT + index * FIELD_HEIGHT + FIELD_HEIGHT / 2;
        return (
          <Fragment key={field.name}>
            <Handle
              type="target"
              position={Position.Left}
              id={field.name}
              style={{
                top,
                width: 8,
                height: 8,
                background: color,
                border: '2px solid #0d1117',
                borderRadius: '50%',
              }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={field.name}
              style={{
                top,
                width: 8,
                height: 8,
                background: color,
                border: '2px solid #0d1117',
                borderRadius: '50%',
              }}
            />
          </Fragment>
        );
      })}

      {/* Visual box — overflow:hidden only here for rounded corners */}
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 10,
          border: `1.5px solid ${selected ? color : '#30363d'}`,
          backgroundColor: '#161b22',
          boxShadow: selected
            ? `0 0 0 2px ${color}40, 0 8px 32px rgba(0,0,0,0.5)`
            : '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: HEADER_HEIGHT,
            backgroundColor: `${color}1a`,
            borderBottom: `1.5px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {table.schema !== 'public' && (
                <span style={{ color: '#8b949e', fontWeight: 400 }}>{table.schema}.</span>
              )}
              {table.name}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color: '#8b949e',
              backgroundColor: '#0d1117',
              padding: '2px 8px',
              borderRadius: 99,
              marginLeft: 8,
              flexShrink: 0,
            }}
          >
            {table.fields.length}
          </span>
        </div>

        {/* Fields */}
        {table.fields.map((field, index) => (
          <div
            key={field.name}
            className="nodrag nopan"
            onMouseEnter={(e) => handleFieldEnter(field, e)}
            onMouseLeave={handleFieldLeave}
            style={{
              height: FIELD_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              gap: 8,
              borderTop: index > 0 ? '1px solid #21262d' : undefined,
              cursor: 'default',
            }}
          >
            {/* Constraint icon */}
            <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {field.isPrimaryKey ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <circle cx="7" cy="8" r="4" stroke="#f59e0b" strokeWidth="2" />
                  <path
                    d="M11 8h8M16 6v4"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : field.isUnique ? (
                <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, lineHeight: 1 }}>
                  U
                </span>
              ) : field.isNotNull ? (
                <div
                  style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4d5566' }}
                />
              ) : (
                <div
                  style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#2d3139' }}
                />
              )}
            </div>

            {/* Name */}
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: field.isPrimaryKey ? '#f59e0b' : '#e6edf3',
                fontWeight: field.isPrimaryKey ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {field.name}
            </span>

            {/* Type */}
            <span
              style={{
                fontSize: 11,
                color: '#8b949e',
                backgroundColor: '#0d1117',
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: 'monospace',
                flexShrink: 0,
                maxWidth: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {field.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(TableNode);
