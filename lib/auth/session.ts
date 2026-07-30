import { createClient } from '@/lib/supabase/server';
import { type Staff, type UserRole } from '@/lib/types';

export interface SessionInfo {
  userId: string;
  email: string;
  staff: Staff;
}

/**
 * Gets the current authenticated user's session and staff record.
 * Returns null if not authenticated or staff record not found.
 */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('*, branch:branches(*)')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (staffError || !staff) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email || '',
    staff: staff as Staff,
  };
}

/**
 * Requires a specific minimum role level.
 * Role hierarchy: cashier < branch_admin < super_admin
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    cashier: 1,
    branch_admin: 2,
    super_admin: 3,
  };

  return hierarchy[userRole] >= hierarchy[requiredRole];
}

/**
 * Checks if the user can access a specific branch's data.
 * super_admin can access any branch.
 */
export function canAccessBranch(
  staff: Staff,
  branchId: string
): boolean {
  if (staff.role === 'super_admin') return true;
  return staff.branch_id === branchId;
}
