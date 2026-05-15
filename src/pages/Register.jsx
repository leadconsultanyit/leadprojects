import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const VERTICALS = ['ESG', 'Green Building Certification', 'MEFP Design'];

export default function Register() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [cvFile, setCvFile] = useState(null);
  const [cvParsed, setCvParsed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({
    designation: '',
    yearsOfExperience: '',
    vertical: [],
    contactNumber: '',
    credentials: [],
    qualifications: [],
    expertise: [],
    pastProjects: [],
    pastExperience: [],
    professionalSummary: ''
  });

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError('');

    if (role !== 'employee') {
      setLoading(true);
      try {
        const user = await register(name, email, password, role, null, null);
        if (user.role === 'business') navigate('/business');
        else navigate('/login');
      } catch (err) {
        setError(err.response?.data?.message || 'Registration failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Employee path: if CV is provided, parse it and pre-fill; otherwise go straight to manual entry
    if (cvFile) {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('cv', cvFile);
        const res = await axios.post('/api/auth/parse-cv-preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const p = res.data.profile;
        if (p) {
          setProfileForm({
            designation: p.designation || '',
            yearsOfExperience: p.yearsOfExperience || '',
            vertical: p.vertical || [],
            contactNumber: p.contactNumber || '',
            credentials: p.credentials || res.data.credentials || [],
            qualifications: p.qualifications || [],
            expertise: p.expertise || [],
            pastProjects: p.pastProjects || [],
            pastExperience: p.pastExperience || [],
            professionalSummary: p.professionalSummary || ''
          });
        }
        setCvParsed(true);
        setStep(2);
      } catch (err) {
        setError(err.response?.data?.message || 'CV parsing failed. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      setCvParsed(false);
      setStep(2);
    }
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(name, email, password, role, cvFile, profileForm);
      navigate('/employee');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const pf = profileForm;
  const setPf = setProfileForm;

  const addArrayItem = (field, template) => setPf(f => ({ ...f, [field]: [...f[field], template] }));
  const removeArrayItem = (field, idx) => setPf(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  const updateArrayItem = (field, idx, key, value) => {
    setPf(f => ({ ...f, [field]: f[field].map((item, i) => i === idx ? { ...item, [key]: value } : item) }));
  };

  if (step === 2) {
    return (
      <div className="auth-container" style={{ alignItems: 'flex-start', paddingTop: 32 }}>
        <div style={{ width: '100%', maxWidth: 700, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)', padding: '32px 36px', animation: 'fadeInUp 0.4s var(--ease) both'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                Review Your Profile
              </h1>
              <span className="badge badge-active" style={{ fontSize: '0.72rem' }}>Step 2 of 2</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>
              {cvParsed
                ? 'We extracted this from your CV. Review and edit before creating your account.'
                : 'Fill in your professional details to complete your profile.'}
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleStep2}>
              {/* Basic Info Row */}
              <div className="inline-fields">
                <div className="form-group">
                  <label>Designation</label>
                  <input type="text" value={pf.designation} onChange={e => setPf({ ...pf, designation: e.target.value })} placeholder="e.g. Senior Consultant" />
                </div>
                <div className="form-group">
                  <label>Years of Experience</label>
                  <input type="text" value={pf.yearsOfExperience} onChange={e => setPf({ ...pf, yearsOfExperience: e.target.value })} placeholder="e.g. 5" />
                </div>
              </div>

              <div className="inline-fields">
                <div className="form-group">
                  <label>Contact Number</label>
                  <input type="text" value={pf.contactNumber} onChange={e => setPf({ ...pf, contactNumber: e.target.value })} placeholder="+91 99999 99999" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={email} disabled style={{ opacity: 0.6 }} />
                </div>
              </div>

              {/* Vertical */}
              <div className="form-group">
                <label>Vertical</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {VERTICALS.map(v => (
                    <span key={v} className={`chip ${pf.vertical.includes(v) ? 'chip-active' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const next = pf.vertical.includes(v) ? pf.vertical.filter(x => x !== v) : [...pf.vertical, v];
                        setPf({ ...pf, vertical: next });
                      }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              {/* Professional Summary */}
              <div className="form-group">
                <label>Professional Summary</label>
                <textarea value={pf.professionalSummary} onChange={e => setPf({ ...pf, professionalSummary: e.target.value })}
                  rows={3} placeholder="Brief professional summary..." />
              </div>

              {/* Credentials */}
              <div className="form-group">
                <label>Credentials / Certifications</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {pf.credentials.map((c, i) => (
                    <span key={i} className="meta-tag tag-rating" style={{ cursor: 'pointer' }}
                      onClick={() => setPf({ ...pf, credentials: pf.credentials.filter((_, j) => j !== i) })}>
                      {c} &times;
                    </span>
                  ))}
                </div>
                <input type="text" placeholder="Type and press Enter to add"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      e.preventDefault();
                      setPf({ ...pf, credentials: [...pf.credentials, e.target.value.trim()] });
                      e.target.value = '';
                    }
                  }} />
              </div>

              {/* Expertise */}
              <div className="form-group">
                <label>Expertise</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {pf.expertise.map((ex, i) => (
                    <span key={i} className="meta-tag tag-service" style={{ cursor: 'pointer' }}
                      onClick={() => setPf({ ...pf, expertise: pf.expertise.filter((_, j) => j !== i) })}>
                      {ex} &times;
                    </span>
                  ))}
                </div>
                <input type="text" placeholder="Type and press Enter to add"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      e.preventDefault();
                      setPf({ ...pf, expertise: [...pf.expertise, e.target.value.trim()] });
                      e.target.value = '';
                    }
                  }} />
              </div>

              {/* Qualifications */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Qualifications</label>
                  <button type="button" className="btn btn-sm btn-outline"
                    onClick={() => addArrayItem('qualifications', { degree: '', field: '', institution: '', year: '' })}>+ Add</button>
                </div>
                {pf.qualifications.map((q, i) => (
                  <div key={i} className="fm-block" style={{ padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>#{i + 1}</span>
                      <button type="button" style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => removeArrayItem('qualifications', i)}>&times; Remove</button>
                    </div>
                    <div className="inline-fields">
                      <input type="text" value={q.degree} onChange={e => updateArrayItem('qualifications', i, 'degree', e.target.value)} placeholder="Degree" style={{ marginBottom: 6 }} />
                      <input type="text" value={q.field} onChange={e => updateArrayItem('qualifications', i, 'field', e.target.value)} placeholder="Field" style={{ marginBottom: 6 }} />
                    </div>
                    <div className="inline-fields">
                      <input type="text" value={q.institution} onChange={e => updateArrayItem('qualifications', i, 'institution', e.target.value)} placeholder="Institution" />
                      <input type="text" value={q.year} onChange={e => updateArrayItem('qualifications', i, 'year', e.target.value)} placeholder="Year" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Past Experience */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Past Experience</label>
                  <button type="button" className="btn btn-sm btn-outline"
                    onClick={() => addArrayItem('pastExperience', { company: '', position: '', duration: '' })}>+ Add</button>
                </div>
                {pf.pastExperience.map((exp, i) => (
                  <div key={i} className="fm-block" style={{ padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>#{i + 1}</span>
                      <button type="button" style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => removeArrayItem('pastExperience', i)}>&times; Remove</button>
                    </div>
                    <input type="text" value={exp.position} onChange={e => updateArrayItem('pastExperience', i, 'position', e.target.value)} placeholder="Position / Title" style={{ marginBottom: 6, width: '100%' }} />
                    <div className="inline-fields">
                      <input type="text" value={exp.company} onChange={e => updateArrayItem('pastExperience', i, 'company', e.target.value)} placeholder="Company" />
                      <input type="text" value={exp.duration} onChange={e => updateArrayItem('pastExperience', i, 'duration', e.target.value)} placeholder="Duration (e.g. 2020-2023)" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Past Projects */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Past Projects</label>
                  <button type="button" className="btn btn-sm btn-outline"
                    onClick={() => addArrayItem('pastProjects', { name: '', role: '', description: '' })}>+ Add</button>
                </div>
                {pf.pastProjects.map((proj, i) => (
                  <div key={i} className="fm-block" style={{ padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>#{i + 1}</span>
                      <button type="button" style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => removeArrayItem('pastProjects', i)}>&times; Remove</button>
                    </div>
                    <div className="inline-fields">
                      <input type="text" value={proj.name} onChange={e => updateArrayItem('pastProjects', i, 'name', e.target.value)} placeholder="Project Name" style={{ marginBottom: 6 }} />
                      <input type="text" value={proj.role} onChange={e => updateArrayItem('pastProjects', i, 'role', e.target.value)} placeholder="Your Role" style={{ marginBottom: 6 }} />
                    </div>
                    <input type="text" value={proj.description} onChange={e => updateArrayItem('pastProjects', i, 'description', e.target.value)} placeholder="Brief description" style={{ width: '100%' }} />
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1, padding: 12, justifyContent: 'center' }}
                  onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>

            <div className="auth-link" style={{ marginTop: 16 }}>
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ margin: '0 auto 20px', display: 'flex', justifyContent: 'center' }}>
          <img src="/logo.png" alt="LEAD Logo" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Join the Project Milestone Tracker</p>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-info">
          New employee accounts require admin verification before access is granted.
        </div>
        <form onSubmit={handleStep1}>
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your full name" required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters" required minLength={6} />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="employee">Employee</option>
              <option value="observer">Observer</option>
            </select>
          </div>
          {role === 'employee' && (
            <div className="form-group">
              <label>Upload CV (Optional)</label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                Optionally upload your CV to auto-fill your profile, or fill it manually in the next step.
              </p>
              <input type="file" accept=".pdf,.txt,.doc,.docx"
                onChange={e => setCvFile(e.target.files[0] || null)}
                style={{ fontSize: '0.85rem' }} />
              {cvFile && (
                <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--accent)' }}>
                  Selected: {cvFile.name}
                </div>
              )}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? (role === 'employee' ? (cvFile ? 'Parsing CV...' : 'Please wait...') : 'Creating Account...')
              : (role === 'employee' ? (cvFile ? 'Parse CV & Continue' : 'Continue to Profile') : 'Create Account')}
          </button>
        </form>
        <div className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
