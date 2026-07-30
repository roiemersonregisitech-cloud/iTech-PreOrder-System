import { NextRequest } from 'next/server';
import { UAParser } from 'ua-parser-js';
import { createServiceClient } from '@/lib/supabase/server';

interface AuditLogParams {
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  request: NextRequest;
}

/**
 * Writes an audit log entry with device/browser/IP info parsed from the request.
 * Always uses the service role client to bypass RLS.
 */
export async function writeAuditLog({
  userId,
  action,
  entityType,
  entityId,
  metadata,
  request,
}: AuditLogParams): Promise<void> {
  const supabase = await createServiceClient();

  // Extract IP: Cloudflare → x-forwarded-for → fallback
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Parse user agent
  const userAgentString = request.headers.get('user-agent') || '';
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  const deviceType = result.device.type || 'desktop'; // undefined = desktop
  const browser = result.browser.name
    ? `${result.browser.name} ${result.browser.version || ''}`
    : 'unknown';
  const os = result.os.name
    ? `${result.os.name} ${result.os.version || ''}`
    : 'unknown';

  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType || null,
    entity_id: entityId || null,
    ip_address: ip,
    user_agent: userAgentString,
    device_type: deviceType,
    browser: browser.trim(),
    os: os.trim(),
    metadata: metadata || null,
  });

  if (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw — audit log failure should not block the request
  }
}
