import React, { useState } from 'react';
import { api } from '../lib/api.js';

// "Why flagged?" — AI explains the rule hits in plain words (rules still decide).
export default function FlagExplainer({ voucherId, compact }) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(false);
  const go = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (points) return;
    setLoading(true);
    try {
      const r = await api('/api/ai/explain', { method: 'POST', body: JSON.stringify({ voucher_id: voucherId }) });
      setPoints(r.points);
    } catch {
      setPoints(['Could not load the explanation — the flag details above still apply.']);
    } finally { setLoading(false); }
  };
  return (
    <span style={{ display: 'inline-block' }}>
      <button className="btn-ghost" style={{ padding: compact ? '4px 10px' : '6px 12px', fontSize: compact ? 12 : 13 }} onClick={go}>
        {open ? 'Hide why ✦' : 'Why flagged? ✦'}
      </button>
      {open && (
        <div className="pop-in" style={{ marginTop: 8, background: '#F7FEE7', border: '1.5px solid var(--line)', borderRadius: 12, padding: 12, maxWidth: 520 }}>
          {loading
            ? <span style={{ fontWeight: 700 }}>Reading the flags<span className="typing"><i /><i /><i /></span></span>
            : points.map((p, i) => <div key={i} style={{ fontSize: 13.5, padding: '3px 0' }}>✦ {p}</div>)}
        </div>
      )}
    </span>
  );
}
