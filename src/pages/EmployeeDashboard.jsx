import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const VERTICALS = ['ESG', 'Green Building Certification', 'MEFP Design'];

export default function EmployeeDashboard() {
  const { user, refreshUser } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('projects');
  const [cvUploading, setCvUploading] = useState(false);
  const [cvMessage, setCvMessage] = useState('');
  const [profile, setProfile] = useState(null);

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

  const activeProjects = projects.filter(p => p.pipelineStatus === 'workorder' && p.projectStatus === 'active');
  const myProjects = projects.filter(p => selectedProjects.includes(p.projectId) && p.pipelineStatus === 'workorder');
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
        <button className={`tab ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>
          Projects
        </button>
        <button className={`tab ${tab === 'milestones' ? 'active' : ''}`} onClick={() => setTab('milestones')}>
          Milestones ({myProjects.length})
        </button>
        <button className={`tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          My Profile
        </button>
      </div>

      {tab === 'projects' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Select Your Projects</div>
              <div className="card-subtitle">Choose the projects you are currently working on</div>
            </div>
            <button className="btn btn-blue" onClick={saveProjects} disabled={saving}>
              {saving ? 'Saving...' : 'Save Selection'}
            </button>
          </div>
          {message && (
            <div className={message.includes('success') ? 'auth-info' : 'auth-error'} style={{ marginBottom: 12 }}>
              {message}
            </div>
          )}
          <div className="checkbox-group">
            {activeProjects.map(p => (
              <label key={p.projectId}
                className={`checkbox-item ${selectedProjects.includes(p.projectId) ? 'checked' : ''}`}>
                <input type="checkbox" checked={selectedProjects.includes(p.projectId)}
                  onChange={() => toggleProject(p.projectId)} />
                <div>
                  <div style={{ fontWeight: 500 }}>{p.projectId}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.projectName}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {tab === 'milestones' && myProjects.length > 0 && (
        <div>
          <div className="grid-2">
            {myProjects.map(p => {
              const totalTMs = p.financialMilestones.reduce((s, fm) => s + fm.technicalMilestones.length, 0);
              const completedTMs = p.financialMilestones.reduce(
                (s, fm) => s + fm.technicalMilestones.filter(t => t.status === 'completed').length, 0);
              const progress = totalTMs > 0 ? Math.round((completedTMs / totalTMs) * 100) : 0;

              return (
                <div className="card" key={p.projectId}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">{p.projectName}</div>
                      <div className="card-subtitle">{p.projectId} | {p.clientName}</div>
                    </div>
                    <span className={`badge badge-${p.projectStatus}`}>{p.projectStatus}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span className="vertical-tag">{p.vertical}</span>
                    <span className="money">{'₹'}{(p.totalProposedMoney / 100000).toFixed(1)}L</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Progress: {progress}%
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>

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
                          <select value={tm.status} onChange={e => updateMilestone(p.projectId, {
                            technicalMilestoneId: tm.technicalMilestoneId,
                            status: e.target.value
                          })}>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
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
          No projects assigned. Select projects in the Projects tab first.
        </div>
      )}

      {tab === 'profile' && (
        <div>
          {/* CV Upload Card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>CV Upload</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Upload your CV to auto-fill your profile with AI-extracted data.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {profile?.cvPath && (
                  <a href={profile.cvPath} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">
                    Download CV
                  </a>
                )}
                <label className="btn btn-sm btn-blue" style={{ cursor: cvUploading ? 'not-allowed' : 'pointer' }}>
                  {cvUploading ? 'Parsing...' : 'Upload CV'}
                  <input type="file" accept=".pdf,.txt,.doc,.docx"
                    onChange={e => { if (e.target.files[0]) handleCvUpload(e.target.files[0]); }}
                    disabled={cvUploading}
                    style={{ display: 'none' }} />
                </label>
              </div>
            </div>
            {cvMessage && (
              <div style={{ marginTop: 10, fontSize: '0.85rem', color: cvMessage.includes('success') ? 'var(--success)' : 'var(--error)' }}>
                {cvMessage}
              </div>
            )}
          </div>

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
