import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  CHECKPOINT_DAYS,
  invoiceFollowUpStatus,
  invoiceAnchorDate,
  checkpointDate,
  startOfDay,
  fmtDate
} from '../utils/invoiceFollowUp';

const inr = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const todayInput = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Raise-invoice modal — captures invoice number + invoice date, then moves the
// milestone from pending → in_progress and fires the invoice-request email.
// ---------------------------------------------------------------------------
export function RaiseInvoiceModal({ projectId, milestone, onClose, onDone }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayInput());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!invoiceNumber.trim()) { setError('Work Order number is required'); return; }
    setLoading(true); setError('');
    try {
      await axios.put(`/api/projects/${projectId}/financial-action`, {
        financialMilestoneId: milestone.financialMilestoneId,
        action: 'raise',
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate
      });
      onDone && onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to raise invoice');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Raise Invoice</h2>
          <button className="btn-icon" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: 12, fontSize: '0.9rem' }}>
            <strong>{milestone.title}</strong> · {inr(milestone.amount)}
          </p>
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="form-group">
            <label>Work Order Number *</label>
            <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="e.g. WO-2026-014" autoFocus />
          </div>
          <div className="form-group">
            <label>Invoice Date</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Follow-up reminders will be scheduled at 7, 20, 30 &amp; 45 days from this date.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-blue" onClick={submit} disabled={loading}>
            {loading ? 'Raising…' : 'Raise Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collect modal — captures transaction details + payment reference and marks
// the milestone completed (money received).
// ---------------------------------------------------------------------------
export function CollectInvoiceModal({ projectId, milestone, onClose, onDone }) {
  const [paymentRef, setPaymentRef] = useState('');
  const [transactionDetails, setTransactionDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      await axios.put(`/api/projects/${projectId}/financial-action`, {
        financialMilestoneId: milestone.financialMilestoneId,
        action: 'collect',
        paymentRef: paymentRef.trim(),
        transactionDetails: transactionDetails.trim()
      });
      onDone && onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark collected');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Mark Collected</h2>
          <button className="btn-icon" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: 12, fontSize: '0.9rem' }}>
            <strong>{milestone.title}</strong> · {inr(milestone.amount)}
            {milestone.invoiceNumber && <> · Work Order {milestone.invoiceNumber}</>}
          </p>
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="form-group">
            <label>Transaction / UTR / Cheque No.</label>
            <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
              placeholder="e.g. UTR 123456789" autoFocus />
          </div>
          <div className="form-group">
            <label>Transaction Details</label>
            <textarea value={transactionDetails} onChange={e => setTransactionDetails(e.target.value)}
              rows={3} placeholder="Amount received, date, bank, remarks…"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-green" onClick={submit} disabled={loading}>
            {loading ? 'Saving…' : 'Confirm Collected'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One follow-up card in the list panel.
// ---------------------------------------------------------------------------
function FollowUpCard({ item, onAction, busy }) {
  const st = invoiceFollowUpStatus(item);
  const [marker, setMarker] = useState('');
  const [remark, setRemark] = useState('');

  // Default the checkpoint selector to the earliest due checkpoint.
  useEffect(() => {
    if (marker === '' && st.dueCheckpoints.length > 0) setMarker(String(st.dueCheckpoints[0]));
  }, [st.dueCheckpoints, marker]);

  const border = st.critical ? '#DC2626' : st.alerting ? '#F59E0B' : 'var(--border)';
  const bg = st.critical ? '#FEF2F2' : st.alerting ? '#FFFBEB' : 'var(--bg)';

  const addRemark = () => {
    if (!remark.trim()) return;
    onAction('remark', item, { dayMarker: Number(marker) || 0, remark: remark.trim() });
    setRemark('');
  };

  return (
    <div style={{ padding: 12, border: `1.5px solid ${border}`, background: bg, borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {item.projectName}
            {st.critical && <span className="badge" style={{ marginLeft: 8, background: '#DC2626', color: '#fff' }}>CRITICAL · {st.elapsed}d</span>}
            {!st.critical && st.snoozed && <span className="badge" style={{ marginLeft: 8, background: '#E5E7EB', color: '#374151' }}>Snoozed</span>}
            {!st.critical && st.alerting && <span className="badge" style={{ marginLeft: 8, background: '#F59E0B', color: '#fff' }}>Follow-up due</span>}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {item.title} · {inr(item.amount)} · Work Order {item.invoiceNumber || '—'} ({fmtDate(item.invoiceDate)})
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {st.elapsed != null ? `${st.elapsed} day(s) since invoice` : 'Not yet dated'}
            {st.nextDueDate && <> · next checkpoint {fmtDate(st.nextDueDate)}</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <button className="btn btn-sm btn-outline" disabled={busy}
            title="Snooze alerts for 3 days" onClick={() => onAction('snooze', item, { days: 3 })}>Snooze 3d</button>
          <button className="btn btn-sm btn-outline" disabled={busy}
            title="Resend the invoice request email" onClick={() => onAction('retrigger', item)}>Re-trigger</button>
        </div>
      </div>

      {/* Checkpoint chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {CHECKPOINT_DAYS.map(d => {
          const done = st.withRemark.has(d);
          const due = st.dueCheckpoints.includes(d);
          const reached = st.elapsed != null && st.elapsed >= d;
          const cbg = done ? '#DCFCE7' : due ? '#FEF3C7' : reached ? '#FEE2E2' : '#F3F4F6';
          const cfg = done ? '#166534' : due ? '#92400E' : reached ? '#991B1B' : '#6B7280';
          return (
            <span key={d} title={`Day ${d} · ${fmtDate(checkpointDate(item, d))}`}
              style={{ padding: '2px 8px', borderRadius: 12, background: cbg, color: cfg, fontSize: '0.72rem', fontWeight: 600 }}>
              {d}d {done ? '✓' : due ? '!' : ''}
            </span>
          );
        })}
      </div>

      {/* Existing remarks */}
      {(item.invoiceRemarks || []).length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {item.invoiceRemarks.map((r, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text)', background: 'var(--card, #fff)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <strong>{r.dayMarker ? `${r.dayMarker}d` : 'Note'}:</strong> {r.remark}
              <span style={{ color: 'var(--text-secondary)' }}> — {r.createdByName || 'User'}, {fmtDate(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add remark */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <select value={marker} onChange={e => setMarker(e.target.value)}
          style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem' }}>
          <option value="0">Note</option>
          {CHECKPOINT_DAYS.map(d => <option key={d} value={d}>{d}-day</option>)}
        </select>
        <input value={remark} onChange={e => setRemark(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addRemark()}
          placeholder="Add follow-up remark…"
          style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.82rem' }} />
        <button className="btn btn-sm btn-blue" disabled={busy || !remark.trim()} onClick={addRemark}>Add</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar month grid plotting each milestone's checkpoint dates.
// ---------------------------------------------------------------------------
function FollowUpCalendar({ items }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  // Map date-key (yyyy-mm-dd) → array of { item, day, status }
  const byDate = {};
  for (const item of items) {
    if (!invoiceAnchorDate(item)) continue;
    const st = invoiceFollowUpStatus(item);
    for (const d of CHECKPOINT_DAYS) {
      const cd = checkpointDate(item, d);
      if (!cd) continue;
      const key = startOfDay(cd).toISOString().slice(0, 10);
      (byDate[key] = byDate[key] || []).push({
        item, day: d,
        done: st.withRemark.has(d),
        critical: d === 45 && st.critical
      });
    }
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = startOfDay(new Date()).toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button className="btn btn-sm btn-outline" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹ Prev</button>
        <strong>{monthLabel}</strong>
        <button className="btn btn-sm btn-outline" onClick={() => setCursor(new Date(year, month + 1, 1))}>Next ›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const key = startOfDay(date).toISOString().slice(0, 10);
          const entries = byDate[key] || [];
          const isToday = key === todayKey;
          return (
            <div key={i} style={{
              minHeight: 64, padding: 4, border: `1px solid ${isToday ? 'var(--primary, #2563EB)' : 'var(--border)'}`,
              borderRadius: 6, background: isToday ? 'var(--primary-light, #EFF6FF)' : 'transparent'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{date.getDate()}</div>
              {entries.map((e, j) => (
                <div key={j} title={`${e.item.projectName} — ${e.item.title} (${e.day}-day follow-up)`}
                  style={{
                    fontSize: '0.66rem', marginTop: 2, padding: '1px 4px', borderRadius: 4, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    background: e.critical ? '#DC2626' : e.done ? '#DCFCE7' : '#FEF3C7',
                    color: e.critical ? '#fff' : e.done ? '#166534' : '#92400E'
                  }}>
                  {e.day}d · {e.item.projectName}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel: list + calendar of raised-but-uncollected invoice follow-ups.
// `refreshSignal` (a changing number) forces a refetch; `onChange` lets the
// parent refresh its own project data after an action here.
// ---------------------------------------------------------------------------
export default function InvoiceFollowUps({ refreshSignal = 0, onChange }) {
  const [items, setItems] = useState([]);
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get('/api/projects/invoice-followups/mine');
      setItems(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoice follow-ups');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshSignal]);

  const onAction = async (kind, item, payload = {}) => {
    setBusy(true);
    try {
      if (kind === 'remark') {
        await axios.put(`/api/projects/${item.projectId}/invoice-remark`, {
          financialMilestoneId: item.financialMilestoneId, ...payload
        });
      } else if (kind === 'snooze') {
        await axios.put(`/api/projects/${item.projectId}/invoice-snooze`, {
          financialMilestoneId: item.financialMilestoneId, ...payload
        });
      } else if (kind === 'retrigger') {
        if (!window.confirm('Resend the invoice-request email to the recipients?')) { setBusy(false); return; }
        await axios.post(`/api/projects/${item.projectId}/invoice-retrigger`, {
          financialMilestoneId: item.financialMilestoneId
        });
      }
      await load();
      onChange && onChange();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    } finally { setBusy(false); }
  };

  // Sort: critical first, then alerting, then by days elapsed desc.
  const sorted = [...items].sort((a, b) => {
    const sa = invoiceFollowUpStatus(a), sb = invoiceFollowUpStatus(b);
    const rank = s => (s.critical ? 0 : s.alerting ? 1 : s.snoozed ? 3 : 2);
    if (rank(sa) !== rank(sb)) return rank(sa) - rank(sb);
    return (sb.elapsed || 0) - (sa.elapsed || 0);
  });

  const criticalCount = items.filter(i => invoiceFollowUpStatus(i).critical).length;
  const dueCount = items.filter(i => invoiceFollowUpStatus(i).alerting && !invoiceFollowUpStatus(i).critical).length;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Invoice Collection Follow-ups</h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {items.length} open invoice(s)
            {criticalCount > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}> · {criticalCount} critical</span>}
            {dueCount > 0 && <span style={{ color: '#B45309', fontWeight: 600 }}> · {dueCount} due</span>}
          </div>
        </div>
        <div className="btn-group">
          <button className={`btn btn-sm ${view === 'list' ? 'btn-blue' : 'btn-outline'}`} onClick={() => setView('list')}>List</button>
          <button className={`btn btn-sm ${view === 'calendar' ? 'btn-blue' : 'btn-outline'}`} onClick={() => setView('calendar')}>Calendar</button>
          <button className="btn btn-sm btn-outline" onClick={load} disabled={loading}>↻</button>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', padding: 20, textAlign: 'center' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', padding: 20, textAlign: 'center' }}>
          No raised invoices awaiting collection.
        </div>
      ) : view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => (
            <FollowUpCard key={`${item.projectId}:${item.financialMilestoneId}`} item={item} onAction={onAction} busy={busy} />
          ))}
        </div>
      ) : (
        <FollowUpCalendar items={items} />
      )}
    </div>
  );
}
