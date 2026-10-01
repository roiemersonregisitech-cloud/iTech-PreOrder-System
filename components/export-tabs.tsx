"use client";

import React, { useState } from "react";
import { ExportManager } from "./export-manager";
import { InventoryExportManager, type InventoryExportRow } from "./inventory-export-manager";

interface ExportTabsProps {
  isSuperAdmin: boolean;
  staffBranchName: string;
  preorders: any[];
  preorderBranches: string[];
  preorderSkus: string[];
  preorderStatuses: string[];
  inventory: InventoryExportRow[];
  inventoryBranches: string[];
  inventorySkus: string[];
}

export function ExportTabs({
  isSuperAdmin,
  staffBranchName,
  preorders,
  preorderBranches,
  preorderSkus,
  preorderStatuses,
  inventory,
  inventoryBranches,
  inventorySkus,
}: ExportTabsProps) {
  const [activeTab, setActiveTab] = useState<"inventory" | "preorders">("inventory");

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid var(--border-secondary)" }}>
        <button
          onClick={() => setActiveTab("inventory")}
          style={{
            padding: "0.75rem 1rem",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "inventory" ? "2px solid var(--accent-primary)" : "2px solid transparent",
            color: activeTab === "inventory" ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: activeTab === "inventory" ? 700 : 500,
            cursor: "pointer",
            fontSize: "1rem",
            transition: "all 0.2s"
          }}
        >
          Inventory Export
        </button>
        <button
          onClick={() => setActiveTab("preorders")}
          style={{
            padding: "0.75rem 1rem",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "preorders" ? "2px solid var(--accent-primary)" : "2px solid transparent",
            color: activeTab === "preorders" ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: activeTab === "preorders" ? 700 : 500,
            cursor: "pointer",
            fontSize: "1rem",
            transition: "all 0.2s"
          }}
        >
          Preorder Export
        </button>
      </div>

      {activeTab === "inventory" && (
        <InventoryExportManager
          data={inventory}
          branches={inventoryBranches}
          skus={inventorySkus}
          isSuperAdmin={isSuperAdmin}
          staffBranchName={staffBranchName}
        />
      )}

      {activeTab === "preorders" && (
        <ExportManager
          data={preorders}
          branches={preorderBranches}
          skus={preorderSkus}
          statuses={preorderStatuses}
          isSuperAdmin={isSuperAdmin}
          staffBranchName={staffBranchName}
        />
      )}
    </div>
  );
}
