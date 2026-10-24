interface AuditParams {
  actorId?: string | null;
  actorEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'INVITE' | 'ROLE_CHANGE' | 'TOGGLE' | 'UPLOAD';
  tableName: string;
  recordId?: string | null;
  recordLabel?: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}

// API v3.0 has no audit-log write endpoint. Keep existing callers harmless
// until the backend exposes one; never send writes to an unsupported resource.
export async function logAudit(_params: AuditParams): Promise<void> {
  return;
}
