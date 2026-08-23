import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

interface IssueItem {
  type: string;
  message: string;
  episode?: string;
}

interface ShowReport {
  show: string;
  issues: IssueItem[];
}

interface ValidationReportData {
  blocking_issues: ShowReport[];
  warnings: ShowReport[];
  summary: {
    total_shows: number;
    publishable_shows: number;
    total_blocking_issues: number;
    total_warnings: number;
  };
}

const fetchReportData = async (): Promise<ValidationReportData> => {
  const response = await api.get('/admin/validation-report');
  return response.data;
};

const ValidationReport: React.FC = () => {
  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: ['validationReport'],
    queryFn: fetchReportData,
  });

  const errorMessage = error instanceof Error ? error.message : (error as any)?.response?.data?.detail || 'Failed to load validation report.';

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-gradient" style={{ marginBottom: '0.5rem' }}>Validation Report</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Automated integrity auditor inspecting missing artwork, null sections, drafts, and casing discrepancies.
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary" disabled={isLoading}>
          <RefreshCw size={18} className={isLoading ? 'loader' : ''} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none', border: 'none' }} />
          Run Audit
        </button>
      </div>

      {error && (
        <div className="glass-card mb-8" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <p style={{ color: '#fca5a5', margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center p-12"><div className="loader" style={{ width: '40px', height: '40px' }} /></div>
      )}

      {!isLoading && report && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Shows</span>
              <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0' }}>{report.summary.total_shows}</h2>
            </div>
            
            <div className="glass-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <span style={{ fontSize: '0.85rem', color: '#6ee7b7' }}>Publishable Shows</span>
              <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#10b981' }}>{report.summary.publishable_shows}</h2>
            </div>

            <div className="glass-card" style={{ borderColor: report.summary.total_blocking_issues > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)' }}>
              <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>Blocking Errors</span>
              <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#ef4444' }}>{report.summary.total_blocking_issues}</h2>
            </div>

            <div className="glass-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <span style={{ fontSize: '0.85rem', color: '#fcd34d' }}>Data Warnings</span>
              <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#f59e0b' }}>{report.summary.total_warnings}</h2>
            </div>
          </div>

          {/* Blocking Issues Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <XCircle size={22} color="#ef4444" />
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Blocking Issues (Must Fix Before Publish)</h2>
            </div>

            {report.blocking_issues.length === 0 ? (
              <div className="glass-card flex items-center gap-3 p-4" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <CheckCircle2 size={24} color="#10b981" />
                <p style={{ margin: 0, color: '#6ee7b7' }}>No blocking issues found across any shows.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {report.blocking_issues.map((item: ShowReport, idx: number) => (
                  <div key={idx} className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.03)' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', color: '#f87171' }}>{item.show}</h3>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {item.issues.map((iss: IssueItem, iIdx: number) => (
                        <li key={iIdx} style={{ marginBottom: '0.4rem' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>[{iss.type}]</strong> {iss.message} {iss.episode && <em>({iss.episode})</em>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warnings Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={22} color="#f59e0b" />
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Warnings (Data Quality Suggestions)</h2>
            </div>

            {report.warnings.length === 0 ? (
              <div className="glass-card flex items-center gap-3 p-4">
                <CheckCircle2 size={24} color="#10b981" />
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No warnings detected.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {report.warnings.map((item: ShowReport, idx: number) => (
                  <div key={idx} className="glass-card" style={{ borderColor: 'rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.03)' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', color: '#fbbf24' }}>{item.show}</h3>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {item.issues.map((iss: IssueItem, iIdx: number) => (
                        <li key={iIdx} style={{ marginBottom: '0.4rem' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>[{iss.type}]</strong> {iss.message} {iss.episode && <em>({iss.episode})</em>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ValidationReport;
