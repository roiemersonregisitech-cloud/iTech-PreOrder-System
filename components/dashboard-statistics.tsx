'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

export function DashboardStatistics({ preorders, branches, skus }: DashboardStatisticsProps) {
  const [groupBy, setGroupBy] = useState<'total' | 'branch' | 'sku'>('total');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterSku, setFilterSku] = useState<string>('all');

  const chartData = useMemo(() => {
    const groupedByDate: Record<string, { date: string; Total: number; [key: string]: string | number }> = {};
    
    // Sort preorders by date first
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

      // Group by selected mode
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

  // Generate distinct colors
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
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
            onChange={(e) => setGroupBy(e.target.value as 'total' | 'branch' | 'sku')}
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

      <div style={{ width: '100%', height: '350px' }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }} />
              {lineKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2, fill: 'var(--bg-primary)' }}
                  activeDot={{ r: 6 }}
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
    </div>
  );
}
