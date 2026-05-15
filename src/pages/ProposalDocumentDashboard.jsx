import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const CATEGORY_LABELS = {
  igbc_griha: 'IGBC / GRIHA Projects',
  igbc: 'IGBC Projects',
  leed_cities_campus: 'LEED Cities & Campus',
  net_zero: 'Net Zero Facilities'
};

const CATEGORY_KEYS = ['igbc_griha', 'igbc', 'leed_cities_campus', 'net_zero'];

const DEFAULT_SCOPE_SECTIONS = [
  {
    key: 'facilitationServices', title: 'Facilitation Services', isCustom: false,
    items: [
      { text: 'Overall facilitation to obtain the best possible rating', checked: true },
      { text: 'Conduct the feasibility checklist during initial stage', checked: true },
      { text: 'Design charrette with the project team to optimize the integration of green strategies across all aspects of community planning and design, construction and operation, drawing on the expertise of all participants', checked: true },
      { text: 'Review of current design planned for the project.', checked: true },
      { text: 'Providing a Pre-Assessment report with the recommendations and any additional requirements to meet LEED v4.1 for cities best possible rating', checked: true },
      { text: 'Facilitate the project design team to select infrastructure materials to meet the rating requirement.', checked: true },
      { text: 'Vet tender documents, drawings & BOQ to ensure that the technical specification mentioned are meeting the green norms', checked: true },
      { text: 'Provide Inputs to design team for Green incorporation at infrastructure level', checked: true },
      { text: 'GHG Emission calculation as per LFC rating', checked: true },
      { text: 'Energy Analysis to improve the energy efficiency of community services', checked: true },
      { text: 'Facilitate the project team in preparing the documentation as stipulated by LEED', checked: true },
      { text: 'The facilitation team will filter, cross-validate, verify consistency, add value, and consolidate to make the document suitable for submission to USGBC.', checked: true },
      { text: 'The Green team would conduct necessary meetings with coordinators and to take care of the smooth implementation of the LEED rating program.', checked: true },
      { text: 'Scrutinize the documents before submission to USGBC.', checked: true },
      { text: 'Provide inputs on previous credit interpretation requests, for improved success rate', checked: true },
      { text: 'Co-ordinate with USGBC obtain the final rating for the project', checked: true }
    ]
  },
  {
    key: 'overallDeliverables', title: 'Overall Deliverables', isCustom: false,
    items: [
      { text: 'Design inputs for LEED for cities.', checked: true },
      { text: 'GHG Emission evaluation report', checked: true },
      { text: 'Energy Analysis Report', checked: true },
      { text: 'Periodical review with the design and construction teams for smooth work progress', checked: true },
      { text: 'Develop templates, drawings, and documentation required to meet the green rating.', checked: true },
      { text: 'Develop project monitoring formats & list of photos required to be taken at the site and handed over to the contractor for monitoring.', checked: true },
      { text: 'Interact with USGBC in getting the pre-certification (only applicable for USGBC) certification.', checked: true },
      { text: 'Clarify all doubts that arise out of the review by the USGBC team.', checked: true }
    ]
  },
  {
    key: 'supportFromClient', title: 'Support required from Client', isCustom: false,
    items: [
      { text: 'EIA report', checked: true },
      { text: 'Vulnerability and capacity assessment Resilience plan', checked: true },
      { text: 'Design documents and basic design drawings required for credit preparation to be given to the green team for further addition modification.', checked: true },
      { text: 'Documents pertaining to govt approvals for the project to be given as per the LEED requirements.', checked: true },
      { text: 'Letters, photos, invoice, technical data sheets & test certificates from the suppliers to be obtained as per the LEED requirements.', checked: true },
      { text: 'Project coordinator for LEED related interactions', checked: true }
    ]
  },
  {
    key: 'exclusions', title: 'Exclusions', isCustom: false,
    items: [
      { text: 'Detailed design, if any', checked: true },
      { text: 'LEED council fee (registration and certification fee)', checked: true },
      { text: 'Any other survey / assessments', checked: true }
    ]
  }
];

const DEFAULT_MILESTONES = [
  { number: 1, percentage: '15%', paymentStage: 'On signing of Agreement' },
  { number: 2, percentage: '15%', paymentStage: 'On submission of Design basis report' },
  { number: 3, percentage: '20%', paymentStage: 'On submission of Preliminary Energy Model' },
  { number: 4, percentage: '20%', paymentStage: 'On submission of Final Energy Model' },
  { number: 5, percentage: '15%', paymentStage: 'On submission of Application to Rating Body' },
  { number: 6, percentage: '15%', paymentStage: 'On receipt of Final Rating Certificate' }
];

function StatusBadge({ status }) {
  const color = status === 'generated' ? 'var(--success)' : 'var(--warning)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 99,
      fontSize: '0.75rem',
      fontWeight: 700,
      background: `${color}18`,
      color,
      border: `1px solid ${color}40`,
      textTransform: 'capitalize'
    }}>
      {status}
    </span>
  );
}

export default function ProposalDocumentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');

  // Reference projects
  const [allRefProjects, setAllRefProjects] = useState([]);

  // Editor state (mirrors selectedDoc fields for editing)
  const [overrides, setOverrides] = useState({});
  const [selectedProjects, setSelectedProjects] = useState({
    igbc_griha: [], igbc: [], leed_cities_campus: [], net_zero: []
  });
  const [milestones, setMilestones] = useState(DEFAULT_MILESTONES);
  const [expandedMilestoneIdx, setExpandedMilestoneIdx] = useState(null);
  const [aiExpandingIdx, setAiExpandingIdx] = useState(null); // null = none, -1 = all
  const [totalFee, setTotalFee] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState(DEFAULT_SCOPE_SECTIONS);
  const [timeline, setTimeline] = useState({ entries: [] });
  const [templateName, setTemplateName] = useState('LEED Cities');

  // New ref project form per category
  const [newProjForms, setNewProjForms] = useState({});
  const [addingRefProj, setAddingRefProj] = useState({});

  useEffect(() => {
    fetchDocs();
    fetchRefProjects();
  }, []);

  // Auto-select from URL param — only when the doc isn't already open
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && docs.length > 0 && (!selectedDoc || selectedDoc._id !== id)) {
      const found = docs.find(d => d._id === id);
      if (found) openDoc(found);
    }
  }, [docs, searchParams]);

  const fetchDocs = async () => {
    try {
      const res = await axios.get('/api/proposal-documents');
      setDocs(res.data);
    } catch (err) {
      setError('Failed to load proposal documents');
    }
  };

  const fetchRefProjects = async () => {
    try {
      const res = await axios.get('/api/reference-projects');
      setAllRefProjects(res.data);
    } catch (err) {
      console.error('Failed to load reference projects', err);
    }
  };

  const openDoc = async (doc) => {
    setActiveTab('info');
    setSaveStatus('');
    setError('');
    try {
      const res = await axios.get(`/api/proposal-documents/${doc._id}`);
      const d = res.data;
      setSelectedDoc(d);
      setOverrides(d.overrides || {});
      setSelectedProjects({
        igbc_griha: (d.selectedProjects?.igbc_griha || []).map(p => (p._id || p)),
        igbc: (d.selectedProjects?.igbc || []).map(p => (p._id || p)),
        leed_cities_campus: (d.selectedProjects?.leed_cities_campus || []).map(p => (p._id || p)),
        net_zero: (d.selectedProjects?.net_zero || []).map(p => (p._id || p))
      });
      const loaded = d.milestones && d.milestones.length > 0 ? d.milestones : DEFAULT_MILESTONES;
      setMilestones(loaded.map(m => ({ ...m, technicalMilestones: m.technicalMilestones || [] })));
      setExpandedMilestoneIdx(null);
      setTotalFee(d.totalFee ? String(d.totalFee) : '');
      setTemplateName(d.templateName || 'LEED Cities');
      // Normalize scopeOfWork: server may return array (new) or object (old) or empty
      const rawSw = d.scopeOfWork;
      if (Array.isArray(rawSw) && rawSw.length > 0) {
        setScopeOfWork(rawSw);
      } else if (rawSw && !Array.isArray(rawSw)) {
        // migrate old object format
        setScopeOfWork(DEFAULT_SCOPE_SECTIONS.map(s => ({
          ...s,
          items: rawSw[s.key]?.length > 0 ? rawSw[s.key] : s.items
        })));
      } else {
        setScopeOfWork(DEFAULT_SCOPE_SECTIONS);
      }
      // Timeline
      const tl = d.timeline || {};
      setTimeline({
        entries: (tl.entries || []).map(e => ({
          label: e.label || '',
          date: e.date ? new Date(e.date).toISOString().substring(0, 10) : '',
          type: e.type || 'milestone'
        }))
      });
      setSearchParams({ id: d._id });
    } catch (err) {
      setError('Failed to load document details');
    }
  };

  const saveDoc = useCallback(async (docId, patch) => {
    if (!docId) return;
    setSaveStatus('saving...');
    try {
      await axios.put(`/api/proposal-documents/${docId}`, patch);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      setSaveStatus('save failed');
    }
  }, []);

  const buildSavePatch = () => ({
    overrides,
    selectedProjects,
    milestones,
    totalFee: totalFee ? Number(totalFee) : undefined,
    templateName,
    scopeOfWork,
    timeline
  });

  const handleTabChange = async (newTab) => {
    if (selectedDoc) await saveDoc(selectedDoc._id, buildSavePatch());
    setActiveTab(newTab);
  };

  const handleGenerate = async () => {
    if (!selectedDoc) return;
    setGenerating(true);
    setError('');
    try {
      await axios.put(`/api/proposal-documents/${selectedDoc._id}`, buildSavePatch());

      const response = await axios.post(
        `/api/proposal-documents/${selectedDoc._id}/generate`,
        {},
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Proposal_${(selectedDoc.projectName || 'Document').replace(/[^a-zA-Z0-9_\- ]/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // Refresh docs list to show generated status
      await fetchDocs();
      setSelectedDoc(prev => prev ? { ...prev, status: 'generated' } : prev);
    } catch (err) {
      setError('Failed to generate document. Please check server logs.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleRefProject = (category, projId) => {
    setSelectedProjects(prev => {
      const current = prev[category] || [];
      const strId = String(projId);
      const isSelected = current.some(id => String(id) === strId);
      return {
        ...prev,
        [category]: isSelected
          ? current.filter(id => String(id) !== strId)
          : [...current, strId]
      };
    });
  };

  const selectAllDefaults = (category) => {
    const defaultIds = allRefProjects
      .filter(p => p.category === category && p.isDefault)
      .map(p => String(p._id));
    setSelectedProjects(prev => ({ ...prev, [category]: defaultIds }));
  };

  const clearCategory = (category) => {
    setSelectedProjects(prev => ({ ...prev, [category]: [] }));
  };

  const updateMilestone = (idx, field, value) => {
    setMilestones(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const addMilestone = () => {
    setMilestones(prev => [...prev, { number: prev.length + 1, percentage: '', paymentStage: '', technicalMilestones: [] }]);
  };

  const removeMilestone = (idx) => {
    setMilestones(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, number: i + 1 })));
  };

  const addNewRefProject = async (category) => {
    const form = newProjForms[category] || {};
    if (!form.name) return;
    try {
      const res = await axios.post('/api/reference-projects', {
        name: form.name,
        bua: form.bua || '',
        ratingSystem: form.ratingSystem || '',
        ratingLevel: form.ratingLevel || '',
        category,
        isDefault: false
      });
      setAllRefProjects(prev => [...prev, res.data]);
      // Auto-select newly created project
      setSelectedProjects(prev => ({
        ...prev,
        [category]: [...(prev[category] || []), String(res.data._id)]
      }));
      setNewProjForms(prev => ({ ...prev, [category]: {} }));
      setAddingRefProj(prev => ({ ...prev, [category]: false }));
    } catch (err) {
      alert('Failed to add reference project');
    }
  };

  const isSelected = (category, projId) => {
    const current = selectedProjects[category] || [];
    return current.some(id => String(id) === String(projId));
  };

  const countSelected = (category) => (selectedProjects[category] || []).length;

  const renderInfoTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Project Info
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Project ID:</span>
          <span style={{ fontWeight: 600 }}>{selectedDoc?.projectId}</span>
          <span style={{ color: 'var(--text-secondary)' }}>Project Name:</span>
          <span style={{ fontWeight: 600 }}>{selectedDoc?.projectName}</span>
          <span style={{ color: 'var(--text-secondary)' }}>Client:</span>
          <span style={{ fontWeight: 600 }}>{selectedDoc?.clientName}</span>
          <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
          <StatusBadge status={selectedDoc?.status} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>Contact Person Name</label>
          <input
            value={overrides.contactName || ''}
            onChange={e => setOverrides(o => ({ ...o, contactName: e.target.value }))}
            placeholder="Contact person name"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>Designation</label>
          <input
            value={overrides.contactDesignation || ''}
            onChange={e => setOverrides(o => ({ ...o, contactDesignation: e.target.value }))}
            placeholder="Designation"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>Project Description (replaces [project])</label>
          <input
            value={overrides.projectDescription || ''}
            onChange={e => setOverrides(o => ({ ...o, projectDescription: e.target.value }))}
            placeholder="e.g., Office Building"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>Project Location (replaces [location])</label>
          <input
            value={overrides.projectLocation || ''}
            onChange={e => setOverrides(o => ({ ...o, projectLocation: e.target.value }))}
            placeholder="e.g., Chennai, Tamil Nadu"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>Project Area (replaces [area])</label>
          <input
            value={overrides.projectArea || ''}
            onChange={e => setOverrides(o => ({ ...o, projectArea: e.target.value }))}
            placeholder="e.g., 10.5 L sft"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>Reference Number</label>
          <input
            value={overrides.refNumber || ''}
            onChange={e => setOverrides(o => ({ ...o, refNumber: e.target.value }))}
            placeholder="e.g., LCES/LEED Cities/001"
          />
        </div>
      </div>
    </div>
  );

  const renderTemplateTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>Select Template</div>
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px',
        border: `2px solid ${templateName === 'LEED Cities' ? 'var(--info)' : 'var(--border)'}`,
        borderRadius: 10, cursor: 'pointer', background: templateName === 'LEED Cities' ? '#EFF6FF' : 'var(--surface)'
      }}>
        <input
          type="radio"
          value="LEED Cities"
          checked={templateName === 'LEED Cities'}
          onChange={() => setTemplateName('LEED Cities')}
          style={{ marginTop: 2 }}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>LEED Cities Template</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Standard proposal template for LEED Cities & Campus, IGBC, GRIHA, and Net Zero projects.
            Includes sections for reference projects across 4 rating categories, fee schedule,
            and payment milestone terms table.
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['IGBC/GRIHA', 'LEED Cities', 'Net Zero', 'Payment Terms'].map(tag => (
              <span key={tag} style={{
                fontSize: '0.72rem', padding: '2px 8px', borderRadius: 99,
                background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </label>
      <div style={{
        padding: 12, borderRadius: 8, background: 'var(--bg)',
        border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-secondary)'
      }}>
        More templates can be added in future versions. The LEED Cities template contains 6 tables
        covering project references for all major rating systems and a payment milestone schedule.
      </div>
    </div>
  );

  const renderRefProjectsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {CATEGORY_KEYS.map(cat => {
        const catProjects = allRefProjects.filter(p => p.category === cat);
        const selectedCount = countSelected(cat);
        const isAddingNew = addingRefProj[cat];
        const newForm = newProjForms[cat] || {};

        return (
          <div key={cat} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              padding: '12px 16px', background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{CATEGORY_LABELS[cat]}</span>
                <span style={{
                  marginLeft: 8, fontSize: '0.75rem', fontWeight: 600,
                  padding: '1px 8px', borderRadius: 99,
                  background: selectedCount > 0 ? '#DCFCE7' : '#F3F4F6',
                  color: selectedCount > 0 ? '#166534' : 'var(--text-secondary)'
                }}>
                  {selectedCount} selected
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                  onClick={() => selectAllDefaults(cat)}
                >
                  Use Defaults
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                  onClick={() => clearCategory(cat)}
                >
                  Clear
                </button>
              </div>
            </div>
            <div style={{ padding: '10px 16px', maxHeight: 240, overflowY: 'auto' }}>
              {catProjects.length === 0 && (
                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', padding: '8px 0' }}>
                  No reference projects in this category yet.
                </div>
              )}
              {catProjects.map(proj => (
                <label key={proj._id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
                  background: isSelected(cat, proj._id) ? '#EFF6FF' : 'transparent',
                  marginBottom: 2
                }}>
                  <input
                    type="checkbox"
                    checked={isSelected(cat, proj._id)}
                    onChange={() => toggleRefProject(cat, proj._id)}
                  />
                  <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500 }}>{proj.name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: 80 }}>{proj.bua}</span>
                  <span style={{ fontSize: '0.75rem', color: '#7C3AED', minWidth: 90 }}>{proj.ratingSystem}</span>
                  <span style={{
                    fontSize: '0.72rem', padding: '2px 7px', borderRadius: 99,
                    background: '#F3F4F6', color: 'var(--text-secondary)', minWidth: 60, textAlign: 'center'
                  }}>{proj.ratingLevel}</span>
                  {proj.isDefault && (
                    <span style={{
                      fontSize: '0.65rem', padding: '1px 5px', borderRadius: 99,
                      background: '#DBEAFE', color: '#1D4ED8', fontWeight: 700
                    }}>default</span>
                  )}
                </label>
              ))}
            </div>
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
              {!isAddingNew ? (
                <button
                  className="btn btn-sm btn-outline"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => setAddingRefProj(prev => ({ ...prev, [cat]: true }))}
                >
                  + Add Reference Project
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      placeholder="Project name *"
                      value={newForm.name || ''}
                      onChange={e => setNewProjForms(prev => ({ ...prev, [cat]: { ...prev[cat], name: e.target.value } }))}
                      style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.83rem' }}
                    />
                    <input
                      placeholder="BUA (e.g., 10.0 L sft)"
                      value={newForm.bua || ''}
                      onChange={e => setNewProjForms(prev => ({ ...prev, [cat]: { ...prev[cat], bua: e.target.value } }))}
                      style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.83rem' }}
                    />
                    <input
                      placeholder="Rating System (e.g., IGBC NB)"
                      value={newForm.ratingSystem || ''}
                      onChange={e => setNewProjForms(prev => ({ ...prev, [cat]: { ...prev[cat], ratingSystem: e.target.value } }))}
                      style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.83rem' }}
                    />
                    <input
                      placeholder="Rating Level (e.g., Platinum)"
                      value={newForm.ratingLevel || ''}
                      onChange={e => setNewProjForms(prev => ({ ...prev, [cat]: { ...prev[cat], ratingLevel: e.target.value } }))}
                      style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.83rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-sm btn-blue"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => addNewRefProject(cat)}
                    >
                      Add
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => {
                        setAddingRefProj(prev => ({ ...prev, [cat]: false }));
                        setNewProjForms(prev => ({ ...prev, [cat]: {} }));
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const aiExpandMilestones = async (onlyIdx = null) => {
    if (!selectedDoc) return;
    const targetMilestones = onlyIdx !== null ? [milestones[onlyIdx]] : milestones;
    setAiExpandingIdx(onlyIdx !== null ? onlyIdx : -1);
    try {
      const res = await axios.post('/api/proposal-documents/expand-milestones', {
        milestones: targetMilestones.map((m, i) => ({ ...m, index: i })),
        projectName: selectedDoc.projectName,
        ratingSystem: selectedDoc.templateName
      });
      const expanded = res.data.milestones;
      if (onlyIdx !== null) {
        setMilestones(prev => prev.map((m, i) =>
          i === onlyIdx ? { ...m, technicalMilestones: expanded[0]?.technicalMilestones || [] } : m
        ));
        setExpandedMilestoneIdx(onlyIdx);
      } else {
        setMilestones(prev => prev.map((m, i) => ({
          ...m,
          technicalMilestones: expanded[i]?.technicalMilestones || m.technicalMilestones || []
        })));
      }
    } catch (err) {
      alert('AI expand failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setAiExpandingIdx(null);
    }
  };

  const updateTechnicalMilestone = (milestoneIdx, tmIdx, value) => {
    setMilestones(prev => prev.map((m, i) => {
      if (i !== milestoneIdx) return m;
      const tms = [...(m.technicalMilestones || [])];
      tms[tmIdx] = { ...tms[tmIdx], title: value };
      return { ...m, technicalMilestones: tms };
    }));
  };

  const addTechnicalMilestone = (milestoneIdx) => {
    setMilestones(prev => prev.map((m, i) =>
      i === milestoneIdx
        ? { ...m, technicalMilestones: [...(m.technicalMilestones || []), { title: '' }] }
        : m
    ));
  };

  const removeTechnicalMilestone = (milestoneIdx, tmIdx) => {
    setMilestones(prev => prev.map((m, i) =>
      i === milestoneIdx
        ? { ...m, technicalMilestones: (m.technicalMilestones || []).filter((_, j) => j !== tmIdx) }
        : m
    ));
  };

  const renderMilestonesTab = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Financial Milestones & Technical Deliverables</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            style={{
              fontSize: '0.78rem', background: '#7C3AED', color: '#fff',
              opacity: aiExpandingIdx === -1 ? 0.7 : 1
            }}
            onClick={() => aiExpandMilestones(null)}
            disabled={aiExpandingIdx !== null}
          >
            {aiExpandingIdx === -1 ? 'Expanding...' : '✦ AI Expand All'}
          </button>
          <button
            className="btn btn-sm btn-outline"
            style={{ fontSize: '0.78rem' }}
            onClick={async () => {
              try {
                const res = await axios.get(`/api/proposal-documents/${selectedDoc._id}`);
                const doc = res.data;
                if (doc.projectId) {
                  const projRes = await axios.get(`/api/projects/${doc.projectId}`);
                  const fms = projRes.data.financialMilestones || [];
                  const total = fms.reduce((s, fm) => s + (fm.amount || 0), 0);
                  const synced = fms.filter(fm => fm.title).map((fm, i) => ({
                    number: i + 1,
                    percentage: total > 0 ? `${Math.round(((fm.amount || 0) / total) * 100)}%` : '',
                    paymentStage: fm.title,
                    technicalMilestones: (fm.technicalMilestones || [])
                      .filter(tm => tm.title)
                      .map(tm => ({ title: tm.title }))
                  }));
                  if (synced.length > 0) {
                    setMilestones(synced);
                    setExpandedMilestoneIdx(null);
                  }
                }
              } catch (e) {
                alert('Failed to reload from project');
              }
            }}
          >
            Reload from Project
          </button>
          <button
            className="btn btn-sm btn-outline"
            style={{ fontSize: '0.78rem' }}
            onClick={() => setMilestones(DEFAULT_MILESTONES.map(m => ({ ...m, technicalMilestones: [] })))}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {milestones.map((m, idx) => {
          const isExpanded = expandedMilestoneIdx === idx;
          const tmCount = (m.technicalMilestones || []).length;
          const isAiLoading = aiExpandingIdx === idx;

          return (
            <div key={idx} style={{
              border: `1px solid ${isExpanded ? 'var(--info)' : 'var(--border)'}`,
              borderRadius: 8, overflow: 'hidden',
              background: isExpanded ? '#F8FBFF' : 'var(--surface)'
            }}>
              {/* Financial milestone row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <input
                  type="number"
                  value={m.number}
                  onChange={e => updateMilestone(idx, 'number', Number(e.target.value))}
                  style={{ width: 44, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.83rem', textAlign: 'center', flexShrink: 0 }}
                />
                <input
                  value={m.percentage}
                  onChange={e => updateMilestone(idx, 'percentage', e.target.value)}
                  placeholder="%"
                  style={{ width: 64, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.83rem', flexShrink: 0 }}
                />
                <input
                  value={m.paymentStage}
                  onChange={e => updateMilestone(idx, 'paymentStage', e.target.value)}
                  placeholder="Payment stage description"
                  style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.83rem' }}
                />
                <button
                  onClick={() => setExpandedMilestoneIdx(isExpanded ? null : idx)}
                  title={isExpanded ? 'Collapse' : 'Show technical milestones'}
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer', padding: '4px 6px',
                    color: isExpanded ? 'var(--info)' : 'var(--text-secondary)',
                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                  }}
                >
                  {isExpanded ? '▲' : '▼'} TM{tmCount > 0 ? ` (${tmCount})` : ''}
                </button>
                <button
                  onClick={() => removeMilestone(idx)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.9rem', padding: 4, flexShrink: 0 }}
                >
                  &#10005;
                </button>
              </div>

              {/* Technical milestones sub-panel */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: '10px 14px 12px 52px',
                  background: '#F0F6FF'
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--info)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Technical Deliverables
                  </div>
                  {(m.technicalMilestones || []).length === 0 && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                      No technical milestones yet. Add manually or use AI.
                    </div>
                  )}
                  {(m.technicalMilestones || []).map((tm, tmIdx) => (
                    <div key={tmIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>→</span>
                      <input
                        value={tm.title || ''}
                        onChange={e => updateTechnicalMilestone(idx, tmIdx, e.target.value)}
                        placeholder="Technical deliverable"
                        style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.82rem', background: '#fff' }}
                      />
                      <button
                        onClick={() => removeTechnicalMilestone(idx, tmIdx)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.85rem', padding: '2px 4px', flexShrink: 0 }}
                      >
                        &#10005;
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                      onClick={() => addTechnicalMilestone(idx)}
                    >
                      + Add
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 10px', background: '#7C3AED', color: '#fff', opacity: isAiLoading ? 0.7 : 1 }}
                      onClick={() => aiExpandMilestones(idx)}
                      disabled={isAiLoading}
                    >
                      {isAiLoading ? 'Generating...' : '✦ AI Generate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="btn btn-sm btn-outline"
        style={{ marginTop: 12, fontSize: '0.82rem' }}
        onClick={() => {
          addMilestone();
          setExpandedMilestoneIdx(milestones.length);
        }}
      >
        + Add Milestone Row
      </button>
    </div>
  );

  // ---- Scope helpers (array-based) ----
  const updateScopeSection = (sIdx, field, value) => {
    setScopeOfWork(prev => prev.map((s, i) => i === sIdx ? { ...s, [field]: value } : s));
  };

  const updateScopeItem = (sIdx, iIdx, field, value) => {
    setScopeOfWork(prev => prev.map((s, i) =>
      i === sIdx ? { ...s, items: s.items.map((it, j) => j === iIdx ? { ...it, [field]: value } : it) } : s
    ));
  };

  const addScopeItem = (sIdx) => {
    setScopeOfWork(prev => prev.map((s, i) =>
      i === sIdx ? { ...s, items: [...s.items, { text: '', checked: true }] } : s
    ));
  };

  const removeScopeItem = (sIdx, iIdx) => {
    setScopeOfWork(prev => prev.map((s, i) =>
      i === sIdx ? { ...s, items: s.items.filter((_, j) => j !== iIdx) } : s
    ));
  };

  const resetScopeSection = (sIdx) => {
    const def = DEFAULT_SCOPE_SECTIONS[sIdx];
    if (def) setScopeOfWork(prev => prev.map((s, i) => i === sIdx ? { ...def } : s));
  };

  const addScopeSection = () => {
    const newSection = {
      key: `custom_${Date.now()}`,
      title: 'New Section',
      isCustom: true,
      items: [{ text: '', checked: true }]
    };
    setScopeOfWork(prev => [...prev, newSection]);
  };

  const removeScopeSection = (sIdx) => {
    setScopeOfWork(prev => prev.filter((_, i) => i !== sIdx));
  };

  const renderScopeTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {scopeOfWork.map((section, sIdx) => {
        const checkedCount = section.items.filter(i => i.checked).length;
        return (
          <div key={section.key} style={{
            border: `1px solid ${section.isCustom ? '#D8B4FE' : 'var(--border)'}`,
            borderRadius: 10, overflow: 'hidden'
          }}>
            {/* Section header */}
            <div style={{
              padding: '10px 14px', background: section.isCustom ? '#FAF5FF' : 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              {section.isCustom ? (
                <input
                  value={section.title}
                  onChange={e => updateScopeSection(sIdx, 'title', e.target.value)}
                  placeholder="Section title"
                  style={{
                    flex: 1, fontWeight: 700, fontSize: '0.9rem', border: '1px solid #D8B4FE',
                    borderRadius: 5, padding: '3px 8px', background: '#fff'
                  }}
                />
              ) : (
                <input
                  value={section.title}
                  onChange={e => updateScopeSection(sIdx, 'title', e.target.value)}
                  style={{
                    flex: 1, fontWeight: 700, fontSize: '0.9rem',
                    border: '1px solid transparent', borderRadius: 5, padding: '3px 8px',
                    background: 'transparent'
                  }}
                  onFocus={e => { e.target.style.border = '1px solid var(--border)'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
                />
              )}
              <span style={{
                fontSize: '0.73rem', fontWeight: 600, padding: '1px 8px', borderRadius: 99, flexShrink: 0,
                background: checkedCount > 0 ? '#DCFCE7' : '#F3F4F6',
                color: checkedCount > 0 ? '#166534' : 'var(--text-secondary)'
              }}>
                {checkedCount}/{section.items.length}
              </span>
              {section.isCustom && (
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                  background: '#EDE9FE', color: '#7C3AED', flexShrink: 0
                }}>custom</span>
              )}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-sm btn-outline" style={{ fontSize: '0.7rem', padding: '2px 7px' }}
                  onClick={() => setScopeOfWork(prev => prev.map((s, i) => i === sIdx ? { ...s, items: s.items.map(it => ({ ...it, checked: true })) } : s))}>
                  All
                </button>
                <button className="btn btn-sm btn-outline" style={{ fontSize: '0.7rem', padding: '2px 7px' }}
                  onClick={() => setScopeOfWork(prev => prev.map((s, i) => i === sIdx ? { ...s, items: s.items.map(it => ({ ...it, checked: false })) } : s))}>
                  None
                </button>
                {!section.isCustom && sIdx < DEFAULT_SCOPE_SECTIONS.length && (
                  <button className="btn btn-sm btn-outline" style={{ fontSize: '0.7rem', padding: '2px 7px' }}
                    onClick={() => resetScopeSection(sIdx)}>
                    Reset
                  </button>
                )}
                <button
                  onClick={() => removeScopeSection(sIdx)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.9rem', padding: '2px 4px' }}
                  title="Remove section"
                >
                  &#10005;
                </button>
              </div>
            </div>

            {/* Items list */}
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {section.items.map((item, iIdx) => (
                <div key={iIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={e => updateScopeItem(sIdx, iIdx, 'checked', e.target.checked)}
                    style={{ marginTop: 6, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <textarea
                    value={item.text}
                    onChange={e => updateScopeItem(sIdx, iIdx, 'text', e.target.value)}
                    rows={Math.max(1, Math.ceil((item.text || '').length / 80))}
                    style={{
                      flex: 1, padding: '4px 8px', border: '1px solid var(--border)',
                      borderRadius: 5, fontSize: '0.83rem', resize: 'vertical',
                      background: item.checked ? '#fff' : '#F9FAFB',
                      color: item.checked ? 'var(--text)' : 'var(--text-secondary)',
                      opacity: item.checked ? 1 : 0.65
                    }}
                  />
                  <button onClick={() => removeScopeItem(sIdx, iIdx)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.85rem', padding: '4px 4px', flexShrink: 0, marginTop: 2 }}>
                    &#10005;
                  </button>
                </div>
              ))}
            </div>

            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
              <button className="btn btn-sm btn-outline" style={{ fontSize: '0.78rem' }}
                onClick={() => addScopeItem(sIdx)}>
                + Add Item
              </button>
            </div>
          </div>
        );
      })}

      {/* Add new section */}
      <button
        className="btn btn-sm btn-outline"
        style={{ fontSize: '0.82rem', alignSelf: 'flex-start', borderStyle: 'dashed' }}
        onClick={addScopeSection}
      >
        + Add Section
      </button>
    </div>
  );

  // ---- Timeline helpers ----
  const TIMELINE_TYPES = [
    { value: 'milestone', label: 'Milestone' },
    { value: 'deliverable', label: 'Deliverable' },
    { value: 'submission', label: 'Submission' },
    { value: 'approval', label: 'Approval' },
    { value: 'other', label: 'Other' }
  ];

  const updateTimelineEntry = (idx, field, value) => {
    setTimeline(prev => ({
      ...prev,
      entries: prev.entries.map((e, i) => i === idx ? { ...e, [field]: value } : e)
    }));
  };

  const addTimelineEntry = () => {
    setTimeline(prev => ({
      ...prev,
      entries: [...prev.entries, { label: '', date: '', type: 'milestone' }]
    }));
  };

  const removeTimelineEntry = (idx) => {
    setTimeline(prev => ({ ...prev, entries: prev.entries.filter((_, i) => i !== idx) }));
  };

  const autoPopulateTimeline = () => {
    const entries = [];
    milestones.forEach(m => {
      (m.technicalMilestones || []).forEach(tm => {
        if (tm.title && tm.expectedDate) {
          entries.push({
            label: tm.title,
            date: new Date(tm.expectedDate).toISOString().substring(0, 10),
            type: 'deliverable'
          });
        }
      });
    });
    if (entries.length === 0) {
      alert('No technical milestones with expected dates found. Add dates in the Payment Milestones tab first.');
      return;
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    setTimeline(prev => ({ ...prev, entries }));
  };

  const renderTimelineTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Project Timeline</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Appended as a table at the end of the generated DOCX.
          </div>
        </div>
        <button
          className="btn btn-sm btn-outline"
          style={{ fontSize: '0.78rem' }}
          onClick={autoPopulateTimeline}
        >
          ↺ Auto-populate from Milestones
        </button>
      </div>

      {timeline.entries.length === 0 ? (
        <div style={{
          padding: '32px 24px', textAlign: 'center', border: '2px dashed var(--border)',
          borderRadius: 10, color: 'var(--text-secondary)', fontSize: '0.85rem'
        }}>
          No entries yet. Auto-populate from milestones or add rows manually.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '32px 1fr 150px 130px 32px',
            gap: 8, padding: '8px 12px',
            background: '#1F3864', color: '#fff',
            fontSize: '0.75rem', fontWeight: 700
          }}>
            <span>#</span>
            <span>Milestone / Deliverable</span>
            <span>Expected Date</span>
            <span>Type</span>
            <span></span>
          </div>
          {timeline.entries.map((entry, idx) => (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 150px 130px 32px',
              gap: 8, padding: '7px 12px', alignItems: 'center',
              borderTop: '1px solid var(--border)',
              background: idx % 2 === 0 ? '#F9FAFB' : '#fff'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {idx + 1}
              </span>
              <input
                value={entry.label}
                onChange={e => updateTimelineEntry(idx, 'label', e.target.value)}
                placeholder="Activity or deliverable"
                style={{ padding: '4px 7px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.83rem' }}
              />
              <input
                type="date"
                value={entry.date}
                onChange={e => updateTimelineEntry(idx, 'date', e.target.value)}
                style={{ padding: '4px 7px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.82rem' }}
              />
              <select
                value={entry.type}
                onChange={e => updateTimelineEntry(idx, 'type', e.target.value)}
                style={{ padding: '4px 7px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.82rem' }}
              >
                {TIMELINE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                onClick={() => removeTimelineEntry(idx)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.9rem', padding: 2 }}
              >
                &#10005;
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-sm btn-outline"
        style={{ fontSize: '0.82rem', alignSelf: 'flex-start' }}
        onClick={addTimelineEntry}
      >
        + Add Row
      </button>
    </div>
  );

  const renderGenerateTab = () => {
    const totalSelected = CATEGORY_KEYS.reduce((s, cat) => s + countSelected(cat), 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12 }}>Generation Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Template:</span>
              <span style={{ fontWeight: 600 }}>{templateName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Contact Person:</span>
              <span style={{ fontWeight: 600 }}>{overrides.contactName || 'Not set'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Designation:</span>
              <span style={{ fontWeight: 600 }}>{overrides.contactDesignation || 'Not set'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Project Location:</span>
              <span style={{ fontWeight: 600 }}>{overrides.projectLocation || 'Not set'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Reference Projects:</span>
              <span style={{ fontWeight: 600 }}>{totalSelected} total selected</span>
            </div>
            {CATEGORY_KEYS.map(cat => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{CATEGORY_LABELS[cat]}:</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{countSelected(cat)} projects</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Payment Milestones:</span>
              <span style={{ fontWeight: 600 }}>{milestones.length} rows</span>
            </div>
          </div>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Fee (INR)</label>
          <input
            type="number"
            value={totalFee}
            onChange={e => setTotalFee(e.target.value)}
            placeholder="e.g., 1500000"
            style={{ maxWidth: 280 }}
          />
          {totalFee && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Formatted: INR {Number(totalFee).toLocaleString('en-IN')}/-
            </div>
          )}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 8, color: '#B91C1C', fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-blue"
          style={{ alignSelf: 'flex-start', padding: '10px 28px', fontSize: '0.95rem' }}
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate & Download DOCX'}
        </button>

        {selectedDoc?.status === 'generated' && (
          <div style={{
            padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: 8, color: '#166534', fontSize: '0.85rem'
          }}>
            This document was previously generated successfully.
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { key: 'info', label: 'Info & Overrides' },
    { key: 'template', label: 'Template' },
    { key: 'refprojects', label: 'Reference Projects' },
    { key: 'milestones', label: 'Payment Milestones' },
    { key: 'scope', label: 'Scope of Work' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'generate', label: 'Generate' }
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* LEFT PANEL: Document list */}
      <div style={{
        width: 320, minWidth: 280, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--surface)'
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Proposal Documents</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {docs.length} document{docs.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {docs.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No proposal documents yet.<br />
              Use "Create Proposal Doc" from a project card.
            </div>
          )}
          {docs.map(doc => (
            <div
              key={doc._id}
              onClick={() => openDoc(doc)}
              style={{
                padding: '12px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                border: `2px solid ${selectedDoc?._id === doc._id ? 'var(--info)' : 'var(--border)'}`,
                background: selectedDoc?._id === doc._id ? '#EFF6FF' : 'var(--surface)',
                transition: 'all 0.1s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', flex: 1, marginRight: 8 }}>
                  {doc.projectName || doc.projectId}
                </div>
                <StatusBadge status={doc.status} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {doc.clientName || 'No client'}
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {doc.templateName} &bull; {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedDoc ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 16, color: 'var(--text-secondary)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <div style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.5 }}>Select a document to edit</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.4 }}>
              Or create one from a project proposal card
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface)'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedDoc.projectName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedDoc.projectId} &bull; {selectedDoc.clientName}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {saveStatus && (
                  <span style={{
                    fontSize: '0.78rem', color: saveStatus === 'saved' ? 'var(--success)' : 'var(--text-secondary)'
                  }}>
                    {saveStatus}
                  </span>
                )}
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => saveDoc(selectedDoc._id, buildSavePatch())}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
              padding: '0 20px', gap: 0
            }}>
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  style={{
                    padding: '10px 16px', border: 'none', background: 'none',
                    fontSize: '0.83rem', fontWeight: activeTab === t.key ? 700 : 500,
                    color: activeTab === t.key ? 'var(--info)' : 'var(--text-secondary)',
                    borderBottom: activeTab === t.key ? '2px solid var(--info)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {activeTab === 'info' && renderInfoTab()}
              {activeTab === 'template' && renderTemplateTab()}
              {activeTab === 'refprojects' && renderRefProjectsTab()}
              {activeTab === 'milestones' && renderMilestonesTab()}
              {activeTab === 'scope' && renderScopeTab()}
              {activeTab === 'timeline' && renderTimelineTab()}
              {activeTab === 'generate' && renderGenerateTab()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
