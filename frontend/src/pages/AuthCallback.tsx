import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, getRedirectResult } from 'firebase/auth';

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
    <div className="min-h-screen w-screen bg-[#0a0a0a] flex items-center justify-center font-sans">
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-5 p-12 bg-white/[0.03] border border-white/[0.07] rounded-[20px] shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-md min-w-[300px] text-center">
          <div className="w-12 h-12 border-[3px] border-white/10 border-t-[#8b1a1a] rounded-full animate-spin"></div>
          <p className="m-0 text-base font-medium text-white/80 tracking-tight">Completing sign-in&hellip;</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-5 p-12 bg-white/[0.03] border border-white/[0.07] rounded-[20px] shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-md min-w-[300px] text-center">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-400">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="m-0 text-base font-medium text-white/80 tracking-tight">{errorMessage}</p>
          <p className="-mt-2 text-xs text-white/35">Redirecting back to sign-in&hellip;</p>
        </div>
      )}
    </div>
  );
};
