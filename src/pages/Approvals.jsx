import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, inr } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { burstConfetti } from '../components/Confetti.jsx';
import FlagExplainer from '../components/FlagExplainer.jsx';
import { isAdmin, canApprove } from '../lib/roles.js';

export default function Approvals({ me }) {
  const [queue, setQueue] = useState([]);
  const [mine, setMine] = useState([]);
  const [msg, setMsg] = useState('');
  const [rejectFor, setRejectFor] = useState(null);
  const [reason, setReason] = useState('');
  const nav = useNavigate();
  const approver = canApprove(me);

  const load = async () => {
    try {
      const q = await api('/approvals' + (approver ? '' : '?mine=1'));
      if (approver) setQueue(q.queue); else setMine(q.queue);
      if (me.role_preset === 'data_entry' || me.needs_approval) {
        const m = await api('/approvals?mine=1').catch(() => ({ queue: [] }));
        setMine(m.queue);
      }
    } catch (e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, []);

  const act = async (id, a, r) => {
    try {
      await api(`/vouchers/${id}/${a}`, { method: 'POST', body: JSON.stringify({ reason: r || '' }) });
      toast(a === 'approve' ? 'Approved & posted' : a === 'reject' ? 'Sent back to draft' : a, 'ok');
      if (a === 'approve') burstConfetti();
      setRejectFor(null); setReason(''); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const overLimit = v => !isAdmin(me) && me.approval_limit > 0 && v.total > me.approval_limit;

  return (
    <div>
      <div className="serif" style={{ fontSize: 36 }}>{approver ? 'Approval queue' : 'My submissions'}</div>
      <p className="muted">
        {approver
          ? <>Maker-checker: makers submit, approvers post. {isAdmin(me) ? 'As Admin you can approve any amount.' : <>Your approval limit is <b className="mono">{inr(me.approval_limit)}</b>.</>} Every action is audited.</>
          : <>Vouchers you submitted that are waiting for an approver. You can recall one back to draft while it is pending.</>}
      </p>
      {msg && <p style={{ color: 'var(--danger)' }}>{msg}</p>}

      {approver && queue.map(v => (
        <div key={v.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <b className="mono" style={{ cursor: 'pointer' }} onClick={() => nav('/vouchers/' + v.id)}>{v.number}</b>
            <span>{v.party_name}</span>
            <b className="mono">{inr(v.total)}</b>
            <span className="muted" style={{ fontSize: 12 }}>by {v.created_by} · {v.date} {v.bill ? `· 🧾 ${v.bill.file_name}` : ''}</span>
            {v.high_flags > 0 && <span style={{ color: 'var(--danger)', fontSize: 12 }}>● {v.high_flags} high flag(s)</span>}
            {!v.high_flags && v.flag_count > 0 && <span style={{ color: 'var(--warn)', fontSize: 12 }}>● {v.flag_count} flag(s)</span>}
          </div>
          {v.flags?.length > 0 && (
            <div style={{ marginTop: 8 }}>{v.flags.map((f, i) => (
              <div key={i} style={{ fontSize: 13 }}><span className={`dot ${f.severity}`} />[{f.severity}] <b>{f.rule_code}</b> — {f.message}</div>))}
              <div style={{ marginTop: 6 }}><FlagExplainer voucherId={v.id} compact /></div>
            </div>
          )}
          {rejectFor === v.id ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input className="input" placeholder="Rejection reason (required)" value={reason} onChange={e => setReason(e.target.value)} style={{ maxWidth: 320 }} />
              <button className="btn" onClick={() => act(v.id, 'reject', reason)}>Confirm reject</button>
              <button className="btn-ghost" onClick={() => { setRejectFor(null); setReason(''); }}>Back</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" disabled={overLimit(v)} title={overLimit(v) ? `Exceeds your ${inr(me.approval_limit)} limit` : ''} onClick={() => act(v.id, 'approve')}>
                {overLimit(v) ? `Over your limit (${inr(me.approval_limit)})` : 'Approve & post'}
              </button>
              <button className="btn-ghost" onClick={() => setRejectFor(v.id)}>Reject…</button>
              <button className="btn-ghost" onClick={() => nav('/vouchers/' + v.id)}>Open</button>
            </div>
          )}
        </div>
      ))}
      {approver && queue.length === 0 && <p className="muted">Queue empty — nothing pending.</p>}

      {(!approver || mine.length > 0) && (
        <>
          {approver && <h3 style={{ marginTop: 20 }}>My own submissions</h3>}
          {mine.map(v => (
            <div key={v.id} className="card" style={{ marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}><b className="mono">{v.number}</b> · {v.party_name} · <span className="mono">{inr(v.total)}</span>
                <div className="muted" style={{ fontSize: 12 }}>Pending since {v.date} · awaiting {v.high_flags ? 'careful review — has high flags' : 'approver review'}</div></div>
              <button className="btn-ghost" onClick={() => nav('/vouchers/' + v.id)}>Track</button>
              <button className="btn-ghost" onClick={() => act(v.id, 'reject', 'recalled by maker')}>Recall to draft</button>
            </div>
          ))}
          {mine.length === 0 && !approver && <p className="muted">Nothing pending — accepted vouchers appear under Vouchers.</p>}
        </>
      )}
    </div>
  );
}
