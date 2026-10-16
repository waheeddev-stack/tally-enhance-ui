import React, { useState } from 'react';
import { uploadBill, api, inr, aiLabel } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { burstConfetti } from '../components/Confetti.jsx';
import { useNavigate } from 'react-router-dom';

// PRD: images are downscaled in the browser to under 1.5 MB (avoids object storage).
function downscaleImage(file) {
  return new Promise(resolve => {
    if (!file?.type?.startsWith('image/')) return resolve({ file, note: null });
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(b => {
        if (!b) return resolve({ file, note: null });
        const out = new File([b], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
        resolve({ file: out, note: `Downscaled in browser to ${(out.size / 1048576).toFixed(2)} MB` });
      }, 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ file, note: null });
    img.src = URL.createObjectURL(file);
  });
}

export default function Upload() {
  const [file, setFile] = useState(null);
  const [st, setSt] = useState('idle');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [ocrProg, setOcrProg] = useState(null);
  // editable draft overrides
  const [invNo, setInvNo] = useState('');
  const [invDate, setInvDate] = useState('');
  const [gstin, setGstin] = useState('');
  const [partyId, setPartyId] = useState('');
  const [ledgers, setLedgers] = useState([]);
  const nav = useNavigate();

  // Browser OCR (English + Hindi, per PRD bilingual bills) grounds the AI:
  // exact numbers/GSTIN from text beat pixels-alone. Dynamic import keeps it
  // out of the main bundle; any failure degrades to AI-vision-only.
  const ocrImage = async imgFile => {
    try {
      setOcrProg('loading OCR engine…');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng+hin', undefined, {
        logger: m => { if (m.status === 'recognizing text') setOcrProg(`reading text… ${Math.round((m.progress || 0) * 100)}%`); },
      });
      const { data: { text } } = await worker.recognize(imgFile);
      await worker.terminate().catch(() => {});
      setOcrProg(null);
      const t = String(text || '').trim();
      if (t.length > 20) toast(`OCR pre-read captured (${t.length} chars) — grounding the AI`, 'ok');
      return t.slice(0, 6000);
    } catch {
      setOcrProg(null);
      return '';
    }
  };

  const run = async demo => {
    setErr(''); setSt('uploading'); setData(null);
    try {
      const { file: upFile, note } = await downscaleImage(file);
      if (note) toast(note, 'info');
      let ocrText = '';
      if (!demo && upFile?.type?.startsWith('image/')) ocrText = await ocrImage(upFile);
      const { billId } = await uploadBill(demo ? null : upFile, demo);
      setSt('extracting');
      const r = await api(`/bills/${billId}/extract`, { method: 'POST', body: JSON.stringify({ demo: demo || file?.name || 'bill', ocr_text: ocrText }) });
      setData({ ...r, billId });
      setInvNo(r.draft.invoice.number); setInvDate(r.draft.invoice.date); setGstin(r.draft.vendor.gstin);
      setPartyId(r.draft.suggested_ledger.id || '');
      const l = await api('/ledgers?q=').catch(() => ({ ledgers: [] }));
      setLedgers(l.ledgers);
      if (r.draft.suggested_ledger.new_ledger) {
        const created = await api('/ledgers', { method: 'POST', body: JSON.stringify({ name: r.draft.vendor.name, group_name: 'Sundry Creditors', gstin: r.draft.vendor.gstin }) }).catch(() => null);
        if (created) { setPartyId(created.id); toast(`Created vendor ledger “${r.draft.vendor.name}”`, 'ok'); }
      }
      setSt('done');
    } catch (e) { setErr(e.message); setSt('idle'); }
  };

  const isPO = data?.document_kind === 'purchase_order';
  const save = async () => {
    setSt('saving'); setErr('');
    try {
      const d = data.draft;
      const r = await api('/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          type: 'purchase', date: invDate, party_ledger_id: partyId || null,
          number: invNo, narration: (isPO ? 'PO ' : 'Bill ') + invNo + ' — ' + d.vendor.name,
          lines: d.lines, bill_id: data.billId, vendor_gstin: gstin,
          force_draft: isPO,
        }),
      });
      toast(isPO ? 'PO converted to Draft — complete it when the real bill arrives' : r.status === 'pending' ? 'Saved as Pending — sent for approval' : 'Approved & posted', r.anomalies?.length ? 'info' : 'ok');
      burstConfetti();
      nav('/vouchers/' + r.id);
    } catch (e) { setErr(e.message); setSt('done'); }
  };

  const low = c => (c ?? 1) < 0.75;

  return (
    <div>
      <div className="serif" style={{ fontSize: 36 }}>Upload bill <span className="sticker pop" style={{ fontSize: 12, verticalAlign: 'middle' }}>snap → post ⚡</span></div>
      <p className="muted">JPG, PNG, PDF up to 10 MB — invoices <b>and</b> purchase orders. OCR pre-reads the text, AI structures it. Underlined fields are low-confidence.</p>
      <div className="dropzone" onClick={() => document.getElementById('f').click()}>
        <input id="f" type="file" hidden accept=".jpg,.jpeg,.png,.pdf" onChange={e => setFile(e.target.files[0])} />
        {file ? <b>{file.name}</b> : 'Drop a bill here or click to browse'}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn" disabled={!file || st !== 'idle'} onClick={() => run()}>{st === 'uploading' || st === 'extracting' ? 'Reading…' : 'Extract bill'}</button>
        <button className="btn-ghost" disabled={st !== 'idle'} onClick={() => run('sample-clean')}>Use sample bill</button>
        <button className="btn-ghost" disabled={st !== 'idle'} onClick={() => run('demo-po')}>Use sample PO ⬣</button>
        <button className="btn-ghost" disabled={st !== 'idle'} onClick={() => run('demo-6-flawed')}>Use flawed bill ⚠</button>
      </div>
      {ocrProg && <p className="muted" style={{ marginTop: 8 }}>◌ {ocrProg} (English + Hindi OCR grounding the AI…)</p>}
      {err && <div style={{ color: 'var(--danger)', marginTop: 10 }}>{err}</div>}
      {(st === 'uploading' || st === 'extracting') && <div className="card" style={{ marginTop: 14 }}><div className="skel" /><div className="skel" style={{ marginTop: 8 }} /><div className="skel" style={{ marginTop: 8, width: '60%' }} /><p className="muted">Reading bill… fields stream in after extraction.</p></div>}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 14, marginTop: 14 }}>
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <h3 style={{ margin: 0 }}>Review draft voucher <span className="pill" style={{ marginLeft: 6 }}>{aiLabel(data.ai_source)}</span>{' '}
              {data.document_kind === 'purchase_order'
                ? <span className="sticker lime" style={{ fontSize: 11 }}>PURCHASE ORDER ⬣</span>
                : <span className="sticker pop" style={{ fontSize: 11 }}>TAX INVOICE ✦</span>}
            </h3>
            <label>Vendor<div className="mono" style={{ textDecoration: low(data.draft.confidence?.vendor) ? 'underline wavy var(--accent)' : 'none' }}>{data.draft.vendor.name}</div></label>
            <label>Invoice no.<input className="input mono" value={invNo} onChange={e => setInvNo(e.target.value)} style={low(data.draft.confidence?.invoice) ? { borderColor: 'var(--accent)' } : {}} /></label>
            <label>Invoice date<input className="input" type="date" value={invDate} onChange={e => setInvDate(e.target.value)} /></label>
            <label>Vendor GSTIN<input className="input mono" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} /></label>
            <label>Party ledger (dropdown — scoped to ledgers you can see)
              <select className="select" value={partyId} onChange={e => setPartyId(e.target.value)}>
                <option value="">— create/keep as {data.draft.vendor.name} —</option>
                {ledgers.map(l => <option key={l.id} value={l.id}>{l.name} · {l.group_name}</option>)}
              </select>
            </label>
            {data.draft.lines.map((l, i) => (
              <div key={i} className="mono" style={{ fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                {l.description} · HSN {l.hsn || '—'} · {l.qty}×{inr(l.rate)} = {inr(l.amount)} + {l.tax_rate}% tax
              </div>
            ))}
            <div className="mono"><b>Total {inr(data.draft.totals.grand_total)}</b> <span className="muted">(CGST {inr(data.draft.totals.cgst)} + SGST {inr(data.draft.totals.sgst)})</span></div>
            {data.draft.note && <p className="muted">{data.draft.note}</p>}
            {data.ai_note && <p className="muted">ℹ {data.ai_note}</p>}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Anomaly flags ({data.anomalies.length})</h3>
            {data.anomalies.length === 0 && <p className="muted">No issues found. Ready to accept.</p>}
            {data.anomalies.map((a, i) => (
              <div key={i} className={`flagbanner ${a.severity}`}><span className={`dot ${a.severity}`} />[{a.severity}] <b>{a.rule_code}</b> — {a.message}</div>
            ))}
            {isPO && <div className="flagbanner" style={{ borderColor: 'var(--accent)' }}><b>Purchase order detected</b> — accepting converts it to a <b>Draft</b> voucher (no tax posts). Complete it when the real bill arrives.</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => { setData(null); setSt('idle'); }}>Discard</button>
              <button className="btn" disabled={st === 'saving'} onClick={save}>{st === 'saving' ? 'Saving…' : isPO ? 'Convert PO to draft' : 'Accept voucher'} <kbd>Ctrl+A</kbd></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
