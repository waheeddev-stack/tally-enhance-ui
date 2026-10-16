import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, inr, aiLabel } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';

const TYPES = [
  { key: 'contra', label: 'Contra', fkey: 'F4', alt: '1' },
  { key: 'payment', label: 'Payment', fkey: 'F5', alt: '2' },
  { key: 'receipt', label: 'Receipt', fkey: 'F6', alt: '3' },
  { key: 'journal', label: 'Journal', fkey: 'F7', alt: '4' },
  { key: 'sales', label: 'Sales', fkey: 'F8', alt: '5' },
  { key: 'purchase', label: 'Purchase', fkey: 'F9', alt: '6' },
];
const RATES = [0, 3, 5, 12, 18, 28];
const blankLine = ledger => ({ ledger: ledger || '', description: '', hsn: '', qty: 1, rate: 0, amount: 0, amountTouched: false, tax_rate: 18 });

export default function VoucherNew({ me }) {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [vtype, setVtype] = useState(sp.get('type') || 'purchase');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [number, setNumber] = useState('');
  const [party, setParty] = useState('');
  const [gstin, setGstin] = useState('');
  const [narration, setNarration] = useState('');
  const [inter, setInter] = useState(false);
  const [lines, setLines] = useState([blankLine('Purchase @18%')]);
  const [ledgers, setLedgers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showNewLedger, setShowNewLedger] = useState(false);
  const [nl, setNl] = useState({ name: '', group: 'Sundry Creditors', gstin: '' });

  useEffect(() => {
    api('/ledgers?q=').then(r => setLedgers(r.ledgers)).catch(() => {});
    api('/groups').then(r => setGroups(r.groups)).catch(() => {});
  }, []);

  // default line ledger follows voucher type
  useEffect(() => {
    const def = vtype === 'purchase' ? 'Purchase @18%' : vtype === 'sales' ? 'Sales @18%' : vtype === 'payment' ? 'Cash' : vtype === 'receipt' ? 'Cash' : '';
    setLines(ls => (ls.length === 1 && !ls[0].amount && !ls[0].rate ? [blankLine(def)] : ls));
  }, [vtype]);

  // shortcuts: F4-F9 / Alt+1-6 switch type, Ctrl+A save, Esc back
  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); saveRef.current(); }
      if (e.key === 'Escape') nav('/vouchers');
      const fmap = { F4: 'contra', F5: 'payment', F6: 'receipt', F7: 'journal', F8: 'sales', F9: 'purchase' };
      if (fmap[e.key]) { e.preventDefault(); setVtype(fmap[e.key]); }
      if (e.altKey && ['1', '2', '3', '4', '5', '6'].includes(e.key)) { e.preventDefault(); setVtype(TYPES[Number(e.key) - 1].key); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const setLine = (i, patch) => setLines(ls => {
    const next = [...ls];
    const row = { ...next[i], ...patch };
    if (('qty' in patch || 'rate' in patch) && !row.amountTouched) row.amount = +(Number(row.qty || 0) * Number(row.rate || 0)).toFixed(2);
    next[i] = row;
    return next;
  });

  const totals = useMemo(() => {
    let taxable = 0, tax = 0;
    for (const l of lines) {
      const a = Number(l.amount || 0), r = Number(l.tax_rate || 0);
      taxable += a; tax += a * r / 100;
    }
    return { taxable, tax, grand: taxable + tax };
  }, [lines]);

  const taxSplit = l => {
    const t = Number(l.amount || 0) * Number(l.tax_rate || 0) / 100;
    return inter ? { cgst: 0, sgst: 0, igst: +t.toFixed(2) } : { cgst: +(t / 2).toFixed(2), sgst: +(t / 2).toFixed(2), igst: 0 };
  };

  const createLedgerInline = async () => {
    if (!nl.name.trim()) { setErr('Ledger name required'); return; }
    try {
      const r = await api('/ledgers', { method: 'POST', body: JSON.stringify({ name: nl.name.trim(), group_name: nl.group, gstin: nl.gstin || undefined }) });
      const all = await api('/ledgers?q=');
      setLedgers(all.ledgers);
      setParty(nl.name.trim());
      setShowNewLedger(false); setNl({ name: '', group: 'Sundry Creditors', gstin: '' });
      toast(`Ledger created (Alt+C)`, 'ok');
    } catch (e) { setErr(e.message); }
  };

  const save = async () => {
    setErr('');
    if (!date) { setErr('Date is required'); return; }
    const valid = lines.filter(l => Number(l.amount || 0) > 0);
    if (!valid.length) { setErr('Add at least one line with an amount — a voucher must balance to more than zero.'); return; }
    if ((vtype === 'purchase' || vtype === 'sales') && !party.trim()) { setErr('Party ledger is required for purchase/sales.'); return; }
    setSaving(true);
    try {
      const payloadLines = valid.map(l => {
        const s = taxSplit(l);
        const match = ledgers.find(x => x.name.toLowerCase() === l.ledger.trim().toLowerCase());
        return { ledger_id: match?.id || null, ledger_name: l.ledger.trim(), description: l.description, hsn: l.hsn, qty: Number(l.qty || 0), rate: Number(l.rate || 0), amount: Number(l.amount || 0), tax_rate: Number(l.tax_rate || 0), ...s, dc: 'Dr' };
      });
      const partyMatch = ledgers.find(x => x.name.toLowerCase() === party.trim().toLowerCase());
      const r = await api('/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          type: vtype, date, number: number || undefined,
          party_ledger_id: partyMatch?.id || null, narration,
          lines: payloadLines, vendor_gstin: gstin || undefined,
        }),
      });
      toast(r.status === 'pending' ? `Saved as Pending — sent for approval (${r.number})` : `Approved & posted (${r.number})`, r.anomalies?.length ? 'info' : 'ok');
      if (r.anomalies?.length) toast(`${r.anomalies.length} anomaly flag(s) attached — see Alerts`, 'error');
      nav('/vouchers/' + r.id);
    } catch (e) { setErr(e.message); setSaving(false); }
  };
  const saveRef = React.useRef(save);
  saveRef.current = save;

  return (
    <div>
      <div className="serif" style={{ fontSize: 34 }}>New {vtype} voucher</div>
      <p className="muted"><kbd>F4</kbd>–<kbd>F9</kbd> switch type · <kbd>Alt+C</kbd> new ledger · <kbd>Ctrl+A</kbd> accept · <kbd>Esc</kbd> cancel</p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {TYPES.map(t => (
          <button key={t.key} className={vtype === t.key ? 'btn' : 'btn-ghost'} style={{ padding: '6px 12px' }} onClick={() => setVtype(t.key)}>
            {t.label} <kbd style={{ marginLeft: 4 }}>{t.fkey}</kbd>
          </button>
        ))}
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <label>Date<input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Number (auto if blank)<input className="input mono" value={number} onChange={e => setNumber(e.target.value)} placeholder="auto" /></label>
        <label>Supply
          <select className="select" value={inter ? 'inter' : 'intra'} onChange={e => setInter(e.target.value === 'inter')}>
            <option value="intra">Within state (CGST+SGST)</option>
            <option value="inter">Inter-state (IGST)</option>
          </select>
        </label>
        <label style={{ gridColumn: 'span 2' }}>Party ledger (type to search)
          <input className="input" list="ledgers" value={party} onChange={e => setParty(e.target.value)} placeholder="e.g. Gupta Enterprises" />
        </label>
        <label>Party GSTIN (optional)<input className="input mono" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="27…" /></label>
        <datalist id="ledgers">{ledgers.map(l => <option key={l.id} value={l.name}>{l.group_name}</option>)}</datalist>
        <label style={{ gridColumn: 'span 3' }}>Narration
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Being goods purchased…" />
            <button className="btn-ghost" style={{ whiteSpace: 'nowrap', padding: '6px 12px' }} onClick={async () => {
              try {
                const r = await api('/api/ai/narration', { method: 'POST', body: JSON.stringify({ type: vtype, party, lines: lines.map(l => ({ description: l.description, ledger_name: l.ledger, qty: l.qty, amount: l.amount })) }) });
                setNarration(r.narration); toast(`Narration written (${r.source === 'local' ? 'template' : aiLabel(r.source)})`, 'ok');
              } catch (e) { toast(e.message, 'error'); }
            }}>✦ Auto-write</button>
          </div>
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setShowNewLedger(s => !s)}>+ New ledger <kbd>Alt+C</kbd></button>
      </div>
      {showNewLedger && (
        <div className="card" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Ledger name" value={nl.name} onChange={e => setNl({ ...nl, name: e.target.value })} />
          <select className="select" style={{ maxWidth: 200 }} value={nl.group} onChange={e => setNl({ ...nl, group: e.target.value })}>
            {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
          </select>
          <input className="input mono" style={{ maxWidth: 200 }} placeholder="GSTIN (optional)" value={nl.gstin} onChange={e => setNl({ ...nl, gstin: e.target.value })} />
          <button className="btn" onClick={createLedgerInline}>Create</button>
        </div>
      )}

      <div className="card" style={{ padding: 6 }}>
        <table className="table">
          <thead><tr><th>Ledger</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Tax%</th><th>Tax</th><th></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const s = taxSplit(l);
              const tax = s.cgst + s.sgst + s.igst;
              return (
                <tr key={i}>
                  <td><input className="input" list="ledgers" value={l.ledger} onChange={e => setLine(i, { ledger: e.target.value })} style={{ minWidth: 150 }} /></td>
                  <td><input className="input" value={l.description} onChange={e => setLine(i, { description: e.target.value })} /></td>
                  <td><div style={{ display: 'flex', gap: 4 }}><input className="input mono" value={l.hsn} onChange={e => setLine(i, { hsn: e.target.value })} style={{ width: 76 }} /><button className="btn-ghost" title="Suggest HSN from description ✦" style={{ padding: '4px 7px' }} onClick={async () => {
                    if (!l.description?.trim()) { setErr('Type a description first — the AI guesses HSN from it.'); return; }
                    try {
                      const r = await api('/api/ai/hsn', { method: 'POST', body: JSON.stringify({ description: l.description }) });
                      if (r.hsn) { setLine(i, { hsn: r.hsn }); toast(`HSN ${r.hsn}${r.label ? ' — ' + r.label : ''}`, 'ok'); }
                      else toast('No suggestion — enter HSN manually.', 'info');
                    } catch (e) { toast(e.message, 'error'); }
                  }}>✦</button></div></td>
                  <td><input className="input mono" type="number" value={l.qty} onChange={e => setLine(i, { qty: e.target.value })} style={{ width: 70 }} /></td>
                  <td><input className="input mono" type="number" value={l.rate} onChange={e => setLine(i, { rate: e.target.value })} style={{ width: 90 }} /></td>
                  <td><input className="input mono" type="number" value={l.amount} onChange={e => setLine(i, { amount: e.target.value, amountTouched: true })} style={{ width: 110 }} /></td>
                  <td><select className="select" value={l.tax_rate} onChange={e => setLine(i, { tax_rate: Number(e.target.value) })} style={{ width: 70 }}>{RATES.map(r => <option key={r} value={r}>{r}</option>)}</select></td>
                  <td className="mono">{inr(tax)}</td>
                  <td><button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: 10 }}><button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setLines(ls => [...ls, blankLine()])}>+ Add line</button></div>
        <div style={{ padding: 12, textAlign: 'right', borderTop: '1px solid var(--line)' }} className="mono">
          Taxable {inr(totals.taxable)} · Tax {inr(totals.tax)} · <b>Total {inr(totals.grand)}</b>
          {totals.grand > 0 ? <span style={{ color: '#16a34a' }}> · balanced ✓</span> : <span className="muted"> · enter amounts</span>}
        </div>
      </div>

      {err && <div style={{ color: 'var(--danger)', marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-ghost" onClick={() => nav('/vouchers')}>Cancel <kbd>Esc</kbd></button>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Accept'} <kbd>Ctrl+A</kbd></button>
      </div>
    </div>
  );
}
