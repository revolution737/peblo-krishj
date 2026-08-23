import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, CheckCircle2, Database, AlertCircle, RefreshCw } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ValidationReport from './pages/ValidationReport';
import AuditLogs from './pages/AuditLogs';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-primary)' }}>
          <div className="glass-panel" style={{ padding: '2.5rem', maxWidth: '500px', textAlign: 'center' }}>
            <AlertCircle size={48} color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
            <h2>Something went wrong</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {this.state.error?.message || 'An unexpected render error occurred.'}
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              <RefreshCw size={16} /> Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = localStorage.getItem('userRole') || 'User';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  return (
    <div className="flex" style={{ minHeight: '100vh', width: '100%' }}>
      {/* Sidebar */}
      <aside className="glass-panel" style={{ width: '260px', margin: '1rem 0.5rem 1rem 1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center gap-3 mb-8" style={{ padding: '0.25rem' }}>
          <div style={{ background: 'var(--primary-color)', padding: '8px', borderRadius: '10px' }}>
            <Database size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }} className="text-gradient">Peblo CMS</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Content Management</span>
          </div>
        </div>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link 
            to="/" 
            className={`btn ${location.pathname === '/' ? 'btn-primary' : 'btn-secondary'} flex items-center justify-start gap-3`} 
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <LayoutDashboard size={18} /> Catalog
          </Link>
          <Link 
            to="/validation" 
            className={`btn ${location.pathname === '/validation' ? 'btn-primary' : 'btn-secondary'} flex items-center justify-start gap-3`} 
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <CheckCircle2 size={18} /> Validation Report
          </Link>
          <Link 
            to="/audit-logs" 
            className={`btn ${location.pathname === '/audit-logs' ? 'btn-primary' : 'btn-secondary'} flex items-center justify-start gap-3`} 
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <AlertCircle size={18} /> Audit Logs
          </Link>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div className="mb-3 flex items-center justify-between" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>Role:</span>
            <span className="badge badge-primary">{role}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-danger flex items-center gap-2" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '1rem 1rem 1rem 0.5rem', overflow: 'hidden' }}>
        <div className="glass-panel" style={{ height: 'calc(100vh - 2rem)', padding: '2rem', overflowY: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/validation" element={<ProtectedRoute><AppLayout><ValidationReport /></AppLayout></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AppLayout><AuditLogs /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
};

export default App;
