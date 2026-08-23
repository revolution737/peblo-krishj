import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

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
    console.error('Viewer uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'white', backgroundColor: '#141414', textAlign: 'center' }}>
          <h2>Oops! Something went wrong loading Peblo TV.</h2>
          <p style={{ color: '#aaa', margin: '1rem 0 2rem 0' }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '0.8rem 2rem', background: '#e50914', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </ErrorBoundary>
  );
};

export default App;
