export interface AccessCapabilities {
  readOnly: boolean;
  canCreateClient: boolean;
  canCreateProspect: boolean;
  canCreateEvent: boolean;
  canExportPrivateWealthReport: boolean;
  canImportClients: boolean;
}

function detectReadOnly(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const data = user as Record<string, unknown>;

  if (data.readOnly === true || data.isReadOnly === true) return true;

  if (typeof data.role === 'string') {
    const normalizedRole = data.role.toLowerCase();
    if (normalizedRole === 'viewer' || normalizedRole === 'readonly' || normalizedRole === 'read_only') {
      return true;
    }
  }

  if (data.permissions && typeof data.permissions === 'object') {
    const permissions = data.permissions as Record<string, unknown>;
    if (permissions.write === false || permissions.create === false) return true;
    if (permissions.app === 'read' || permissions.crm === 'read') return true;
  }

  return false;
}

function detectPrivateWealthExportPermission(user: unknown, readOnly: boolean): boolean {
  if (readOnly) return false;
  if (!user || typeof user !== 'object') return true;

  const data = user as Record<string, unknown>;

  const directFlags = [
    data.canExportPrivateWealthReport,
    data.canExportReports,
    data.canExport,
  ];

  for (const flag of directFlags) {
    if (typeof flag === 'boolean') return flag;
  }

  if (data.permissions && typeof data.permissions === 'object') {
    const permissions = data.permissions as Record<string, unknown>;
    const exportFlags = [
      permissions.export,
      permissions.exports,
      permissions.reportExport,
      permissions.privateWealthExport,
      permissions.private_wealth_export,
      permissions.pwExport,
    ];

    for (const flag of exportFlags) {
      if (typeof flag === 'boolean') return flag;
      if (typeof flag === 'string') {
        const normalized = flag.toLowerCase();
        if (normalized === 'none' || normalized === 'deny' || normalized === 'read') {
          return false;
        }
        if (normalized === 'write' || normalized === 'full' || normalized === 'export') {
          return true;
        }
      }
    }
  }

  return true;
}

function detectClientImportPermission(user: unknown, readOnly: boolean): boolean {
  if (readOnly) return false;
  if (!user || typeof user !== 'object') return true;

  const data = user as Record<string, unknown>;

  const directFlags = [
    data.canImportClients,
    data.canImportClient,
    data.canImport,
  ];

  for (const flag of directFlags) {
    if (typeof flag === 'boolean') return flag;
  }

  if (typeof data.role === 'string') {
    const role = data.role.toLowerCase();
    if (role === 'viewer' || role === 'readonly' || role === 'read_only') return false;
    if (role === 'advisor' || role === 'assessor' || role === 'admin' || role === 'owner') return true;
  }

  if (data.permissions && typeof data.permissions === 'object') {
    const permissions = data.permissions as Record<string, unknown>;
    const importFlags = [
      permissions.import,
      permissions.importClients,
      permissions.clientImport,
      permissions.clientsImport,
    ];

    for (const flag of importFlags) {
      if (typeof flag === 'boolean') return flag;
      if (typeof flag === 'string') {
        const normalized = flag.toLowerCase();
        if (normalized === 'none' || normalized === 'deny' || normalized === 'read') return false;
        if (normalized === 'write' || normalized === 'full' || normalized === 'import') return true;
      }
    }
  }

  return true;
}

export function resolveAccessCapabilities(user: unknown): AccessCapabilities {
  const readOnly = detectReadOnly(user);
  const canExportPrivateWealthReport = detectPrivateWealthExportPermission(user, readOnly);
  const canImportClients = detectClientImportPermission(user, readOnly);

  return {
    readOnly,
    canCreateClient: !readOnly,
    canCreateProspect: !readOnly,
    canCreateEvent: !readOnly,
    canExportPrivateWealthReport,
    canImportClients,
  };
}
