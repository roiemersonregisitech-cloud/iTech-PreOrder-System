"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Spinner, Modal, ActionButton, Pagination, SkeletonTable } from "@/components/ui";
import type {
  AllocationRequest,
  Branch,
  Product,
  InventoryRow,
  Staff,
} from "@/lib/types";

export default function AllocationsPage() {
  const [requests, setRequests] = useState<AllocationRequest[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  // Pagination for Requests
  const [reqPage, setReqPage] = useState(1);
  const [reqPageSize, setReqPageSize] = useState(6);
  const [reqTotalItems, setReqTotalItems] = useState(0);

  // Pagination for Inventory Overview
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(6);

  // Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqBranchId, setReqBranchId] = useState("");
  const [reqProductId, setReqProductId] = useState("");
  const [reqQty, setReqQty] = useState(1);
  const [reqReason, setReqReason] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);

  // Direct Allocation Modal State (Super Admin)
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [dirBranchId, setDirBranchId] = useState("");
  const [dirProductId, setDirProductId] = useState("");
  const [dirAction, setDirAction] = useState<"add" | "reclaim">("add");
  const [dirQty, setDirQty] = useState(1);
  const [dirReason, setDirReason] = useState("");
  const [dirError, setDirError] = useState("");
  const [dirSubmitting, setDirSubmitting] = useState(false);

  // Approve / Reject Modal State (Super Admin)
  const [actionModal, setActionModal] = useState<{
    id: string;
    type: "approve" | "reject";
    request?: AllocationRequest;
  } | null>(null);
  const [approvedQty, setApprovedQty] = useState<number>(1);
  const [sourceType, setSourceType] = useState<"central" | "branch">("central");
  const [sourceBranchId, setSourceBranchId] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  // Fetch Current User Staff Info
  const fetchStaff = useCallback(async () => {
    const res = await fetch("/api/staff/me");
    if (res.ok) {
      const data = await res.json();
      setCurrentStaff(data.staff);
      if (data.staff.branch_id) {
        setReqBranchId(data.staff.branch_id);
      }
    }
  }, []);

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (branchFilter) params.set("branch_id", branchFilter);
    params.set("page", reqPage.toString());
    params.set("limit", reqPageSize.toString());
    const res = await fetch(`/api/allocations?${params}`);
    const data = await res.json();
    if (res.ok) {
      setRequests(data.data || []);
      setReqTotalItems(data.pagination?.total || 0);
    }
  }, [statusFilter, branchFilter, reqPage, reqPageSize]);

  // Fetch Auxiliary Data
  const fetchData = useCallback(async () => {
    const [bRes, pRes, iRes] = await Promise.all([
      fetch("/api/branches"),
      fetch("/api/products"),
      fetch("/api/inventory"),
    ]);
    const [bData, pData, iData] = await Promise.all([
      bRes.json(),
      pRes.json(),
      iRes.json(),
    ]);

    if (bRes.ok && bData.data) {
      setBranches(bData.data);
      if (bData.data.length > 0) {
        setDirBranchId((prev) => prev || bData.data[0].id);
      }
    }
    if (pRes.ok && pData.data) {
      setProducts(pData.data);
      if (pData.data.length > 0) {
        setReqProductId((prev) => prev || pData.data[0].id);
        setDirProductId((prev) => prev || pData.data[0].id);
      }
    }
    if (iRes.ok && iData.data) {
      setInventory(iData.data);
    }
  }, []);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      await Promise.all([fetchStaff(), fetchRequests(), fetchData()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    setReqPage(1);
    fetchRequests();
  }, [statusFilter, branchFilter, fetchRequests]);

  useEffect(() => {
    if (!initialized.current) return;
    fetchRequests();
  }, [reqPage, reqPageSize, fetchRequests]);

  const isSuperAdmin = currentStaff?.role === "super_admin";
  const isBranchAdmin = currentStaff?.role === "branch_admin" || isSuperAdmin;

  // Submit Stock Request
  async function handleCreateRequest(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setReqError("");
    setReqSubmitting(true);

    const targetBranch = isSuperAdmin ? reqBranchId : currentStaff?.branch_id;
    if (!targetBranch) {
      setReqError("No branch selected");
      setReqSubmitting(false);
      return;
    }

    const res = await fetch("/api/allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch_id: targetBranch,
        product_id: reqProductId,
        requested_qty: reqQty,
        reason: reqReason,
      }),
    });

    const data = await res.json();
    setReqSubmitting(false);

    if (!res.ok) {
      setReqError(data.error || "Failed to submit request");
      return;
    }

    setShowRequestModal(false);
    setReqQty(1);
    setReqReason("");
    fetchRequests();
  }

  // Submit Direct Allocation (Add / Reclaim)
  async function handleDirectAllocation(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setDirError("");
    setDirSubmitting(true);

    const res = await fetch("/api/allocations/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch_id: dirBranchId,
        product_id: dirProductId,
        action: dirAction,
        qty: dirQty,
        reason: dirReason,
      }),
    });

    const data = await res.json();
    setDirSubmitting(false);

    if (!res.ok) {
      setDirError(
        data.error || "Failed to execute direct allocation adjustment",
      );
      return;
    }

    setShowDirectModal(false);
    setDirQty(1);
    setDirReason("");
    fetchRequests();
    fetchData();
  }

  // Process Approval / Rejection
  async function handleProcessAction() {
    if (!actionModal) return;
    setActionError("");

    if (actionModal.type === "approve") {
      if (approvedQty <= 0) {
        setActionError("Approved quantity must be positive");
        return;
      }
      if (sourceType === "branch" && !sourceBranchId) {
        setActionError("Please select a source branch");
        return;
      }
    }

    setActionSubmitting(true);

    const endpoint = `/api/allocations/${actionModal.id}/${actionModal.type}`;
    const payload =
      actionModal.type === "approve"
        ? {
            approved_qty: approvedQty,
            source_type: sourceType,
            source_branch_id: sourceBranchId || null,
            admin_notes: adminNotes,
          }
        : { admin_notes: adminNotes };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setActionSubmitting(false);

    if (!res.ok) {
      setActionError(data.error || `Failed to ${actionModal.type} request`);
      return;
    }

    setActionModal(null);
    setAdminNotes("");
    fetchRequests();
    fetchData();
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-heading)" }}>Allocations</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading stock requests and inventory allocations…</p>
        </div>
        <SkeletonTable rows={6} columns={6} />
      </div>
    );
  }

  // Calculate live math prediction for Approval Modal
  const activeReq = actionModal?.request;
  const activeProduct = activeReq
    ? products.find((p) => p.id === activeReq.product_id)
    : null;
  const activeTargetBranch = activeReq
    ? branches.find((b) => b.id === activeReq.branch_id)
    : null;

  const centralAvailable = activeProduct?.central_qty || 0;

  const sourceBranchInv =
    sourceType === "branch" && activeReq && sourceBranchId
      ? inventory.find(
          (i) =>
            i.branch_id === sourceBranchId &&
            (i.product as Product)?.id === activeReq.product_id,
        )
      : null;
  const sourceBranchAvailable = sourceBranchInv
    ? sourceBranchInv.qty_on_hand - sourceBranchInv.qty_reserved
    : 0;

  const maxAvailable =
    sourceType === "central" ? centralAvailable : sourceBranchAvailable;
  const isApprovalMathInvalid =
    actionModal?.type === "approve" &&
    (approvedQty <= 0 || approvedQty > maxAvailable);

  // Pagination Math
  const reqTotalPages = Math.ceil(reqTotalItems / reqPageSize);

  const filteredInventory = inventory.filter((inv) => !branchFilter || inv.branch_id === branchFilter);
  const invTotalPages = Math.ceil(filteredInventory.length / invPageSize);
  const paginatedInventory = filteredInventory.slice((invPage - 1) * invPageSize, invPage * invPageSize);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "var(--text-heading)",
            }}
          >
            Product Allocations
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Manage branch stock allocations and allocation request workflows
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {isBranchAdmin && (
            <button
              id="request-allocation-btn"
              onClick={() => setShowRequestModal(true)}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "var(--accent-primary)",
                color: "white",
                border: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Request Stock Allocation
            </button>
          )}

          {isSuperAdmin && (
            <button
              id="direct-allocation-btn"
              onClick={() => setShowDirectModal(true)}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Direct Stock Adjustment
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {["", "pending", "approved", "rejected"].map((st) => (
            <button
              key={st}
              id={`filter-status-${st || "all"}`}
              onClick={() => { setStatusFilter(st); setReqPage(1); }}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "9999px",
                background:
                  statusFilter === st
                    ? "var(--accent-primary)"
                    : "var(--bg-tertiary)",
                color: statusFilter === st ? "white" : "var(--text-secondary)",
                border:
                  statusFilter === st
                    ? "none"
                    : "1px solid var(--border-primary)",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {st || "All Status"}
            </button>
          ))}
        </div>

        <select
          id="filter-branch-select"
          value={branchFilter}
          onChange={(e) => { setBranchFilter(e.target.value); setReqPage(1); setInvPage(1); }}
          style={{
            padding: "0.4rem 0.8rem",
            background: "var(--bg-input)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-primary)",
            fontSize: "0.8rem",
            outline: "none",
          }}
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code})
            </option>
          ))}
        </select>
      </div>

      {/* Request Cards */}
      <div style={{ marginBottom: "2rem" }}>
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--text-heading)",
            marginBottom: "1rem",
          }}
        >
          Allocation Requests ({requests.length})
        </h2>

        {requests.length === 0 ? (
          <div
            className="glass-card"
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            No allocation requests found
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: "1rem",
              }}
            >
              {requests.map((r) => {
                const product = r.product as Product;
                const branch = r.branch as Branch;
                const requester = r.requester as Staff;
                const processor = r.processor as Staff;

                const statusColors = {
                  pending: {
                    bg: "rgba(245, 158, 11, 0.1)",
                    text: "var(--accent-warning)",
                  },
                  approved: {
                    bg: "rgba(34, 197, 94, 0.1)",
                    text: "var(--accent-success)",
                  },
                  rejected: {
                    bg: "rgba(239, 68, 68, 0.1)",
                    text: "var(--accent-danger)",
                  },
                };

                return (
                  <div
                    key={r.id}
                    className="glass-card"
                    style={{
                      padding: "1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      {/* Header: Item Name & Status */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.95rem",
                              color: "var(--text-heading)",
                            }}
                          >
                            {product?.name || "Product"}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            SKU: {product?.sku || "N/A"}
                          </div>
                        </div>

                        <span
                          style={{
                            padding: "0.2rem 0.6rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: statusColors[r.status].bg,
                            color: statusColors[r.status].text,
                          }}
                        >
                          {r.status}
                        </span>
                      </div>

                      {/* Branch Info */}
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-primary)",
                          marginBottom: "0.5rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Target Branch: {branch?.name || "Branch"} (
                        {branch?.code || "N/A"})
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "0.4rem",
                          fontSize: "0.8rem",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>
                            Requested Qty:{" "}
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: "var(--accent-info)",
                            }}
                          >
                            {r.requested_qty}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>
                            Requested By:{" "}
                          </span>
                          {requester?.full_name || "Staff"}
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <span style={{ color: "var(--text-muted)" }}>
                            Date:{" "}
                          </span>
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                        {r.reason && (
                          <div
                            style={{
                              gridColumn: "1 / -1",
                              fontStyle: "italic",
                              color: "var(--text-secondary)",
                            }}
                          >
                            &quot;{r.reason}&quot;
                          </div>
                        )}
                      </div>

                      {/* Processing Status Info */}
                      {r.status !== "pending" && (
                        <div
                          style={{
                            padding: "0.5rem 0.75rem",
                            borderRadius: "var(--radius-sm)",
                            background:
                              r.status === "approved"
                                ? "rgba(16, 185, 129, 0.08)"
                                : "rgba(239, 68, 68, 0.08)",
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <div>
                            <strong>Processed By:</strong>{" "}
                            {processor?.full_name || "Super Admin"}
                          </div>
                          {r.processed_at && (
                            <div>
                              <strong>Date:</strong>{" "}
                              {new Date(r.processed_at).toLocaleString()}
                            </div>
                          )}
                          {r.admin_notes && (
                            <div>
                              <strong>Notes:</strong> {r.admin_notes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Super Admin Actions */}
                      {isSuperAdmin && r.status === "pending" && (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            paddingTop: "0.5rem",
                            borderTop: "1px solid var(--border-secondary)",
                          }}
                        >
                          <ActionButton
                            id={`approve-req-${r.id}`}
                            label="Process / Approve"
                            loadingLabel="Approving…"
                            variant="primary"
                            onClick={async () => {
                              setActionModal({
                                id: r.id,
                                type: "approve",
                                request: r,
                              });
                              setApprovedQty(r.requested_qty);
                              setSourceType("central");
                              const otherBranch = branches.find(
                                (b) => b.id !== r.branch_id,
                              );
                              setSourceBranchId(otherBranch ? otherBranch.id : "");
                              setAdminNotes("");
                              setActionError("");
                            }}
                            style={{ flex: 1 }}
                          />
                          <ActionButton
                            id={`reject-req-${r.id}`}
                            label="Reject"
                            loadingLabel="Rejecting…"
                            variant="danger"
                            onClick={async () => {
                              setActionModal({
                                id: r.id,
                                type: "reject",
                                request: r,
                              });
                              setAdminNotes("");
                              setActionError("");
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={reqPage}
              totalPages={reqTotalPages}
              totalItems={reqTotalItems}
              pageSize={reqPageSize}
              onPageChange={setReqPage}
              onPageSizeChange={(size) => { setReqPageSize(size); setReqPage(1); }}
              pageSizeOptions={[6, 12, 24, 48]}
            />
          </>
        )}
      </div>

      {/* Current Branch Allocated Inventory Overview */}
      <div>
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--text-heading)",
            marginBottom: "1rem",
          }}
        >
          Current Allocated Inventory Overview
        </h2>
        {filteredInventory.length === 0 ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No allocated inventory rows
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {paginatedInventory.map((inv) => {
                const prod = inv.product as Product;
                const br = inv.branch as Branch;
                const avail = inv.qty_on_hand - inv.qty_reserved;
                return (
                  <div
                    key={inv.id}
                    className="glass-card"
                    style={{ padding: "1rem" }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: "var(--text-heading)",
                      }}
                    >
                      {prod?.name || "Item"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {br?.name} • SKU: {prod?.sku}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8rem",
                        borderTop: "1px solid var(--border-secondary)",
                        paddingTop: "0.4rem",
                      }}
                    >
                      <div>
                        Allocated (On Hand):{" "}
                        <strong style={{ color: "var(--text-primary)" }}>
                          {inv.qty_on_hand}
                        </strong>
                      </div>
                      <div>
                        Available:{" "}
                        <strong style={{ color: "var(--accent-success)" }}>
                          {avail}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={invPage}
              totalPages={invTotalPages}
              totalItems={filteredInventory.length}
              pageSize={invPageSize}
              onPageChange={setInvPage}
              onPageSizeChange={setInvPageSize}
              pageSizeOptions={[6, 12, 24, 48]}
            />
          </>
        )}
      </div>

      {/* Request Stock Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request Stock Allocation"
      >
        <form onSubmit={handleCreateRequest}>
          {isSuperAdmin && (
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "0.4rem",
                }}
              >
                Target Branch
              </label>
              <select
                id="req-branch-select"
                value={reqBranchId}
                onChange={(e) => setReqBranchId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Select Product
            </label>
            <select
              id="req-product-select"
              value={reqProductId}
              onChange={(e) => setReqProductId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Requested Quantity
            </label>
            <input
              id="req-qty-input"
              type="number"
              min="1"
              value={reqQty}
              onChange={(e) => setReqQty(parseInt(e.target.value) || 1)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Reason / Notes
            </label>
            <textarea
              id="req-reason-input"
              rows={3}
              value={reqReason}
              onChange={(e) => setReqReason(e.target.value)}
              placeholder="e.g. Expected weekend rush, customer preorders…"
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          {reqError && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "var(--radius-sm)",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--accent-danger)",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              {reqError}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={() => setShowRequestModal(false)}
              style={{
                padding: "0.5rem 1rem",
                background: "transparent",
                border: "1px solid var(--border-primary)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <ActionButton
              id="submit-request-btn"
              label="Submit Request"
              loadingLabel="Submitting…"
              variant="primary"
              onClick={handleCreateRequest}
              disabled={reqSubmitting}
            />
          </div>
        </form>
      </Modal>

      {/* Direct Allocation Modal */}
      <Modal
        isOpen={showDirectModal}
        onClose={() => setShowDirectModal(false)}
        title="Direct Stock Adjustment"
      >
        <form onSubmit={handleDirectAllocation}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Adjustment Action
            </label>
            <div style={{ display: "flex", gap: "1rem" }}>
              <label
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <input
                  type="radio"
                  name="dirAction"
                  value="add"
                  checked={dirAction === "add"}
                  onChange={() => setDirAction("add")}
                />
                Add Stock to Branch
              </label>
              <label
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <input
                  type="radio"
                  name="dirAction"
                  value="reclaim"
                  checked={dirAction === "reclaim"}
                  onChange={() => setDirAction("reclaim")}
                />
                Reclaim Stock from Branch
              </label>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Target Branch
            </label>
            <select
              id="dir-branch-select"
              value={dirBranchId}
              onChange={(e) => setDirBranchId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Select Product
            </label>
            <select
              id="dir-product-select"
              value={dirProductId}
              onChange={(e) => setDirProductId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Quantity to {dirAction === "add" ? "Add" : "Reclaim"}
            </label>
            <input
              id="dir-qty-input"
              type="number"
              min="1"
              value={dirQty}
              onChange={(e) => setDirQty(parseInt(e.target.value) || 1)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Reason / Admin Note
            </label>
            <textarea
              id="dir-reason-input"
              rows={2}
              value={dirReason}
              onChange={(e) => setDirReason(e.target.value)}
              placeholder="Reason for manual adjustment…"
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          {dirError && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "var(--radius-sm)",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--accent-danger)",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              {dirError}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={() => setShowDirectModal(false)}
              style={{
                padding: "0.5rem 1rem",
                background: "transparent",
                border: "1px solid var(--border-primary)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <ActionButton
              id="execute-direct-btn"
              label={
                dirAction === "add" ? "Add Allocation" : "Reclaim Allocation"
              }
              loadingLabel="Executing…"
              variant={dirAction === "add" ? "primary" : "danger"}
              onClick={handleDirectAllocation}
              disabled={dirSubmitting}
            />
          </div>
        </form>
      </Modal>

      {/* Approve / Reject Modal */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => setActionModal(null)}
        title={`${actionModal?.type === "approve" ? "Approve Stock Request" : "Reject Allocation Request"}`}
      >
        <div>
          {actionModal?.type === "approve" && activeReq && (
            <div>
              {/* Summary Card */}
              <div
                style={{
                  padding: "0.8rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-tertiary)",
                  marginBottom: "1rem",
                  fontSize: "0.85rem",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: "var(--text-heading)",
                    marginBottom: "0.2rem",
                  }}
                >
                  {activeProduct?.name} ({activeProduct?.sku})
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  Requesting Branch:{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {activeTargetBranch?.name}
                  </strong>{" "}
                  • Originally Requested:{" "}
                  <strong style={{ color: "var(--accent-info)" }}>
                    {activeReq.requested_qty}
                  </strong>
                </div>
              </div>

              {/* Quantity to Approve Field */}
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "0.4rem",
                  }}
                >
                  Quantity to Approve (Can override requested count)
                </label>
                <input
                  id="approve-qty-input"
                  type="number"
                  min={1}
                  value={approvedQty}
                  onChange={(e) => setApprovedQty(parseInt(e.target.value) || 0)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    fontSize: '1rem',
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              </div>

              {/* Source Selection */}
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "0.4rem",
                  }}
                >
                  Stock Source
                </label>
                <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem" }}>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="sourceType"
                      value="central"
                      checked={sourceType === "central"}
                      onChange={() => setSourceType("central")}
                    />
                    Central Warehouse (Avail: {centralAvailable})
                  </label>

                  <label
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="sourceType"
                      value="branch"
                      checked={sourceType === "branch"}
                      onChange={() => setSourceType("branch")}
                    />
                    Transfer from another branch
                  </label>
                </div>

                {sourceType === "branch" && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginBottom: "0.3rem",
                      }}
                    >
                      Select Source Branch
                    </label>
                    <select
                      id="source-branch-select"
                      value={sourceBranchId}
                      onChange={(e) => setSourceBranchId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.8rem",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-primary)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    >
                      <option value="">-- Select Source Branch --</option>
                      {branches
                        .filter((b) => b.id !== activeReq.branch_id)
                        .map((b) => {
                          const brInv = inventory.find(
                            (i) =>
                              i.branch_id === b.id &&
                              (i.product as Product)?.id === activeReq.product_id,
                          );
                          const avail = brInv
                            ? brInv.qty_on_hand - brInv.qty_reserved
                            : 0;
                          return (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.code}) — {avail} available
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}
              </div>

              {/* Math Prediction Card */}
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  background: isApprovalMathInvalid
                    ? "rgba(239, 68, 68, 0.08)"
                    : "rgba(34, 197, 94, 0.08)",
                  border: isApprovalMathInvalid
                    ? "1px solid rgba(239, 68, 68, 0.3)"
                    : "1px solid rgba(34, 197, 94, 0.3)",
                  fontSize: "0.8rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>
                  Live Stock Math Preview:
                </div>
                <div>
                  • Source ({sourceType === "central" ? "Central Warehouse" : "Source Branch"}):{" "}
                  <strong>{maxAvailable}</strong> →{" "}
                  <strong
                    style={{
                      color:
                        maxAvailable - approvedQty < 0
                          ? "var(--accent-danger)"
                          : "var(--accent-success)",
                    }}
                  >
                    {maxAvailable - approvedQty} available
                  </strong>
                </div>
                {isApprovalMathInvalid && (
                  <div
                    style={{
                      color: "var(--accent-danger)",
                      fontWeight: 700,
                      marginTop: "0.3rem",
                    }}
                  >
                    ⚠️ Math Invalid: Approved quantity exceeds source available stock!
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.4rem",
              }}
            >
              Admin Notes / Remarks
            </label>
            <textarea
              id="admin-notes-input"
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add remarks for the branch team…"
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "var(--bg-input)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          {actionError && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "var(--radius-sm)",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--accent-danger)",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              {actionError}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={() => setActionModal(null)}
              style={{
                padding: "0.5rem 1rem",
                background: "transparent",
                border: "1px solid var(--border-primary)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <ActionButton
              id="confirm-action-btn"
              label={`Confirm ${actionModal?.type === "approve" ? "Approval" : "Rejection"}`}
              loadingLabel="Processing…"
              variant={actionModal?.type === "approve" ? "primary" : "danger"}
              onClick={handleProcessAction}
              disabled={actionSubmitting || (actionModal?.type === "approve" && isApprovalMathInvalid)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
