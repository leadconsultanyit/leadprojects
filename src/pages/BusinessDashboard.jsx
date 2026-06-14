import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProjectForm from '../components/ProjectForm';
import RevenueDashboard from '../components/RevenueDashboard';
import { fuzzyFilterSort } from '../utils/fuzzy';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const DEFAULT_LOSS_REASONS = ['Dropped', 'To other consultants', 'Low Cost', 'Arch dependent', 'Non-responsive', 'Budget constraint', 'ESG', 'Other'];

const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const isOverdue = (expectedDate, status) => {
  if (!expectedDate || status === 'completed') return false;
  return new Date(expectedDate) < new Date();
};
const daysUntil = (date) => {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
};
const fmtMoney = (v) => v ? `₹${(v / 100000).toFixed(1)}L` : '-';

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pipeline');
  const [pipelineTab, setPipelineTab] = useState('proposals');
  const [mapping, setMapping] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [triggerLoading, setTriggerLoading] = useState(null);
  const [triggerError, setTriggerError] = useState('');

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [wonModal, setWonModal] = useState(null);
  const [wonBudget, setWonBudget] = useState('');
  const [lostModal, setLostModal] = useState(null);
  const [lostReason, setLostReason] = useState('');
  const [lostReasonOther, setLostReasonOther] = useState('');
  const [lostComments, setLostComments] = useState('');
  const [workorderModal, setWorkorderModal] = useState(null);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [actionError, setActionError] = useState('');

  const [workorderMilestones, setWorkorderMilestones] = useState([]);
  const [proposalMilestonesModal, setProposalMilestonesModal] = useState(null);
  const [pipelineFilter, setPipelineFilter] = useState({ month: '', vertical: '', contactPoint: '', leadOffice: '', search: '', lossReason: '' });

  const [revisionModal, setRevisionModal] = useState(null);
  const [revisionAmount, setRevisionAmount] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [dynamicLossReasons, setDynamicLossReasons] = useState([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    axios.get('/api/projects/metadata/all').then(res => {
      const existing = (res.data.lossReasons || []).filter(r => r && !DEFAULT_LOSS_REASONS.includes(r));
      setDynamicLossReasons(existing);
    }).catch(() => {});
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const [mappingRes, projectsRes] = await Promise.all([
      axios.get('/api/projects/mapping/all'),
      axios.get('/api/projects')
    ]);
    setMapping(mappingRes.data);
    setAllProjects(projectsRes.data);
    if (selectedProject) {
      const updated = projectsRes.data.find(p => p.projectId === selectedProject.projectId);
      if (updated) {
        const empRes = mappingRes.data.find(m => m.projectId === updated.projectId);
        setSelectedProject({ ...updated, employees: empRes?.employees || [] });
      }
    }
  };

  const saveProject = async (data) => {
    if (editingProject) {
      await axios.put(`/api/projects/${editingProject.projectId}`, data);
      setShowProjectModal(false); setEditingProject(null); fetchData();
    } else {
      const res = await axios.post('/api/projects', data);
      setShowProjectModal(false);
      setProposalMilestonesModal(res.data);
      setWorkorderMilestones([{
        financialMilestoneId: 'FM-1', title: '', amount: '',
        technicalMilestones: [{ technicalMilestoneId: 'TM-1-1', title: '', expectedDate: '' }]
      }]);
      setActionError('');
      fetchData();
    }
  };

  // Universal stage transition — works from any current stage.
  const STAGE_OPTIONS = [
    { value: 'proposal', label: 'Proposal' },
    { value: 'won', label: 'Won' },
    { value: 'workorder', label: 'Work Order' },
    { value: 'workorder-held', label: 'Work Order (Held)' },
    { value: 'hold', label: 'Hold' },
    { value: 'lost', label: 'Lost / Failed' }
  ];

  const changeStage = async (project, targetStage, payload = {}) => {
    try {
      await axios.put(`/api/projects/${project.projectId}/change-stage`, { targetStage, ...payload });
      fetchData();
    } catch (err) { alert(err.response?.data?.message || 'Failed to change stage'); }
  };

  const handleStageSelect = (project, targetStage) => {
    if (!targetStage || targetStage === project.pipelineStatus) return;
    if (targetStage === 'won') {
      setWonModal(project); setWonBudget(project.approvedBudget ? String(project.approvedBudget) : ''); setActionError('');
    } else if (targetStage === 'lost') {
      setLostModal(project); setLostReason(''); setLostReasonOther(''); setLostComments(''); setActionError('');
    } else if (targetStage === 'workorder') {
      openWorkorderModal(project);
    } else {
      const label = STAGE_OPTIONS.find(s => s.value === targetStage)?.label || targetStage;
      if (window.confirm(`Move "${project.projectName}" to ${label}?`)) changeStage(project, targetStage);
    }
  };

  const renderStageMover = (project) => (
    <select
      value=""
      onChange={e => { handleStageSelect(project, e.target.value); e.target.value = ''; }}
      title="Move this project to another stage"
      style={{ padding: '5px 8px', border: '1px solid var(--info)', borderRadius: 6, fontSize: '0.8rem', color: 'var(--info)', fontWeight: 600, background: 'var(--surface)', cursor: 'pointer' }}
    >
      <option value="">Move to ▾</option>
      {STAGE_OPTIONS.filter(s => s.value !== project.pipelineStatus).map(s => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );

  const moveToWon = async () => {
    if (!wonBudget || Number(wonBudget) <= 0) { setActionError('Enter a valid budget'); return; }
    try {
      await axios.put(`/api/projects/${wonModal.projectId}/change-stage`, { targetStage: 'won', approvedBudget: Number(wonBudget) });
      setWonModal(null); setWonBudget(''); setActionError(''); fetchData();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed'); }
  };

  const moveToLost = async () => {
    if (!lostReason) { setActionError('Select a loss reason'); return; }
    if (lostReason === 'Other' && !lostReasonOther.trim()) { setActionError('Specify the loss reason'); return; }
    try {
      await axios.put(`/api/projects/${lostModal.projectId}/change-stage`, {
        targetStage: 'lost',
        lossReason: lostReason === 'Other' ? lostReasonOther : lostReason,
        lossReasonOther: lostReason === 'Other' ? lostReasonOther : '',
        lossComments
      });
      setLostModal(null); setLostReason(''); setLostReasonOther(''); setLostComments(''); setActionError(''); fetchData();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed'); }
  };

  const moveToHold = async (project) => {
    try {
      await axios.put(`/api/projects/${project.projectId}/move-to-hold`);
      fetchData();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const moveToProposal = async (project) => {
    try {
      await axios.put(`/api/projects/${project.projectId}/move-to-proposal`);
      fetchData();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const openWorkorderModal = async (project) => {
    setWorkorderModal(project); setSelectedEmployees([]); setLoadingEmployees(true); setActionError('');
    const existingFMs = (project.financialMilestones || []).filter(fm => fm.title);
    setWorkorderMilestones(existingFMs.length > 0
      ? existingFMs.map((fm, i) => ({
          ...fm,
          financialMilestoneId: fm.financialMilestoneId || `FM-${i + 1}`,
          technicalMilestones: (fm.technicalMilestones || []).map((tm, j) => ({
            ...tm,
            technicalMilestoneId: tm.technicalMilestoneId || `TM-${i + 1}-${j + 1}`
          }))
        }))
      : [{
          financialMilestoneId: 'FM-1', title: '', amount: '',
          technicalMilestones: [{ technicalMilestoneId: 'TM-1-1', title: '', expectedDate: '' }]
        }]);
    try {
      setAvailableEmployees((await axios.get(`/api/projects/${project.projectId}/available-employees`)).data);
    } catch { setActionError('Failed to load employees'); }
    setLoadingEmployees(false);
  };

  const addFinancialMilestone = () => {
    const idx = workorderMilestones.length + 1;
    setWorkorderMilestones([...workorderMilestones, {
      financialMilestoneId: `FM-${idx}`, title: '', amount: '',
      technicalMilestones: [{ technicalMilestoneId: `TM-${idx}-1`, title: '', expectedDate: '' }]
    }]);
  };

  const updateFM = (i, field, value) => {
    const ms = [...workorderMilestones];
    ms[i] = { ...ms[i], [field]: value };
    setWorkorderMilestones(ms);
  };

  const removeFM = (i) => {
    setWorkorderMilestones(workorderMilestones.filter((_, idx) => idx !== i));
  };

  const addTM = (fmIdx) => {
    const ms = [...workorderMilestones];
    const tmIdx = ms[fmIdx].technicalMilestones.length + 1;
    ms[fmIdx].technicalMilestones = [...ms[fmIdx].technicalMilestones, {
      technicalMilestoneId: `TM-${fmIdx + 1}-${tmIdx}`, title: '', expectedDate: ''
    }];
    setWorkorderMilestones(ms);
  };

  const updateTM = (fmIdx, tmIdx, field, value) => {
    const ms = [...workorderMilestones];
    ms[fmIdx].technicalMilestones = [...ms[fmIdx].technicalMilestones];
    ms[fmIdx].technicalMilestones[tmIdx] = { ...ms[fmIdx].technicalMilestones[tmIdx], [field]: value };
    setWorkorderMilestones(ms);
  };

  const removeTM = (fmIdx, tmIdx) => {
    const ms = [...workorderMilestones];
    ms[fmIdx].technicalMilestones = ms[fmIdx].technicalMilestones.filter((_, i) => i !== tmIdx);
    setWorkorderMilestones(ms);
  };

  const moveToWorkorder = async () => {
    if (selectedEmployees.length < 1) { setActionError('Select at least 1 employee'); return; }
    const milestones = workorderMilestones
      .filter(fm => fm.title.trim())
      .map(fm => ({
        ...fm,
        amount: Number(fm.amount) || 0,
        status: 'pending',
        technicalMilestones: fm.technicalMilestones
          .filter(tm => tm.title.trim())
          .map(tm => ({ ...tm, status: 'pending', expectedDate: tm.expectedDate || null }))
      }));
    try {
      await axios.put(`/api/projects/${workorderModal.projectId}/change-stage`, {
        targetStage: 'workorder',
        assignedEmployeeIds: selectedEmployees,
        financialMilestones: milestones
      });
      setWorkorderModal(null); setSelectedEmployees([]); setWorkorderMilestones([]); setActionError(''); fetchData();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed'); }
  };

  const toggleEmployee = (empId) => {
    setSelectedEmployees(prev => prev.includes(empId) ? prev.filter(e => e !== empId) : [...prev, empId]);
  };

  const triggerFinancial = async (projectId, financialMilestoneId) => {
    setTriggerLoading(financialMilestoneId); setTriggerError('');
    try {
      const res = await axios.put(`/api/projects/${projectId}/trigger-financial`, { financialMilestoneId });
      const empData = mapping.find(m => m.projectId === projectId);
      setSelectedProject({ ...res.data, employees: empData?.employees || [] });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to trigger';
      const pending = err.response?.data?.pending;
      setTriggerError(pending ? `${msg}: ${pending.join(', ')}` : msg);
    } finally {
      setTriggerLoading(null);
      setTimeout(() => setTriggerError(''), 5000);
    }
  };

  const addRevision = async () => {
    if (!revisionAmount || Number(revisionAmount) <= 0) { setActionError('Enter a valid amount'); return; }
    try {
      await axios.post(`/api/projects/${revisionModal.projectId}/revision`, {
        amount: Number(revisionAmount), notes: revisionNotes
      });
      setRevisionModal(null); setRevisionAmount(''); setRevisionNotes(''); setActionError(''); fetchData();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed to add revision'); }
  };

  const saveProposalMilestones = async () => {
    const milestones = workorderMilestones
      .filter(fm => fm.title.trim())
      .map(fm => ({
        ...fm,
        amount: Number(fm.amount) || 0,
        status: 'pending',
        technicalMilestones: fm.technicalMilestones
          .filter(tm => tm.title.trim())
          .map(tm => ({ ...tm, status: 'pending', expectedDate: tm.expectedDate || null }))
      }));
    try {
      await axios.put(`/api/projects/${proposalMilestonesModal.projectId}`, { financialMilestones: milestones });
      setProposalMilestonesModal(null); setWorkorderMilestones([]); setActionError(''); fetchData();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed to save milestones'); }
  };

  const applyPipelineFilter = (list) => {
    const filtered = list.filter(p => {
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
      return true;
    });
    // Fuzzy, ranked search (tolerant of typos; best matches first)
    return fuzzyFilterSort(
      pipelineFilter.search,
      filtered,
      p => [p.projectName, p.clientName, p.projectId]
    );
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
      'Location': p.projectLocation || '',
      ...(p.lossReason ? { 'Loss Reason': p.lossReason, 'Loss Comments': p.lossComments || '' } : {}),
      'Status': p.pipelineStatus
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const proposals = allProjects.filter(p => p.pipelineStatus === 'proposal');
  const wonProjects = allProjects.filter(p => p.pipelineStatus === 'won');
  const workorders = allProjects.filter(p => p.pipelineStatus === 'workorder');
  const holdProjects = allProjects.filter(p => p.pipelineStatus === 'hold');
  const lostProjects = allProjects.filter(p => p.pipelineStatus === 'lost');

  const filteredProposals = applyPipelineFilter(proposals);
  const filteredWonProjects = applyPipelineFilter(wonProjects);
  const filteredHoldProjects = applyPipelineFilter(holdProjects);
  const filteredLostProjects = applyPipelineFilter(lostProjects);
  const filteredAllProjects = applyPipelineFilter(allProjects);

  const activeFilteredList = pipelineTab === 'all' ? filteredAllProjects
    : pipelineTab === 'proposals' ? filteredProposals
    : pipelineTab === 'won' ? filteredWonProjects
    : pipelineTab === 'hold' ? filteredHoldProjects
    : filteredLostProjects;

  const activeUnfilteredList = pipelineTab === 'all' ? allProjects
    : pipelineTab === 'proposals' ? proposals
    : pipelineTab === 'won' ? wonProjects
    : pipelineTab === 'hold' ? holdProjects
    : lostProjects;

  const allMonths = [...new Set(allProjects.map(p => {
    const d = p.proposalMonth || p.createdAt;
    return d ? new Date(d).toISOString().slice(0, 7) : null;
  }).filter(Boolean))].sort().reverse();

  const allLeadOffices = [...new Set(allProjects.map(p => p.leadOffice).filter(Boolean))].sort();

  const totalProposed = allProjects.reduce((s, p) => s + (p.proposalValue || p.totalProposedMoney || 0), 0);
  const totalApproved = allProjects.filter(p => p.approvedBudget).reduce((s, p) => s + p.approvedBudget, 0);
  const pendingFMValue = workorders.reduce((s, p) =>
    s + p.financialMilestones.filter(fm => fm.status !== 'completed').reduce((s2, fm) => s2 + fm.amount, 0), 0);

  const openDetail = (project) => {
    const empData = mapping.find(m => m.projectId === project.projectId);
    setSelectedProject({ ...project, employees: empData?.employees || [] });
    setTriggerError('');
  };

  const renderMetaTags = (project) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {project.leadOffice && <span className="meta-tag">{project.leadOffice}</span>}
      {project.services?.map(s => <span key={s} className="meta-tag tag-service">{s}</span>)}
      {project.ratingSystem?.map(r => <span key={r} className="meta-tag tag-rating">{r}</span>)}
      {project.buildingUsage && <span className="meta-tag tag-building">{project.buildingUsage}</span>}
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

  return (
    <div>
      <div className="dashboard-header">
        <h1>Business Dashboard</h1>
      </div>

      <div className="stats-row">
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
        <div className="stat-box">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{fmtMoney(pendingFMValue)}</div>
          <div className="stat-label">Pending Payments</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'pipeline' ? 'active' : ''}`} onClick={() => setTab('pipeline')}>Pipeline</button>
        <button className={`tab ${tab === 'workorders' ? 'active' : ''}`} onClick={() => setTab('workorders')}>
          Workorders ({workorders.length})
        </button>
        <button className={`tab ${tab === 'deltas' ? 'active' : ''}`} onClick={() => setTab('deltas')}>Budget Deltas</button>
        <button className={`tab ${tab === 'revenue' ? 'active' : ''}`} onClick={() => setTab('revenue')}>Revenue Dashboard</button>
      </div>

      {tab === 'revenue' && <RevenueDashboard />}

      {tab === 'pipeline' && (
        <div>
          <div className="pipeline-tabs">
            {[
              { key: 'all', label: 'All', count: allProjects.length, color: '#6366F1' },
              { key: 'proposals', label: 'Proposals', count: proposals.length, color: 'var(--info)' },
              { key: 'won', label: 'Won', count: wonProjects.length, color: 'var(--success)' },
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

          {pipelineTab === 'proposals' && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-blue" onClick={() => { setEditingProject(null); setShowProjectModal(true); }}>
                + New Proposal
              </button>
            </div>
          )}

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
                  <div className="btn-group" style={{ marginTop: 12 }}>
                    {renderStageMover(p)}
                  </div>
                </div>
              );
            })}

            {pipelineTab === 'proposals' && filteredProposals.map(p => {
              const revData = (p.revisions || []).map(r => ({
                name: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                amount: r.amount
              }));
              return (
                <div className="card pipeline-card" key={p.projectId}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">{p.projectName}</div>
                      <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                    </div>
                    <span className="vertical-tag">{p.vertical}</span>
                  </div>
                  <div className="money" style={{ marginBottom: 4 }}>{fmtMoney(p.proposalValue || p.totalProposedMoney)}</div>
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
                  <div className="btn-group" style={{ marginTop: 12 }}>
                    <button className="btn btn-sm btn-green" onClick={() => { setWonModal(p); setWonBudget(''); setActionError(''); }}>Won</button>
                    <button className="btn btn-sm" style={{ background: 'var(--warning)', color: '#fff' }} onClick={() => moveToHold(p)}>Hold</button>
                    <button className="btn btn-sm btn-red" onClick={() => { setLostModal(p); setLostReason(''); setLostReasonOther(''); setLostComments(''); setActionError(''); }}>Lost</button>
                    {renderStageMover(p)}
                    <button className="btn btn-sm btn-outline" onClick={() => { setEditingProject(p); setShowProjectModal(true); }}>Edit</button>
                    <button className="btn btn-sm btn-outline"
                      onClick={() => { setRevisionModal(p); setRevisionAmount(''); setRevisionNotes(''); setActionError(''); }}>
                      + Revision
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={() => {
                      const existingFMs = (p.financialMilestones || []).filter(fm => fm.title);
                      setProposalMilestonesModal(p);
                      setWorkorderMilestones(existingFMs.length > 0
                        ? existingFMs.map((fm, i) => ({
                            ...fm,
                            financialMilestoneId: fm.financialMilestoneId || `FM-${i + 1}`,
                            technicalMilestones: (fm.technicalMilestones || []).map((tm, j) => ({
                              ...tm,
                              technicalMilestoneId: tm.technicalMilestoneId || `TM-${i + 1}-${j + 1}`
                            }))
                          }))
                        : [{ financialMilestoneId: 'FM-1', title: '', amount: '', technicalMilestones: [{ technicalMilestoneId: 'TM-1-1', title: '', expectedDate: '' }] }]);
                      setActionError('');
                    }}>
                      {(p.financialMilestones || []).some(fm => fm.title) ? 'Edit Milestones' : '+ Milestones'}
                    </button>
                    {(p.financialMilestones || []).some(fm => fm.title) && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#7C3AED', color: '#fff' }}
                        onClick={async () => {
                          try {
                            const res = await axios.post('/api/proposal-documents', { projectId: p.projectId });
                            navigate(`/proposal-documents?id=${res.data._id}`);
                          } catch (err) {
                            alert('Failed to create proposal document: ' + (err.response?.data?.message || err.message));
                          }
                        }}
                      >
                        Create Proposal Doc
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {pipelineTab === 'won' && filteredWonProjects.map(p => (
              <div className="card pipeline-card" key={p.projectId} style={{ borderLeft: '4px solid var(--success)' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{p.projectName}</div>
                    <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                  </div>
                  <span className="vertical-tag">{p.vertical}</span>
                </div>
                <div className="delta-inline">
                  <span>Proposed: {fmtMoney(p.proposalValue || p.totalProposedMoney)}</span>
                  <span>Approved: <strong style={{ color: 'var(--success)' }}>{fmtMoney(p.approvedBudget)}</strong></span>
                </div>
                {renderContactPoint(p.contactPoint)}
                {renderMetaTags(p)}
                <div className="btn-group" style={{ marginTop: 12 }}>
                  <button className="btn btn-sm btn-blue" onClick={() => openWorkorderModal(p)}>Move to Workorder</button>
                  {renderStageMover(p)}
                </div>
              </div>
            ))}

            {pipelineTab === 'hold' && filteredHoldProjects.map(p => (
              <div className="card pipeline-card" key={p.projectId} style={{ borderLeft: '4px solid var(--warning)' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{p.projectName}</div>
                    <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                  </div>
                  <span className="vertical-tag">{p.vertical}</span>
                </div>
                <div className="money" style={{ marginBottom: 4 }}>{fmtMoney(p.proposalValue || p.totalProposedMoney)}</div>
                {renderContactPoint(p.contactPoint)}
                {renderMetaTags(p)}
                <div className="btn-group" style={{ marginTop: 12 }}>
                  <button className="btn btn-sm btn-blue" onClick={() => moveToProposal(p)}>Back to Proposal</button>
                  <button className="btn btn-sm btn-green" onClick={() => { setWonModal(p); setWonBudget(''); setActionError(''); }}>Won</button>
                  <button className="btn btn-sm btn-red" onClick={() => { setLostModal(p); setLostReason(''); setLostReasonOther(''); setLostComments(''); setActionError(''); }}>Lost</button>
                  {renderStageMover(p)}
                </div>
              </div>
            ))}

            {pipelineTab === 'lost' && filteredLostProjects.map(p => (
              <div className="card pipeline-card" key={p.projectId} style={{ borderLeft: '4px solid var(--error)' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{p.projectName}</div>
                    <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                  </div>
                  <span className="vertical-tag">{p.vertical}</span>
                </div>
                <div className="money" style={{ marginBottom: 4 }}>{fmtMoney(p.proposalValue || p.totalProposedMoney)}</div>
                <div className="loss-info">
                  <div><strong>Reason:</strong> <span className="badge badge-lost">{p.lossReason}</span></div>
                  {p.lossReasonOther && <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Detail: {p.lossReasonOther}</div>}
                  {p.lossComments && <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    "{p.lossComments}"
                  </div>}
                </div>
                {renderContactPoint(p.contactPoint)}
                {renderMetaTags(p)}
                <div className="btn-group" style={{ marginTop: 12 }}>
                  {renderStageMover(p)}
                </div>
              </div>
            ))}
          </div>

          {pipelineTab === 'all' && filteredAllProjects.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {allProjects.length === 0 ? 'No projects yet.' : 'No projects match your filters.'}
            </div>
          )}
          {pipelineTab === 'proposals' && filteredProposals.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {proposals.length === 0 ? 'No proposals.' : 'No proposals match your filters.'}
            </div>
          )}
          {pipelineTab === 'won' && filteredWonProjects.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {wonProjects.length === 0 ? 'No won projects.' : 'No won projects match your filters.'}
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

      {tab === 'workorders' && (
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 16 }}>
            Workorders ({workorders.length}) - click to view milestone timeline
          </h2>
          {workorders.map(p => {
            const totalTMs = p.financialMilestones.reduce((s, fm) => s + fm.technicalMilestones.length, 0);
            const completedTMs = p.financialMilestones.reduce(
              (s, fm) => s + fm.technicalMilestones.filter(t => t.status === 'completed').length, 0);
            const progress = totalTMs > 0 ? Math.round((completedTMs / totalTMs) * 100) : 0;
            const completedFMs = p.financialMilestones.filter(f => f.status === 'completed').length;
            const empData = mapping.find(m => m.projectId === p.projectId);
            const empCount = empData?.employees?.length || p.assignedEmployeeIds?.length || 0;

            return (
              <div key={p.projectId} className="biz-project-row" onClick={() => openDetail(p)}>
                <div className="biz-project-left">
                  <div className="biz-project-name">{p.projectName}</div>
                  <div className="biz-project-sub">
                    {p.projectId} &middot; {p.clientName} &middot; {empCount} employees
                  </div>
                </div>
                <div className="biz-project-right">
                  <span className="vertical-tag">{p.vertical}</span>
                  <span className="money">{fmtMoney(p.totalProposedMoney)}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: 70, textAlign: 'right' }}>
                    {completedFMs}/{p.financialMilestones.length} FM
                  </span>
                  <div className="biz-mini-progress">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: 36 }}>{progress}%</span>
                  <span className={`badge badge-${p.projectStatus}`}>{p.projectStatus}</span>
                </div>
              </div>
            );
          })}
          {workorders.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              No workorder projects yet. Move won proposals to workorder stage first.
            </div>
          )}
        </div>
      )}

      {tab === 'deltas' && (
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Budget Delta Overview</h3>
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
                {allProjects.filter(p => p.approvedBudget).map(p => {
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
                {allProjects.filter(p => p.approvedBudget).length > 0 && (
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
      )}

      {/* WORKORDER DETAIL MODAL */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 850 }}>
            <div className="modal-header">
              <h2>{selectedProject.projectName}</h2>
              <button className="btn-icon" onClick={() => setSelectedProject(null)} style={{ fontSize: '1.2rem' }}>&#10005;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '80vh' }}>
              <div className="project-meta-grid">
                <div className="meta-item"><div className="meta-label">Project ID</div><div className="meta-value">{selectedProject.projectId}</div></div>
                <div className="meta-item"><div className="meta-label">Client</div><div className="meta-value">{selectedProject.clientName}</div></div>
                <div className="meta-item"><div className="meta-label">Vertical</div><div className="meta-value">{selectedProject.vertical}</div></div>
                <div className="meta-item"><div className="meta-label">Proposed</div><div className="meta-value">{fmtMoney(selectedProject.proposalValue || selectedProject.totalProposedMoney)}</div></div>
                <div className="meta-item"><div className="meta-label">Approved</div><div className="meta-value" style={{ color: 'var(--success)' }}>{fmtMoney(selectedProject.approvedBudget)}</div></div>
                <div className="meta-item"><div className="meta-label">Status</div><div className="meta-value"><span className={`badge badge-${selectedProject.projectStatus}`}>{selectedProject.projectStatus}</span></div></div>
                <div className="meta-item"><div className="meta-label">Team ({selectedProject.employees?.length || 0})</div>
                  <div className="meta-value" style={{ fontSize: '0.85rem' }}>
                    {selectedProject.employees?.length > 0
                      ? selectedProject.employees.map(e => e.name).join(', ')
                      : selectedProject.assignedEmployeeIds?.join(', ') || 'None'}
                  </div>
                </div>
                {selectedProject.leadOffice && <div className="meta-item"><div className="meta-label">Office</div><div className="meta-value">{selectedProject.leadOffice}</div></div>}
              </div>

              {triggerError && <div className="auth-error" style={{ marginBottom: 16 }}>{triggerError}</div>}

              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Milestone Timeline</h3>
              <div className="timeline">
                {selectedProject.financialMilestones.map((fm) => {
                  const allTMsDone = fm.technicalMilestones.length === 0 || fm.technicalMilestones.every(t => t.status === 'completed');
                  const canTrigger = fm.status !== 'completed' && allTMsDone;
                  const nodeClass = canTrigger ? 'ready' : fm.status;
                  const overdue = isOverdue(fm.expectedDate, fm.status);
                  const days = daysUntil(fm.expectedDate);
                  const completedTMs = fm.technicalMilestones.filter(t => t.status === 'completed').length;
                  const totalTMs = fm.technicalMilestones.length;

                  return (
                    <div className="tl-fm" key={fm.financialMilestoneId}>
                      <div className={`tl-fm-node ${nodeClass}`}>
                        {fm.status === 'completed' ? '✓' : '₹'}
                      </div>
                      <div className={`tl-fm-card ${canTrigger ? 'ready' : fm.status}`}>
                        <div className="tl-fm-top">
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{fm.financialMilestoneId}</span>
                              <span className={`badge badge-${fm.status}`}>
                                {fm.status === 'completed' ? 'COMPLETED' : canTrigger ? 'READY TO TRIGGER' : fm.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <div className="tl-fm-title">{fm.title}</div>
                          </div>
                          <div className="tl-fm-amount">{'₹'}{fm.amount?.toLocaleString('en-IN')}</div>
                        </div>
                        <div className="tl-fm-dates">
                          <span>
                            <span className="date-label">Expected:</span>
                            <span className={overdue ? 'overdue' : ''}>
                              {fmtDate(fm.expectedDate) || '—'}
                              {overdue && ` (${Math.abs(days)}d overdue)`}
                              {!overdue && days !== null && fm.status !== 'completed' && days > 0 && ` (${days}d left)`}
                            </span>
                          </span>
                          {fm.completedDate && <span><span className="date-label">Completed:</span><span className="on-time">{fmtDate(fm.completedDate)}</span></span>}
                          {totalTMs > 0 && <span><span className="date-label">Technical:</span>{completedTMs}/{totalTMs} done</span>}
                        </div>
                        {fm.technicalMilestones.length > 0 && (
                          <div className="tl-tm-list">
                            {fm.technicalMilestones.map(tm => (
                              <div className="tl-tm-item" key={tm.technicalMilestoneId}>
                                <div className={`tl-tm-dot ${tm.status}`} />
                                <span className="tl-tm-title"><span style={{ fontWeight: 500 }}>{tm.technicalMilestoneId}:</span> {tm.title}</span>
                                <span className={`badge badge-${tm.status}`} style={{ fontSize: '0.65rem', padding: '1px 7px' }}>{tm.status.replace('_', ' ')}</span>
                                <span className="tl-tm-date">
                                  {tm.completedDate ? <span className="on-time">{fmtDate(tm.completedDate)}</span> :
                                    <span className={isOverdue(tm.expectedDate, tm.status) ? 'overdue' : ''}>{fmtDate(tm.expectedDate) || '—'}{isOverdue(tm.expectedDate, tm.status) && ' !'}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {fm.status !== 'completed' && (
                          <div className="tl-trigger-row">
                            {canTrigger ? (
                              <>
                                <span className="tl-trigger-info" style={{ color: 'var(--success)' }}>All technical milestones completed</span>
                                <button className="btn-trigger can-trigger"
                                  onClick={() => triggerFinancial(selectedProject.projectId, fm.financialMilestoneId)}
                                  disabled={triggerLoading === fm.financialMilestoneId}>
                                  {triggerLoading === fm.financialMilestoneId ? 'Triggering...' : 'Trigger Milestone'}
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="tl-trigger-info blocked">
                                  {totalTMs === 0 ? 'No technical milestones' : `${totalTMs - completedTMs} remaining`}
                                </span>
                                {totalTMs === 0 ? (
                                  <button className="btn-trigger can-trigger"
                                    onClick={() => triggerFinancial(selectedProject.projectId, fm.financialMilestoneId)}
                                    disabled={triggerLoading === fm.financialMilestoneId}>
                                    {triggerLoading === fm.financialMilestoneId ? 'Triggering...' : 'Trigger Milestone'}
                                  </button>
                                ) : <button className="btn-trigger" disabled>Cannot Trigger Yet</button>}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION MODALS */}

      {showProjectModal && (
        <div className="modal-overlay" onClick={() => { setShowProjectModal(false); setEditingProject(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 850 }}>
            <div className="modal-header">
              <h2>{editingProject ? 'Edit Project' : 'New Proposal'}</h2>
              <button className="btn-icon" onClick={() => { setShowProjectModal(false); setEditingProject(null); }}>&#10005;</button>
            </div>
            <div className="modal-body">
              <ProjectForm project={editingProject} onSave={saveProject}
                onCancel={() => { setShowProjectModal(false); setEditingProject(null); }} />
            </div>
          </div>
        </div>
      )}

      {proposalMilestonesModal && (
        <div className="modal-overlay" onClick={() => { setProposalMilestonesModal(null); setWorkorderMilestones([]); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 850 }}>
            <div className="modal-header">
              <h2>Add Milestones (Optional)</h2>
              <button className="btn-icon" onClick={() => { setProposalMilestonesModal(null); setWorkorderMilestones([]); }}>&#10005;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '80vh' }}>
              <p style={{ marginBottom: 8 }}>
                <strong>{proposalMilestonesModal.projectName}</strong> ({proposalMilestonesModal.projectId})
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Proposal created. Optionally add financial and technical milestones now, or skip to do it later.
              </p>
              {actionError && <div className="auth-error">{actionError}</div>}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Financial & Technical Milestones</h3>
              {workorderMilestones.map((fm, fmIdx) => (
                <div key={fmIdx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 12, background: 'var(--card, #F3F4F6)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: '0.9rem' }}>Financial Milestone {fmIdx + 1}</strong>
                    {workorderMilestones.length > 1 && (
                      <button type="button" className="btn btn-sm btn-red" onClick={() => removeFM(fmIdx)} style={{ padding: '2px 8px' }}>Remove</button>
                    )}
                  </div>
                  <div className="inline-fields">
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: '0.8rem' }}>Title</label>
                      <input value={fm.title} onChange={e => updateFM(fmIdx, 'title', e.target.value)} placeholder="e.g., Registration Payment" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: '0.8rem' }}>Amount (INR)</label>
                      <input type="number" value={fm.amount} onChange={e => updateFM(fmIdx, 'amount', e.target.value)} placeholder="Amount" />
                    </div>
                  </div>
                  <div style={{ marginLeft: 16 }}>
                    {fm.technicalMilestones.map((tm, tmIdx) => (
                      <div key={tmIdx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: 50 }}>TM-{fmIdx + 1}-{tmIdx + 1}</span>
                        <input value={tm.title} onChange={e => updateTM(fmIdx, tmIdx, 'title', e.target.value)}
                          placeholder="Technical milestone title" style={{ flex: 1 }} />
                        <input type="date" value={tm.expectedDate} onChange={e => updateTM(fmIdx, tmIdx, 'expectedDate', e.target.value)}
                          style={{ width: 150 }} />
                        {fm.technicalMilestones.length > 1 && (
                          <button type="button" className="btn-icon" onClick={() => removeTM(fmIdx, tmIdx)}
                            style={{ fontSize: '0.8rem', color: 'var(--error)' }}>&#10005;</button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => addTM(fmIdx)}
                      style={{ marginTop: 4, fontSize: '0.8rem' }}>+ Add Technical Milestone</button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline" onClick={addFinancialMilestone}
                style={{ marginBottom: 16 }}>+ Add Financial Milestone</button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setProposalMilestonesModal(null); setWorkorderMilestones([]); }}>Skip</button>
              <button className="btn btn-blue" onClick={saveProposalMilestones}>Save Milestones</button>
            </div>
          </div>
        </div>
      )}

      {wonModal && (
        <div className="modal-overlay" onClick={() => setWonModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Mark as Won</h2>
              <button className="btn-icon" onClick={() => setWonModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}><strong>{wonModal.projectName}</strong> ({wonModal.projectId})</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Proposed: <strong className="money">{fmtMoney(wonModal.proposalValue || wonModal.totalProposedMoney)}</strong>
              </p>
              {actionError && <div className="auth-error">{actionError}</div>}
              <div className="form-group">
                <label>Approved Budget by Client (INR)</label>
                <input type="number" value={wonBudget} onChange={e => setWonBudget(e.target.value)}
                  placeholder="Enter approved budget" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setWonModal(null)}>Cancel</button>
              <button className="btn btn-green" onClick={moveToWon}>Confirm Won</button>
            </div>
          </div>
        </div>
      )}

      {lostModal && (
        <div className="modal-overlay" onClick={() => setLostModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Mark as Lost</h2>
              <button className="btn-icon" onClick={() => setLostModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}><strong>{lostModal.projectName}</strong> ({lostModal.projectId})</p>
              {actionError && <div className="auth-error">{actionError}</div>}
              <div className="form-group">
                <label>Loss Reason</label>
                <select value={lostReason} onChange={e => { setLostReason(e.target.value); if (e.target.value !== 'Other') setLostReasonOther(''); }}>
                  <option value="">Select reason...</option>
                  {[...DEFAULT_LOSS_REASONS.filter(r => r !== 'Other'), ...dynamicLossReasons, 'Other'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {lostReason === 'Other' && (
                <div className="form-group">
                  <label>Specify Reason</label>
                  <input value={lostReasonOther} onChange={e => setLostReasonOther(e.target.value)}
                    placeholder="Enter the loss reason (will be saved for future use)" />
                </div>
              )}
              <div className="form-group">
                <label>Comments</label>
                <textarea value={lostComments} onChange={e => setLostComments(e.target.value)}
                  placeholder="Additional comments..." rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                    borderRadius: 6, fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setLostModal(null)}>Cancel</button>
              <button className="btn btn-red" onClick={moveToLost}>Confirm Lost</button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {revisionModal && (
        <div className="modal-overlay" onClick={() => setRevisionModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <h2>Add Proposal Revision</h2>
              <button className="btn-icon" onClick={() => setRevisionModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 8 }}>
                <strong>{revisionModal.projectName}</strong> ({revisionModal.projectId})
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Current: <strong className="money">{fmtMoney(revisionModal.proposalValue || revisionModal.totalProposedMoney)}</strong>
              </p>
              {actionError && <div className="auth-error">{actionError}</div>}
              {(revisionModal.revisions || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Revision History</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={(revisionModal.revisions || []).map(r => ({
                      name: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                      amount: r.amount
                    }))}>
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} fontSize={10} width={50} />
                      <Tooltip formatter={v => fmtMoney(v)} />
                      <Line type="monotone" dataKey="amount" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ maxHeight: 120, overflowY: 'auto', marginTop: 8 }}>
                    {(revisionModal.revisions || []).map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: '0.82rem', borderBottom: '1px solid var(--border)' }}>
                        <span>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span style={{ fontWeight: 600 }}>{fmtMoney(r.amount)}</span>
                        <span style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>New Proposed Amount (INR)</label>
                <input type="number" value={revisionAmount} onChange={e => setRevisionAmount(e.target.value)}
                  placeholder="Enter revised amount" autoFocus />
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <input value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)}
                  placeholder="Reason for revision" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setRevisionModal(null)}>Cancel</button>
              <button className="btn btn-blue" onClick={addRevision}>Add Revision</button>
            </div>
          </div>
        </div>
      )}

      {workorderModal && (
        <div className="modal-overlay" onClick={() => setWorkorderModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 850 }}>
            <div className="modal-header">
              <h2>Assign to Workorder</h2>
              <button className="btn-icon" onClick={() => setWorkorderModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '80vh' }}>
              <p style={{ marginBottom: 8 }}><strong>{workorderModal.projectName}</strong> ({workorderModal.projectId})</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Requirements: {[...(workorderModal.ratingSystem || []), ...(workorderModal.services || []),
                  ...(workorderModal.certificationType || [])].join(', ') || 'None specified'}
              </p>
              {actionError && <div className="auth-error">{actionError}</div>}

              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Employee Assignment</h3>
              {loadingEmployees ? <p>Loading...</p> : (
                <div className="employee-list" style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 20 }}>
                  {availableEmployees.map(emp => (
                    <label key={emp.employeeId}
                      className={`employee-option ${selectedEmployees.includes(emp.employeeId) ? 'selected' : ''} ${!emp.available ? 'unavailable' : ''}`}>
                      <input type="checkbox" checked={selectedEmployees.includes(emp.employeeId)}
                        onChange={() => toggleEmployee(emp.employeeId)} disabled={!emp.available} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong>{emp.name}</strong>
                          <code style={{ fontSize: '0.75rem' }}>{emp.employeeId}</code>
                          {!emp.available && <span className="badge badge-unverified">MAX 3</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {emp.activeProjectCount}/3 projects
                          {emp.credentials?.length > 0 && ` | ${emp.credentials.slice(0, 5).join(', ')}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className={`match-score ${emp.matchScore >= 50 ? 'high' : emp.matchScore > 0 ? 'medium' : 'low'}`}>
                          {emp.matchScore}% match
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Financial & Technical Milestones</h3>
              {workorderMilestones.map((fm, fmIdx) => (
                <div key={fmIdx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 12, background: 'var(--card, #F3F4F6)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: '0.9rem' }}>Financial Milestone {fmIdx + 1}</strong>
                    {workorderMilestones.length > 1 && (
                      <button type="button" className="btn btn-sm btn-red" onClick={() => removeFM(fmIdx)} style={{ padding: '2px 8px' }}>Remove</button>
                    )}
                  </div>
                  <div className="inline-fields">
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: '0.8rem' }}>Title</label>
                      <input value={fm.title} onChange={e => updateFM(fmIdx, 'title', e.target.value)} placeholder="e.g., Registration Payment" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: '0.8rem' }}>Amount (INR)</label>
                      <input type="number" value={fm.amount} onChange={e => updateFM(fmIdx, 'amount', e.target.value)} placeholder="Amount" />
                    </div>
                  </div>
                  <div style={{ marginLeft: 16 }}>
                    {fm.technicalMilestones.map((tm, tmIdx) => (
                      <div key={tmIdx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: 50 }}>TM-{fmIdx + 1}-{tmIdx + 1}</span>
                        <input value={tm.title} onChange={e => updateTM(fmIdx, tmIdx, 'title', e.target.value)}
                          placeholder="Technical milestone title" style={{ flex: 1 }} />
                        <input type="date" value={tm.expectedDate} onChange={e => updateTM(fmIdx, tmIdx, 'expectedDate', e.target.value)}
                          style={{ width: 150 }} />
                        {fm.technicalMilestones.length > 1 && (
                          <button type="button" className="btn-icon" onClick={() => removeTM(fmIdx, tmIdx)}
                            style={{ fontSize: '0.8rem', color: 'var(--error)' }}>&#10005;</button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => addTM(fmIdx)}
                      style={{ marginTop: 4, fontSize: '0.8rem' }}>+ Add Technical Milestone</button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline" onClick={addFinancialMilestone}
                style={{ marginBottom: 16 }}>+ Add Financial Milestone</button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setWorkorderModal(null)}>Cancel</button>
              <button className="btn btn-blue" onClick={moveToWorkorder} disabled={selectedEmployees.length < 1}>
                Assign & Move to Workorder ({selectedEmployees.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
