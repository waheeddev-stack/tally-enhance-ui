// Client-side CSV export (CA handoffs, audit trails) — no server round-trip.
export function downloadCSV(filename, rows) {
  if (!rows?.length) return false;
  const cols = Object.keys(rows[0]).filter(k => k !== 'file_blob');
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}
