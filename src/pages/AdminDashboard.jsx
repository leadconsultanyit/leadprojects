import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProjectForm from '../components/ProjectForm';
import RevenueDashboard from '../components/RevenueDashboard';
import { fuzzyFilterSort } from '../utils/fuzzy';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import * as XLSX from 'xlsx';

const DEFAULT_LOSS_REASONS = ['Dropped', 'To other consultants', 'Low Cost', 'Arch dependent', 'Non-responsive', 'Budget constraint', 'ESG', 'Other'];
const CHART_COLORS = ['#059669', '#7C3AED', '#0891B2', '#D97706', '#E11D48', '#047857', '#6D28D9', '#14B8A6'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('employees');
  const [pipelineTab, setPipelineTab] = useState('proposals');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'employee', employeeId: '', maxProjects: 3 });
  const [cvUser, setCvUser] = useState(null);

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

  // Workorder milestones
  const [workorderMilestones, setWorkorderMilestones] = useState([]);
  const [proposalMilestonesModal, setProposalMilestonesModal] = useState(null);

  // Reassign employees modal
  const [reassignModal, setReassignModal] = useState(null);
  const [reassignEmployees, setReassignEmployees] = useState([]);
  const [reassignForceAssign, setReassignForceAssign] = useState(false);

  // Workorder settings
  const [workorderMaxEmployees, setWorkorderMaxEmployees] = useState(5);
  const [forceAssign, setForceAssign] = useState(false);

  // Invoice emails
  const [invoiceEmailsModal, setInvoiceEmailsModal] = useState(null);
  const [invoiceEmailsInput, setInvoiceEmailsInput] = useState('');

  // Universal pipeline filtering
  const [pipelineFilter, setPipelineFilter] = useState({ month: '', vertical: '', contactPoint: '', leadOffice: '', search: '', lossReason: '', certificationType: '' });

  // CV upload
  const [cvUploading, setCvUploading] = useState(false);
  const [cvMessage, setCvMessage] = useState('');

  const [dynamicLossReasons, setDynamicLossReasons] = useState([]);

  // Revision modal
  const [revisionModal, setRevisionModal] = useState(null);
  const [revisionAmount, setRevisionAmount] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');

  // Completed projects
  const [completedProjects, setCompletedProjects] = useState([]);
  const [completedFilter, setCompletedFilter] = useState({ search: '', ratingSystem: '', buildingType: '', location: '', status: '', dateFrom: '', dateTo: '' });
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedImporting, setCompletedImporting] = useState(false);
  const [completedImportMsg, setCompletedImportMsg] = useState('');

  useEffect(() => {
    fetchUsers(); fetchProjects();
    axios.get('/api/projects/metadata/all').then(res => {
      const existing = (res.data.lossReasons || []).filter(r => r && !DEFAULT_LOSS_REASONS.includes(r));
      setDynamicLossReasons(existing);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'completed') fetchCompletedProjects();
  }, [tab]);

  const fetchUsers = async () => { setUsers((await axios.get('/api/users')).data); };
  const fetchProjects = async () => { setProjects((await axios.get('/api/projects')).data); };

  const verifyUser = async (id) => { await axios.put(`/api/users/${id}/verify`); fetchUsers(); };
  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    await axios.delete(`/api/users/${id}`); fetchUsers();
  };
  const startEditUser = (u) => {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email, role: u.role, employeeId: u.employeeId || '', maxProjects: u.maxProjects ?? 3 });
  };
  const saveUser = async () => {
    await axios.put(`/api/users/${editingUser._id}`, userForm);
    setEditingUser(null); fetchUsers();
  };

  const saveProject = async (data) => {
    if (editingProject) {
      await axios.put(`/api/projects/${editingProject.projectId}`, data);
      setShowProjectModal(false); setEditingProject(null); fetchProjects();
    } else {
      const res = await axios.post('/api/projects', data);
      setShowProjectModal(false);
      setProposalMilestonesModal(res.data);
      setWorkorderMilestones([{
        financialMilestoneId: 'FM-1', title: '', amount: '',
        technicalMilestones: [{ technicalMilestoneId: 'TM-1-1', title: '', expectedDate: '' }]
      }]);
      setActionError('');
      fetchProjects();
    }
  };

  const deleteProject = async (projectId) => {
    if (!confirm('Delete this project?')) return;
    await axios.delete(`/api/projects/${projectId}`); fetchProjects();
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
      fetchProjects();
    } catch (err) { alert(err.response?.data?.message || 'Failed to change stage'); }
  };

  // Route a chosen target stage to the right modal (for stages needing input)
  // or directly transition (for stages without requirements).
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
      setWonModal(null); setWonBudget(''); setActionError(''); fetchProjects();
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
        lossComments: lostComments
      });
      setLostModal(null); setLostReason(''); setLostReasonOther(''); setLostComments(''); setActionError(''); fetchProjects();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed'); }
  };

  const moveToHold = async (project) => {
    try {
      await axios.put(`/api/projects/${project.projectId}/move-to-hold`);
      fetchProjects();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const moveToWorkorderHeld = async (project) => {
    try {
      await axios.put(`/api/projects/${project.projectId}/move-to-workorder-held`);
      fetchProjects();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const reactivateWorkorder = async (project) => {
    try {
      await axios.put(`/api/projects/${project.projectId}/reactivate-workorder`);
      fetchProjects();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const openReassignModal = async (project) => {
    setReassignModal(project);
    setReassignEmployees(project.assignedEmployeeIds || []);
    setReassignForceAssign(false);
    setLoadingEmployees(true);
    setActionError('');
    try {
      const res = await axios.get(`/api/projects/${project.projectId}/available-employees`);
      setAvailableEmployees(res.data);
    } catch (err) { setActionError('Failed to load employees'); }
    setLoadingEmployees(false);
  };

  const saveReassign = async () => {
    if (reassignEmployees.length < 1) { setActionError('Select at least 1 employee'); return; }
    try {
      await axios.put(`/api/projects/${reassignModal.projectId}/reassign-employees`, {
        assignedEmployeeIds: reassignEmployees,
        forceAssign: reassignForceAssign
      });
      setReassignModal(null); setReassignEmployees([]); setReassignForceAssign(false); setActionError(''); fetchProjects();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed'); }
  };

  const saveInvoiceEmails = async () => {
    const emails = invoiceEmailsInput.split(/[\n,;]/).map(e => e.trim()).filter(Boolean);
    try {
      await axios.put(`/api/projects/${invoiceEmailsModal.projectId}`, { invoiceRecipientEmails: emails });
      setInvoiceEmailsModal(null); setInvoiceEmailsInput(''); fetchProjects();
    } catch (err) { alert(err.response?.data?.message || 'Failed to save emails'); }
  };

  const moveToProposal = async (project) => {
    try {
      await axios.put(`/api/projects/${project.projectId}/move-to-proposal`);
      fetchProjects();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const openWorkorderModal = async (project) => {
    setWorkorderModal(project);
    setSelectedEmployees([]);
    setWorkorderMaxEmployees(project.maxEmployees ?? 5);
    setForceAssign(false);
    const baseAmount = project.revisions?.[0]?.amount || project.proposalValue || project.totalProposedMoney || 0;
    const existingFMs = (project.financialMilestones || []).filter(fm => fm.title);
    setWorkorderMilestones(existingFMs.length > 0
      ? existingFMs.map((fm, i) => ({
          ...fm,
          financialMilestoneId: fm.financialMilestoneId || `FM-${i + 1}`,
          amount: baseAmount > 0 ? Math.round((fm.amount / baseAmount) * 1000) / 10 : fm.amount,
          technicalMilestones: (fm.technicalMilestones || []).map((tm, j) => ({
            ...tm,
            technicalMilestoneId: tm.technicalMilestoneId || `TM-${i + 1}-${j + 1}`
          }))
        }))
      : [{
          financialMilestoneId: 'FM-1', title: '', amount: '',
          technicalMilestones: [{ technicalMilestoneId: 'TM-1-1', title: '', expectedDate: '' }]
        }]);
    setLoadingEmployees(true);
    setActionError('');
    try {
      const res = await axios.get(`/api/projects/${project.projectId}/available-employees`);
      setAvailableEmployees(res.data);
    } catch (err) { setActionError('Failed to load employees'); }
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
    const baseAmount = workorderModal.revisions?.[0]?.amount || workorderModal.proposalValue || workorderModal.totalProposedMoney || 0;
    const milestones = workorderMilestones
      .filter(fm => fm.title.trim())
      .map(fm => ({
        ...fm,
        amount: baseAmount > 0 ? Math.round((Number(fm.amount) / 100) * baseAmount) : Number(fm.amount) || 0,
        status: 'pending',
        technicalMilestones: fm.technicalMilestones
          .filter(tm => tm.title.trim())
          .map(tm => ({ ...tm, status: 'pending', expectedDate: tm.expectedDate || null }))
      }));
    try {
      await axios.put(`/api/projects/${workorderModal.projectId}/change-stage`, {
        targetStage: 'workorder',
        assignedEmployeeIds: selectedEmployees,
        financialMilestones: milestones,
        maxEmployees: workorderMaxEmployees,
        forceAssign
      });
      setWorkorderModal(null); setSelectedEmployees([]); setWorkorderMilestones([]); setForceAssign(false); setActionError(''); fetchProjects();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed'); }
  };

  const toggleEmployee = (empId) => {
    setSelectedEmployees(prev =>
      prev.includes(empId) ? prev.filter(e => e !== empId) : [...prev, empId]
    );
  };

  // CV upload
  const handleCvUpload = async (userId, file) => {
    setCvUploading(true); setCvMessage('');
    const formData = new FormData();
    formData.append('cv', file);
    try {
      const res = await axios.post(`/api/users/${userId}/parse-cv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCvMessage('CV parsed successfully');
      setCvUser(res.data);
      fetchUsers();
    } catch (err) {
      setCvMessage(err.response?.data?.message || 'CV parsing failed');
    } finally {
      setCvUploading(false);
      setTimeout(() => setCvMessage(''), 4000);
    }
  };

  const handleGenerateCV = async (userId, userName) => {
    try {
      const res = await axios.get(`/api/users/${userId}/generate-cv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${(userName || 'employee').replace(/\s+/g, '_')}_CV.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate CV');
    }
  };

  const addRevision = async () => {
    if (!revisionAmount || Number(revisionAmount) <= 0) { setActionError('Enter a valid amount'); return; }
    try {
      await axios.post(`/api/projects/${revisionModal.projectId}/revision`, {
        amount: Number(revisionAmount), notes: revisionNotes
      });
      setRevisionModal(null); setRevisionAmount(''); setRevisionNotes(''); setActionError(''); fetchProjects();
    } catch (err) { setActionError(err.response?.data?.message || 'Failed to add revision'); }
  };

  const fetchCompletedProjects = async (filter) => {
    const f = filter || completedFilter;
    setCompletedLoading(true);
    try {
      const params = {};
      // search is handled client-side (fuzzy); other filters stay server-side
      if (f.ratingSystem) params.ratingSystem = f.ratingSystem;
      if (f.buildingType) params.buildingType = f.buildingType;
      if (f.location) params.location = f.location;
      if (f.status) params.status = f.status;
      if (f.dateFrom) params.dateFrom = f.dateFrom;
      if (f.dateTo) params.dateTo = f.dateTo;
      const res = await axios.get('/api/completed-projects', { params });
      setCompletedProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCompletedLoading(false);
    }
  };

  const handleCompletedImport = async (file) => {
    if (!file) return;
    setCompletedImporting(true);
    setCompletedImportMsg('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/completed-projects/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCompletedImportMsg(`Imported ${res.data.inserted} of ${res.data.total} records successfully.`);
      fetchCompletedProjects();
    } catch (err) {
      setCompletedImportMsg(err.response?.data?.message || 'Import failed');
    } finally {
      setCompletedImporting(false);
      setTimeout(() => setCompletedImportMsg(''), 6000);
    }
  };

  const handleCompletedExport = async () => {
    try {
      const res = await axios.get('/api/completed-projects/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `completed_projects_${new Date().toISOString().substring(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed');
    }
  };

  const handleCompletedTemplate = async () => {
    try {
      const res = await axios.get('/api/completed-projects/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'completed_projects_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Template download failed');
    }
  };

  const saveProposalMilestones = async () => {
    const baseAmount = proposalMilestonesModal.revisions?.[0]?.amount || proposalMilestonesModal.proposalValue || proposalMilestonesModal.totalProposedMoney || 0;
    const milestones = workorderMilestones
      .filter(fm => fm.title.trim())
      .map(fm => ({
        ...fm,
        amount: baseAmount > 0 ? Math.round((Number(fm.amount) / 100) * baseAmount) : Number(fm.amount) || 0,
        status: 'pending',
        technicalMilestones: fm.technicalMilestones
          .filter(tm => tm.title.trim())
          .map(tm => ({ ...tm, status: 'pending', expectedDate: tm.expectedDate || null }))
      }));
    try {
      await axios.put(`/api/projects/${proposalMilestonesModal.projectId}`, { financialMilestones: milestones });
      setProposalMilestonesModal(null); setWorkorderMilestones([]); setActionError(''); fetchProjects();
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
      if (pipelineFilter.certificationType) {
        const ct = pipelineFilter.certificationType.toLowerCase();
        if (!(p.certificationType || []).some(c => c.toLowerCase().includes(ct))) return false;
      }
      return true;
    });
    // Fuzzy, ranked search (tolerant of typos; best matches first)
    return fuzzyFilterSort(
      pipelineFilter.search,
      filtered,
      p => [p.projectName, p.clientName, p.projectId]
    );
  };

  const exportClientContacts = () => {
    // Group by client name + contact point, collect all their projects
    const clientMap = {};
    projects.forEach(p => {
      const key = `${p.clientName || 'Unknown'}__${p.contactPoint?.mailId || p.contactPoint?.number || Math.random()}`;
      if (!clientMap[key]) {
        clientMap[key] = {
          'Client Name': p.clientName || '',
          'Contact Person': p.contactPoint?.name || '',
          'Designation': p.contactPoint?.designation || '',
          'Phone': p.contactPoint?.number || '',
          'Email': p.contactPoint?.mailId || '',
          'Vertical': p.vertical || '',
          'Location': p.projectLocation || '',
          'Client Sector': p.clientSector || '',
          'Projects': [],
          'Project IDs': []
        };
      }
      clientMap[key]['Projects'].push(p.projectName);
      clientMap[key]['Project IDs'].push(p.projectId);
    });

    const data = Object.values(clientMap).map(c => ({
      ...c,
      'Projects': c['Projects'].join('; '),
      'Project IDs': c['Project IDs'].join('; ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Client Contacts');
    XLSX.writeFile(wb, `client_contacts_${new Date().toISOString().split('T')[0]}.xlsx`);
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
  const unverifiedUsers = users.filter(u => !u.verified && u.role === 'employee');
  const employees = users.filter(u => u.role === 'employee');

  const proposals = projects.filter(p => p.pipelineStatus === 'proposal');
  const wonProjects = projects.filter(p => p.pipelineStatus === 'won');
  const workorders = projects.filter(p => p.pipelineStatus === 'workorder');
  const heldWorkorders = projects.filter(p => p.pipelineStatus === 'workorder-held');
  const holdProjects = projects.filter(p => p.pipelineStatus === 'hold');
  const lostProjects = projects.filter(p => p.pipelineStatus === 'lost');

  const filteredProposals = applyPipelineFilter(proposals);
  const filteredWonProjects = applyPipelineFilter(wonProjects);
  const filteredWorkorders = applyPipelineFilter([...workorders, ...heldWorkorders]);
  const filteredHoldProjects = applyPipelineFilter(holdProjects);
  const filteredLostProjects = applyPipelineFilter(lostProjects);
  const filteredAllProjects = applyPipelineFilter(projects);

  const displayedCompletedProjects = fuzzyFilterSort(
    completedFilter.search,
    completedProjects,
    p => [p.projectName, p.clientName, p.location, p.ratingSystem, p.certificationType, p.woReference, p.concernPerson]
  );

  const activeFilteredList = pipelineTab === 'all' ? filteredAllProjects
    : pipelineTab === 'proposals' ? filteredProposals
    : pipelineTab === 'won' ? filteredWonProjects
    : pipelineTab === 'workorders' ? filteredWorkorders
    : pipelineTab === 'hold' ? filteredHoldProjects
    : filteredLostProjects;

  const activeUnfilteredList = pipelineTab === 'all' ? projects
    : pipelineTab === 'proposals' ? proposals
    : pipelineTab === 'won' ? wonProjects
    : pipelineTab === 'workorders' ? [...workorders, ...heldWorkorders]
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
      <select value={pipelineFilter.certificationType} onChange={e => setPipelineFilter({ ...pipelineFilter, certificationType: e.target.value })}
        style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }}>
        <option value="">All Cert Types</option>
        {[...new Set(projects.flatMap(p => p.certificationType || []).filter(Boolean))].sort().map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
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
      {(pipelineFilter.month || pipelineFilter.vertical || pipelineFilter.leadOffice || pipelineFilter.contactPoint || pipelineFilter.search || pipelineFilter.lossReason || pipelineFilter.certificationType) && (
        <button className="btn btn-sm" style={{ background: 'var(--text-secondary)', color: '#fff', padding: '4px 10px' }}
          onClick={() => setPipelineFilter({ month: '', vertical: '', contactPoint: '', leadOffice: '', search: '', lossReason: '', certificationType: '' })}>
          Clear
        </button>
      )}
    </div>
  );

  const renderProjectCard = (p, actions, revData) => (
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
      {revData && revData.length > 1 && (
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
        {actions}
        {renderStageMover(p)}
        <button className="btn btn-sm btn-outline"
          onClick={() => { setEditingProject(p); setShowProjectModal(true); }}>Edit</button>
        <button className="btn btn-sm btn-red" onClick={() => deleteProject(p.projectId)}>Delete</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-sm btn-outline" onClick={exportClientContacts}
          title="Download Excel with all client names, contact persons, and emails">
          Export Client Contacts
        </button>
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
        <button className={`tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
          Completed Projects
        </button>
        <button className={`tab ${tab === 'revenue' ? 'active' : ''}`} onClick={() => setTab('revenue')}>
          Revenue Dashboard
        </button>
      </div>

      {/* ========== REVENUE DASHBOARD TAB ========== */}
      {tab === 'revenue' && <RevenueDashboard />}

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
          {unverifiedUsers.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid var(--warning)', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
                Pending Verification ({unverifiedUsers.length})
              </h3>
              <div className="table-container">
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Employee ID</th><th>Credentials</th><th>Action</th></tr></thead>
                  <tbody>
                    {unverifiedUsers.map(u => (
                      <tr key={u._id}>
                        <td><strong>{u.name}</strong></td>
                        <td>{u.email}</td>
                        <td>{u.employeeId || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(u.credentials || []).slice(0, 3).map(c => <span key={c} className="meta-tag">{c}</span>)}
                            {(u.credentials || []).length > 3 && <span className="meta-tag">+{u.credentials.length - 3}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="btn-group">
                            <button className="btn btn-sm btn-green" onClick={() => verifyUser(u._id)}>Verify</button>
                            <button className="btn btn-sm btn-red" onClick={() => deleteUser(u._id)}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>All Employees</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Email</th><th>Status</th><th>Projects</th><th>Credentials</th><th>CV</th><th>Actions</th></tr>
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
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-sm btn-outline" onClick={() => setCvUser(u)}>Profile</button>
                          <button className="btn btn-sm btn-outline" onClick={() => startEditUser(u)}>Edit</button>
                          <button className="btn btn-sm btn-red" onClick={() => deleteUser(u._id)}>Delete</button>
                        </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="pipeline-tabs" style={{ marginBottom: 0 }}>
              {[
                { key: 'all', label: 'All', count: projects.length, color: '#6366F1' },
                { key: 'proposals', label: 'Ongoing', count: proposals.length, color: 'var(--info)' },
                { key: 'won', label: 'Won', count: wonProjects.length, color: 'var(--success)' },
                { key: 'workorders', label: 'Workorders', count: workorders.length + heldWorkorders.length, color: 'var(--primary)' },
                { key: 'hold', label: 'Hold', count: holdProjects.length, color: 'var(--warning)' },
                { key: 'lost', label: 'Failed', count: lostProjects.length, color: 'var(--error)' }
              ].map(t => (
                <button key={t.key}
                  className={`pipeline-tab ${pipelineTab === t.key ? 'active' : ''}`}
                  style={{ '--tab-color': t.color }}
                  onClick={() => setPipelineTab(t.key)}>
                  {t.label} <span className="pipeline-tab-count">{t.count}</span>
                </button>
              ))}
            </div>
            <button className="btn btn-blue" onClick={() => { setEditingProject(null); setShowProjectModal(true); }}>
              + New Proposal
            </button>
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
                  <div className="btn-group" style={{ marginTop: 12 }}>
                    {renderStageMover(p)}
                  </div>
                </div>
              );
            })}

            {pipelineTab === 'proposals' && filteredProposals.map(p => {
              const revData = (p.revisions || []).map((r, i) => ({
                name: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                amount: r.amount,
                notes: r.notes
              }));
              return renderProjectCard(p, <>
                <button className="btn btn-sm btn-green" onClick={() => { setWonModal(p); setWonBudget(''); setActionError(''); }}>
                  Won
                </button>
                <button className="btn btn-sm" style={{ background: 'var(--warning)', color: '#fff' }}
                  onClick={() => moveToHold(p)}>Hold</button>
                <button className="btn btn-sm btn-red"
                  onClick={() => { setLostModal(p); setLostReason(''); setLostReasonOther(''); setLostComments(''); setActionError(''); }}>Failed</button>
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
              </>, revData);
            })}

            {pipelineTab === 'won' && filteredWonProjects.map(p => renderProjectCard(p, <>
              <button className="btn btn-sm btn-blue" onClick={() => openWorkorderModal(p)}>
                Move to Workorder
              </button>
            </>))}

            {pipelineTab === 'workorders' && filteredWorkorders.map(p => {
              const fms = p.financialMilestones || [];
              const totalTMs = fms.reduce((s, fm) => s + (fm.technicalMilestones || []).length, 0);
              const completedTMs = fms.reduce(
                (s, fm) => s + (fm.technicalMilestones || []).filter(t => t.status === 'completed').length, 0);
              const techProgress = totalTMs > 0 ? Math.round((completedTMs / totalTMs) * 100) : 0;
              const totalFMAmount = fms.reduce((s, fm) => s + (fm.amount || 0), 0);
              const raisedAmount = fms.filter(fm => fm.status === 'in_progress' || fm.status === 'completed').reduce((s, fm) => s + (fm.amount || 0), 0);
              const receivedAmount = fms.filter(fm => fm.status === 'completed').reduce((s, fm) => s + (fm.amount || 0), 0);
              const raisedPct = totalFMAmount > 0 ? Math.round((raisedAmount / totalFMAmount) * 100) : 0;
              const receivedPct = totalFMAmount > 0 ? Math.round((receivedAmount / totalFMAmount) * 100) : 0;
              const assignedEmps = (p.assignedEmployeeIds || []).map(id => {
                const emp = users.find(u => u.employeeId === id);
                return emp ? emp.name : id;
              });
              const isHeld = p.pipelineStatus === 'workorder-held';
              return (
                <div className="card pipeline-card" key={p.projectId} style={isHeld ? { borderLeft: '4px solid var(--warning)' } : {}}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">{p.projectName}</div>
                      <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isHeld && <span className="badge" style={{ background: '#D97706', color: '#fff' }}>ON HOLD</span>}
                      <span className={`badge badge-${p.projectStatus}`}>{p.projectStatus}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="vertical-tag">{p.vertical}</span>
                    <span className="money">{fmtMoney(p.totalProposedMoney)}</span>
                  </div>
                  {assignedEmps.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Assigned: {assignedEmps.join(', ')}
                    </div>
                  )}
                  {p.approvedBudget && (
                    <div className="delta-inline">
                      <span>Proposed: {fmtMoney(p.proposalValue || p.totalProposedMoney)}</span>
                      <span>Approved: <strong style={{ color: 'var(--success)' }}>{fmtMoney(p.approvedBudget)}</strong></span>
                      <span style={{ color: p.approvedBudget < (p.proposalValue || p.totalProposedMoney) ? 'var(--error)' : 'var(--success)' }}>
                        Delta: {fmtMoney(p.approvedBudget - (p.proposalValue || p.totalProposedMoney))}
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                      <span>Technical: {techProgress}% ({completedTMs}/{totalTMs})</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 6 }}>
                      <div className="progress-fill" style={{ width: `${techProgress}%`, background: '#059669' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                      <span>Financial Raised: {raisedPct}%</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 6 }}>
                      <div className="progress-fill" style={{ width: `${raisedPct}%`, background: '#0891B2' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                      <span>Money Received: {receivedPct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${receivedPct}%`, background: '#7C3AED' }} />
                    </div>
                  </div>
                  {renderContactPoint(p.contactPoint)}
                  {renderMetaTags(p)}
                  {(p.invoiceRecipientEmails || []).length > 0 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                      Invoice to: {p.invoiceRecipientEmails.join(', ')}
                    </div>
                  )}
                  <div className="btn-group" style={{ marginTop: 12 }}>
                    {!isHeld && (
                      <button className="btn btn-sm" style={{ background: 'var(--warning)', color: '#fff' }}
                        onClick={() => moveToWorkorderHeld(p)}>Hold Project</button>
                    )}
                    {isHeld && (
                      <button className="btn btn-sm btn-green" onClick={() => reactivateWorkorder(p)}>Reactivate</button>
                    )}
                    <button className="btn btn-sm btn-blue" onClick={() => openReassignModal(p)}>Re-assign</button>
                    <button className="btn btn-sm btn-outline"
                      onClick={() => {
                        setInvoiceEmailsModal(p);
                        setInvoiceEmailsInput((p.invoiceRecipientEmails || []).join('\n'));
                      }}>Invoice Emails</button>
                    {renderStageMover(p)}
                    <button className="btn btn-sm btn-outline"
                      onClick={() => { setEditingProject(p); setShowProjectModal(true); }}>Edit</button>
                    <button className="btn btn-sm btn-red" onClick={() => deleteProject(p.projectId)}>Delete</button>
                  </div>
                </div>
              );
            })}

            {pipelineTab === 'hold' && filteredHoldProjects.map(p => renderProjectCard(p, <>
              <button className="btn btn-sm btn-blue" onClick={() => moveToProposal(p)}>
                Back to Proposal
              </button>
              <button className="btn btn-sm btn-green" onClick={() => { setWonModal(p); setWonBudget(''); setActionError(''); }}>
                Won
              </button>
              <button className="btn btn-sm btn-red"
                onClick={() => { setLostModal(p); setLostReason(''); setLostReasonOther(''); setLostComments(''); setActionError(''); }}>Failed</button>
            </>))}

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
                <div className="btn-group" style={{ marginTop: 12 }}>
                  <button className="btn btn-sm btn-red" onClick={() => deleteProject(p.projectId)}>Delete</button>
                </div>
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
              {proposals.length === 0 ? 'No proposals. Click "+ New Proposal" to create one.' : 'No proposals match your filters.'}
            </div>
          )}
          {pipelineTab === 'won' && filteredWonProjects.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              {wonProjects.length === 0 ? 'No won projects awaiting workorder assignment.' : 'No won projects match your filters.'}
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
                    const proposed = p.revisions?.[0]?.amount || p.proposalValue || p.totalProposedMoney || 0;
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

      {/* ========== COMPLETED PROJECTS TAB ========== */}
      {tab === 'completed' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <h2 style={{ flex: 1, fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Completed Projects <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({completedProjects.length})</span>
            </h2>
            <button className="btn btn-sm btn-outline" onClick={handleCompletedTemplate}>Download Template</button>
            <label className="btn btn-sm btn-outline" style={{ cursor: completedImporting ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
              {completedImporting ? 'Importing...' : 'Import Excel'}
              <input type="file" accept=".xlsx,.xls"
                onChange={e => { if (e.target.files[0]) handleCompletedImport(e.target.files[0]); e.target.value = ''; }}
                disabled={completedImporting} style={{ display: 'none' }} />
            </label>
            <button className="btn btn-sm btn-outline" onClick={handleCompletedExport}>Export Excel</button>
          </div>

          {completedImportMsg && (
            <div style={{
              padding: '10px 16px', borderRadius: 6, marginBottom: 12, fontSize: '0.875rem',
              background: completedImportMsg.toLowerCase().includes('fail') ? 'var(--error-bg, #FEF2F2)' : '#F0FDF4',
              border: `1px solid ${completedImportMsg.toLowerCase().includes('fail') ? 'var(--error, #E11D48)' : 'var(--success, #059669)'}`,
              color: completedImportMsg.toLowerCase().includes('fail') ? 'var(--error, #E11D48)' : 'var(--success, #059669)'
            }}>
              {completedImportMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <input type="text" value={completedFilter.search}
              onChange={e => setCompletedFilter({ ...completedFilter, search: e.target.value })}
              placeholder="Search name, client, location..."
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', flex: 1, minWidth: 160 }} />
            <input type="text" value={completedFilter.ratingSystem}
              onChange={e => setCompletedFilter({ ...completedFilter, ratingSystem: e.target.value })}
              placeholder="Rating system..."
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', width: 150 }} />
            <input type="text" value={completedFilter.buildingType}
              onChange={e => setCompletedFilter({ ...completedFilter, buildingType: e.target.value })}
              placeholder="Building type..."
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', width: 140 }} />
            <input type="text" value={completedFilter.location}
              onChange={e => setCompletedFilter({ ...completedFilter, location: e.target.value })}
              placeholder="Location..."
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', width: 120 }} />
            <input type="text" value={completedFilter.status}
              onChange={e => setCompletedFilter({ ...completedFilter, status: e.target.value })}
              placeholder="Status..."
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', width: 110 }} />
            <input type="date" value={completedFilter.dateFrom}
              onChange={e => setCompletedFilter({ ...completedFilter, dateFrom: e.target.value })}
              title="Completion date from"
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }} />
            <input type="date" value={completedFilter.dateTo}
              onChange={e => setCompletedFilter({ ...completedFilter, dateTo: e.target.value })}
              title="Completion date to"
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }} />
            <button className="btn btn-sm btn-blue" onClick={() => fetchCompletedProjects(completedFilter)}>Apply</button>
            {(completedFilter.search || completedFilter.ratingSystem || completedFilter.buildingType ||
              completedFilter.location || completedFilter.status || completedFilter.dateFrom || completedFilter.dateTo) && (
              <button className="btn btn-sm" style={{ background: 'var(--text-secondary)', color: '#fff', padding: '4px 10px' }}
                onClick={() => {
                  const f = { search: '', ratingSystem: '', buildingType: '', location: '', status: '', dateFrom: '', dateTo: '' };
                  setCompletedFilter(f);
                  fetchCompletedProjects(f);
                }}>
                Clear
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 0 }}>
            {completedLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading...</div>
            ) : displayedCompletedProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                No completed projects. Import an Excel file or mark a pipeline project as completed.
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>Location</th>
                      <th>Building Type</th>
                      <th>BUA (sft)</th>
                      <th>Client</th>
                      <th>Contact</th>
                      <th>Rating System</th>
                      <th>Certification</th>
                      <th>Level</th>
                      <th>Status</th>
                      <th>Completion Date</th>
                      <th>WO Ref</th>
                      <th>LCES SPOC</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCompletedProjects.map(p => (
                      <tr key={p._id}>
                        <td><strong>{p.projectName || '-'}</strong></td>
                        <td>{p.location || '-'}</td>
                        <td>{p.buildingType || '-'}</td>
                        <td>{p.buaInSft || '-'}</td>
                        <td>
                          <div>{p.clientName || '-'}</div>
                          {p.concernPerson && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {p.concernPerson}{p.designation ? ` (${p.designation})` : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          {p.contact && <div style={{ fontSize: '0.82rem' }}>{p.contact}</div>}
                          {p.emailId && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.emailId}</div>}
                        </td>
                        <td>{p.ratingSystem || '-'}</td>
                        <td>{p.certificationType || '-'}</td>
                        <td>{p.levelOfRating || '-'}</td>
                        <td>{p.status || '-'}</td>
                        <td>
                          {p.dateOfCompletion
                            ? new Date(p.dateOfCompletion).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '-'}
                        </td>
                        <td>{p.woReference || '-'}</td>
                        <td>{p.lcesspoc || '-'}</td>
                        <td><span className="meta-tag">{p.source}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button className="btn-icon" onClick={() => setEditingUser(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
              </div>
              <div className="inline-fields">
                <div className="form-group">
                  <label>Role</label>
                  <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                    <option value="employee">Employee</option>
                    <option value="business">Business</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Employee ID</label>
                  <input value={userForm.employeeId} onChange={e => setUserForm({ ...userForm, employeeId: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Max Projects (concurrent workorders)</label>
                <input type="number" min={1} max={20} value={userForm.maxProjects}
                  onChange={e => setUserForm({ ...userForm, maxProjects: Number(e.target.value) })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingUser(null)}>Cancel</button>
              <button className="btn btn-blue" onClick={saveUser}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Profile / CV Modal */}
      {cvUser && (() => {
        const pf = cvUser.profile || {};
        return (
        <div className="modal-overlay" onClick={() => setCvUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 750 }}>
            <div className="modal-header">
              <h2>Employee Profile - {cvUser.name}</h2>
              <button className="btn-icon" onClick={() => setCvUser(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              {/* Basic Info Grid */}
              <div className="project-meta-grid" style={{ marginBottom: 20 }}>
                <div className="meta-item"><div className="meta-label">Employee ID</div><div className="meta-value">{cvUser.employeeId}</div></div>
                <div className="meta-item"><div className="meta-label">Email</div><div className="meta-value">{cvUser.email}</div></div>
                <div className="meta-item"><div className="meta-label">Designation</div><div className="meta-value">{pf.designation || '-'}</div></div>
                <div className="meta-item"><div className="meta-label">Years of Experience</div><div className="meta-value">{pf.yearsOfExperience || '-'}</div></div>
                <div className="meta-item"><div className="meta-label">Contact</div><div className="meta-value">{pf.contactNumber || '-'}</div></div>
                <div className="meta-item"><div className="meta-label">Status</div><div className="meta-value"><span className={`badge ${cvUser.verified ? 'badge-verified' : 'badge-unverified'}`}>{cvUser.verified ? 'Verified' : 'Unverified'}</span></div></div>
              </div>

              {/* Vertical */}
              {(pf.vertical || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Vertical</strong>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {pf.vertical.map(v => <span key={v} className="meta-tag tag-service">{v}</span>)}
                  </div>
                </div>
              )}

              {/* Professional Summary */}
              {pf.professionalSummary && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Professional Summary</strong>
                  <p style={{ marginTop: 6, fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text)' }}>{pf.professionalSummary}</p>
                </div>
              )}

              {/* Credentials */}
              {(pf.credentials || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Credentials / Certifications</strong>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {pf.credentials.map((c, i) => <span key={i} className="meta-tag tag-rating">{c}</span>)}
                  </div>
                </div>
              )}

              {/* Expertise */}
              {(pf.expertise || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Expertise</strong>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {pf.expertise.map((e, i) => <span key={i} className="meta-tag tag-service">{e}</span>)}
                  </div>
                </div>
              )}

              {/* Qualifications */}
              {(pf.qualifications || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Qualifications</strong>
                  <div style={{ marginTop: 6 }}>
                    {pf.qualifications.map((q, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 500 }}>{q.degree}{q.field ? ` - ${q.field}` : ''}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{q.institution}{q.year ? ` (${q.year})` : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Experience */}
              {(pf.pastExperience || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Past Experience</strong>
                  <div style={{ marginTop: 6 }}>
                    {pf.pastExperience.map((exp, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 500 }}>{exp.position}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{exp.company}{exp.duration ? ` | ${exp.duration}` : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Projects */}
              {(pf.pastProjects || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Past Projects</strong>
                  <div style={{ marginTop: 6 }}>
                    {pf.pastProjects.map((proj, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 500 }}>{proj.name}{proj.role ? ` — ${proj.role}` : ''}</div>
                        {proj.description && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{proj.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CV Actions */}
              <div style={{ marginTop: 20, padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>CV</strong>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>Generate a formatted Word CV from this employee's profile data</div>
                  </div>
                  <div className="btn-group">
                    <button className="btn btn-sm btn-green" onClick={() => handleGenerateCV(cvUser._id, cvUser.name)}>
                      Generate CV
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setCvUser(null)}>Close</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Project Create/Edit Modal */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={() => { setShowProjectModal(false); setEditingProject(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 850 }}>
            <div className="modal-header">
              <h2>{editingProject ? 'Edit Project' : 'New Proposal'}</h2>
              <button className="btn-icon" onClick={() => { setShowProjectModal(false); setEditingProject(null); }}>&#10005;</button>
            </div>
            <div className="modal-body">
              <ProjectForm
                project={editingProject}
                onSave={saveProject}
                onCancel={() => { setShowProjectModal(false); setEditingProject(null); }}
              />
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
              {(() => {
                const pmBase = proposalMilestonesModal.revisions?.[0]?.amount || proposalMilestonesModal.proposalValue || proposalMilestonesModal.totalProposedMoney || 0;
                return pmBase > 0 && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Base proposal value: <strong>{fmtMoney(pmBase)}</strong> — enter % for each milestone
                  </div>
                );
              })()}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Financial & Technical Milestones</h3>
              {workorderMilestones.map((fm, fmIdx) => {
                const pmBase = proposalMilestonesModal.revisions?.[0]?.amount || proposalMilestonesModal.proposalValue || proposalMilestonesModal.totalProposedMoney || 0;
                const computedAmt = pmBase > 0 ? Math.round((Number(fm.amount) / 100) * pmBase) : 0;
                return (
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
                      <label style={{ fontSize: '0.8rem' }}>
                        Amount (% of proposal){pmBase > 0 && computedAmt > 0 && <span style={{ color: 'var(--success)', marginLeft: 6 }}>= {fmtMoney(computedAmt)}</span>}
                      </label>
                      <input type="number" min={0} max={100} value={fm.amount} onChange={e => updateFM(fmIdx, 'amount', e.target.value)} placeholder="e.g. 20" />
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
              ); })}
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

      {/* Won Modal */}
      {wonModal && (
        <div className="modal-overlay" onClick={() => setWonModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Mark as Won</h2>
              <button className="btn-icon" onClick={() => setWonModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>
                <strong>{wonModal.projectName}</strong> ({wonModal.projectId})
              </p>
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

      {/* Lost Modal */}
      {lostModal && (
        <div className="modal-overlay" onClick={() => setLostModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Mark as Failed</h2>
              <button className="btn-icon" onClick={() => setLostModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>
                <strong>{lostModal.projectName}</strong> ({lostModal.projectId})
              </p>
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
                  placeholder="Additional comments about the loss..."
                  rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                    borderRadius: 6, fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setLostModal(null)}>Cancel</button>
              <button className="btn btn-red" onClick={moveToLost}>Confirm Failed</button>
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

      {/* Reassign Employees Modal */}
      {reassignModal && (
        <div className="modal-overlay" onClick={() => setReassignModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>Re-assign Employees</h2>
              <button className="btn-icon" onClick={() => setReassignModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 8 }}>
                <strong>{reassignModal.projectName}</strong> ({reassignModal.projectId})
              </p>
              {actionError && <div className="auth-error">{actionError}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Max employees for this project: <strong>{reassignModal.maxEmployees ?? 5}</strong>
                </p>
                <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={reassignForceAssign} onChange={e => setReassignForceAssign(e.target.checked)} />
                  Override capacity limit
                </label>
              </div>
              {loadingEmployees ? (
                <p>Loading available employees...</p>
              ) : (
                <div className="employee-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {availableEmployees.map(emp => {
                    const isCurrentlyAssigned = (reassignModal.assignedEmployeeIds || []).includes(emp.employeeId);
                    const isSelected = reassignEmployees.includes(emp.employeeId);
                    const atCap = !emp.available && !isCurrentlyAssigned;
                    const isDisabled = atCap && !reassignForceAssign;
                    return (
                      <label key={emp.employeeId}
                        className={`employee-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'unavailable' : ''}`}>
                        <input type="checkbox" checked={isSelected}
                          onChange={() => setReassignEmployees(prev =>
                            prev.includes(emp.employeeId) ? prev.filter(e => e !== emp.employeeId) : [...prev, emp.employeeId]
                          )}
                          disabled={isDisabled} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong>{emp.name}</strong>
                            <code style={{ fontSize: '0.75rem' }}>{emp.employeeId}</code>
                            {isCurrentlyAssigned && <span className="badge badge-verified" style={{ fontSize: '0.7rem' }}>Currently Assigned</span>}
                            {atCap && <span className="badge badge-unverified" style={{ opacity: reassignForceAssign ? 0.5 : 1 }}>At Capacity</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {emp.activeProjectCount}/{emp.maxProjects || 3} projects
                            {emp.credentials?.length > 0 && ` | ${emp.credentials.slice(0, 4).join(', ')}`}
                          </div>
                        </div>
                        <div className={`match-score ${emp.matchScore >= 50 ? 'high' : emp.matchScore > 0 ? 'medium' : 'low'}`}>
                          {emp.matchScore}% match
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setReassignModal(null)}>Cancel</button>
              <button className="btn btn-blue" onClick={saveReassign}
                disabled={reassignEmployees.length < 1}>
                Save ({reassignEmployees.length} selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Emails Modal */}
      {invoiceEmailsModal && (
        <div className="modal-overlay" onClick={() => setInvoiceEmailsModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Invoice Recipient Emails</h2>
              <button className="btn-icon" onClick={() => setInvoiceEmailsModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 8 }}>
                <strong>{invoiceEmailsModal.projectName}</strong> ({invoiceEmailsModal.projectId})
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                These emails receive invoice notifications when a financial milestone is completed. Enter one per line or comma-separated.
              </p>
              <div className="form-group">
                <label>Recipient Emails</label>
                <textarea
                  value={invoiceEmailsInput}
                  onChange={e => setInvoiceEmailsInput(e.target.value)}
                  placeholder="email@example.com&#10;another@example.com"
                  rows={5}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setInvoiceEmailsModal(null)}>Cancel</button>
              <button className="btn btn-blue" onClick={saveInvoiceEmails}>Save Emails</button>
            </div>
          </div>
        </div>
      )}

      {/* Workorder Modal with Milestones */}
      {workorderModal && (
        <div className="modal-overlay" onClick={() => setWorkorderModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 850 }}>
            <div className="modal-header">
              <h2>Assign to Workorder</h2>
              <button className="btn-icon" onClick={() => setWorkorderModal(null)}>&#10005;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '80vh' }}>
              <p style={{ marginBottom: 8 }}>
                <strong>{workorderModal.projectName}</strong> ({workorderModal.projectId})
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Requirements: {[...(workorderModal.ratingSystem || []), ...(workorderModal.services || []),
                  ...(workorderModal.certificationType || [])].join(', ') || 'None specified'}
              </p>
              {actionError && <div className="auth-error">{actionError}</div>}

              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Employee Assignment</h3>
              <div className="inline-fields" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Max Employees on this Project</label>
                  <input type="number" min={1} max={20} value={workorderMaxEmployees}
                    onChange={e => setWorkorderMaxEmployees(Number(e.target.value))}
                    style={{ width: 100 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, justifyContent: 'flex-end' }}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 20 }}>
                    <input type="checkbox" checked={forceAssign} onChange={e => setForceAssign(e.target.checked)} />
                    Override employee capacity limit
                  </label>
                </div>
              </div>
              {loadingEmployees ? (
                <p>Loading available employees...</p>
              ) : (
                <div className="employee-list" style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 20 }}>
                  {availableEmployees.map(emp => {
                    const atCap = !emp.available;
                    const isDisabled = atCap && !forceAssign;
                    return (
                    <label key={emp.employeeId}
                      className={`employee-option ${selectedEmployees.includes(emp.employeeId) ? 'selected' : ''} ${isDisabled ? 'unavailable' : ''}`}>
                      <input type="checkbox" checked={selectedEmployees.includes(emp.employeeId)}
                        onChange={() => toggleEmployee(emp.employeeId)} disabled={isDisabled} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong>{emp.name}</strong>
                          <code style={{ fontSize: '0.75rem' }}>{emp.employeeId}</code>
                          {atCap && <span className="badge badge-unverified" style={{ opacity: forceAssign ? 0.5 : 1 }}>AT CAPACITY</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {emp.activeProjectCount}/{emp.maxProjects || 3} projects
                          {emp.credentials?.length > 0 && ` | ${emp.credentials.slice(0, 5).join(', ')}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className={`match-score ${emp.matchScore >= 50 ? 'high' : emp.matchScore > 0 ? 'medium' : 'low'}`}>
                          {emp.matchScore}% match
                        </div>
                        {emp.matchedSkills?.length > 0 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: 2 }}>
                            {emp.matchedSkills.slice(0, 3).join(', ')}
                          </div>
                        )}
                      </div>
                    </label>
                    );
                  })}
                </div>
              )}

              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Financial & Technical Milestones</h3>
              {(() => {
                const woBase = workorderModal.revisions?.[0]?.amount || workorderModal.proposalValue || workorderModal.totalProposedMoney || 0;
                return woBase > 0 && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Base proposal value: <strong>{fmtMoney(woBase)}</strong> — enter % for each milestone
                  </div>
                );
              })()}
              {workorderMilestones.map((fm, fmIdx) => {
                const woBase = workorderModal.revisions?.[0]?.amount || workorderModal.proposalValue || workorderModal.totalProposedMoney || 0;
                const computedAmt = woBase > 0 ? Math.round((Number(fm.amount) / 100) * woBase) : 0;
                return (
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
                      <input value={fm.title} onChange={e => updateFM(fmIdx, 'title', e.target.value)}
                        placeholder="e.g., Registration Payment" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: '0.8rem' }}>
                        Amount (% of proposal){woBase > 0 && computedAmt > 0 && <span style={{ color: 'var(--success)', marginLeft: 6 }}>= {fmtMoney(computedAmt)}</span>}
                      </label>
                      <input type="number" min={0} max={100} value={fm.amount} onChange={e => updateFM(fmIdx, 'amount', e.target.value)}
                        placeholder="e.g. 20" />
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
              ); })}
              <button type="button" className="btn btn-sm btn-outline" onClick={addFinancialMilestone}
                style={{ marginBottom: 16 }}>+ Add Financial Milestone</button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setWorkorderModal(null)}>Cancel</button>
              <button className="btn btn-blue" onClick={moveToWorkorder}
                disabled={selectedEmployees.length < 1}>
                Assign & Move to Workorder ({selectedEmployees.length} selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
