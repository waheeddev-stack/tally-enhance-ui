import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Alerts() {
  const [rows, setRows] = useState([]);
  const nav = useNavigate();
  const load = () => api('/anomalies').then(r => setRows(r.anomalies)).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="serif" style={{ fontSize: 36 }}>Alerts</div>
      <p className="muted">Deterministic rules; the model only writes explanations.</p>
      {rows.map(a => (
        <div key={a.id} className="card" style={{ marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={`dot ${a.severity}`} />
          <div style={{ flex: 1 }}><b>{a.rule_code}</b> <span className="muted">· {a.severity} · {a.voucher_number} ({a.type})</span><div>{a.message}</div></div>
          <button className="btn-ghost" onClick={() => nav('/vouchers/' + a.voucher_id)}>Open</button>
          <button className="btn-ghost" onClick={async () => { await api('/anomalies/' + a.id + '/resolve', { method: 'POST' }); load(); }}>Resolve</button>
        </div>
      ))}
      {rows.length === 0 && <p className="muted">All clear — no open flags.</p>}
    </div>
  );
}
