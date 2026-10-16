// Central role/permission helpers — mirrors server presets + per-user overrides.
export const isAdmin = me => !!me?.is_admin;

const ROLE_DEFAULTS = {
  admin: ['voucher.create', 'voucher.edit', 'voucher.submit', 'voucher.approve', 'voucher.cancel', 'bill.upload', 'ai.ask', 'report.view', 'ledger.create', 'export', 'approvals'],
  accountant: ['voucher.create', 'voucher.edit', 'voucher.submit', 'voucher.approve', 'bill.upload', 'ai.ask', 'report.view', 'ledger.create', 'export', 'approvals'],
  data_entry: ['voucher.create', 'voucher.submit', 'bill.upload', 'report.view'],
  viewer: ['report.view'],
};

export function hasPerm(me, perm) {
  if (!me) return false;
  if (me.is_admin) return true;
  const p = me.permissions || {};
  if (p[perm] === true) return true;
  const [ns, act] = String(perm).split('.');
  if (p[ns]?.[act] === true || p[ns] === true) return true;
  return false;
}

export function can(me, perm) {
  if (!me) return false;
  if (hasPerm(me, perm)) return true;
  return (ROLE_DEFAULTS[me.role_preset] || []).includes(perm);
}

export const canApprove = me => can(me, 'voucher.approve') || can(me, 'approvals');
export const canUpload = me => can(me, 'bill.upload');
export const canAsk = me => can(me, 'ai.ask');
export const canCreateVoucher = me => can(me, 'voucher.create');
export const canVouchers = me => !!me && (me.is_admin || me.role_preset !== 'viewer');
export const canAlerts = me => !!me && (me.is_admin || me.role_preset !== 'viewer');
export const canReports = me => can(me, 'report.view');

// Admin assigns modules by label; accept legacy aliases.
export function inModule(me, ...labels) {
  if (!me) return false;
  if (me.is_admin) return true;
  const mods = me.permissions?.modules;
  if (!Array.isArray(mods)) return true;
  const norm = mods.map(m => String(m).toLowerCase());
  return labels.some(l => norm.includes(String(l).toLowerCase()));
}

export const MODULES = ['Dashboard', 'Vouchers', 'Upload Bill', 'Ask AI', 'Alerts', 'Reports'];

export function roleLabel(me) {
  if (me?.is_admin) return 'Admin';
  return { accountant: 'Accountant', data_entry: 'Data entry', viewer: 'Viewer' }[me?.role_preset] || me?.role_preset;
}
