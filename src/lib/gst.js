// Central GST default: 18% when no external GST value is provided.
// 0% is a valid explicit rate (exempt/nil) and is preserved — only
// missing/blank/invalid values fall back to 18.
export const DEFAULT_GST_RATE = 18;

export function normGstRate(v) {
  if (v === '' || v === null || v === undefined) return DEFAULT_GST_RATE;
  const n = Number(v);
  return Number.isFinite(n) ? n : DEFAULT_GST_RATE;
}
