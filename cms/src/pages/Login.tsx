import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tv, KeyRound, Mail, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      localStorage.setItem('token', response.data.access_token);
      
      // We decode token to get role
      const payload = JSON.parse(atob(response.data.access_token.split('.')[1]));
      localStorage.setItem('userRole', payload.role);

      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100%' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '3rem', width: '100%', maxWidth: '420px' }}>
        
        <div className="flex items-center justify-center gap-4 mb-4">
          <div style={{ background: 'var(--primary-color)', padding: '12px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)' }}>
            <Tv size={32} color="white" />
          </div>
        </div>
        
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }} className="text-gradient">
          Peblo TV CMS
        </h2>

        {error && (
          <div className="flex items-center gap-2 mb-4 animate-fade-in" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#fca5a5' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <Mail size={16} /> Email
            </label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@peblo.tv"
              required
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <KeyRound size={16} /> Password
            </label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary mt-4" 
            style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={20} className="loader" /> : 'Sign In'}
          </button>
        </form>
        
        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <p>Admin: admin@peblo.tv / admin123</p>
          <p>Editor: editor@peblo.tv / editor123</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
