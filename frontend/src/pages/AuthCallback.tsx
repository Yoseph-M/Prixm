import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, getRedirectResult } from 'firebase/auth';
import './AuthCallback.css';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const auth = getAuth();
        const cred = await getRedirectResult(auth);
        if (cred?.user) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/auth', { replace: true });
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Sign-in failed. Please try again.');
        setTimeout(() => navigate('/auth', { replace: true }), 3000);
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="callback-page">
      {status === 'loading' && (
        <div className="callback-card">
          <div className="callback-spinner"></div>
          <p className="callback-msg">Completing sign-in&hellip;</p>
        </div>
      )}
      {status === 'error' && (
        <div className="callback-card">
          <div className="error-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="callback-msg">{errorMessage}</p>
          <p className="callback-sub">Redirecting back to sign-in&hellip;</p>
        </div>
      )}
    </div>
  );
};
