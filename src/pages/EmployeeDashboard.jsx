import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const VERTICALS = ['ESG', 'Green Building Certification', 'MEFP Design'];

const fmtFollowUpDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const daysUntilDate = (d) => d == null ? null : Math.ceil((new Date(d) - new Date()) / 86400000);
const followUpAlert = (fu) => {
  if (!fu || fu.status === 'completed') return null;
  const days = daysUntilDate(fu.dueDate);
  if (days === null) return null;
  if (days < 0) return 'overdue';
  if (days <= 3) return 'due-soon';
  return null;
};

export default function EmployeeDashboard() {
  const { user, refreshUser } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('milestones');
  const [cvUploading, setCvUploading] = useState(false);
  const [cvMessage, setCvMessage] = useState('');
  const [profile, setProfile] = useState(null);
  const [followUps, setFollowUps] = useState([]);

  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await axios.get('/api/projects');
    setProjects(res.data);
    if (user?.assignedProjects) {
      setSelectedProjects([...user.assignedProjects]);
    }
    try {
      const meRes = await axios.get('/api/auth/me');
      setProfile(meRes.data);
    } catch {}
    try {
      const fuRes = await axios.get('/api/projects/follow-ups/mine');
      setFollowUps(fuRes.data);
    } catch {}
  };

  const markFollowUp = async (fu, status) => {
    try {
      await axios.put(`/api/projects/${fu.projectId}/follow-ups/${fu.followUpId}`, { status });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update follow-up');
    }
  };

  useEffect(() => {
    if (profile?.profile) {
      setProfileForm(buildFormFromProfile(profile));
    }
  }, [profile]);

  const buildFormFromProfile = (p) => ({
    designation: p.profile?.designation || '',
    yearsOfExperience: p.profile?.yearsOfExperience || '',
    vertical: p.profile?.vertical || [],
    contactNumber: p.profile?.contactNumber || '',
    credentials: p.profile?.credentials || p.credentials || [],
    qualifications: p.profile?.qualifications?.length > 0 ? p.profile.qualifications : (p.cvParsed?.qualifications || []),
    expertise: p.profile?.expertise || [],
    pastProjects: p.profile?.pastProjects || [],
    pastExperience: p.profile?.pastExperience?.length > 0 ? p.profile.pastExperience : (p.cvParsed?.experience || []),
    professionalSummary: p.profile?.professionalSummary || ''
  });

  if (!user?.verified) {
    return (
      <div>
        <div className="pending-banner">
          <h2>Account Pending Verification</h2>
          <p>Your account is awaiting admin approval. Once verified, you'll be able to select projects and manage milestones.</p>
          <p style={{ marginTop: 8, fontSize: '0.85rem' }}>Employee ID: <strong>{user?.employeeId}</strong></p>
        </div>
      </div>
    );
  }

  const toggleProject = (projectId) => {
    setSelectedProjects(prev =>
      prev.includes(projectId) ? prev.filter(p => p !== projectId) : [...prev, projectId]
    );
  };

  const saveProjects = async () => {
    setSaving(true);
    setMessage('');
    try {
      await axios.post('/api/projects/assign', { projectIds: selectedProjects });
      await refreshUser();
      setMessage('Projects updated successfully');
      fetchData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const updateMilestone = async (projectId, payload) => {
    try {
      await axios.put(`/api/projects/${projectId}/milestone`, payload);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update milestone');
    }
  };

  const handleCvUpload = async (file) => {
    setCvUploading(true);
    setCvMessage('');
    const formData = new FormData();
    formData.append('cv', file);
    try {
      const res = await axios.post('/api/users/me/parse-cv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProfile(res.data);
      setCvMessage('CV parsed successfully! Your profile has been updated.');
      setEditing(false);
      await refreshUser();
    } catch (err) {
      setCvMessage(err.response?.data?.message || 'CV parsing failed');
    } finally {
      setCvUploading(false);
      setTimeout(() => setCvMessage(''), 5000);
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const res = await axios.put('/api/users/me/profile', profileForm);
      setProfile(res.data);
      setEditing(false);
      setProfileMsg('Profile saved successfully');
      await refreshUser();
    } catch (err) {
      setProfileMsg(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMsg(''), 4000);
    }
  };

  const addArrayItem = (field, template) => {
    setProfileForm(f => ({ ...f, [field]: [...f[field], template] }));
  };
  const removeArrayItem = (field, idx) => {
    setProfileForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  };
  const updateArrayItem = (field, idx, key, value) => {
    setProfileForm(f => ({
      ...f,
      [field]: f[field].map((item, i) => i === idx ? { ...item, [key]: value } : item)
    }));
  };

  const myProjects = projects.filter(p =>
    (p.pipelineStatus === 'workorder' || p.pipelineStatus === 'workorder-held') &&
    (p.assignedEmployeeIds || []).includes(user?.employeeId)
  );
  const pendingFollowUps = followUps.filter(fu => fu.status === 'pending').length;
  const overdueFollowUps = followUps.filter(fu => followUpAlert(fu) === 'overdue').length;
  const pf = profileForm || buildFormFromProfile(profile || {});

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1>Employee Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {user?.name} ({user?.employeeId})
          </p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-value">{myProjects.length}</div>
          <div className="stat-label">Assigned Projects</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">
            {myProjects.reduce((s, p) => {
              const total = p.financialMilestones.reduce((s2, fm) => s2 + fm.technicalMilestones.length, 0);
              const done = p.financialMilestones.reduce(
                (s2, fm) => s2 + fm.technicalMilestones.filter(t => t.status === 'completed').length, 0);
              return s + done;
            }, 0)}
          </div>
          <div className="stat-label">Milestones Completed</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">
            {myProjects.reduce((s, p) =>
              s + p.financialMilestones.reduce(
                (s2, fm) => s2 + fm.technicalMilestones.filter(t => t.status === 'in_progress').length, 0), 0)}
          </div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{(profile?.credentials || []).length}</div>
          <div className="stat-label">Skills Matched</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'milestones' ? 'active' : ''}`} onClick={() => setTab('milestones')}>
          Milestones ({myProjects.length})
        </button>
        <button className={`tab ${tab === 'followups' ? 'active' : ''}`} onClick={() => setTab('followups')}>
          Follow-ups{pendingFollowUps > 0 ? ` (${pendingFollowUps})` : ''}
          {overdueFollowUps > 0 && (
            <span style={{ marginLeft: 6, background: 'var(--error)', color: '#fff', borderRadius: 99, padding: '0 7px', fontSize: '0.7rem', fontWeight: 700 }}>
              {overdueFollowUps}
            </span>
          )}
        </button>
        <button className={`tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          My Profile
        </button>
      </div>

      {tab === 'followups' && (
        <div>
          {followUps.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              No follow-ups assigned to you yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {followUps.map(fu => {
                const alertLevel = followUpAlert(fu);
                const done = fu.status === 'completed';
                const bd = alertLevel === 'overdue' ? '#FCA5A5' : alertLevel === 'due-soon' ? '#FDE68A' : 'var(--border)';
                const days = daysUntilDate(fu.dueDate);
                return (
                  <div className="card" key={`${fu.projectId}-${fu.followUpId}`} style={{ borderLeft: `4px solid ${alertLevel === 'overdue' ? 'var(--error)' : alertLevel === 'due-soon' ? 'var(--warning)' : 'var(--border)'}`, border: `1px solid ${bd}`, opacity: done ? 0.7 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', textDecoration: done ? 'line-through' : 'none' }}>
                          {fu.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {fu.projectName} · {fu.projectId} · {fu.clientName}
                        </div>
                        {fu.notes && <div style={{ fontSize: '0.85rem', marginTop: 6 }}>{fu.notes}</div>}
                        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {fu.dueDate && (
                            <span style={{ color: alertLevel === 'overdue' ? 'var(--error)' : alertLevel === 'due-soon' ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: alertLevel ? 700 : 400 }}>
                              Due {fmtFollowUpDate(fu.dueDate)}
                              {!done && alertLevel === 'overdue' && ` — ${Math.abs(days)}d overdue`}
                              {!done && alertLevel === 'due-soon' && ` — ${days === 0 ? 'due today' : days + 'd left'}`}
                            </span>
                          )}
                          {fu.createdByName && <span>Assigned by {fu.createdByName}</span>}
                          {done && <span>· Completed</span>}
                        </div>
                      </div>
                      <button
                        className={`btn btn-sm ${done ? 'btn-outline' : 'btn-green'}`}
                        onClick={() => markFollowUp(fu, done ? 'pending' : 'completed')}
                      >
                        {done ? 'Reopen' : 'Mark Done'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'milestones' && myProjects.length > 0 && (
        <div>
          <div className="grid-2">
            {myProjects.map(p => {
              const isHeld = p.pipelineStatus === 'workorder-held';
              const totalTMs = p.financialMilestones.reduce((s, fm) => s + fm.technicalMilestones.length, 0);
              const completedTMs = p.financialMilestones.reduce(
                (s, fm) => s + fm.technicalMilestones.filter(t => t.status === 'completed').length, 0);
              const techProgress = totalTMs > 0 ? Math.round((completedTMs / totalTMs) * 100) : 0;

              const totalBudget = p.financialMilestones.reduce((s, fm) => s + (fm.amount || 0), 0);
              const raisedAmount = p.financialMilestones
                .filter(fm => fm.status === 'in_progress' || fm.status === 'completed')
                .reduce((s, fm) => s + (fm.amount || 0), 0);
              const receivedAmount = p.financialMilestones
                .filter(fm => fm.status === 'completed')
                .reduce((s, fm) => s + (fm.amount || 0), 0);
              const raisedPct = totalBudget > 0 ? Math.round((raisedAmount / totalBudget) * 100) : 0;
              const receivedPct = totalBudget > 0 ? Math.round((receivedAmount / totalBudget) * 100) : 0;

              return (
                <div className="card" key={p.projectId}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">{p.projectName}</div>
                      <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isHeld && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 99, background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>
                          ON HOLD
                        </span>
                      )}
                      <span className={`badge badge-${p.projectStatus}`}>{p.projectStatus}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <span className="vertical-tag">{p.vertical}</span>
                    <span className="money">{'₹'}{(p.totalProposedMoney / 100000).toFixed(1)}L</span>
                  </div>

                  {/* 3 Progress metrics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                        <span>Technical Completion</span><span>{techProgress}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${techProgress}%`, background: 'var(--primary)' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                        <span>Financial Raised</span><span>{raisedPct}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${raisedPct}%`, background: '#D97706' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                        <span>Money Received</span><span>{receivedPct}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${receivedPct}%`, background: 'var(--success)' }} />
                      </div>
                    </div>
                  </div>

                  {isHeld && (
                    <div style={{ padding: '8px 12px', background: '#FEF3C7', borderRadius: 6, fontSize: '0.82rem', color: '#92400E', marginBottom: 10 }}>
                      This project is currently on hold. Milestone updates are disabled.
                    </div>
                  )}

                  {p.financialMilestones.map(fm => (
                    <div key={fm.financialMilestoneId} className="milestone-section">
                      <div className="milestone-item" style={{ background: 'var(--primary-light)', fontWeight: 500 }}>
                        <span className="mi-title">{fm.financialMilestoneId}: {fm.title}</span>
                        <span className="mi-amount">{'₹'}{(fm.amount / 1000).toFixed(0)}K</span>
                        <span className={`badge badge-${fm.status}`}>{fm.status.replace('_', ' ')}</span>
                      </div>
                      {fm.technicalMilestones.map(tm => (
                        <div key={tm.technicalMilestoneId} className="milestone-item" style={{ marginLeft: 16 }}>
                          <span className="mi-title" style={{ fontSize: '0.85rem' }}>
                            {tm.technicalMilestoneId}: {tm.title}
                          </span>
                          {isHeld ? (
                            <span className={`badge badge-${tm.status}`} style={{ fontSize: '0.75rem' }}>{tm.status.replace('_', ' ')}</span>
                          ) : (
                            <select value={tm.status} onChange={e => updateMilestone(p.projectId, {
                              technicalMilestoneId: tm.technicalMilestoneId,
                              status: e.target.value
                            })}>
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'milestones' && myProjects.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          No projects assigned yet. Your assigned projects will appear here once an admin assigns them to you.
        </div>
      )}

      {tab === 'profile' && (
        <div>
          {profileMsg && (
            <div className={profileMsg.includes('success') ? 'auth-info' : 'auth-error'} style={{ marginBottom: 12 }}>
              {profileMsg}
            </div>
          )}

          {/* Profile Content */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>My Profile</h3>
              {!editing ? (
                <button className="btn btn-sm btn-outline" onClick={() => setEditing(true)}>Edit Profile</button>
              ) : (
                <div className="btn-group">
                  <button className="btn btn-sm btn-blue" onClick={saveProfile} disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => { setEditing(false); setProfileForm(buildFormFromProfile(profile || {})); }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="project-meta-grid" style={{ marginBottom: 20 }}>
              <div className="meta-item">
                <div className="meta-label">Name</div>
                <div className="meta-value">{profile?.name || user?.name}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Employee ID</div>
                <div className="meta-value">{profile?.employeeId || user?.employeeId}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Email</div>
                <div className="meta-value">{profile?.email || user?.email}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Designation</div>
                {editing ? (
                  <input type="text" value={pf.designation} onChange={e => setProfileForm({ ...pf, designation: e.target.value })}
                    placeholder="e.g. Senior Consultant" style={{ marginTop: 4, width: '100%' }} />
                ) : (
                  <div className="meta-value">{pf.designation || '-'}</div>
                )}
              </div>
              <div className="meta-item">
                <div className="meta-label">Years of Experience</div>
                {editing ? (
                  <input type="text" value={pf.yearsOfExperience} onChange={e => setProfileForm({ ...pf, yearsOfExperience: e.target.value })}
                    placeholder="e.g. 5" style={{ marginTop: 4, width: '100%' }} />
                ) : (
                  <div className="meta-value">{pf.yearsOfExperience || '-'}</div>
                )}
              </div>
              <div className="meta-item">
                <div className="meta-label">Contact Number</div>
                {editing ? (
                  <input type="text" value={pf.contactNumber} onChange={e => setProfileForm({ ...pf, contactNumber: e.target.value })}
                    placeholder="+91 99999 99999" style={{ marginTop: 4, width: '100%' }} />
                ) : (
                  <div className="meta-value">{pf.contactNumber || '-'}</div>
                )}
              </div>
            </div>

            {/* Vertical */}
            <div style={{ marginBottom: 20 }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vertical</strong>
              {editing ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {VERTICALS.map(v => (
                    <label key={v} className={`chip ${pf.vertical.includes(v) ? 'chip-active' : ''}`}
                      onClick={() => {
                        const next = pf.vertical.includes(v) ? pf.vertical.filter(x => x !== v) : [...pf.vertical, v];
                        setProfileForm({ ...pf, vertical: next });
                      }}>
                      {v}
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {pf.vertical?.length > 0
                    ? pf.vertical.map(v => <span key={v} className="meta-tag tag-service">{v}</span>)
                    : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>}
                </div>
              )}
            </div>

            {/* Professional Summary */}
            <div style={{ marginBottom: 20 }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Professional Summary</strong>
              {editing ? (
                <textarea value={pf.professionalSummary} onChange={e => setProfileForm({ ...pf, professionalSummary: e.target.value })}
                  rows={3} placeholder="Brief professional summary..." style={{ marginTop: 6, width: '100%' }} />
              ) : (
                <p style={{ marginTop: 6, fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {pf.professionalSummary || <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                </p>
              )}
            </div>

            {/* Credentials / Certifications */}
            <div style={{ marginBottom: 20 }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credentials / Certifications</strong>
              {editing ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {pf.credentials.map((c, i) => (
                      <span key={i} className="meta-tag tag-rating" style={{ cursor: 'pointer' }}
                        onClick={() => setProfileForm({ ...pf, credentials: pf.credentials.filter((_, j) => j !== i) })}>
                        {c} &times;
                      </span>
                    ))}
                  </div>
                  <input type="text" placeholder="Type and press Enter to add"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        e.preventDefault();
                        setProfileForm({ ...pf, credentials: [...pf.credentials, e.target.value.trim()] });
                        e.target.value = '';
                      }
                    }}
                    style={{ width: '100%' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {pf.credentials?.length > 0
                    ? pf.credentials.map((c, i) => <span key={i} className="meta-tag tag-rating">{c}</span>)
                    : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>}
                </div>
              )}
            </div>

            {/* Expertise */}
            <div style={{ marginBottom: 20 }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expertise</strong>
              {editing ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {pf.expertise.map((e, i) => (
                      <span key={i} className="meta-tag tag-service" style={{ cursor: 'pointer' }}
                        onClick={() => setProfileForm({ ...pf, expertise: pf.expertise.filter((_, j) => j !== i) })}>
                        {e} &times;
                      </span>
                    ))}
                  </div>
                  <input type="text" placeholder="Type and press Enter to add"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        e.preventDefault();
                        setProfileForm({ ...pf, expertise: [...pf.expertise, e.target.value.trim()] });
                        e.target.value = '';
                      }
                    }}
                    style={{ width: '100%' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {pf.expertise?.length > 0
                    ? pf.expertise.map((e, i) => <span key={i} className="meta-tag tag-service">{e}</span>)
                    : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>}
                </div>
              )}
            </div>

            {/* Qualifications */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qualifications</strong>
                {editing && (
                  <button className="btn btn-sm btn-outline" type="button"
                    onClick={() => addArrayItem('qualifications', { degree: '', field: '', institution: '', year: '' })}>
                    + Add
                  </button>
                )}
              </div>
              {editing ? (
                <div style={{ marginTop: 8 }}>
                  {pf.qualifications.map((q, i) => (
                    <div key={i} className="fm-block" style={{ padding: 14, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Qualification {i + 1}</span>
                        <button type="button" style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => removeArrayItem('qualifications', i)}>&times;</button>
                      </div>
                      <div className="inline-fields">
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <input type="text" value={q.degree} onChange={e => updateArrayItem('qualifications', i, 'degree', e.target.value)} placeholder="Degree" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <input type="text" value={q.field} onChange={e => updateArrayItem('qualifications', i, 'field', e.target.value)} placeholder="Field" />
                        </div>
                      </div>
                      <div className="inline-fields">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <input type="text" value={q.institution} onChange={e => updateArrayItem('qualifications', i, 'institution', e.target.value)} placeholder="Institution" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <input type="text" value={q.year} onChange={e => updateArrayItem('qualifications', i, 'year', e.target.value)} placeholder="Year" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  {pf.qualifications?.length > 0 ? pf.qualifications.map((q, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 500 }}>{q.degree}{q.field ? ` - ${q.field}` : ''}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{q.institution}{q.year ? ` (${q.year})` : ''}</div>
                    </div>
                  )) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>}
                </div>
              )}
            </div>

            {/* Past Experience */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Past Experience</strong>
                {editing && (
                  <button className="btn btn-sm btn-outline" type="button"
                    onClick={() => addArrayItem('pastExperience', { company: '', position: '', duration: '' })}>
                    + Add
                  </button>
                )}
              </div>
              {editing ? (
                <div style={{ marginTop: 8 }}>
                  {pf.pastExperience.map((exp, i) => (
                    <div key={i} className="fm-block" style={{ padding: 14, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Experience {i + 1}</span>
                        <button type="button" style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => removeArrayItem('pastExperience', i)}>&times;</button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <input type="text" value={exp.position} onChange={e => updateArrayItem('pastExperience', i, 'position', e.target.value)} placeholder="Position" />
                      </div>
                      <div className="inline-fields">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <input type="text" value={exp.company} onChange={e => updateArrayItem('pastExperience', i, 'company', e.target.value)} placeholder="Company" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <input type="text" value={exp.duration} onChange={e => updateArrayItem('pastExperience', i, 'duration', e.target.value)} placeholder="Duration" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  {pf.pastExperience?.length > 0 ? pf.pastExperience.map((exp, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 500 }}>{exp.position}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {exp.company}{exp.duration ? ` | ${exp.duration}` : ''}
                      </div>
                    </div>
                  )) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>}
                </div>
              )}
            </div>

            {/* Past Projects */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Past Projects</strong>
                {editing && (
                  <button className="btn btn-sm btn-outline" type="button"
                    onClick={() => addArrayItem('pastProjects', { name: '', role: '', description: '' })}>
                    + Add
                  </button>
                )}
              </div>
              {editing ? (
                <div style={{ marginTop: 8 }}>
                  {pf.pastProjects.map((proj, i) => (
                    <div key={i} className="fm-block" style={{ padding: 14, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Project {i + 1}</span>
                        <button type="button" style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => removeArrayItem('pastProjects', i)}>&times;</button>
                      </div>
                      <div className="inline-fields">
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <input type="text" value={proj.name} onChange={e => updateArrayItem('pastProjects', i, 'name', e.target.value)} placeholder="Project Name" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <input type="text" value={proj.role} onChange={e => updateArrayItem('pastProjects', i, 'role', e.target.value)} placeholder="Your Role" />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <input type="text" value={proj.description} onChange={e => updateArrayItem('pastProjects', i, 'description', e.target.value)} placeholder="Brief description" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  {pf.pastProjects?.length > 0 ? pf.pastProjects.map((proj, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 500 }}>{proj.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {proj.role}{proj.description ? ` — ${proj.description}` : ''}
                      </div>
                    </div>
                  )) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
