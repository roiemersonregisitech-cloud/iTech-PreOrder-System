"use client";

import React, { useState, useMemo } from "react";

type PreorderRow = {
  id: string;
  preorder_code: string;
  status: string;
  invoice_no: string;
  remarks: string;
  created_at: string;
  branch_name: string;
  qty: number;
  customer_name: string;
  customer_contact: string;
  sku: string;
  product_name: string;
};

interface ExportManagerProps {
  data: PreorderRow[];
  branches: string[];
  skus: string[];
  statuses: string[];
  isSuperAdmin: boolean;
  staffBranchName: string;
}

export function ExportManager({ data, branches, skus, statuses, isSuperAdmin, staffBranchName }: ExportManagerProps) {
  const [filterBranch, setFilterBranch] = useState<string>(isSuperAdmin ? "all" : staffBranchName);
  const [filterSku, setFilterSku] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  const columns = [
    { key: "preorder_code", label: "Preorder Code" },
    { key: "created_at", label: "Date" },
    { key: "branch_name", label: "Branch" },
    { key: "customer_name", label: "Customer Name" },
    { key: "customer_contact", label: "Customer Contact" },
    { key: "sku", label: "SKU" },
    { key: "product_name", label: "Product Name" },
    { key: "qty", label: "Quantity" },
    { key: "invoice_no", label: "Invoice No" },
    { key: "remarks", label: "Remarks" },
    { key: "status", label: "Status" },
  ];

  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(columns.map((c) => c.key))
  );

  const toggleColumn = (key: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedColumns(newSelected);
  };

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (filterBranch !== "all" && row.branch_name !== filterBranch) return false;
      if (filterSku !== "all" && row.sku !== filterSku) return false;
      if (filterStatus !== "all" && row.status !== filterStatus) return false;
      
      if (filterStartDate) {
        const rowDate = new Date(row.created_at);
        const startDate = new Date(filterStartDate);
        startDate.setHours(0, 0, 0, 0);
        if (rowDate < startDate) return false;
      }
      
      if (filterEndDate) {
        const rowDate = new Date(row.created_at);
        const endDate = new Date(filterEndDate);
        endDate.setHours(23, 59, 59, 999);
        if (rowDate > endDate) return false;
      }
      
      return true;
    });
  }, [data, filterBranch, filterSku, filterStatus, filterStartDate, filterEndDate]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert("No data to export based on your current filters.");
      return;
    }

    const activeColumns = columns.filter((c) => selectedColumns.has(c.key));
    const header = activeColumns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");

    const rows = filteredData.map((row) => {
      return activeColumns
        .map((c) => {
          let val = row[c.key as keyof PreorderRow];
          if (val === null || val === undefined) val = "";
          if (c.key === "created_at" && val) {
            val = new Date(val).toLocaleString();
          }
          if (typeof val === "string") {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(",");
    });

    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `preorders_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-card" style={{ padding: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Filters Section */}
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>
            Data Filters
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                Date Range
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  style={{ width: "100%", padding: "0.625rem", borderRadius: "var(--radius-md)", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: "0.9rem" }}
                  title="Start Date"
                />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  style={{ width: "100%", padding: "0.625rem", borderRadius: "var(--radius-md)", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: "0.9rem" }}
                  title="End Date"
                />
              </div>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                Branch
              </label>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                disabled={!isSuperAdmin}
                style={{ width: "100%", padding: "0.625rem", borderRadius: "var(--radius-md)", background: !isSuperAdmin ? "var(--bg-tertiary)" : "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: "0.9rem", opacity: !isSuperAdmin ? 0.7 : 1 }}
              >
                {isSuperAdmin && <option value="all">All Branches</option>}
                {!isSuperAdmin && <option value={staffBranchName}>{staffBranchName}</option>}
                {isSuperAdmin && branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                Product / SKU
              </label>
              <select
                value={filterSku}
                onChange={(e) => setFilterSku(e.target.value)}
                style={{ width: "100%", padding: "0.625rem", borderRadius: "var(--radius-md)", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: "0.9rem" }}
              >
                <option value="all">All Products</option>
                {skus.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: "100%", padding: "0.625rem", borderRadius: "var(--radius-md)", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)", fontSize: "0.9rem" }}
              >
                <option value="all">All Statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Columns Section */}
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>
            Select Columns
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {columns.map((c) => (
              <label key={c.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedColumns.has(c.key)}
                  onChange={() => toggleColumn(c.key)}
                  style={{ accentColor: "var(--accent-primary)", width: "16px", height: "16px" }}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
          Rows to export: <strong style={{ color: "var(--text-primary)" }}>{filteredData.length}</strong>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredData.length === 0 || selectedColumns.size === 0}
          style={{
            padding: "0.625rem 1.5rem",
            background: filteredData.length === 0 || selectedColumns.size === 0 ? "var(--bg-tertiary)" : "var(--gradient-primary)",
            color: filteredData.length === 0 || selectedColumns.size === 0 ? "var(--text-muted)" : "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: filteredData.length === 0 || selectedColumns.size === 0 ? "not-allowed" : "pointer",
            transition: "all var(--transition-fast)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download CSV
        </button>
      </div>
    </div>
  );
}
