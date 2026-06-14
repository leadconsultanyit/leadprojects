import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const dropdownRef = useRef(null);

  const isBusiness = user?.role === 'business';
  const canSeeProposals = user?.role === 'admin' || user?.role === 'business';

  useEffect(() => {
    if (!isBusiness) return;
    const fetchNotifs = () => {
      axios.get('/api/notifications').then(res => {
        setNotifications(res.data);
        const unread = res.data.filter(n => !n.readBy?.includes(user.id || user._id)).length;
        setUnreadCount(unread);
      }).catch(() => {});
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [isBusiness, user]);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    await axios.put(`/api/notifications/${id}/read`);
    setNotifications(prev => prev.map(n =>
      n._id === id ? { ...n, readBy: [...(n.readBy || []), user.id || user._id] } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await axios.put('/api/notifications/read-all');
    setNotifications(prev => prev.map(n => ({
      ...n, readBy: [...(n.readBy || []), user.id || user._id]
    })));
    setUnreadCount(0);
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const roleColor = user?.role === 'admin' ? '#E11D48'
    : user?.role === 'business' ? '#7C3AED'
    : '#059669';

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src="/logo.png" alt="LEAD Logo" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
      </div>
      {canSeeProposals && (
        <div className="navbar-center" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => navigate('/proposal-documents')}
            style={{
              padding: '5px 14px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.83rem',
              fontWeight: location.pathname === '/proposal-documents' ? 700 : 500,
              background: location.pathname === '/proposal-documents' ? 'var(--info)' : 'transparent',
              color: location.pathname === '/proposal-documents' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Proposals
          </button>
        </div>
      )}
      <div className="navbar-right">
        {isBusiness && (
          <div className="notification-bell" ref={dropdownRef}>
            <div onClick={() => setShowNotif(!showNotif)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </div>
            {showNotif && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <button className="btn btn-sm btn-outline" onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="notification-empty">No notifications yet</div>
                ) : (
                  notifications.map(n => {
                    const isUnread = !n.readBy?.includes(user.id || user._id);
                    return (
                      <div
                        key={n._id}
                        className={`notification-item ${isUnread ? 'unread' : ''}`}
                        onClick={() => isUnread && markRead(n._id)}
                      >
                        <div className="notif-msg">{n.message}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="notif-amount">{n.amount?.toLocaleString('en-IN')}</span>
                          <span className="notif-time">{formatTime(n.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: `linear-gradient(135deg, ${roleColor}30, ${roleColor}10)`,
            border: `1.5px solid ${roleColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.72rem', fontWeight: 800, color: roleColor,
            fontFamily: 'var(--font-display)'
          }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <span className="navbar-user">{user?.name}</span>
            <span className="navbar-role" style={{
              marginLeft: 8,
              background: `${roleColor}12`,
              color: roleColor,
              borderColor: `${roleColor}30`
            }}>{user?.role}</span>
          </div>
        </div>
        <button className="btn-logout" onClick={logout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: -2 }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </nav>
  );
}
