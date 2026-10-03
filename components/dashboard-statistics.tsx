'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export type PreorderData = {
  created_at: string;
  qty: number;
  branch_name: string;
  sku: string;
  product_name: string;
};

interface DashboardStatisticsProps {
  preorders: PreorderData[];
  branches: { id: string; name: string }[];
  skus: { id: string; sku: string; name: string }[];
}

// Extended color palette — enough distinct colors for many branches/SKUs
const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#e879f9', '#22d3ee', '#fb923c', '#a78bfa', '#34d399',
  '#fbbf24', '#f87171', '#c084fc', '#2dd4bf', '#a3e635',
];

/* ─── Custom Tooltip ─── */
interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  labelMap: Record<string, string>;
}

function CustomTooltip({ active, payload, label, labelMap }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Sort entries by value descending so the biggest ones are on top
  const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        boxShadow: 'var(--shadow-lg)',
        maxWidth: '320px',
        maxHeight: '280px',
        overflowY: 'auto',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid var(--border-secondary)',
          paddingBottom: '0.375rem',
        }}
      >
        {label}
      </div>
      {sorted.map((entry, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.25rem 0',
            fontSize: '0.8rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: entry.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={labelMap[entry.dataKey] || entry.name}
            >
              {labelMap[entry.dataKey] || entry.name}
            </span>
          </div>
          <span
            style={{
              fontWeight: 700,
              color: 'var(--text-primary)',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Custom Legend ─── */
interface LegendProps {
  lineKeys: string[];
  labelMap: Record<string, string>;
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
}

function ChartLegend({ lineKeys, labelMap, hiddenKeys, onToggle }: LegendProps) {
  if (lineKeys.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.375rem',
        paddingTop: '0.75rem',
        maxHeight: '100px',
        overflowY: lineKeys.length > 8 ? 'auto' : 'visible',
      }}
    >
      {lineKeys.map((key, index) => {
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const isHidden = hiddenKeys.has(key);
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            title={labelMap[key] || key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.625rem',
              borderRadius: '9999px',
              border: `1px solid ${isHidden ? 'var(--border-secondary)' : color}`,
              background: isHidden ? 'transparent' : `${color}18`,
              color: isHidden ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              transition: 'all var(--transition-fast)',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: isHidden ? 0.5 : 1,
              textDecoration: isHidden ? 'line-through' : 'none',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isHidden ? 'var(--text-muted)' : color,
                flexShrink: 0,
              }}
            />
            {labelMap[key] || key}
          </button>
        );
      })}
    </div>
  );
}

export function DashboardStatistics({ preorders, branches, skus }: DashboardStatisticsProps) {
  const [groupBy, setGroupBy] = useState<'total' | 'branch' | 'sku'>('total');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterSku, setFilterSku] = useState<string>('all');
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  // Reset hidden keys when groupBy changes
  const handleGroupChange = useCallback((value: 'total' | 'branch' | 'sku') => {
    setGroupBy(value);
    setHiddenKeys(new Set());
  }, []);

  // Build a lookup map from dataKey → display label
  const labelMap = useMemo(() => {
    const map: Record<string, string> = { Total: 'Total' };
    branches.forEach((b) => { map[b.name] = b.name; });
    skus.forEach((s) => { map[s.sku] = `${s.name}`; });
    return map;
  }, [branches, skus]);

  const chartData = useMemo(() => {
    const groupedByDate: Record<string, { date: string; Total: number; [key: string]: string | number }> = {};

    const sortedPreorders = [...preorders].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedPreorders.forEach(p => {
      // Apply filters
      if (filterBranch !== 'all' && p.branch_name !== filterBranch) return;
      if (filterSku !== 'all' && p.sku !== filterSku) return;

      const dateStr = new Date(p.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { date: dateStr, Total: 0 };
      }

      if (groupBy === 'total') {
        groupedByDate[dateStr].Total += p.qty;
      } else if (groupBy === 'branch') {
        const key = p.branch_name;
        if (!groupedByDate[dateStr][key]) groupedByDate[dateStr][key] = 0;
        groupedByDate[dateStr][key] = (groupedByDate[dateStr][key] as number) + p.qty;
      } else if (groupBy === 'sku') {
        const key = `${p.sku}`;
        if (!groupedByDate[dateStr][key]) groupedByDate[dateStr][key] = 0;
        groupedByDate[dateStr][key] = (groupedByDate[dateStr][key] as number) + p.qty;
      }
    });

    return Object.values(groupedByDate);
  }, [preorders, groupBy, filterBranch, filterSku]);

  // Extract all dynamic keys for lines
  const lineKeys = useMemo(() => {
    if (chartData.length === 0) return [];
    const keys = new Set<string>();
    chartData.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'date' && k !== 'Total' || (k === 'Total' && groupBy === 'total')) {
          keys.add(k);
        }
      });
    });
    return Array.from(keys);
  }, [chartData, groupBy]);

  const toggleKey = useCallback((key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Don't allow hiding ALL lines
        if (next.size < lineKeys.length - 1) {
          next.add(key);
        }
      }
      return next;
    });
  }, [lineKeys]);

  // Compute summary stats
  const summaryStats = useMemo(() => {
    const totalQty = chartData.reduce((sum, d) => {
      lineKeys.forEach((k) => {
        if (!hiddenKeys.has(k)) sum += (d[k] as number) || 0;
      });
      return sum;
    }, 0);

    const daysWithData = chartData.length;

    // Peak day
    let peakDay = '';
    let peakVal = 0;
    chartData.forEach((d) => {
      let dayTotal = 0;
      lineKeys.forEach((k) => {
        if (!hiddenKeys.has(k)) dayTotal += (d[k] as number) || 0;
      });
      if (dayTotal > peakVal) {
        peakVal = dayTotal;
        peakDay = d.date;
      }
    });

    return { totalQty, daysWithData, peakDay, peakVal };
  }, [chartData, lineKeys, hiddenKeys]);

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.25rem' }}>
            Preorder Statistics
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Compare preorders across branches and SKUs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={groupBy}
            onChange={(e) => handleGroupChange(e.target.value as 'total' | 'branch' | 'sku')}
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)', fontSize: '0.85rem'
            }}
          >
            <option value="total">Overall Total</option>
            <option value="branch">Compare by Branch</option>
            <option value="sku">Compare by SKU</option>
          </select>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)', fontSize: '0.85rem'
            }}
            disabled={groupBy === 'branch'}
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>

          <select
            value={filterSku}
            onChange={(e) => setFilterSku(e.target.value)}
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)', fontSize: '0.85rem'
            }}
            disabled={groupBy === 'sku'}
          >
            <option value="all">All SKUs</option>
            {skus.map(s => (
              <option key={s.id} value={s.sku}>{s.name} ({s.sku})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary mini-stats row */}
      {chartData.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          {[
            { label: 'Total Units', value: summaryStats.totalQty, icon: '📊' },
            { label: 'Days with Data', value: summaryStats.daysWithData, icon: '📅' },
            { label: 'Peak Day', value: summaryStats.peakDay || '—', icon: '🔥' },
            { label: 'Peak Volume', value: summaryStats.peakVal, icon: '📈' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-secondary)',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                {s.icon} {s.label}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={{ width: '100%', height: '350px' }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<CustomTooltip labelMap={labelMap} />}
                wrapperStyle={{ zIndex: 50 }}
              />
              {lineKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={labelMap[key] || key}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={hiddenKeys.has(key) ? 0 : 2}
                  dot={hiddenKeys.has(key) ? false : { r: 3, strokeWidth: 2, fill: 'var(--bg-primary)' }}
                  activeDot={hiddenKeys.has(key) ? false : { r: 6, strokeWidth: 0, fill: CHART_COLORS[index % CHART_COLORS.length] }}
                  hide={hiddenKeys.has(key)}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No preorder data matches the selected filters.
          </div>
        )}
      </div>

      {/* Custom Legend (click to toggle) */}
      {chartData.length > 0 && lineKeys.length > 1 && (
        <>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Click a label to show/hide its line
          </div>
          <ChartLegend
            lineKeys={lineKeys}
            labelMap={labelMap}
            hiddenKeys={hiddenKeys}
            onToggle={toggleKey}
          />
        </>
      )}

      {/* Single-line legend for total mode */}
      {chartData.length > 0 && lineKeys.length === 1 && (
        <div style={{ paddingTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '12px',
              height: '3px',
              borderRadius: '2px',
              background: CHART_COLORS[0],
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {labelMap[lineKeys[0]] || lineKeys[0]}
          </span>
        </div>
      )}
    </div>
  );
}
