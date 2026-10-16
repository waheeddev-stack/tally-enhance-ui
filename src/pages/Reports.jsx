import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, inr } from '../lib/api.js';
import { downloadCSV } from '../lib/csv.js';
import { toast } from '../components/Toast.jsx';

const reminderText = (row, lang) => {
  const name = row.customer || row.vendor || 'there';
  const amt = inr(row.outstanding);
  const days = row.days_overdue || 0;
  if (lang === 'hi') return `Namaste ${name} ji, ${amt} ka payment ${days} din se pending hai. Kripya jald se jald clear karein taaki hisaab clean rahe. — via Tally Copilot`;
  return `Hi ${name}, friendly reminder: ${amt} has been pending for ${days} days. Please clear it at the earliest so our books stay clean. — via Tally Copilot`;
};

export default function Reports() {
  const [tab, setTab] = useState(null);
  const [rows, setRows] = useState([]);
  const [ageing, setAgeing] = useState(null);
  const [kind, setKind] = useState('receivables');
  const [status, setStatus] = useState('');
  const [drill, setDrill] = useState(null);
  const [err, setErr] = useState('');
  const [remind, setRemind] = useState(null);
  const [aiMsg, setAiMsg] = useState(null);
  const openRemind = r => { setRemind(r); setAiMsg(null); };
  const nav = useNavigate();

  const load = async (t, k = kind) => {
    setTab(t); setRows([]); setAgeing(null); setDrill(null); setErr('');
    try {
      if (t === 'day-book') {
        const r = await api('/reports/day-book');
        setRows(status ? r.rows.filter(x => x.status === status) : r.rows);
      } else if (t === 'trial') {
        const r = await api('/reports/trial-balance');
        setRows(r.rows);
      } else if (t === 'out') {
        const r = await api(`/reports/outstandings?kind=${k === 'receivables' ? 'receivables' : 'payables'}`);
        setRows(r.rows); setAgeing(r.ageing);
      } else if (t === 'gst') {
        const r = await api('/reports/gst-summary');
        setRows(r.rows);
      }
    } catch (e) { setErr(e.message); }
  };

  const openLedger = async name => {
    try {
      const r = await api('/reports/ledger?ledger=' + encodeURIComponent(name));
      setDrill({ ledger: r.ledger, entries: r.entries, hidden: r.hidden });
    } catch (e) { setErr(e.message); }
  };

  const cols = rows.length ? Object.keys(rows[0]).filter(k => !['id', 'company_id', 'bill_id', 'created_by', 'approved_by'].includes(k)) : [];

  return (
    <div>
      <div className="serif" style={{ fontSize: 36 }}>Reports</div>
      <p className="muted">Drill down: Trial Balance → Ledger → Voucher → bill. Click any row.</p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <button className={tab === 'day-book' ? 'btn' : 'btn-ghost'} onClick={() => load('day-book')}>Day Book</button>
        <button className={tab === 'trial' ? 'btn' : 'btn-ghost'} onClick={() => load('trial')}>Trial Balance</button>
        <button className={tab === 'out' ? 'btn' : 'btn-ghost'} onClick={() => load('out')}>Outstandings</button>
        <button className={tab === 'gst' ? 'btn' : 'btn-ghost'} onClick={() => load('gst')}>GST summary</button>
        {tab === 'day-book' && (
          <select className="select" style={{ maxWidth: 150 }} value={status} onChange={e => { setStatus(e.target.value); }}>
            <option value="">All incl. pending</option><option value="approved">Approved</option><option value="pending">Pending</option>
          </select>
        )}
        {tab === 'out' && (
          <select className="select" style={{ maxWidth: 170 }} value={kind} onChange={e => { setKind(e.target.value); load('out', e.target.value); }}>
            <option value="receivables">Receivables</option><option value="payables">Payables</option>
          </select>
        )}
        {tab && rows.length > 0 && (
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => { downloadCSV(`${tab}.csv`, rows) ? toast('CSV downloaded — send it to your CA', 'ok') : toast('Nothing to export', 'error'); }}>↓ Export CSV</button>
        )}
      </div>
      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
      {ageing && (
        <div className="grid4" style={{ marginBottom: 12 }}>
          {Object.entries(ageing).map(([b, v]) => <div className="card" key={b}><div className="muted" style={{ fontSize: 13 }}>{b} days</div><div className="statnum" style={{ fontSize: 30 }}>{inr(v)}</div></div>)}
        </div>
      )}
      {!tab && <div className="card"><p className="muted">Pick a report above.</p></div>}
      {tab && (
        <div className="card" style={{ padding: 6 }}>
          {rows.length === 0 ? <p className="muted" style={{ padding: 12 }}>No rows.</p> :
            <table className="table"><thead><tr>{cols.map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}<th /></tr></thead>
              <tbody>{rows.slice(0, 150).map((r, i) => (
                <tr key={i} onClick={() => {
                  if (r.id) nav('/vouchers/' + r.id);
                  else if (tab === 'trial') openLedger(r.ledger);
                  else if (tab === 'out') openLedger(r.customer || r.vendor);
                }}>
                  {cols.map(k => <td key={k} className="mono">{typeof r[k] === 'number' ? inr(r[k]) : String(r[k] ?? '').slice(0, 42)}</td>)}
                  <td onClick={e => e.stopPropagation()}>{tab === 'out' && <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openRemind(r)}>Remind ✦</button>}</td>
                </tr>))}</tbody></table>}
        </div>
      )}
      {drill && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Ledger: {drill.hidden ? '••• (hidden for your role)' : drill.ledger?.name}</h3>
          {!drill.hidden && (
            <table className="table"><thead><tr><th>Date</th><th>Number</th><th>Type</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>{drill.entries.map(e => (
                <tr key={e.id} onClick={() => nav('/vouchers/' + e.id)}>
                  <td className="mono">{e.date}</td><td className="mono">{e.number}</td><td>{e.type}</td><td className="mono">{inr(e.total)}</td><td><span className={`pill ${e.status}`}>{e.status}</span></td>
                </tr>))}</tbody></table>
          )}
          <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setDrill(null)}>Close</button>
        </div>
      )}
      {remind && (
        <div className="modal-overlay" onClick={() => setRemind(null)}>
          <div className="modal-card card" onClick={e => e.stopPropagation()}>
            <div className="serif" style={{ fontSize: 26 }}>Payment nudge <span className="sticker lime" style={{ fontSize: 11 }}>copy-paste ready</span></div>
            <p className="muted">{remind.customer || remind.vendor} · <b className="mono">{inr(remind.outstanding)}</b> · {remind.days_overdue}d overdue</p>
            {[['English', 'en'], ['Hinglish', 'hi']].map(([label, lang]) => (
              <div key={lang} style={{ marginTop: 10 }}>
                <b style={{ fontSize: 13 }}>{label}</b>
                <p style={{ background: '#F7FEE7', border: '1.5px solid var(--line)', borderRadius: 12, padding: 12, fontSize: 13.5 }}>{reminderText(remind, lang)}</p>
                <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => navigator.clipboard.writeText(reminderText(remind, lang)).then(() => toast(`${label} reminder copied — paste it in WhatsApp`, 'ok'), () => toast('Copy blocked', 'error'))}>Copy {label}</button>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <b style={{ fontSize: 13 }}>Rewrite the vibe ✦</b>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {[['strict', 'Strict ⚡'], ['funny', 'Funny ✦']].map(([tone, label]) => (
                  <button key={tone} className="chip" onClick={async () => {
                    try {
                      const r = await api('/api/ai/reminder', { method: 'POST', body: JSON.stringify({ name: remind.customer || remind.vendor, amount: inr(remind.outstanding), days: remind.days_overdue, tone }) });
                      setAiMsg({ tone, text: r.text });
                    } catch (e) { toast(e.message, 'error'); }
                  }}>{label}</button>
                ))}
              </div>
              {aiMsg && (
                <div className="pop-in">
                  <p style={{ background: '#EDE9FE', border: '1.5px solid var(--line)', borderRadius: 12, padding: 12, fontSize: 13.5, marginTop: 8 }}>{aiMsg.text}</p>
                  <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => navigator.clipboard.writeText(aiMsg.text).then(() => toast(`${aiMsg.tone} version copied`, 'ok'), () => toast('Copy blocked', 'error'))}>Copy {aiMsg.tone} version</button>
                </div>
              )}
            </div>
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setRemind(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
