import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';

const CHART_COLORS = ['#059669', '#7C3AED', '#0891B2', '#D97706', '#E11D48', '#047857', '#6D28D9', '#14B8A6'];

export default function ObserverDashboard() {
  const [tab, setTab] = useState('dashboard');
  const [pipelineTab, setPipelineTab] = useState('proposals');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  // Universal pipeline filtering
  const [pipelineFilter, setPipelineFilter] = useState({ month: '', vertical: '', contactPoint: '', leadOffice: '', search: '', lossReason: '' });

  useEffect(() => {
    fetchUsers(); fetchProjects();
  }, []);

  const fetchUsers = async () => { setUsers((await axios.get('/api/users')).data); };
  const fetchProjects = async () => { setProjects((await axios.get('/api/projects')).data); };

  const applyPipelineFilter = (list) => {
    return list.filter(p => {
      if (pipelineFilter.month) {
        const d = p.proposalMonth || p.createdAt;
        if (!d) return false;
        const pm = new Date(d).toISOString().slice(0, 7);
        if (pm !== pipelineFilter.month) return false;
      }
      if (pipelineFilter.vertical && p.vertical !== pipelineFilter.vertical) return false;
      if (pipelineFilter.leadOffice && p.leadOffice !== pipelineFilter.leadOffice) return false;
      if (pipelineFilter.contactPoint) {
        const q = pipelineFilter.contactPoint.toLowerCase();
        const cp = p.contactPoint || {};
        if (!(cp.name || '').toLowerCase().includes(q) && !(cp.mailId || '').toLowerCase().includes(q) && !(cp.number || '').includes(q)) return false;
      }
      if (pipelineFilter.lossReason && p.lossReason !== pipelineFilter.lossReason) return false;
      if (pipelineFilter.search) {
        const s = pipelineFilter.search.toLowerCase();
        if (!p.projectName.toLowerCase().includes(s) && !p.clientName?.toLowerCase().includes(s) && !p.projectId.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  };

  const exportToExcel = (list, sheetName) => {
    const data = list.map(p => ({
      'Project ID': p.projectId,
      'Project Name': p.projectName,
      'Client': p.clientName,
      'Vertical': p.vertical,
      'Lead Office': p.leadOffice || '',
      'Proposed Value': p.proposalValue || p.totalProposedMoney || 0,
      'Approved Budget': p.approvedBudget || '',
      'Proposal Month': p.proposalMonth ? new Date(p.proposalMonth).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '',
      'Contact Name': p.contactPoint?.name || '',
      'Contact Designation': p.contactPoint?.designation || '',
      'Contact Number': p.contactPoint?.number || '',
      'Contact Email': p.contactPoint?.mailId || '',
      'Services': (p.services || []).join(', '),
      'Rating System': (p.ratingSystem || []).join(', '),
      'Building Usage': p.buildingUsage || '',
      'Client Sector': p.clientSector || '',
      'Location': p.projectLocation || '',
      ...(p.lossReason ? { 'Loss Reason': p.lossReason, 'Loss Comments': p.lossComments || '' } : {}),
      'Status': p.pipelineStatus
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Data
  const employees = users.filter(u => u.role === 'employee');

  const proposals = projects.filter(p => p.pipelineStatus === 'proposal');
  const wonProjects = projects.filter(p => p.pipelineStatus === 'won');
  const workorders = projects.filter(p => p.pipelineStatus === 'workorder');
  const holdProjects = projects.filter(p => p.pipelineStatus === 'hold');
  const lostProjects = projects.filter(p => p.pipelineStatus === 'lost');

  const filteredProposals = applyPipelineFilter(proposals);
  const filteredWonProjects = applyPipelineFilter(wonProjects);
  const filteredWorkorders = applyPipelineFilter(workorders);
  const filteredHoldProjects = applyPipelineFilter(holdProjects);
  const filteredLostProjects = applyPipelineFilter(lostProjects);
  const filteredAllProjects = applyPipelineFilter(projects);

  const activeFilteredList = pipelineTab === 'all' ? filteredAllProjects
    : pipelineTab === 'proposals' ? filteredProposals
    : pipelineTab === 'won' ? filteredWonProjects
    : pipelineTab === 'workorders' ? filteredWorkorders
    : pipelineTab === 'hold' ? filteredHoldProjects
    : filteredLostProjects;

  const activeUnfilteredList = pipelineTab === 'all' ? projects
    : pipelineTab === 'proposals' ? proposals
    : pipelineTab === 'won' ? wonProjects
    : pipelineTab === 'workorders' ? workorders
    : pipelineTab === 'hold' ? holdProjects
    : lostProjects;

  const allMonths = [...new Set(projects.map(p => {
    const d = p.proposalMonth || p.createdAt;
    return d ? new Date(d).toISOString().slice(0, 7) : null;
  }).filter(Boolean))].sort().reverse();

  const allLeadOffices = [...new Set(projects.map(p => p.leadOffice).filter(Boolean))].sort();

  const totalProposed = projects.reduce((s, p) => s + (p.proposalValue || p.totalProposedMoney || 0), 0);
  const totalApproved = projects.filter(p => p.approvedBudget).reduce((s, p) => s + p.approvedBudget, 0);

  const fmtMoney = (v) => {
    if (!v) return '-';
    return `₹${(v / 100000).toFixed(1)}L`;
  };

  // Chart data
  const pipelineChartData = [
    { name: 'Proposals', value: proposals.length, color: '#7C3AED' },
    { name: 'Won', value: wonProjects.length, color: '#059669' },
    { name: 'Workorders', value: workorders.length, color: '#0891B2' },
    { name: 'Hold', value: holdProjects.length, color: '#D97706' },
    { name: 'Lost', value: lostProjects.length, color: '#E11D48' }
  ];

  const verticalData = {};
  projects.forEach(p => {
    const v = p.vertical || 'Unknown';
    if (!verticalData[v]) verticalData[v] = { name: v, count: 0, value: 0 };
    verticalData[v].count++;
    verticalData[v].value += (p.proposalValue || p.totalProposedMoney || 0);
  });
  const verticalChartData = Object.values(verticalData);

  const officeData = {};
  projects.forEach(p => {
    const o = p.leadOffice || 'Unknown';
    if (!officeData[o]) officeData[o] = { name: o, proposals: 0, won: 0, lost: 0, workorders: 0 };
    if (p.pipelineStatus === 'proposal') officeData[o].proposals++;
    else if (p.pipelineStatus === 'won') officeData[o].won++;
    else if (p.pipelineStatus === 'lost') officeData[o].lost++;
    else if (p.pipelineStatus === 'workorder') officeData[o].workorders++;
  });
  const officeChartData = Object.values(officeData);

  const lossReasonData = {};
  lostProjects.forEach(p => {
    const r = p.lossReason || 'Unknown';
    if (!lossReasonData[r]) lossReasonData[r] = { name: r, count: 0 };
    lossReasonData[r].count++;
  });
  const lossReasonChartData = Object.values(lossReasonData);

  const monthlyData = {};
  projects.forEach(p => {
    const d = p.proposalMonth || p.createdAt;
    if (!d) return;
    const key = new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!monthlyData[key]) monthlyData[key] = { name: key, proposed: 0, approved: 0, count: 0 };
    monthlyData[key].proposed += (p.proposalValue || p.totalProposedMoney || 0);
    if (p.approvedBudget) monthlyData[key].approved += p.approvedBudget;
    monthlyData[key].count++;
  });
  const monthlyChartData = Object.values(monthlyData).slice(-12);

  const serviceData = {};
  projects.forEach(p => {
    (p.services || []).forEach(s => {
      if (!serviceData[s]) serviceData[s] = { name: s, count: 0 };
      serviceData[s].count++;
    });
  });
  const serviceChartData = Object.values(serviceData).sort((a, b) => b.count - a.count);

  const empWorkload = {};
  employees.forEach(emp => {
    const active = workorders.filter(w => w.assignedEmployeeIds?.includes(emp.employeeId) && w.projectStatus === 'active');
    empWorkload[emp.employeeId] = { name: emp.name, projects: active.length };
  });
  const empWorkloadData = Object.values(empWorkload).sort((a, b) => b.projects - a.projects).slice(0, 15);

  // Win rate by month
  const winRateByMonth = {};
  projects.forEach(p => {
    const d = p.proposalMonth || p.createdAt;
    if (!d) return;
    const key = new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!winRateByMonth[key]) winRateByMonth[key] = { name: key, total: 0, won: 0, lost: 0 };
    winRateByMonth[key].total++;
    if (p.pipelineStatus === 'won' || p.pipelineStatus === 'workorder') winRateByMonth[key].won++;
    if (p.pipelineStatus === 'lost') winRateByMonth[key].lost++;
  });
  const winRateChartData = Object.values(winRateByMonth).map(d => ({
    ...d, winRate: d.total > 0 ? Math.round((d.won / d.total) * 100) : 0
  })).slice(-12);

  // Rating system distribution
  const ratingData = {};
  projects.forEach(p => {
    (p.ratingSystem || []).forEach(r => {
      if (!ratingData[r]) ratingData[r] = { name: r, count: 0, value: 0 };
      ratingData[r].count++;
      ratingData[r].value += (p.proposalValue || p.totalProposedMoney || 0);
    });
  });
  const ratingChartData = Object.values(ratingData).sort((a, b) => b.count - a.count);

  // Certification distribution
  const certData = {};
  projects.forEach(p => {
    (p.certificationType || []).forEach(c => {
      if (!certData[c]) certData[c] = { name: c, count: 0 };
      certData[c].count++;
    });
  });
  const certChartData = Object.values(certData).sort((a, b) => b.count - a.count);

  // Conversion funnel
  const totalAll = projects.length;
  const funnelData = [
    { name: 'Total Proposals', value: totalAll, fill: '#7C3AED' },
    { name: 'Won', value: wonProjects.length + workorders.length, fill: '#059669' },
    { name: 'Active Workorders', value: workorders.filter(w => w.projectStatus === 'active').length, fill: '#0891B2' },
    { name: 'Completed', value: workorders.filter(w => w.projectStatus === 'closed').length, fill: '#D97706' }
  ];

  // Building usage distribution
  const buildingData = {};
  projects.forEach(p => {
    const b = p.buildingUsage || 'Unspecified';
    if (!buildingData[b]) buildingData[b] = { name: b, count: 0, value: 0 };
    buildingData[b].count++;
    buildingData[b].value += (p.proposalValue || p.totalProposedMoney || 0);
  });
  const buildingChartData = Object.values(buildingData).sort((a, b) => b.count - a.count).slice(0, 10);

  // Client sector distribution
  const sectorData = {};
  projects.forEach(p => {
    const s = p.clientSector || 'Unspecified';
    if (!sectorData[s]) sectorData[s] = { name: s, count: 0, value: 0 };
    sectorData[s].count++;
    sectorData[s].value += (p.proposalValue || p.totalProposedMoney || 0);
  });
  const sectorChartData = Object.values(sectorData).sort((a, b) => b.value - a.value);

  const renderMetaTags = (project) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {project.leadOffice && <span className="meta-tag">{project.leadOffice}</span>}
      {project.services?.map(s => <span key={s} className="meta-tag tag-service">{s}</span>)}
      {project.ratingSystem?.map(r => <span key={r} className="meta-tag tag-rating">{r}</span>)}
      {project.buildingUsage && <span className="meta-tag tag-building">{project.buildingUsage}</span>}
      {project.clientSector && <span className="meta-tag tag-sector">{project.clientSector}</span>}
      {project.projectLocation && <span className="meta-tag tag-location">{project.projectLocation}</span>}
    </div>
  );

  const renderContactPoint = (cp) => {
    if (!cp || !cp.name) return null;
    return (
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 6, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
        <strong style={{ color: 'var(--text)' }}>{cp.name}</strong>
        {cp.designation && <span> — {cp.designation}</span>}
        {cp.number && <span> | {cp.number}</span>}
        {cp.mailId && <span> | {cp.mailId}</span>}
      </div>
    );
  };

  const renderFilterBar = () => (
    <div style={{ gridColumn: 'span 2', display: 'flex', gap: 10, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <select value={pipelineFilter.month} onChange={e => setPipelineFilter({ ...pipelineFilter, month: e.target.value })}
        style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }}>
        <option value="">All Months</option>
        {allMonths.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</option>)}
      </select>
      <select value={pipelineFilter.vertical} onChange={e => setPipelineFilter({ ...pipelineFilter, vertical: e.target.value })}
        style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }}>
        <option value="">All Verticals</option>
        <option value="ESG">ESG</option>
        <option value="Green Building Certification">Green Building Certification</option>
        <option value="MEFP Design">MEFP Design</option>
      </select>
      <select value={pipelineFilter.leadOffice} onChange={e => setPipelineFilter({ ...pipelineFilter, leadOffice: e.target.value })}
        style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }}>
        <option value="">All Offices</option>
        {allLeadOffices.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <input type="text" value={pipelineFilter.contactPoint} onChange={e => setPipelineFilter({ ...pipelineFilter, contactPoint: e.target.value })}
        placeholder="Contact point..." style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', width: 150 }} />
      {pipelineTab === 'lost' && (
        <select value={pipelineFilter.lossReason} onChange={e => setPipelineFilter({ ...pipelineFilter, lossReason: e.target.value })}
          style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }}>
          <option value="">All Reasons</option>
          {[...new Set(lostProjects.map(p => p.lossReason).filter(Boolean))].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}
      <input type="text" value={pipelineFilter.search} onChange={e => setPipelineFilter({ ...pipelineFilter, search: e.target.value })}
        placeholder="Search projects..." style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', flex: 1, minWidth: 160 }} />
      <button className="btn btn-sm btn-outline" onClick={() => exportToExcel(activeFilteredList, pipelineTab.charAt(0).toUpperCase() + pipelineTab.slice(1))}>
        Export Excel
      </button>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        {activeFilteredList.length} of {activeUnfilteredList.length}
      </span>
      {(pipelineFilter.month || pipelineFilter.vertical || pipelineFilter.leadOffice || pipelineFilter.contactPoint || pipelineFilter.search || pipelineFilter.lossReason) && (
        <button className="btn btn-sm" style={{ background: 'var(--text-secondary)', color: '#fff', padding: '4px 10px' }}
          onClick={() => setPipelineFilter({ month: '', vertical: '', contactPoint: '', leadOffice: '', search: '', lossReason: '' })}>
          Clear
        </button>
      )}
    </div>
  );

  const renderProjectCard = (p, showRevisions) => {
    const revData = showRevisions ? (p.revisions || []).map(r => ({
      name: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      amount: r.amount
    })) : [];
    return (
      <div className="card pipeline-card" key={p.projectId}>
        <div className="card-header">
          <div>
            <div className="card-title">{p.projectName}</div>
            <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
          </div>
          <span className="vertical-tag">{p.vertical}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 4, alignItems: 'center' }}>
          <span className="money">{fmtMoney(p.proposalValue || p.totalProposedMoney)}</span>
          {p.approvedBudget && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Approved: <strong style={{ color: 'var(--success)' }}>{fmtMoney(p.approvedBudget)}</strong>
            </span>
          )}
        </div>
        {revData.length > 1 && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
              Proposal Revisions ({revData.length})
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={revData}>
                <XAxis dataKey="name" fontSize={10} />
                <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} fontSize={10} width={45} />
                <Tooltip formatter={v => fmtMoney(v)} />
                <Line type="monotone" dataKey="amount" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {renderContactPoint(p.contactPoint)}
        {renderMetaTags(p)}
      </div>
    );
  };

  return (
    <div>
      <div className="dashboard-header">
        <h1>Observer Dashboard</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: 12 }}>Read-only view</span>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-value">{employees.length}</div>
          <div className="stat-label">Employees</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{proposals.length}</div>
          <div className="stat-label">Proposals</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{workorders.filter(w => w.projectStatus === 'active').length}</div>
          <div className="stat-label">Active Workorders</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{fmtMoney(totalProposed)}</div>
          <div className="stat-label">Total Proposed</div>
        </div>
        <div className="stat-box">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{fmtMoney(totalApproved)}</div>
          <div className="stat-label">Total Approved</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          Dashboard
        </button>
        <button className={`tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>
          Employees ({employees.length})
        </button>
        <button className={`tab ${tab === 'pipeline' ? 'active' : ''}`} onClick={() => setTab('pipeline')}>
          Pipeline ({projects.length})
        </button>
        <button className={`tab ${tab === 'deltas' ? 'active' : ''}`} onClick={() => setTab('deltas')}>
          Budget Deltas
        </button>
      </div>

      {/* ========== DASHBOARD TAB ========== */}
      {tab === 'dashboard' && (
        <div>
          <div className="grid-2">
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Pipeline Overview</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pipelineChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pipelineChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Projects by Office</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={officeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="proposals" fill="#7C3AED" name="Proposals" />
                  <Bar dataKey="won" fill="#059669" name="Won" />
                  <Bar dataKey="workorders" fill="#0891B2" name="Workorders" />
                  <Bar dataKey="lost" fill="#E11D48" name="Lost" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Monthly Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip formatter={v => fmtMoney(v)} />
                  <Legend />
                  <Area type="monotone" dataKey="proposed" fill="#05966930" stroke="#059669" name="Proposed" />
                  <Area type="monotone" dataKey="approved" fill="#7C3AED40" stroke="#7C3AED" name="Approved" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Loss Reasons</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={lossReasonChartData} cx="50%" cy="50%" outerRadius={100} dataKey="count" label={({ name, count }) => `${name}: ${count}`}>
                    {lossReasonChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Revenue by Vertical</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={verticalChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip formatter={v => typeof v === 'number' && v > 1000 ? fmtMoney(v) : v} />
                  <Bar dataKey="value" fill="#059669" name="Revenue" />
                  <Bar dataKey="count" fill="#7C3AED" name="Projects" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Service Line Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={serviceChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#059669" name="Projects" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ gridColumn: 'span 2' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Employee Workload</h3>
              {empWorkloadData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={empWorkloadData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="projects" fill="#059669" name="Active Projects">
                      {empWorkloadData.map((entry, i) => (
                        <Cell key={i} fill={entry.projects >= 3 ? '#E11D48' : entry.projects >= 2 ? '#D97706' : '#059669'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>No employee workload data</p>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Win Rate Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={winRateChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v, name) => name === 'winRate' ? `${v}%` : v} />
                  <Legend />
                  <Line type="monotone" dataKey="winRate" stroke="#059669" strokeWidth={2} name="Win Rate %" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="total" stroke="#7C3AED" strokeWidth={1} strokeDasharray="5 5" name="Total Projects" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Conversion Funnel</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={130} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" name="Projects">
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Rating System Distribution</h3>
              {ratingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={ratingChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v, name) => name === 'Revenue' ? fmtMoney(v) : v} />
                    <Legend />
                    <Bar dataKey="count" fill="#7C3AED" name="Projects" />
                    <Bar dataKey="value" fill="#059669" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>No rating system data</p>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Certification Types</h3>
              {certChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={certChartData} cx="50%" cy="50%" outerRadius={100} dataKey="count" label={({ name, count }) => `${name}: ${count}`}>
                      {certChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>No certification data</p>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Building Usage</h3>
              {buildingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={buildingChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                    <Tooltip formatter={(v, name) => name === 'Revenue' ? fmtMoney(v) : v} />
                    <Legend />
                    <Bar dataKey="count" fill="#059669" name="Projects" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>No building usage data</p>
              )}
            </div>

            <div className="card" style={{ gridColumn: 'span 2' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Revenue by Client Sector</h3>
              {sectorChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sectorChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis yAxisId="left" tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                    <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                    <Tooltip formatter={(v, name) => name === 'Revenue' ? fmtMoney(v) : v} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="value" fill="#059669" name="Revenue" />
                    <Bar yAxisId="right" dataKey="count" fill="#7C3AED" name="Projects" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>No client sector data</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== EMPLOYEES TAB ========== */}
      {tab === 'employees' && (
        <div>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>All Employees</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Email</th><th>Status</th><th>Projects</th><th>Credentials</th><th>CV</th></tr>
                </thead>
                <tbody>
                  {users.filter(u => u.role === 'employee').map(u => (
                    <tr key={u._id}>
                      <td><code>{u.employeeId || '-'}</code></td>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${u.verified ? 'badge-verified' : 'badge-unverified'}`}>
                          {u.verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td>{u.assignedProjects?.length || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 250 }}>
                          {(u.credentials || []).slice(0, 4).map(c => <span key={c} className="meta-tag">{c}</span>)}
                          {(u.credentials || []).length > 4 && <span className="meta-tag">+{u.credentials.length - 4}</span>}
                        </div>
                      </td>
                      <td>
                        {u.cvPath ? (
                          <a href={u.cvPath} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem' }}>View CV</a>
                        ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No CV</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========== PIPELINE TAB ========== */}
      {tab === 'pipeline' && (
        <div>
          <div className="pipeline-tabs">
            {[
              { key: 'all', label: 'All', count: projects.length, color: '#6366F1' },
              { key: 'proposals', label: 'Proposals', count: proposals.length, color: 'var(--info)' },
              { key: 'won', label: 'Won', count: wonProjects.length, color: 'var(--success)' },
              { key: 'workorders', label: 'Workorders', count: workorders.length, color: 'var(--primary)' },
              { key: 'hold', label: 'Hold', count: holdProjects.length, color: 'var(--warning)' },
              { key: 'lost', label: 'Lost', count: lostProjects.length, color: 'var(--error)' }
            ].map(t => (
              <button key={t.key}
                className={`pipeline-tab ${pipelineTab === t.key ? 'active' : ''}`}
                style={{ '--tab-color': t.color }}
                onClick={() => setPipelineTab(t.key)}>
                {t.label} <span className="pipeline-tab-count">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="grid-2">
            {renderFilterBar()}

            {pipelineTab === 'all' && filteredAllProjects.map(p => {
              const statusColors = { proposal: '#7C3AED', won: '#059669', workorder: '#0891B2', hold: '#D97706', lost: '#E11D48' };
              return (
                <div className="card pipeline-card" key={p.projectId} style={{ borderLeft: `4px solid ${statusColors[p.pipelineStatus] || '#888'}` }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">{p.projectName}</div>
                      <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={`badge badge-pipeline-${p.pipelineStatus}`} style={{ textTransform: 'capitalize' }}>{p.pipelineStatus}</span>
                      <span className="vertical-tag">{p.vertical}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 4, alignItems: 'center' }}>
                    <span className="money">{fmtMoney(p.proposalValue || p.totalProposedMoney)}</span>
                    {p.approvedBudget && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Approved: <strong style={{ color: 'var(--success)' }}>{fmtMoney(p.approvedBudget)}</strong>
                      </span>
                    )}
                  </div>
                  {renderContactPoint(p.contactPoint)}
                  {renderMetaTags(p)}
                </div>
              );
            })}

            {pipelineTab === 'proposals' && filteredProposals.map(p => renderProjectCard(p, true))}

            {pipelineTab === 'won' && filteredWonProjects.map(p => renderProjectCard(p))}

            {pipelineTab === 'workorders' && filteredWorkorders.map(p => {
              const totalTMs = p.financialMilestones.reduce((s, fm) => s + fm.technicalMilestones.length, 0);
              const completedTMs = p.financialMilestones.reduce(
                (s, fm) => s + fm.technicalMilestones.filter(t => t.status === 'completed').length, 0);
              const progress = totalTMs > 0 ? Math.round((completedTMs / totalTMs) * 100) : 0;
              return (
                <div className="card pipeline-card" key={p.projectId}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">{p.projectName}</div>
                      <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                    </div>
                    <span className={`badge badge-${p.projectStatus}`}>{p.projectStatus}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="vertical-tag">{p.vertical}</span>
                    <span className="money">{fmtMoney(p.totalProposedMoney)}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {p.assignedEmployeeIds?.length || 0} employees
                    </span>
                  </div>
                  {p.approvedBudget && (
                    <div className="delta-inline">
                      <span>Proposed: {fmtMoney(p.proposalValue || p.totalProposedMoney)}</span>
                      <span>Approved: <strong style={{ color: 'var(--success)' }}>{fmtMoney(p.approvedBudget)}</strong></span>
                      <span style={{ color: p.approvedBudget < (p.proposalValue || p.totalProposedMoney) ? 'var(--error)' : 'var(--success)' }}>
                        Delta: {fmtMoney(p.approvedBudget - (p.proposalValue || p.totalProposedMoney))}
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4, marginTop: 6 }}>
                    Progress: {progress}% ({completedTMs}/{totalTMs} milestones)
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  {renderContactPoint(p.contactPoint)}
                  {renderMetaTags(p)}
                </div>
              );
            })}

            {pipelineTab === 'hold' && filteredHoldProjects.map(p => renderProjectCard(p))}

            {pipelineTab === 'lost' && filteredLostProjects.map(p => (
              <div className="card pipeline-card" key={p.projectId} style={{ borderLeft: '4px solid var(--error)' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{p.projectName}</div>
                    <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                  </div>
                  <span className="vertical-tag">{p.vertical}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <span className="money">{fmtMoney(p.proposalValue || p.totalProposedMoney)}</span>
                </div>
                <div className="loss-info">
                  <div><strong>Loss Reason:</strong> <span className="badge badge-lost">{p.lossReason}</span></div>
                  {p.lossReasonOther && <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Detail: {p.lossReasonOther}</div>}
                  {p.lossComments && <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    "{p.lossComments}"
                  </div>}
                </div>
                {renderContactPoint(p.contactPoint)}
                {renderMetaTags(p)}
              </div>
            ))}
          </div>

          {pipelineTab === 'all' && filteredAllProjects.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {projects.length === 0 ? 'No projects yet.' : 'No projects match your filters.'}
            </div>
          )}
          {pipelineTab === 'proposals' && filteredProposals.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {proposals.length === 0 ? 'No proposals yet.' : 'No proposals match your filters.'}
            </div>
          )}
          {pipelineTab === 'won' && filteredWonProjects.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {wonProjects.length === 0 ? 'No won projects.' : 'No won projects match your filters.'}
            </div>
          )}
          {pipelineTab === 'workorders' && filteredWorkorders.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {workorders.length === 0 ? 'No workorders yet.' : 'No workorders match your filters.'}
            </div>
          )}
          {pipelineTab === 'hold' && filteredHoldProjects.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {holdProjects.length === 0 ? 'No projects on hold.' : 'No hold projects match your filters.'}
            </div>
          )}
          {pipelineTab === 'lost' && filteredLostProjects.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {lostProjects.length === 0 ? 'No lost projects.' : 'No lost projects match your filters.'}
            </div>
          )}
        </div>
      )}

      {/* ========== BUDGET DELTAS TAB ========== */}
      {tab === 'deltas' && (
        <div>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Budget Delta Overview (Proposed vs Approved)</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Project</th><th>Client</th><th>Status</th>
                    <th style={{ textAlign: 'right' }}>Proposed</th>
                    <th style={{ textAlign: 'right' }}>Approved</th>
                    <th style={{ textAlign: 'right' }}>Delta</th>
                    <th style={{ textAlign: 'right' }}>Delta %</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.filter(p => p.approvedBudget).map(p => {
                    const proposed = p.proposalValue || p.totalProposedMoney || 0;
                    const delta = p.approvedBudget - proposed;
                    const pct = proposed > 0 ? ((delta / proposed) * 100).toFixed(1) : 0;
                    return (
                      <tr key={p.projectId}>
                        <td>
                          <strong>{p.projectName}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.projectId}</div>
                        </td>
                        <td>{p.clientName}</td>
                        <td><span className={`badge badge-pipeline-${p.pipelineStatus}`}>{p.pipelineStatus}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMoney(proposed)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{fmtMoney(p.approvedBudget)}</td>
                        <td style={{ textAlign: 'right', color: delta < 0 ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                          {delta < 0 ? '-' : '+'}₹{(Math.abs(delta) / 100000).toFixed(1)}L
                        </td>
                        <td style={{ textAlign: 'right', color: delta < 0 ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                          {delta < 0 ? '' : '+'}{pct}%
                        </td>
                      </tr>
                    );
                  })}
                  {projects.filter(p => p.approvedBudget).length > 0 && (
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3}>TOTAL</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(totalProposed)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{fmtMoney(totalApproved)}</td>
                      <td style={{ textAlign: 'right', color: totalApproved - totalProposed < 0 ? 'var(--error)' : 'var(--success)' }}>
                        {totalApproved - totalProposed < 0 ? '-' : '+'}₹{(Math.abs(totalApproved - totalProposed) / 100000).toFixed(1)}L
                      </td>
                      <td style={{ textAlign: 'right', color: totalApproved - totalProposed < 0 ? 'var(--error)' : 'var(--success)' }}>
                        {totalProposed > 0 ? `${(((totalApproved - totalProposed) / totalProposed) * 100).toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
