import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import type { Toast } from '../hooks/useToast';

export const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div style={{
      position: 'fixed', bottom: '2rem', right: '2rem',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
      zIndex: 9999, pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem',
          background: t.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${t.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: '12px',
          color: 'var(--text-primary)',
          fontSize: '0.9rem',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          animation: 'slideInRight 0.25s ease',
          pointerEvents: 'auto',
          maxWidth: '380px',
          minWidth: '260px',
        }}>
          {t.type === 'success'
            ? <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
            : <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1 }}>{t.text}</span>
          <button onClick={() => onDismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
};
