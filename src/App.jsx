import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import BusinessDashboard from './pages/BusinessDashboard';
import ProposalDocumentDashboard from './pages/ProposalDocumentDashboard';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading</div>;

  const getRedirect = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'employee') return '/employee';
    if (user.role === 'business') return '/business';
    return '/login';
  };

  return (
    <div className="app">
      {user && <Navbar />}
      <main className="main-content">
        <Routes>
          <Route path="/login" element={user ? <Navigate to={getRedirect()} /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to={getRedirect()} /> : <Register />} />
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/employee" element={
            <ProtectedRoute roles={['employee']}><EmployeeDashboard /></ProtectedRoute>
          } />
          <Route path="/business" element={
            <ProtectedRoute roles={['business']}><BusinessDashboard /></ProtectedRoute>
          } />
          <Route path="/proposal-documents" element={
            <ProtectedRoute roles={['admin', 'business']}><ProposalDocumentDashboard /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to={getRedirect()} />} />
        </Routes>
      </main>
    </div>
  );
}
