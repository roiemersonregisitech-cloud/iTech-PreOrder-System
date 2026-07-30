// Database types — mirroring the Supabase schema
// These are used across the entire app for type safety

export type UserRole = 'cashier' | 'branch_admin' | 'super_admin';
export type ReservationStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';
export type PreorderStatus = 'active' | 'fulfilled' | 'cancelled';
export type CancelReason = 'Customer changed mind' | 'Wrong item' | 'Duplicate reservation' | 'Other';
export type AllocationStatus = 'pending' | 'approved' | 'rejected';

export interface Branch {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit_price: number | null;
  central_qty: number;
  is_active: boolean;
  created_at: string;
}

export interface InventoryRow {
  id: string;
  branch_id: string;
  product_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  updated_at: string;
  // Derived
  qty_available?: number;
  // Joined
  product?: Product;
  branch?: Branch;
}

export interface Staff {
  id: string;
  branch_id: string | null;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  // Joined
  branch?: Branch;
}

export interface Reservation {
  id: string;
  branch_id: string;
  product_id: string;
  qty: number;
  cashier_id: string;
  customer_name: string | null;
  customer_contact: string | null;
  status: ReservationStatus;
  created_at: string;
  expires_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  idempotency_key: string | null;
  cancel_idempotency_key: string | null;
  // Joined
  product?: Product;
  branch?: Branch;
  cashier?: Staff;
  preorder?: {
    preorder_code: string;
    downpayment_amount: number;
  } | null;
}

export interface Preorder {
  id: string;
  reservation_id: string;
  branch_id: string;
  preorder_code: string;
  downpayment_amount: number;
  downpayment_received_at: string;
  status: PreorderStatus;
  created_by: string;
  created_at: string;
  idempotency_key: string | null;
  // Joined
  reservation?: Reservation;
  branch?: Branch;
}

export interface AllocationRequest {
  id: string;
  branch_id: string;
  product_id: string;
  requested_qty: number;
  reason: string | null;
  status: AllocationStatus;
  requested_by: string;
  processed_by: string | null;
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
  // Joined
  branch?: Branch;
  product?: Product;
  requester?: Staff;
  processor?: Staff;
}

export interface BranchSequence {
  branch_id: string;
  current_letter: string;
  current_number: number;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export interface BranchSetting {
  id: string;
  branch_id: string;
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Joined
  user?: Staff;
}

// API request/response types

export interface ReserveItemRequest {
  branch_id: string;
  product_id: string;
  qty: number;
  customer_name?: string;
  customer_contact?: string;
  idempotency_key: string;
}

export interface CancelReservationRequest {
  reason: CancelReason;
  idempotency_key: string;
}

export interface ConfirmPaymentRequest {
  amount: number;
  idempotency_key: string;
}

export interface ApiError {
  error: string;
  code?: string;
  message: string;
}
