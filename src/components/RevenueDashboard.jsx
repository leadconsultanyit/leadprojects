import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';

/* ── formatting helpers ───────────────────────────────────────── */
const sym = (c) => (c === 'INR' || !c ? '₹' : c + ' ');
const fmtMoney = (n, c = 'INR') => `${sym(c)}${Number(n || 0).toLocaleString('en-IN')}`;
const fmtCompact = (n, c = 'INR') => {
  const v = Number(n || 0);
  if (v >= 1e7) return `${sym(c)}${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${sym(c)}${(v / 1e5).toFixed(1)} L`;
  if (v >= 1e3) return `${sym(c)}${(v / 1e3).toFixed(1)} K`;
  return `${sym(c)}${v.toLocaleString('en-IN')}`;
};

/* ── count-up animation hook ──────────────────────────────────── */
function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    let raf, start;
    const from = ref.current;
    const to = Number(target) || 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = from + (to - from) * eased;
      ref.current = cur;
      setVal(cur);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ── avatar helpers ───────────────────────────────────────────── */
const AVATAR_GRADIENTS = [
  ['#059669', '#10B981'], ['#7C3AED', '#A78BFA'], ['#0891B2', '#22D3EE'],
  ['#D97706', '#FBBF24'], ['#E11D48', '#FB7185'], ['#2563EB', '#60A5FA'],
  ['#DB2777', '#F472B6'], ['#0D9488', '#2DD4BF']
];
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const gradFor = (key = '') => {
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
};

function Avatar({ name, size = 30, idKey }) {
  const [a, b] = gradFor(idKey || name);
  return (
    <div title={name} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${a}, ${b})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: size * 0.36,
      fontFamily: 'var(--font-display)', boxShadow: `0 2px 8px ${a}55`,
      border: '2px solid var(--surface)'
    }}>{initials(name)}</div>
  );
}

function AvatarStack({ people, max = 5 }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <div key={p.employeeId || i} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: shown.length - i }}>
          <Avatar name={p.name} idKey={p.employeeId} size={30} />
        </div>
      ))}
      {extra > 0 && (
        <div style={{
          marginLeft: -10, width: 30, height: 30, borderRadius: '50%',
          background: 'var(--surface-elevated)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.7rem', border: '2px solid var(--surface)', zIndex: 0
        }}>+{extra}</div>
      )}
      {people.length === 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>}
    </div>
  );
}

/* ── KPI hero card ────────────────────────────────────────────── */
function KpiCard({ label, value, currency, sub, gradient, glow, icon, delay = 0, compact = true }) {
  const animated = useCountUp(value, 1100);
  const display = compact ? fmtCompact(animated, currency) : Math.round(animated).toLocaleString('en-IN');
  return (
    <div className="rd-kpi" style={{ background: gradient, boxShadow: `0 18px 40px -12px ${glow}`, animationDelay: `${delay}ms` }}>
      <div className="rd-kpi-shine" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>{label}</span>
          <span className="rd-kpi-icon">{icon}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 800, color: '#fff', marginTop: 10, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {display}
        </div>
        {sub && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.78)', marginTop: 8, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── custom chart tooltip ─────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'rgba(17,24,39,0.96)', color: '#fff', padding: '10px 14px',
      borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,0.3)', fontSize: '0.8rem',
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: 'var(--font-display)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>{p.name}:</span>
          <strong style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{fmtMoney(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

const STYLES = `
@keyframes rdFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rdShine { 0% { transform: translateX(-120%) skewX(-20deg); } 60%,100% { transform: translateX(220%) skewX(-20deg); } }
@keyframes rdGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes rdPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
.rd-root { animation: rdFadeUp 0.5s var(--ease) both; }
.rd-kpi { position: relative; overflow: hidden; border-radius: var(--radius-lg); padding: 20px 22px; min-width: 220px; flex: 1; animation: rdFadeUp 0.55s var(--spring) both; }
.rd-kpi::after { content: ''; position: absolute; right: -30px; top: -30px; width: 130px; height: 130px; border-radius: 50%; background: rgba(255,255,255,0.12); }
.rd-kpi-shine { position: absolute; top: 0; left: 0; width: 40%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); animation: rdShine 3.5s ease-in-out 0.4s infinite; }
.rd-kpi-icon { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 11px; background: rgba(255,255,255,0.22); color: #fff; backdrop-filter: blur(4px); }
.rd-panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); animation: rdFadeUp 0.6s var(--ease) both; }
.rd-row { display: grid; grid-template-columns: 1.6fr 1fr 150px 130px; gap: 14px; align-items: center; padding: 14px 18px; border-top: 1px solid var(--border); transition: background 0.15s var(--ease); }
.rd-row:hover { background: var(--surface-hover); }
.rd-meter { height: 8px; border-radius: 99px; background: var(--surface-elevated); overflow: hidden; }
.rd-meter > span { display: block; height: 100%; border-radius: 99px; transform-origin: left; animation: rdGrow 0.9s var(--spring) both; }
.rd-livedot { width: 8px; height: 8px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.3); animation: rdPulse 1.8s ease-in-out infinite; }
.rd-chip { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; }
`;

const ICONS = {
  potential: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  received: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  pending: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  people: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
};

export default function RevenueDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    axios.get('/api/projects/revenue/summary')
      .then(res => { if (active) { setData(res.data); setError(''); } })
      .catch(err => { if (active) setError(err.response?.data?.message || 'Failed to load revenue data'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading revenue data…</div>;
  if (error) return <div style={{ padding: '14px 18px', background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: 12, color: 'var(--error)' }}>{error}</div>;
  if (!data) return null;

  const { runningProjects = [], totals = {}, people = [] } = data;
  const collectionPct = totals.totalPotentialRevenue > 0
    ? Math.round((totals.totalReceived / totals.totalPotentialRevenue) * 100) : 0;

  const sorted = [...runningProjects].sort((a, b) => b.potentialRevenue - a.potentialRevenue);
  const chartData = sorted.slice(0, 10).map(p => ({
    name: (p.projectName || p.projectId).length > 20 ? (p.projectName || p.projectId).slice(0, 19) + '…' : (p.projectName || p.projectId),
    received: p.receivedAmount, pending: p.pendingAmount
  }));
  const maxRev = Math.max(1, ...sorted.map(p => p.potentialRevenue));

  return (
    <div className="rd-root" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <style>{STYLES}</style>

      {/* Hero header */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)',
        padding: '26px 30px', color: '#fff',
        background: 'linear-gradient(120deg, #064E3B 0%, #047857 45%, #0891B2 100%)',
        boxShadow: '0 22px 50px -16px rgba(4,120,87,0.55)'
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.18, background: 'radial-gradient(circle at 85% 15%, #fff 0%, transparent 40%), radial-gradient(circle at 10% 90%, #22D3EE 0%, transparent 45%)' }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="rd-livedot" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Live · Running Portfolio</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: '8px 0 4px', letterSpacing: '-0.02em' }}>Revenue Dashboard</h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.82)', maxWidth: 560 }}>
              Money in motion across <strong>{totals.runningCount || 0}</strong> active project{totals.runningCount === 1 ? '' : 's'} — what each can earn, what's already collected from cleared milestones, and who's delivering it.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>Portfolio Value</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.1 }}>{fmtCompact(totals.totalPotentialRevenue)}</div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard label="Potential Revenue" value={totals.totalPotentialRevenue} icon={ICONS.potential} delay={0}
          gradient="linear-gradient(135deg, #059669, #10B981)" glow="rgba(5,150,105,0.55)"
          sub={`Across ${totals.runningCount || 0} running projects`} />
        <KpiCard label="Received" value={totals.totalReceived} icon={ICONS.received} delay={90}
          gradient="linear-gradient(135deg, #0891B2, #22D3EE)" glow="rgba(8,145,178,0.55)"
          sub={`${collectionPct}% of potential collected`} />
        <KpiCard label="Pending" value={totals.totalPending} icon={ICONS.pending} delay={180}
          gradient="linear-gradient(135deg, #D97706, #FBBF24)" glow="rgba(217,119,6,0.5)"
          sub="Yet to be billed / received" />
        <KpiCard label="People Working" value={people.length} icon={ICONS.people} delay={270} compact={false}
          gradient="linear-gradient(135deg, #7C3AED, #A78BFA)" glow="rgba(124,58,237,0.5)"
          sub="Consultants on active delivery" />
      </div>

      {/* Collection gauge + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'stretch' }}>
        <div className="rd-panel" style={{ padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Collection Rate</div>
          <div style={{ position: 'relative', width: '100%', height: 200, marginTop: 6 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: collectionPct }]} startAngle={90} endAngle={-270}>
                <defs>
                  <linearGradient id="rdGauge" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#22D3EE" />
                  </linearGradient>
                </defs>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: 'var(--surface-elevated)' }} dataKey="value" cornerRadius={20} fill="url(#rdGauge)" />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{collectionPct}%</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>collected</div>
            </div>
          </div>
          <div style={{ width: '100%', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--info)' }}>●</span> Received</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmtMoney(totals.totalReceived)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--warning)' }}>●</span> Pending</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmtMoney(totals.totalPending)}</strong>
            </div>
          </div>
        </div>

        <div className="rd-panel" style={{ padding: 22 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Received vs Pending by Project</div>
          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-secondary)' }}>No running projects yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 38)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap="26%">
                <defs>
                  <linearGradient id="rdReceived" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0E7490" /><stop offset="100%" stopColor="#22D3EE" />
                  </linearGradient>
                  <linearGradient id="rdPending" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#B45309" /><stop offset="100%" stopColor="#FBBF24" />
                  </linearGradient>
                </defs>
                <XAxis type="number" tickFormatter={v => fmtCompact(v)} fontSize={11} stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={140} fontSize={11.5} stroke="var(--text)" tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                <Bar dataKey="received" stackId="a" fill="url(#rdReceived)" name="Received" radius={[5, 0, 0, 5]} animationDuration={900} />
                <Bar dataKey="pending" stackId="a" fill="url(#rdPending)" name="Pending" radius={[0, 5, 5, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Project leaderboard */}
      <div className="rd-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>Running Projects</div>
          <span className="rd-chip" style={{ background: 'var(--accent-surface)', color: 'var(--accent)' }}>{runningProjects.length} active</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 150px 130px', gap: 14, padding: '0 18px 8px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          <span>Project</span><span>Revenue Collected</span><span>Potential</span><span>Team</span>
        </div>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' }}>No running (work order) projects.</div>
        ) : sorted.map((p, idx) => {
          const pct = p.potentialRevenue > 0 ? Math.round((p.receivedAmount / p.potentialRevenue) * 100) : 0;
          const held = p.pipelineStatus === 'workorder-held';
          return (
            <div className="rd-row" key={p.projectId} style={{ animationDelay: `${idx * 40}ms` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.projectName || p.projectId}</span>
                  {held && <span className="rd-chip" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>Held</span>}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {p.projectId} · {p.clientName || '—'}
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 5 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--info)', fontWeight: 700 }}>{fmtCompact(p.receivedAmount, p.currency)}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{pct}%</span>
                </div>
                <div className="rd-meter">
                  <span style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0E7490, #22D3EE)' }} />
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.92rem' }}>
                {fmtCompact(p.potentialRevenue, p.currency)}
                <div style={{ height: 5, borderRadius: 99, marginTop: 4, background: 'var(--surface-elevated)' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${Math.round((p.potentialRevenue / maxRev) * 100)}%`, background: 'linear-gradient(90deg, #047857, #10B981)' }} />
                </div>
              </div>
              <AvatarStack people={p.assignedEmployees || []} />
            </div>
          );
        })}
      </div>

      {/* People allocation */}
      <div className="rd-panel" style={{ padding: '16px 18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>People Allocation</div>
          <span className="rd-chip" style={{ background: 'var(--purple-surface)', color: 'var(--purple)' }}>{people.length} on delivery</span>
        </div>
        {people.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>No people allocated to running projects.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {people.map(person => (
              <div key={person.employeeId} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)'
              }}>
                <Avatar name={person.name} idKey={person.employeeId} size={42} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{person.employeeId}</div>
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--purple)' }}>{person.projects.length}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>project{person.projects.length === 1 ? '' : 's'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
