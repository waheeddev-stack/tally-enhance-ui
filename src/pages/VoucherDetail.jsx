import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, inr } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { burstConfetti } from '../components/Confetti.jsx';
import FlagExplainer from '../components/FlagExplainer.jsx';
import { isAdmin, canApprove } from '../lib/roles.js';

export default function VoucherDetail({ me, viewAs }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const load = () => api('/vouchers/' + id).then(setD).catch(() => {});
  useEffect(() => { load(); }, [id]);

  const act = async (a, r) => {
    try {
      const res = await api(`/vouchers/${id}/${a}`, { method: 'POST', body: JSON.stringify({ reason: r || '' }) });
      toast(`${a} → ${res.status}`, 'ok');
      if (a === 'approve') burstConfetti();
      setRejectOpen(false); setReason(''); load();
    } catch (e) { toast(e.message, 'error'); }
  };
  const autofix = async () => {
    try {
      const r = await api(`/vouchers/${id}/autofix`, { method: 'POST' });
      toast(r.fixed ? `Fixed ${r.fixed} issue(s) — flags recomputed` : r.message, r.fixed ? 'ok' : 'info');
      if (r.fixed) burstConfetti();
      load();
    } catch (e) { toast(e.message, 'error'); }
  };
  if (!d) return <div>Loading…</div>;
  const { voucher: v, lines, anomalies, bill } = d;
  const mine = v.created_by === me?.email;
  const approver = canApprove(me);
  const overLimit = !isAdmin(me) && me?.approval_limit > 0 && v.total > me.approval_limit;

  return (
    <div>
      <button className="btn-ghost" style={{ marginBottom: 10 }} onClick={() => nav(-1)}>← Back <kbd>Esc</kbd></button>
      <div className="serif" style={{ fontSize: 34 }}>{v.type} · <span className="mono">{v.number}</span> <span className={`stamp ${v.status === 'approved' ? 'ok' : v.status}`} style={{ marginLeft: 10, fontSize: 13 }}>{v.status}</span></div>
      <p className="muted">{v.date} · <span className={`pill ${v.status}`}>{v.status}</span> · by {v.created_by} {bill ? `· 🧾 ${bill.file_name}` : ''}</p>
      {v.status === 'pending' && mine && !approver && <div className="flagbanner">Waiting for approver review. You can recall it to draft if you spot a mistake.</div>}
      {anomalies.map(a => <div key={a.id} className={`flagbanner ${a.severity}`}><span className={`dot ${a.severity}`} />[{a.severity}] <b>{a.rule_code}</b> — {a.message}</div>)}
      {anomalies.length > 0 && <div style={{ margin: '4px 0 10px' }}><FlagExplainer voucherId={v.id} /></div>}
      <div className="card" style={{ padding: 6 }}>
        <table className="table"><thead><tr><th>Ledger</th><th>Description</th><th>HSN</th><th>Amount</th><th>Tax</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
          <tbody>{lines.map(l => <tr key={l.id}><td>{l.ledger_name}</td><td>{l.description}</td><td className="mono">{l.hsn}</td><td className="mono">{inr(l.amount)}</td><td className="mono">{l.tax_rate}%</td><td className="mono">{inr(l.cgst)}</td><td className="mono">{inr(l.sgst)}</td><td className="mono">{inr(l.igst)}</td></tr>)}</tbody></table>
        <div style={{ padding: 12, textAlign: 'right' }} className="mono">Total: {inr(v.total)} · {v.narration}</div>
      </div>
      {!viewAs && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {v.status === 'draft' && (mine || isAdmin(me)) && <button className="btn" onClick={() => act('submit')}>Submit for approval</button>}
          {v.status === 'pending' && approver && (
            <>
              <button className="btn" disabled={overLimit} title={overLimit ? `Exceeds your ${inr(me.approval_limit)} limit` : ''} onClick={() => act('approve')}>
                {overLimit ? `Over your limit (${inr(me.approval_limit)})` : 'Approve & post'}
              </button>
              <button className="btn-ghost" onClick={() => setRejectOpen(o => !o)}>Reject…</button>
            </>
          )}
          {v.status === 'pending' && mine && !approver && <button className="btn-ghost" onClick={() => act('reject', 'recalled by maker')}>Recall to draft</button>}
          {anomalies.some(a => ['wrong_gst_rate', 'tax_math_error'].includes(a.rule_code)) && v.status !== 'cancelled' && (mine || approver || isAdmin(me)) && (
            <button className="btn" onClick={autofix}>✨ Fix it for me</button>
          )}
          {(isAdmin(me) || me?.role_preset === 'accountant') && v.status === 'approved' && (
            <button className="btn-ghost" onClick={() => { const r = prompt('Cancel reason:'); if (r) act('cancel', r); }}>Cancel voucher…</button>
          )}
        </div>
      )}
      {rejectOpen && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="input" placeholder="Rejection reason (required)" value={reason} onChange={e => setReason(e.target.value)} style={{ maxWidth: 340 }} />
          <button className="btn" onClick={() => act('reject', reason)}>Confirm reject</button>
        </div>
      )}
    </div>
  );
}
