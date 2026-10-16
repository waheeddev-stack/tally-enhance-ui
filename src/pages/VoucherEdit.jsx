import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, inr } from '../lib/api.js';
import { DEFAULT_GST_RATE, normGstRate } from '../lib/gst.js';
import { toast } from '../components/Toast.jsx';

const RATES = [0, 3, 5, 12, 18, 28];
const blankLine = (ledger, taxRate) => ({ ledger: ledger || '', description: '', hsn: '', qty: 1, rate: 0, amount: 0, amountTouched: true, tax_rate: normGstRate(taxRate ?? DEFAULT_GST_RATE) });

export default function VoucherEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vtype, setVtype] = useState('purchase');
  const [date, setDate] = useState('');
  const [number, setNumber] = useState('');
  const [party, setParty] = useState('');
  const [gstin, setGstin] = useState('');
  const [narration, setNarration] = useState('');
  const [inter, setInter] = useState(false);
  const [status, setStatus] = useState('');
  const [lines, setLines] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/ledgers?q=').then(r => setLedgers(r.ledgers || [])).catch(() => {});
    api('/vouchers/' + id)
      .then(d => {
        const v = d.voucher || {};
        setVtype(v.type || 'purchase');
        setDate((v.date || '').slice(0, 10));
        setNumber(v.number || '');
        setNarration(v.narration || '');
        setStatus(v.status || '');
        setGstin(v.vendor_gstin || v.gstin || '');
        // party may come as name or id — resolve via ledgers later, keep name if present
        setParty(v.party_name || v.party_ledger_name || '');
        if (v.party_ledger_id && !v.party_name) {
          api('/ledgers?q=').then(r => {
            const m = (r.ledgers || []).find(x => String(x.id) === String(v.party_ledger_id));
            if (m) setParty(m.name);
          }).catch(() => {});
        }
        const ls = (d.lines || []).map(l => ({
          ledger: l.ledger_name || '',
          ledger_id: l.ledger_id || l.id || null,
          description: l.description || '',
          hsn: l.hsn || '',
          qty: l.qty ?? 1,
          rate: l.rate ?? 0,
          amount: l.amount ?? 0,
          amountTouched: true,
          // default 18% when no external GST value was stored
          tax_rate: normGstRate(l.tax_rate ?? l.gst_rate ?? l.gst),
        }));
        setLines(ls.length ? ls : [blankLine()]);
        setInter(ls.some(l => Number(l.igst || 0) > 0));
        setLoading(false);
      })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [id]);

  const setLine = (i, patch) => setLines(ls => {
    const next = [...ls];
    const row = { ...next[i], ...patch };
    // normalize blank/invalid GST back to 18% default (0% stays 0%)
    if ('tax_rate' in patch) row.tax_rate = normGstRate(patch.tax_rate);
    if (('qty' in patch || 'rate' in patch) && !row.amountTouched) row.amount = +(Number(row.qty || 0) * Number(row.rate || 0)).toFixed(2);
    next[i] = row;
    return next;
  });

  const totals = useMemo(() => {
    let taxable = 0, tax = 0;
    for (const l of lines) {
      const a = Number(l.amount || 0), r = normGstRate(l.tax_rate);
      taxable += a; tax += a * r / 100;
    }
    return { taxable, tax, grand: taxable + tax };
  }, [lines]);

  const taxSplit = l => {
    const t = Number(l.amount || 0) * normGstRate(l.tax_rate) / 100;
    return inter ? { cgst: 0, sgst: 0, igst: +t.toFixed(2) } : { cgst: +(t / 2).toFixed(2), sgst: +(t / 2).toFixed(2), igst: 0 };
  };

  const save = async () => {
    setErr('');
    if (!date) { setErr('Date is required'); return; }
    const valid = lines.filter(l => Number(l.amount || 0) > 0);
    if (!valid.length) { setErr('Add at least one product line with an amount.'); return; }
    setSaving(true);
    try {
      const payloadLines = valid.map(l => {
        const rate = normGstRate(l.tax_rate);
        const s = taxSplit({ ...l, tax_rate: rate });
        const match = ledgers.find(x => x.name.toLowerCase() === String(l.ledger || '').trim().toLowerCase());
        return {
          ledger_id: match?.id || l.ledger_id || null,
          ledger_name: String(l.ledger || '').trim(),
          description: l.description, hsn: l.hsn,
          qty: Number(l.qty || 0), rate: Number(l.rate || 0),
          amount: Number(l.amount || 0), tax_rate: rate, ...s, dc: 'Dr',
        };
      });
      const partyMatch = ledgers.find(x => x.name.toLowerCase() === party.trim().toLowerCase());
      const body = JSON.stringify({
        type: vtype, date, number: number || undefined,
        party_ledger_id: partyMatch?.id || null, narration,
        lines: payloadLines, vendor_gstin: gstin || undefined,
      });
      let r;
      try {
        r = await api('/vouchers/' + id, { method: 'PUT', body });
      } catch (e) {
        // fallback for backends exposing PATCH instead of PUT
        if (/404|405|Method/i.test(e.message)) r = await api('/vouchers/' + id, { method: 'PATCH', body });
        else throw e;
      }
      toast('Voucher updated' + (r?.anomalies?.length ? ` — ${r.anomalies.length} flag(s)` : ''), 'ok');
      nav('/vouchers/' + id);
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  if (loading) return <div>Loading voucher…</div>;

  return (
    <div>
      <div className="serif" style={{ fontSize: 34 }}>Edit {vtype} voucher</div>
      <p className="muted">
        <span className={`pill ${status}`} style={{ marginRight: 8 }}>{status}</span>
        Update products, quantities, rates — GST defaults to <b>18%</b> when no external GST value is given (0% exempt is preserved). <kbd>Esc</kbd> back.
      </p>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <label>Date<input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Number<input className="input mono" value={number} onChange={e => setNumber(e.target.value)} placeholder="auto" /></label>
        <label>Supply
          <select className="select" value={inter ? 'inter' : 'intra'} onChange={e => setInter(e.target.value === 'inter')}>
            <option value="intra">Within state (CGST+SGST)</option>
            <option value="inter">Inter-state (IGST)</option>
          </select>
        </label>
        <label style={{ gridColumn: 'span 2' }}>Party ledger
          <input className="input" list="edit-ledgers" value={party} onChange={e => setParty(e.target.value)} placeholder="e.g. Gupta Enterprises" />
        </label>
        <label>Party GSTIN (optional)<input className="input mono" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="27…" /></label>
        <datalist id="edit-ledgers">{ledgers.map(l => <option key={l.id} value={l.name}>{l.group_name}</option>)}</datalist>
        <label style={{ gridColumn: 'span 3' }}>Narration
          <input className="input" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Being goods purchased…" />
        </label>
      </div>

      <div className="card" style={{ padding: 6 }}>
        <table className="table">
          <thead><tr><th>Product / Ledger</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th><th>GST%</th><th>Tax</th><th></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const s = taxSplit(l);
              const tax = s.cgst + s.sgst + s.igst;
              return (
                <tr key={i}>
                  <td><input className="input" list="edit-ledgers" value={l.ledger} onChange={e => setLine(i, { ledger: e.target.value })} style={{ minWidth: 150 }} placeholder="Product / ledger" /></td>
                  <td><input className="input" value={l.description} onChange={e => setLine(i, { description: e.target.value })} placeholder="Item description" /></td>
                  <td><input className="input mono" value={l.hsn} onChange={e => setLine(i, { hsn: e.target.value })} style={{ width: 76 }} /></td>
                  <td><input className="input mono" type="number" min="0" step="any" value={l.qty} onChange={e => setLine(i, { qty: e.target.value })} style={{ width: 70 }} /></td>
                  <td><input className="input mono" type="number" min="0" step="any" value={l.rate} onChange={e => setLine(i, { rate: e.target.value })} style={{ width: 90 }} /></td>
                  <td><input className="input mono" type="number" min="0" step="any" value={l.amount} onChange={e => setLine(i, { amount: e.target.value, amountTouched: true })} style={{ width: 110 }} /></td>
                  <td>
                    <select className="select" title="GST % — blank/missing defaults to 18%" value={normGstRate(l.tax_rate)} onChange={e => setLine(i, { tax_rate: e.target.value === '' ? '' : Number(e.target.value) })} style={{ width: 90 }}>
                      <option value="">default 18</option>
                      {RATES.map(r => <option key={r} value={r}>{r}{r === DEFAULT_GST_RATE ? ' (default)' : ''}</option>)}
                    </select>
                  </td>
                  <td className="mono">{inr(tax)}</td>
                  <td><button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: 10, display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setLines(ls => [...ls, blankLine()])}>+ Add product</button>
          <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>New rows start at 18% GST — change per-line if the bill shows another rate.</span>
        </div>
        <div style={{ padding: 12, textAlign: 'right', borderTop: '1px solid var(--line)' }} className="mono">
          Taxable {inr(totals.taxable)} · Tax {inr(totals.tax)} · <b>Total {inr(totals.grand)}</b>
        </div>
      </div>

      {err && <div style={{ color: 'var(--danger)', marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-ghost" onClick={() => nav('/vouchers/' + id)}>Cancel <kbd>Esc</kbd></button>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  );
}
