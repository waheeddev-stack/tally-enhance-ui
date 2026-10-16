import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, inr } from '../lib/api.js';
import { downloadCSV } from '../lib/csv.js';
import { toast } from '../components/Toast.jsx';
import { canCreateVoucher } from '../lib/roles.js';
import { api as _api } from '../lib/api.js';

export default function Vouchers() {
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const nav = useNavigate();
  const load = () => {
    _api(`/vouchers?${new URLSearchParams({ q, status, mine: mine ? '1' : '' }).toString()}`)
      .then(r => setRows(r.vouchers)).catch(() => {});
  };
  useEffect(() => { api('/me').then(r => setMe(r.user)).catch(() => {}); load(); }, []);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div className="serif" style={{ fontSize: 36 }}>Vouchers <span className="sticker" style={{ fontSize: 12, verticalAlign: 'middle' }}>F9 = speed ⚡</span></div>
        {canCreateVoucher(me) && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => nav('/vouchers/new')}>+ New voucher <kbd>F9</kbd></button>}
      </div>
      <p className="muted">Day Book · double-entry, balanced before save · pending items carry a tag until approved.</p>
      <div className="topbar">
        <input className="input" placeholder="Search number / party…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ maxWidth: 260 }} />
        <select className="select" value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">All status</option><option value="draft">Draft</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="cancelled">Cancelled</option>
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Only mine
        </label>
        <button className="btn-ghost" onClick={load}>Search</button>
        {rows.length > 0 && <button className="btn-ghost" onClick={() => { downloadCSV('vouchers.csv', rows); toast('Day Book exported', 'ok'); }}>↓ Export</button>}
      </div>
      <div className="card" style={{ padding: 6 }}>
        <table className="table"><thead><tr><th>Date</th><th>Type</th><th>Number</th><th>Party</th><th>Total</th><th>By</th><th>Status</th></tr></thead>
          <tbody>{rows.map(v => (
            <tr key={v.id} onClick={() => nav('/vouchers/' + v.id)}>
              <td className="mono">{v.date}</td><td>{v.type}</td><td className="mono">{v.number}</td><td>{v.party_name}</td><td className="mono">{inr(v.total)}</td>
              <td className="muted" style={{ fontSize: 12 }}>{v.created_by}</td>
              <td><span className={`pill ${v.status}`}>{v.status}</span>{v.source === 'ai' ? ' ✦' : ''}</td>
            </tr>))}</tbody></table>
        {rows.length === 0 && <p className="muted" style={{ padding: 12 }}>No vouchers match. Try clearing filters — or press <kbd>F9</kbd> for a new purchase voucher.</p>}
      </div>
    </div>
  );
}
