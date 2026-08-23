import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: any;
  created_at: string;
}

const fetchAuditLogs = async (): Promise<AuditLog[]> => {
  const res = await api.get('/admin/audit-logs');
  return res.data.logs;
};

const AuditLogs: React.FC = () => {
  const { data: logs = [], isLoading: loading, error } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: fetchAuditLogs,
  });

  const errorMessage = error instanceof Error ? error.message : (error as any)?.response?.data?.detail || 'Failed to fetch audit logs';

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-gradient" style={{ marginBottom: '0.5rem' }}>Audit Logs</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            View recent system actions and changes.
          </p>
        </div>
      </div>

      {error && (
        <div className="glass-card mb-8 animate-fade-in" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} /> Error Loading Logs
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{errorMessage}</p>
        </div>
      )}

      <div className="glass-card">
        <div className="table-responsive">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
                <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>User</th>
                <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Action</th>
                <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Target</th>
                <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-4 text-center"><div className="loader inline-block"></div></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-secondary">No audit logs found.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="p-3 text-sm" style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3 text-sm font-medium">{log.user_email}</td>
                    <td className="p-3 text-sm">
                      <span className={`badge ${log.action === 'DELETE' || log.action === 'ROLLBACK' ? 'badge-danger' : log.action === 'CREATE' || log.action === 'PUBLISH' ? 'badge-success' : 'badge-primary'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      {log.target_type}
                      {log.target_id && <div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{log.target_id.split('-')[0]}...</div>}
                    </td>
                    <td className="p-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {log.details ? JSON.stringify(log.details) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
