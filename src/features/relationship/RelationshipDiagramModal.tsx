/**
 * 相関図 SVG モーダル — ノードを円周配置してエッジを色分けで描画する。
 * 同一ノード対の複数エッジはレーン分散してベジェ曲線で重ならないように表示する。
 */

import { useMemo } from 'react';
import type { Correlation, CorrelationData, CorrelationEdge } from '@/shared/types';
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
const LANE_STEP = 36;

interface EdgeLayout {
  edge: CorrelationEdge;
  index: number;
  lane: number;
  groupSize: number;
}

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

  const edgeLayouts = useMemo<EdgeLayout[]>(() => {
    const groups = new Map<string, number[]>();
    data.edges.forEach((e, i) => {
      const key = [e.from, e.to].sort().join('|');
      const arr = groups.get(key) ?? [];
      arr.push(i);
      groups.set(key, arr);
    });
    const result: EdgeLayout[] = new Array(data.edges.length);
    groups.forEach((indices) => {
      const groupSize = indices.length;
      indices.forEach((edgeIdx, laneIdx) => {
        result[edgeIdx] = {
          edge: data.edges[edgeIdx],
          index: edgeIdx,
          lane: laneIdx - (groupSize - 1) / 2,
          groupSize,
        };
      });
    });
    return result;
  }, [data.edges]);

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
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', maxWidth: '95vw', maxHeight: '95vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
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
            <svg width={WIDTH} height={HEIGHT} style={{ background: 'var(--bg-deep)', borderRadius: 4 }}>
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

              {edgeLayouts.map((el) => {
                if (!el) return null;
                const edge = el.edge;
                const from = layout.get(edge.from);
                const to = layout.get(edge.to);
                if (!from || !to) return null;
                const color = RELATIONSHIP_TYPE_COLORS[edge.type as RelationshipType]
                  ?? RELATIONSHIP_TYPE_COLORS.other;
                const markerId = RELATIONSHIP_TYPES.includes(edge.type as RelationshipType)
                  ? `arrow-${edge.type}`
                  : 'arrow-other';

                // 正規化された対方向（id 昇順）で法線を決定し、往復エッジでも分離される
                const [aId, bId] = [edge.from, edge.to].sort();
                const a = layout.get(aId)!;
                const b = layout.get(bId)!;
                const cdx = b.x - a.x;
                const cdy = b.y - a.y;
                const cdist = Math.max(1, Math.sqrt(cdx * cdx + cdy * cdy));
                const nx = -cdy / cdist;
                const ny = cdx / cdist;

                // エッジ本来の始点/終点（ノード境界へクリップ）
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const ux = dx / dist;
                const uy = dy / dist;
                const x1 = from.x + ux * NODE_R;
                const y1 = from.y + uy * NODE_R;
                const x2 = to.x - ux * NODE_R;
                const y2 = to.y - uy * NODE_R;

                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const offset = el.lane * LANE_STEP;
                const ccx = mx + nx * offset;
                const ccy = my + ny * offset;

                const strokeWidth = Math.max(1, Math.min(6, edge.intensity / 2));
                // 2次ベジェ B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2。t=2/3 で矢印先端側 1/3 地点
                const t = 2 / 3;
                const mt = 1 - t;
                const labelX = mt * mt * x1 + 2 * mt * t * ccx + t * t * x2;
                const labelY = mt * mt * y1 + 2 * mt * t * ccy + t * t * y2;
                const categoryLabel = RELATIONSHIP_TYPE_LABELS[edge.type as RelationshipType] ?? edge.type;

                return (
                  <g key={el.index}>
                    <path
                      d={`M ${x1} ${y1} Q ${ccx} ${ccy} ${x2} ${y2}`}
                      stroke={color}
                      strokeWidth={strokeWidth}
                      fill="none"
                      markerEnd={`url(#${markerId})`}
                      opacity={0.85}
                    />
                    {categoryLabel && (
                      <text
                        x={labelX}
                        y={labelY}
                        fontSize="11"
                        textAnchor="middle"
                        fill={color}
                        stroke="var(--bg-deep)"
                        strokeWidth={3}
                        paintOrder="stroke"
                        style={{ pointerEvents: 'none', fontWeight: 600 }}
                      >
                        {categoryLabel}
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
                      fill="var(--bg-surface)"
                      stroke="var(--accent)"
                      strokeWidth={2}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      fontSize="11"
                      textAnchor="middle"
                      fill="var(--text)"
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
                  <div key={t} className="flex items-center gap-1" style={{ color: 'var(--text-mid)' }}>
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
