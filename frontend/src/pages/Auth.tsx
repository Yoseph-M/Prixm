import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { useAuth, auth } from '../context/AuthContext';
import { FlowFieldBackground } from '../components/FlowFieldBackground';

export const Auth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authCtx = useAuth();

  // Mode: signin, signup, or verify-pending
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
        if (rememberMe) {
          localStorage.setItem('prixm_remember_me', 'true');
        } else {
          localStorage.removeItem('prixm_remember_me');
        }

        const redirect = searchParams.get('redirect') || '/dashboard';
        navigate(redirect);
      }
    } catch (err) {
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
    await auth.currentUser.reload();
    const redirect = searchParams.get('redirect') || '/dashboard';
    navigate(redirect);
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  return (
    <div className="min-h-screen w-screen bg-[#0a0a0a] flex font-sans m-0 p-0 overflow-x-hidden">
      <div className="flex w-full h-screen bg-[#0a0a0a]">

        {/* Left Panel: Aesthetic Backdrop & Core Brand Pitch */}
        <div className="flex-[1.2] hidden md:flex md:max-w-[55%] relative">
          <div className="relative w-full h-full overflow-hidden flex items-end justify-start bg-[#0a0a0a]">
            <FlowFieldBackground
              className="absolute inset-0 block w-full h-full"
              color="#8b1a1a"
              bgColorRgb="10, 10, 10"
              trailOpacity={0.18}
              speed={0.4}
            />

            {/* Custom linear gradients replacing ::after and ::before */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#8b1a1a]/12 via-transparent to-black/40 pointer-events-none z-[2]"></div>
            <div className="absolute top-0 right-0 w-[120px] h-full bg-gradient-to-r from-transparent to-[#0d0d0d] pointer-events-none z-[3]"></div>

            {/* Branding Container */}
            <div className="absolute top-10 left-10 flex items-center gap-3 z-[15] bg-white/4 backdrop-blur-md px-[18px] py-[10px] rounded-xl border border-white/8 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
              <img src="/logo.png" alt="Prixm Logo" className="w-8 h-8 object-contain invert-[1] brightness-[1.2]" />
              <div className="text-left">
                <h2 className="m-0 text-base font-bold text-white tracking-wider leading-none">Prixm</h2>
                <p className="mt-1 text-[9px] font-semibold text-white/40 tracking-[0.18em] uppercase leading-none">Subscription Intelligence</p>
              </div>
            </div>

            {/* Bottom branding card */}
            <div className="absolute bottom-0 left-0 w-full z-10 bg-[#0a0a0a]/70 backdrop-blur-xl border-t border-white/7 px-10 py-10 flex items-start gap-5 shadow-[-20px_0_60px_rgba(0,0,0,0.5)]">
              <div className="w-11 h-11 bg-gradient-to-br from-[#8b1a1a] to-[#c13333] text-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-[0_8px_24px_rgba(139,26,26,0.4)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="m-0 mb-1.5 text-lg font-semibold text-white tracking-tight leading-snug">Stop overpaying for subscriptions.</h3>
                <p className="m-0 text-sm text-white/50 leading-relaxed font-normal max-w-[380px]">Prixm tracks every recurring payment, predicts renewals, and surfaces waste — so you stay in control of your spend.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Clean Form Container */}
        <div className="flex-1 px-6 py-10 md:px-14 md:py-12 flex flex-col justify-center bg-[#0d0d0d] text-white w-full md:max-w-[45%] border-l border-white/6 overflow-y-auto">
          <div className="max-w-[400px] w-full mx-auto text-left">

            {/* Mobile Logo Branding */}
            <div className="flex md:hidden items-center gap-2.5 mb-8">
              <img src="/logo.png" alt="Prixm Logo" className="w-7 h-7 object-contain invert-[1] brightness-[1.2]" />
              <div className="text-left">
                <h2 className="m-0 text-[15px] font-bold text-white tracking-wider leading-none">Prixm</h2>
                <p className="mt-1 text-[8px] font-semibold text-white/35 tracking-[0.18em] uppercase leading-none">Subscription Intelligence</p>
              </div>
            </div>

            {/* Global live region for accessibility announcements */}
            <div className="sr-only" aria-live="assertive">
              {authCtx.error && `Error: ${authCtx.error}`}
              {forgotSuccess && 'Password reset email sent successfully.'}
            </div>

            {mode === 'verify-pending' ? (
              /* EMAIL VERIFICATION PENDING STATE */
              <div className="text-center py-6 animate-[slide-in_0.4s_ease-out]">
                <div className="w-16 h-16 bg-[#8b1a1a]/10 border border-[#8b1a1a]/20 rounded-full flex items-center justify-center mx-auto mb-5 text-[#e87070] animate-pulse">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2.5 tracking-tight">Verify your email</h2>
                <p className="text-sm text-white/45 mb-6 leading-relaxed">
                  We have sent a verification link to <span className="text-[#e87070] font-medium">{email}</span>. 
                  Please check your inbox and verify your email.
                </p>

                {resendSuccess && (
                  <div className="bg-emerald-500/8 text-emerald-400 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm mb-5 text-left leading-normal flex items-center gap-2.5" role="alert">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-emerald-400">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    A new verification link has been sent to your email.
                  </div>
                )}

                <div className="flex flex-col gap-2.5">
                  <button 
                    type="button" 
                    className="w-full h-11 bg-[#8b1a1a] border-none rounded-xl text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 transition duration-200 hover:bg-[#a52222] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070]"
                    onClick={handleVerificationContinue}
                  >
                    Continue to Dashboard
                  </button>
                  <button 
                    type="button" 
                    className="w-full h-11 bg-white/4 border border-white/10 rounded-xl text-white/70 text-sm font-medium cursor-pointer flex items-center justify-center gap-2 transition duration-200 hover:bg-white/7 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070]"
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
                <h1 className="text-3xl font-semibold m-0 mb-2.5 tracking-tight text-white leading-tight">
                  {mode === 'signup' ? 'Create an account' : 'Welcome back'}
                </h1>
                <p className="text-sm text-white/45 m-0 mb-7 leading-relaxed">
                  {mode === 'signup'
                    ? 'Start tracking every subscription in under two minutes.'
                    : 'Sign in to access your subscription dashboard.'}
                </p>

                {authCtx.error && (
                  <div className="bg-red-500/8 text-red-400 border border-red-500/20 rounded-xl px-4 py-3 text-sm mb-5 text-left leading-normal flex items-center gap-2.5" role="alert">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-red-400">
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
                  className="w-full flex items-center justify-center gap-2.5 h-12 bg-white/4 border border-white/10 rounded-xl text-white/80 text-sm font-medium cursor-pointer transition duration-200 hover:bg-white/7 hover:border-white/15 hover:text-white hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070]" 
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

                <div className="flex items-center text-center text-white/20 text-[11px] font-semibold tracking-widest uppercase my-6 before:flex-1 before:border-b before:border-white/7 before:mr-3.5 after:flex-1 after:border-b after:border-white/7 after:ml-3.5">
                  <span>or continue with email</span>
                </div>

                <form onSubmit={handleAuth} className="flex flex-col gap-0" noValidate>
                  
                  {/* Name field (Sign Up Only) */}
                  {mode === 'signup' && (
                    <div className="mb-3.5 relative">
                      <label htmlFor="displayName" className={`block text-[12px] font-medium mb-1.5 tracking-wider transition-colors ${touched.displayName && errors.displayName ? 'text-red-400' : 'text-white/50'}`}>Full Name</label>
                      <div className="relative flex items-center">
                        <div className={`absolute left-3.5 flex items-center justify-center pointer-events-none transition-colors z-[2] ${touched.displayName && errors.displayName ? 'text-red-400' : 'text-white/25'}`}>
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
                          className={`w-full bg-white/4 border rounded-xl py-3 pl-11 pr-3.5 text-white text-sm outline-none transition duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus:bg-white/6 focus:ring-3 ${touched.displayName && errors.displayName ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10' : 'border-white/8 focus:border-white/18 focus:ring-[#8b1a1a]/20'}`}
                          placeholder="e.g. Jane Doe"
                          aria-invalid={touched.displayName && errors.displayName ? 'true' : 'false'}
                          aria-describedby={touched.displayName && errors.displayName ? 'displayName-error' : undefined}
                        />
                      </div>
                      {touched.displayName && errors.displayName && (
                        <div className="flex items-center gap-1.5 text-[12px] text-red-400 mt-1.5 leading-tight" id="displayName-error">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  <div className="mb-3.5 relative">
                    <label htmlFor="email" className={`block text-[12px] font-medium mb-1.5 tracking-wider transition-colors ${touched.email && errors.email ? 'text-red-400' : 'text-white/50'}`}>Email Address</label>
                    <div className="relative flex items-center">
                      <div className={`absolute left-3.5 flex items-center justify-center pointer-events-none transition-colors z-[2] ${touched.email && errors.email ? 'text-red-400' : 'text-white/25'}`}>
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
                        className={`w-full bg-white/4 border rounded-xl py-3 pl-11 pr-3.5 text-white text-sm outline-none transition duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus:bg-white/6 focus:ring-3 ${touched.email && errors.email ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10' : 'border-white/8 focus:border-white/18 focus:ring-[#8b1a1a]/20'}`}
                        placeholder="you@example.com"
                        autoComplete="email"
                        aria-invalid={touched.email && errors.email ? 'true' : 'false'}
                        aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                      />
                    </div>
                    {touched.email && errors.email && (
                      <div className="flex items-center gap-1.5 text-[12px] text-red-400 mt-1.5 leading-tight" id="email-error">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{errors.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Password field */}
                  <div className="mb-3.5 relative">
                    <div className="flex justify-between items-center">
                      <label htmlFor="password" className={`block text-[12px] font-medium mb-1.5 tracking-wider transition-colors ${touched.password && errors.password ? 'text-red-400' : 'text-white/50'}`}>Password</label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          className="text-[13px] text-[#e87070] font-medium cursor-pointer hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070] rounded-[2px]"
                          onClick={() => {
                            setShowForgotModal(true);
                            setForgotEmail(email);
                          }}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <div className={`absolute left-3.5 flex items-center justify-center pointer-events-none transition-colors z-[2] ${touched.password && errors.password ? 'text-red-400' : 'text-white/25'}`}>
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
                        className={`w-full bg-white/4 border rounded-xl py-3 pl-11 pr-11 text-white text-sm outline-none transition duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus:bg-white/6 focus:ring-3 ${touched.password && errors.password ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10' : 'border-white/8 focus:border-white/18 focus:ring-[#8b1a1a]/20'}`}
                        placeholder="••••••••"
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        aria-invalid={touched.password && errors.password ? 'true' : 'false'}
                        aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
                      />
                      <button
                        type="button"
                        className="absolute right-3.5 bg-transparent border-none text-white/25 cursor-pointer p-1 flex items-center justify-center transition-colors rounded hover:text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070] z-[2]"
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
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        <span className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${pwDetails.met.length ? 'text-emerald-400' : 'text-white/30'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${pwDetails.met.length ? 'bg-emerald-400 scale-[1.2]' : 'bg-white/15'}`}></span>8+ chars
                        </span>
                        <span className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${pwDetails.met.upper ? 'text-emerald-400' : 'text-white/30'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${pwDetails.met.upper ? 'bg-emerald-400 scale-[1.2]' : 'bg-white/15'}`}></span>Uppercase
                        </span>
                        <span className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${pwDetails.met.number ? 'text-emerald-400' : 'text-white/30'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${pwDetails.met.number ? 'bg-emerald-400 scale-[1.2]' : 'bg-white/15'}`}></span>Number
                        </span>
                        <span className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${pwDetails.met.special ? 'text-emerald-400' : 'text-white/30'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${pwDetails.met.special ? 'bg-emerald-400 scale-[1.2]' : 'bg-white/15'}`}></span>Special char
                        </span>
                      </div>
                    )}

                    {/* Password Strength Indicator Bar */}
                    {mode === 'signup' && password.length > 0 && (
                      <div className="mt-2 animate-[slide-in_0.3s_ease-out]">
                        <div className="w-full h-1 rounded-sm bg-white/6 overflow-hidden">
                          <div 
                            className="h-full rounded-sm transition-[width,background] duration-300 ease-out" 
                            style={{
                              width: `${pwDetails.score * 25}%`,
                              backgroundColor: pwDetails.score === 1 ? '#ef4444' : pwDetails.score === 2 ? '#f59e0b' : pwDetails.score === 3 ? '#3b82f6' : '#10b981'
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center text-[11px] mt-1 text-white/35">
                          <span>Password Strength:</span>
                          <span className={`font-semibold tracking-wide ${pwDetails.score === 1 ? 'text-red-400' : pwDetails.score === 2 ? 'text-amber-400' : pwDetails.score === 3 ? 'text-blue-400' : 'text-emerald-400'}`}>
                            {pwDetails.label}
                          </span>
                        </div>
                      </div>
                    )}

                    {touched.password && errors.password && (
                      <div className="flex items-center gap-1.5 text-[12px] text-red-400 mt-1.5 leading-tight" id="password-error">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <div className="mb-3.5 relative">
                      <label htmlFor="confirmPassword" className={`block text-[12px] font-medium mb-1.5 tracking-wider transition-colors ${touched.confirmPassword && errors.confirmPassword ? 'text-red-400' : 'text-white/50'}`}>Confirm Password</label>
                      <div className="relative flex items-center">
                        <div className={`absolute left-3.5 flex items-center justify-center pointer-events-none transition-colors z-[2] ${touched.confirmPassword && errors.confirmPassword ? 'text-red-400' : 'text-white/25'}`}>
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
                          className={`w-full bg-white/4 border rounded-xl py-3 pl-11 pr-11 text-white text-sm outline-none transition duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus:bg-white/6 focus:ring-3 ${touched.confirmPassword && errors.confirmPassword ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10' : 'border-white/8 focus:border-white/18 focus:ring-[#8b1a1a]/20'}`}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          aria-invalid={touched.confirmPassword && errors.confirmPassword ? 'true' : 'false'}
                          aria-describedby={touched.confirmPassword && errors.confirmPassword ? 'confirmPassword-error' : undefined}
                        />
                      </div>
                      {touched.confirmPassword && errors.confirmPassword && (
                        <div className="flex items-center gap-1.5 text-[12px] text-red-400 mt-1.5 leading-tight" id="confirmPassword-error">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <div className="flex items-center justify-between mb-4.5 mt-0.5">
                      <label className="flex items-center gap-2 text-[13px] text-white/45 cursor-pointer select-none transition-colors hover:text-white/65" htmlFor="rememberMe">
                        <input
                          type="checkbox"
                          id="rememberMe"
                          name="rememberMe"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 cursor-pointer accent-[#8b1a1a] rounded"
                        />
                        <span>Remember me</span>
                      </label>
                    </div>
                  )}

                  {/* Terms & Privacy checkbox (Sign Up Only) */}
                  {mode === 'signup' && (
                    <div className={`mb-3.5 relative ${touched.terms && errors.terms ? 'text-red-400' : ''}`}>
                      <div className="my-1 mb-3.5 flex items-start">
                        <label className="flex items-start gap-2.5 cursor-pointer text-[13px] text-white/40 leading-normal select-none" htmlFor="terms">
                          <input
                            type="checkbox"
                            id="terms"
                            name="terms"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            onBlur={() => handleBlur('terms')}
                            className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 cursor-pointer accent-[#8b1a1a]"
                          />
                          <span>
                            I agree to the <strong className="text-white/65 hover:text-[#e87070] transition-colors">Terms of Service</strong> and <strong className="text-white/65 hover:text-[#e87070] transition-colors">Privacy Policy</strong>.
                          </span>
                        </label>
                      </div>
                      {touched.terms && errors.terms && (
                        <div className="flex items-center gap-1.5 text-[12px] text-red-400 mt-1.5 leading-tight" id="terms-error">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    className="w-full h-12 bg-[#8b1a1a] border-none rounded-xl text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 transition duration-250 cubic-bezier-[0.16,1,0.3,1] shadow-[0_4px_16px_rgba(139,26,26,0.35)] relative overflow-hidden hover:bg-[#a52222] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(139,26,26,0.45)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070] disabled:opacity-50 disabled:cursor-not-allowed" 
                    disabled={loading || (mode === 'signup' && Object.keys(errors).length > 0)}
                  >
                    {loading && <span className="inline-block w-4 h-4 border-2 border-white/25 rounded-full border-t-white animate-spin mr-2"></span>}
                    {mode === 'signup' ? 'Create Account' : 'Sign In'}
                  </button>
                </form>

                <div className="mt-5 text-[13px] text-white/35 text-center">
                  {mode === 'signin' ? (
                    <>Don't have an account? <a onClick={toggleMode} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggleMode()} className="text-[#e87070] font-semibold cursor-pointer hover:text-white ml-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070] rounded-[2px]">Sign up free</a></>
                  ) : (
                    <>Already have an account? <a onClick={toggleMode} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggleMode()} className="text-[#e87070] font-semibold cursor-pointer hover:text-white ml-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070] rounded-[2px]">Sign in</a></>
                  )}
                </div>
              </>
            )}

          </div>
        </div>

      </div>

      {/* PASSWORD RESET MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowForgotModal(false)}>
          <div className="bg-[#141414] border border-white/8 rounded-2xl p-8 md:p-9 max-w-[420px] w-[90%] text-left shadow-[0_24px_64px_rgba(0,0,0,0.6)] relative" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button 
              type="button" 
              className="absolute top-4 right-4 bg-white/5 border border-white/8 rounded-lg text-white/40 cursor-pointer w-8 h-8 flex items-center justify-center transition-all hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070]" 
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
                <h2 id="modal-title" className="text-xl font-semibold text-white mb-2 tracking-tight">Reset password</h2>
                <p className="text-sm text-white/45 mb-6 leading-relaxed">Enter the email address associated with your account, and we'll email you a link to reset your password.</p>

                {forgotError && (
                  <div className="bg-red-500/8 text-red-400 border border-red-500/20 rounded-xl px-4 py-3 text-sm mb-5 text-left leading-normal flex items-center gap-2.5" role="alert">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-red-400">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className="mb-4.5 relative">
                  <label htmlFor="forgotEmail" className="block text-[12px] font-medium text-white/50 mb-1.5 tracking-wider transition-colors">Email Address</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center justify-center pointer-events-none text-white/25 transition-colors z-[2]">
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
                      className="w-full bg-white/4 border border-white/8 rounded-xl py-3 pl-11 pr-3.5 text-white text-sm outline-none transition duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus:border-white/18 focus:bg-white/6"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="w-full h-11 bg-[#8b1a1a] border-none rounded-xl text-white text-[14px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition duration-200 hover:bg-[#a52222] hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(139,26,26,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e87070]" disabled={forgotLoading}>
                  {forgotLoading && <span className="inline-block w-4 h-4 border-2 border-white/25 rounded-full border-t-white animate-spin"></span>}
                  Send Reset Link
                </button>
              </form>
            ) : (
              <div className="text-center py-3">
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#34d399]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Check your email</h3>
                <p className="text-sm text-white/45 m-0 leading-relaxed">
                  We have sent password reset instructions to <span className="text-[#e87070] font-medium">{forgotEmail}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
