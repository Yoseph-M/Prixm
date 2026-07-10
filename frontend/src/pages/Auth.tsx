import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { useAuth, auth } from '../context/AuthContext';
import { FlowFieldBackground } from '../components/FlowFieldBackground';
import './Auth.css';

export const Auth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authCtx = useAuth();

  // Mode: signin, signup, or email-verification-pending
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify-pending'>('signin');
  
  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Loading/submitting state
  const [loading, setLoading] = useState(false);
  
  // Touched state for inline validation
  const [touched, setTouched] = useState({
    displayName: false,
    email: false,
    password: false,
    confirmPassword: false,
    terms: false
  });

  // Modal for Forgot Password
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Resend verification state
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Synchronize mode from URL parameters
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup') {
      setMode('signup');
    } else {
      setMode('signin');
    }
    // Clear validation and error states on navigation
    authCtx.setError(null);
  }, [searchParams]);

  // Handle switching modes via link
  const toggleMode = () => {
    const newMode = mode === 'signin' ? 'signup' : 'signin';
    setMode(newMode);
    authCtx.setError(null);
    setTouched({
      displayName: false,
      email: false,
      password: false,
      confirmPassword: false,
      terms: false
    });
    // Reset passwords
    setPassword('');
    setConfirmPassword('');
  };

  // Password requirements calculation
  const pwDetails = useMemo(() => {
    let score = 0;
    const met = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };

    if (met.length) score++;
    if (met.upper) score++;
    if (met.number) score++;
    if (met.special) score++;

    let label = 'Very Weak';
    if (score === 2) label = 'Fair';
    else if (score === 3) label = 'Good';
    else if (score === 4) label = 'Strong';

    return { score, met, label };
  }, [password]);

  // Input Field validation
  const errors = useMemo(() => {
    const validationErrors: Record<string, string> = {};

    if (mode === 'signup') {
      if (!displayName.trim()) {
        validationErrors.displayName = 'Name is required';
      }
    }

    if (!email) {
      validationErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      validationErrors.password = 'Password is required';
    } else if (mode === 'signup') {
      if (password.length < 8) {
        validationErrors.password = 'Password must be at least 8 characters';
      } else if (pwDetails.score < 3) {
        validationErrors.password = 'Password is too weak';
      }
    }

    if (mode === 'signup') {
      if (!confirmPassword) {
        validationErrors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        validationErrors.confirmPassword = 'Passwords do not match';
      }

      if (!termsAccepted) {
        validationErrors.terms = 'You must accept the Terms of Service';
      }
    }

    return validationErrors;
  }, [mode, displayName, email, password, confirmPassword, termsAccepted, pwDetails.score]);

  // Main authentication logic
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched to show validation errors
    setTouched({
      displayName: true,
      email: true,
      password: true,
      confirmPassword: true,
      terms: true
    });

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);
    authCtx.setError(null);

    try {
      if (mode === 'signup') {
        // Create user
        await authCtx.signUp(email, password, displayName);
        
        // Send email verification and enter pending verify mode
        if (auth.currentUser) {
          try {
            await sendEmailVerification(auth.currentUser);
            setMode('verify-pending');
          } catch (verifyErr) {
            console.error('Error sending verification email:', verifyErr);
            // Fallback: proceed to dashboard if verification fail to trigger
            const redirect = searchParams.get('redirect') || '/dashboard';
            navigate(redirect);
          }
        }
      } else {
        await authCtx.signIn(email, password);
        
        // If "Remember me" is not checked, we could adjust session persistence.
        // Firebase handles persistence automatically, but we can respect choice or store it.
        if (rememberMe) {
          localStorage.setItem('prixm_remember_me', 'true');
        } else {
          localStorage.removeItem('prixm_remember_me');
        }

        const redirect = searchParams.get('redirect') || '/dashboard';
        navigate(redirect);
      }
    } catch (err) {
      // Error is stored and handled in authCtx
      console.error('Auth action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth
  const handleGoogleSignIn = async () => {
    authCtx.setError(null);
    try {
      await authCtx.signInWithGoogle();
      if (auth.currentUser) {
        const redirect = searchParams.get('redirect') || '/dashboard';
        navigate(redirect);
      }
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    }
  };

  // Forgot password flow
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess(false);

    if (!forgotEmail) {
      setForgotError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setForgotError('No account found with this email address.');
      } else {
        setForgotError(err.message || 'Failed to send password reset email.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  // Resend Verification Email
  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await sendEmailVerification(auth.currentUser);
      setResendSuccess(true);
    } catch (err) {
      console.error('Resend verification failed:', err);
    } finally {
      setResendLoading(false);
    }
  };

  // Skip / Continue from verification pending screen
  const handleVerificationContinue = async () => {
    if (!auth.currentUser) return;
    
    // Force reload user state to check if email was verified
    await auth.currentUser.reload();
    
    // Proceed to dashboard anyway, letting the user verify in the app later if needed.
    const redirect = searchParams.get('redirect') || '/dashboard';
    navigate(redirect);
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  return (
    <div className="auth-page-bg">
      <div className="auth-main-card">

        {/* Left Panel: Aesthetic Backdrop & Core Brand Pitch */}
        <div className="auth-left-image">
          <div className="image-wrapper">
            <FlowFieldBackground
              className="absolute inset-0 block w-full h-full"
              color="#8b1a1a"
              bgColorRgb="10, 10, 10"
              trailOpacity={0.18}
              speed={0.4}
            />

            {/* Branding Container */}
            <div className="auth-left-logo-wrap">
              <img src="/logo.png" alt="Prixm Logo" className="prixm-logo-img" />
              <div className="eprep-logo-text">
                <h2>Prixm</h2>
                <p>Subscription Intelligence</p>
              </div>
            </div>

            {/* Bottom branding card */}
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

        {/* Right Panel: Clean Form Container */}
        <div className="auth-right-form">
          <div className="auth-form-wrapper">

            {/* Mobile Logo Branding */}
            <div className="auth-mobile-logo">
              <img src="/logo.png" alt="Prixm Logo" />
              <div className="auth-mobile-logo-text">
                <h2>Prixm</h2>
                <p>Subscription Intelligence</p>
              </div>
            </div>

            {/* Global live region for accessibility announcements */}
            <div className="sr-only" aria-live="assertive">
              {authCtx.error && `Error: ${authCtx.error}`}
              {forgotSuccess && 'Password reset email sent successfully.'}
            </div>

            {mode === 'verify-pending' ? (
              /* EMAIL VERIFICATION PENDING STATE */
              <div className="verification-pending">
                <div className="verification-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <h2>Verify your email</h2>
                <p>
                  We have sent a verification link to <span className="verification-email-text">{email}</span>. 
                  Please check your inbox and verify your email.
                </p>

                {resendSuccess && (
                  <div className="auth-success" role="alert">
                    <svg className="auth-error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    A new verification link has been sent to your email.
                  </div>
                )}

                <div className="verification-actions">
                  <button 
                    type="button" 
                    className="verification-continue-btn"
                    onClick={handleVerificationContinue}
                  >
                    Continue to Dashboard
                  </button>
                  <button 
                    type="button" 
                    className="verification-resend-btn"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                  >
                    {resendLoading ? 'Resending...' : 'Resend Email'}
                  </button>
                </div>
              </div>
            ) : (
              /* REGULAR SIGN IN / SIGN UP FLOW */
              <>
                <h1 className="auth-heading">
                  {mode === 'signup' ? 'Create an account' : 'Welcome back'}
                </h1>
                <p className="auth-subtext">
                  {mode === 'signup'
                    ? 'Start tracking every subscription in under two minutes.'
                    : 'Sign in to access your subscription dashboard.'}
                </p>

                {authCtx.error && (
                  <div className="auth-error" role="alert">
                    <svg className="auth-error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{authCtx.error}</span>
                  </div>
                )}

                {/* Social Login Button */}
                <button 
                  type="button" 
                  className="google-top-btn" 
                  onClick={handleGoogleSignIn}
                  aria-label="Continue with Google"
                >
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

                <form onSubmit={handleAuth} className="auth-form" noValidate>
                  
                  {/* Name field (Sign Up Only) */}
                  {mode === 'signup' && (
                    <div className={`field-group ${touched.displayName && errors.displayName ? 'has-error' : ''}`}>
                      <label htmlFor="displayName" className="field-label">Full Name</label>
                      <div className="input-with-icon">
                        <div className="input-icon-left">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <input
                          id="displayName"
                          name="displayName"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          onBlur={() => handleBlur('displayName')}
                          className="input-field"
                          placeholder="e.g. Jane Doe"
                          aria-invalid={touched.displayName && errors.displayName ? 'true' : 'false'}
                          aria-describedby={touched.displayName && errors.displayName ? 'displayName-error' : undefined}
                        />
                      </div>
                      {touched.displayName && errors.displayName && (
                        <div className="field-error" id="displayName-error">
                          <svg className="field-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>{errors.displayName}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Email field */}
                  <div className={`field-group ${touched.email && errors.email ? 'has-error' : ''}`}>
                    <label htmlFor="email" className="field-label">Email Address</label>
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
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => handleBlur('email')}
                        className="input-field"
                        placeholder="you@example.com"
                        autoComplete="email"
                        aria-invalid={touched.email && errors.email ? 'true' : 'false'}
                        aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                      />
                    </div>
                    {touched.email && errors.email && (
                      <div className="field-error" id="email-error">
                        <svg className="field-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{errors.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Password field */}
                  <div className={`field-group ${touched.password && errors.password ? 'has-error' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="password" className="field-label">Password</label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          className="forgot-password-link"
                          onClick={() => {
                            setShowForgotModal(true);
                            setForgotEmail(email);
                          }}
                        >
                          Forgot password?
                        </button>
                      )}
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
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => handleBlur('password')}
                        className="input-field input-field-password"
                        placeholder="••••••••"
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        aria-invalid={touched.password && errors.password ? 'true' : 'false'}
                        aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
                      />
                      <button
                        type="button"
                        className="input-action-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
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

                    {/* Upfront password requirements checklist (Sign Up Only) */}
                    {mode === 'signup' && password.length > 0 && (
                      <div className="password-requirements">
                        <span className={`pw-req ${pwDetails.met.length ? 'met' : ''}`}>
                          <span className="pw-req-dot"></span>8+ chars
                        </span>
                        <span className={`pw-req ${pwDetails.met.upper ? 'met' : ''}`}>
                          <span className="pw-req-dot"></span>Uppercase
                        </span>
                        <span className={`pw-req ${pwDetails.met.number ? 'met' : ''}`}>
                          <span className="pw-req-dot"></span>Number
                        </span>
                        <span className={`pw-req ${pwDetails.met.special ? 'met' : ''}`}>
                          <span className="pw-req-dot"></span>Special char
                        </span>
                      </div>
                    )}

                    {/* Password Strength Indicator Bar */}
                    {mode === 'signup' && password.length > 0 && (
                      <div className="password-strength">
                        <div className="password-strength-bar-track">
                          <div 
                            className="password-strength-bar-fill" 
                            data-strength={pwDetails.score}
                          ></div>
                        </div>
                        <div className="password-strength-text">
                          <span>Password Strength:</span>
                          <span className="password-strength-label" data-strength={pwDetails.score}>
                            {pwDetails.label}
                          </span>
                        </div>
                      </div>
                    )}

                    {touched.password && errors.password && (
                      <div className="field-error" id="password-error">
                        <svg className="field-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{errors.password}</span>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password field (Sign Up Only) */}
                  {mode === 'signup' && (
                    <div className={`field-group ${touched.confirmPassword && errors.confirmPassword ? 'has-error' : ''}`}>
                      <label htmlFor="confirmPassword" className="field-label">Confirm Password</label>
                      <div className="input-with-icon">
                        <div className="input-icon-left">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onBlur={() => handleBlur('confirmPassword')}
                          className="input-field input-field-password"
                          placeholder="••••••••"
                          autoComplete="new-password"
                          aria-invalid={touched.confirmPassword && errors.confirmPassword ? 'true' : 'false'}
                          aria-describedby={touched.confirmPassword && errors.confirmPassword ? 'confirmPassword-error' : undefined}
                        />
                      </div>
                      {touched.confirmPassword && errors.confirmPassword && (
                        <div className="field-error" id="confirmPassword-error">
                          <svg className="field-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>{errors.confirmPassword}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Remember Me Checkbox (Login Only) */}
                  {mode === 'signin' && (
                    <div className="auth-options-row">
                      <label className="remember-me-label" htmlFor="rememberMe">
                        <input
                          type="checkbox"
                          id="rememberMe"
                          name="rememberMe"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="remember-me-checkbox"
                        />
                        <span>Remember me</span>
                      </label>
                    </div>
                  )}

                  {/* Terms & Privacy checkbox (Sign Up Only) */}
                  {mode === 'signup' && (
                    <div className={`field-group ${touched.terms && errors.terms ? 'has-error' : ''}`}>
                      <div className="terms-checkbox-wrap">
                        <label className="terms-label" htmlFor="terms">
                          <input
                            type="checkbox"
                            id="terms"
                            name="terms"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            onBlur={() => handleBlur('terms')}
                            className="terms-checkbox"
                          />
                          <span>
                            I agree to the <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>.
                          </span>
                        </label>
                      </div>
                      {touched.terms && errors.terms && (
                        <div className="field-error" id="terms-error">
                          <svg className="field-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>{errors.terms}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="submit-btn" 
                    disabled={loading || (mode === 'signup' && Object.keys(errors).length > 0)}
                  >
                    {loading && <span className="btn-spinner-small"></span>}
                    {mode === 'signup' ? 'Create Account' : 'Sign In'}
                  </button>
                </form>

                <div className="toggle-wrap">
                  {mode === 'signin' ? (
                    <>Don't have an account? <a onClick={toggleMode} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggleMode()}>Sign up free</a></>
                  ) : (
                    <>Already have an account? <a onClick={toggleMode} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggleMode()}>Sign in</a></>
                  )}
                </div>
              </>
            )}

          </div>
        </div>

      </div>

      {/* PASSWORD RESET MODAL */}
      {showForgotModal && (
        <div className="forgot-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="forgot-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button 
              type="button" 
              className="forgot-modal-close" 
              onClick={() => setShowForgotModal(false)}
              aria-label="Close modal"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!forgotSuccess ? (
              <form onSubmit={handleForgotPasswordSubmit}>
                <h2 id="modal-title">Reset password</h2>
                <p>Enter the email address associated with your account, and we'll email you a link to reset your password.</p>

                {forgotError && (
                  <div className="auth-error" role="alert">
                    <svg className="auth-error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className="field-group">
                  <label htmlFor="forgotEmail" className="field-label">Email Address</label>
                  <div className="input-with-icon">
                    <div className="input-icon-left">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>
                    <input
                      id="forgotEmail"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="input-field"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="forgot-submit-btn" disabled={forgotLoading}>
                  {forgotLoading && <span className="btn-spinner-small"></span>}
                  Send Reset Link
                </button>
              </form>
            ) : (
              <div className="forgot-sent">
                <div className="forgot-sent-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3>Check your email</h3>
                <p>
                  We have sent password reset instructions to <span className="forgot-email-highlight">{forgotEmail}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
