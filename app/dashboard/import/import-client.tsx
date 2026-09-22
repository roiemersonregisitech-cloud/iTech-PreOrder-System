'use client';

import React, { useState, useRef } from 'react';
import { ActionButton } from '@/components/ui';

// Basic robust CSV parser
function parseCSV(text: string) {
  const result = [];
  let row = [];
  let inQuotes = false;
  let val = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"' && inQuotes && nextChar === '"') {
      val += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(val.trim());
      val = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(val.trim());
      result.push(row);
      row = [];
      val = '';
    } else {
      val += char;
    }
  }
  row.push(val.trim());
  result.push(row);
  return result.filter(r => r.some(v => v !== '')); // remove empty rows
}

const TEMPLATES = {
  products: "SKU,Name,Description,UnitPrice\nPROD-01,Sample Product,Description here,1000",
  branches: "Code,Name\nBR-01,Sample Branch",
  inventory: "SKU,AddCentralQty,AllocateBranchCode,AllocateQty\nPROD-01,50,BR-01,10"
};

export default function ImportClient() {
  const [activeTab, setActiveTab] = useState<'products'|'branches'|'inventory'>('products');
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csv = TEMPLATES[activeTab];
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeTab}_template.csv`;
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    setParsedData(null);
    
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setError("CSV must contain headers and at least one data row.");
          return;
        }
        
        const headerRow = rows[0].map(h => h.replace(/^[\uFEFF\xA0]+|[\uFEFF\xA0]+$/g, '').trim()); // Strip BOM just in case
        setHeaders(headerRow);
        
        const dataObjects = rows.slice(1).map(row => {
          const obj: Record<string, string> = {};
          headerRow.forEach((h, i) => {
            obj[h] = row[i] || '';
          });
          return obj;
        });
        
        setParsedData(dataObjects);
      } catch (err: any) {
        setError(`Failed to parse CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return;
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          data: parsedData
        })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');
      
      setSuccess(json.message || 'Import successful!');
      setParsedData(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const switchTab = (tab: 'products'|'branches'|'inventory') => {
    setActiveTab(tab);
    setParsedData(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Import Data</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Upload bulk data for products, branches, or inventory stock.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-secondary)' }}>
        {(['products', 'branches', 'inventory'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab ? 700 : 500,
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'capitalize' }}>
              Import {activeTab}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Download the template, fill it out, and upload the CSV file.
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            style={{
              padding: '0.6rem 1rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600
            }}
          >
            ↓ Download Template
          </button>
        </div>

        <div style={{ border: '2px dashed var(--border-primary)', padding: '2rem', textAlign: 'center', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
            id="csv-upload"
          />
          <label htmlFor="csv-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>Click to upload CSV</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>Only .csv files are supported</span>
          </label>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-success)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {success}
          </div>
        )}

        {parsedData && parsedData.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Preview ({parsedData.length} rows)
            </h4>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-secondary)' }}>
                    {headers.map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                      {headers.map(h => (
                        <td key={h} style={{ padding: '0.5rem 1rem', color: 'var(--text-primary)' }}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 5 && (
                <div style={{ padding: '0.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', background: 'var(--bg-tertiary)' }}>
                  Showing first 5 rows...
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ActionButton
                id="submit-import"
                label={`Import ${parsedData.length} rows`}
                loadingLabel="Importing..."
                variant="primary"
                onClick={handleImport}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
