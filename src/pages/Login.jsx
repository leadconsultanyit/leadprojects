import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'employee') navigate('/employee');
      else if (user.role === 'business') navigate('/business');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(5,150,105,0.12), rgba(124,58,237,0.08))',
          border: '1px solid rgba(5,150,105,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to Project Milestone Tracker</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password" required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="auth-link">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>
        <div style={{
          marginTop: 24, padding: '14px 16px',
          borderRadius: 12, background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          fontSize: '0.78rem', color: 'var(--text-secondary)',
          lineHeight: 1.7
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            color: 'var(--text-secondary)', fontSize: '0.72rem',
            textTransform: 'uppercase', letterSpacing: '0.06em'
          }}>Demo Logins</span>
          <div style={{ marginTop: 6 }}>
            <span style={{ color: '#E11D48' }}>Admin</span> admin@greencore.com / admin123
          </div>
          <div>
            <span style={{ color: '#7C3AED' }}>Business</span> business@greencore.com / business123
          </div>
          <div>
            <span style={{ color: '#059669' }}>Employee</span> rahul@greencore.com / password123
          </div>
        </div>
      </div>
    </div>
  );
}
