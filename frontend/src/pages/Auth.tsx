import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FlowFieldBackground } from '../components/FlowFieldBackground';
import './Auth.css';

export const Auth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authCtx = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup') {
      setMode('signup');
    } else {
      setMode('signin');
    }
  }, [searchParams]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setValidationError('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    if (!email || !password) {
      setValidationError('Please fill in all fields.');
      return;
    }
    if (mode === 'signup' && !termsAccepted) {
      setValidationError('You must accept the Terms of Service.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        await authCtx.signUp(email, password);
      } else {
        await authCtx.signIn(email, password);
      }
      const redirect = searchParams.get('redirect') || '/dashboard';
      navigate(redirect);
    } catch (err) {
      // Error is handled in authCtx
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await authCtx.signInWithGoogle();
      if (authCtx.user) {
        const redirect = searchParams.get('redirect') || '/dashboard';
        navigate(redirect);
      }
    } catch (err) {
      // Error is handled in authCtx
    }
  };

  const errorMessage = validationError || authCtx.error;

  return (
    <div className="auth-page-bg">
      <div className="auth-main-card">

        {/* Left Side */}
        <div className="auth-left-image">
          <div className="image-wrapper">
            <FlowFieldBackground
              className="absolute inset-0 block w-full h-full"
              color="#8b1a1a"
              bgColorRgb="10, 10, 10"
              trailOpacity={0.18}
              speed={0.4}
            />

            {/* Logo */}
            <div className="auth-left-logo-wrap">
              <img src="/logo.png" alt="Prixm Logo" className="prixm-logo-img" />
              <div className="eprep-logo-text">
                <h2>Prixm</h2>
                <p>Subscription Intelligence</p>
              </div>
            </div>

            {/* Bottom badge */}
            <div className="hero-badge">
              <div className="hero-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="hero-text">
                <h3>Stop overpaying for subscriptions.</h3>
                <p>Prixm tracks every recurring payment, predicts renewals, and surfaces waste — so you stay in control of your spend.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="auth-right-form">
          <div className="auth-form-wrapper">

            <h1 className="auth-heading">
              {mode === 'signup' ? 'Create an account' : 'Welcome back'}
            </h1>
            <p className="auth-subtext">
              {mode === 'signup'
                ? 'Start tracking every subscription in under two minutes.'
                : 'Sign in to access your subscription dashboard.'}
            </p>

            {errorMessage && (
              <div className="auth-error">
                {errorMessage}
              </div>
            )}

            <button type="button" className="google-top-btn" onClick={handleGoogleSignIn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <div className="auth-divider">
              <span>or continue with email</span>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              <div className="input-with-icon">
                <div className="input-icon-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="input-field"
                  placeholder="Email address"
                  autoComplete="email"
                />
              </div>

              <div className="input-with-icon">
                <div className="input-icon-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field input-field-password"
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-action-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {mode === 'signup' && (
                <div className="terms-checkbox-wrap">
                  <label className="terms-label" htmlFor="terms">
                    <input
                      type="checkbox"
                      id="terms"
                      name="terms"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="terms-checkbox"
                    />
                    <span>I agree to the <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>.</span>
                  </label>
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading && <span className="btn-spinner-small"></span>}
                {mode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="toggle-wrap">
              {mode === 'signin' ? (
                <>Don't have an account? <a onClick={toggleMode}>Sign up free</a></>
              ) : (
                <>Already have an account? <a onClick={toggleMode}>Sign in</a></>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
