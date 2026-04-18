/**
 * 相関図 SVG モーダル — ノードを円周配置してエッジを色分けで描画する。
 */

import { useMemo } from 'react';
import type { Correlation, CorrelationData } from '@/shared/types';
import {
  RELATIONSHIP_TYPE_COLORS,
  RELATIONSHIP_TYPE_LABELS,
  RELATIONSHIP_TYPES,
} from '@/shared/constants/asbEnums';
import type { RelationshipType } from '@/shared/constants/asbEnums';

interface Props {
  item: Correlation;
  onClose: () => void;
}

const WIDTH = 720;
const HEIGHT = 560;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const RADIUS_MIN = 140;
const NODE_R = 28;

export function RelationshipDiagramModal({ item, onClose }: Props) {
  const data = useMemo<CorrelationData>(() => safeParse(item.data), [item.data]);

  const layout = useMemo(() => {
    const n = data.nodes.length;
    if (n === 0) return new Map<string, { x: number; y: number }>();
    const radius = Math.max(RADIUS_MIN, Math.min(WIDTH, HEIGHT) / 2 - NODE_R - 40);
    const map = new Map<string, { x: number; y: number }>();
    data.nodes.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      map.set(node.id, {
        x: CX + Math.cos(angle) * radius,
        y: CY + Math.sin(angle) * radius,
      });
    });
    return map;
  }, [data.nodes]);

  const typesUsed = useMemo(() => {
    const set = new Set<string>();
    for (const e of data.edges) set.add(e.type);
    return Array.from(set);
  }, [data.edges]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded shadow-lg flex flex-col"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', maxWidth: '95vw', maxHeight: '95vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {item.title || '相関図'}
          </span>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
          >
            閉じる
          </button>
        </div>

        <div className="p-3 overflow-auto">
          {data.nodes.length === 0 ? (
            <div className="text-xs p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              ノードがありません
            </div>
          ) : (
            <svg width={WIDTH} height={HEIGHT} style={{ background: 'var(--bg-secondary)', borderRadius: 4 }}>
              <defs>
                {RELATIONSHIP_TYPES.map((t) => (
                  <marker
                    key={t}
                    id={`arrow-${t}`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={RELATIONSHIP_TYPE_COLORS[t]} />
                  </marker>
                ))}
                <marker
                  id="arrow-other"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={RELATIONSHIP_TYPE_COLORS.other} />
                </marker>
              </defs>

              {data.edges.map((edge, i) => {
                const from = layout.get(edge.from);
                const to = layout.get(edge.to);
                if (!from || !to) return null;
                const color = RELATIONSHIP_TYPE_COLORS[edge.type as RelationshipType]
                  ?? RELATIONSHIP_TYPE_COLORS.other;
                const markerId = RELATIONSHIP_TYPES.includes(edge.type as RelationshipType)
                  ? `arrow-${edge.type}`
                  : 'arrow-other';
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const ux = dx / dist;
                const uy = dy / dist;
                const x1 = from.x + ux * NODE_R;
                const y1 = from.y + uy * NODE_R;
                const x2 = to.x - ux * NODE_R;
                const y2 = to.y - uy * NODE_R;
                const strokeWidth = Math.max(1, Math.min(6, edge.intensity / 2));
                return (
                  <g key={i}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={strokeWidth}
                      markerEnd={`url(#${markerId})`}
                      opacity={0.85}
                    />
                    {edge.description && (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 4}
                        fontSize="10"
                        textAnchor="middle"
                        fill="var(--text-muted)"
                        style={{ pointerEvents: 'none' }}
                      >
                        {truncate(edge.description, 16)}
                      </text>
                    )}
                  </g>
                );
              })}

              {data.nodes.map((node) => {
                const pos = layout.get(node.id);
                if (!pos) return null;
                return (
                  <g key={node.id}>
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={NODE_R}
                      fill="var(--bg-primary)"
                      stroke="var(--accent)"
                      strokeWidth={2}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      fontSize="11"
                      textAnchor="middle"
                      fill="var(--text-primary)"
                      style={{ pointerEvents: 'none' }}
                    >
                      {truncate(node.name, 8)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {typesUsed.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {typesUsed.map((t) => {
                const color = RELATIONSHIP_TYPE_COLORS[t as RelationshipType]
                  ?? RELATIONSHIP_TYPE_COLORS.other;
                const label = RELATIONSHIP_TYPE_LABELS[t as RelationshipType] ?? t;
                return (
                  <div key={t} className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'inline-block', width: 16, height: 2, background: color }} />
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function safeParse(json: string): CorrelationData {
  try {
    const parsed = JSON.parse(json || '{}');
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}
