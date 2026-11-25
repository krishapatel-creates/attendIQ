import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { isFirebaseConfigured } from '../config/firebase';
import { useAcademic } from '../context/AcademicContext';

interface AuthPageProps {
  mode: 'login' | 'register';
}

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Incorrect email or password. Please verify your credentials.';
  }
  if (code === 'auth/user-not-found') {
    return 'No account found with this email. Create a new account or continue with Google.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account already exists with this email. Sign in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not enabled in Firebase Console yet. Enable it under Authentication -> Sign-in method, or use Google Sign-In / Guest Student.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completing.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Authentication could not be completed. Please try again.';
}

export function AuthPage({ mode }: AuthPageProps) {
  const {
    student,
    isAuthenticated,
    isAuthLoading,
    login,
    register,
    loginWithGoogle,
    loginAsGuest,
  } = useAcademic();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [program, setProgram] = useState('B.Tech Computer Science');
  const [semester, setSemester] = useState('Semester V · Fall 2026');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!isAuthLoading && isAuthenticated) {
    return (
      <Navigate
        to={student.onboardingCompleted === false ? '/onboarding' : '/dashboard'}
        replace
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid university or personal email address.');
      return;
    }

    if (password.trim().length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register(name, email, password, program, semester);
        navigate('/onboarding');
      } else {
        await login(email, password);
        navigate('/dashboard');
      }
    } catch (error) {
      setErrorMessage(mapFirebaseAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(mapFirebaseAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestAccess = () => {
    loginAsGuest();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#EDEAE6] flex flex-col lg:flex-row">
      {/* Left Editorial Photography & Philosophy Panel */}
      <div className="relative lg:w-1/2 min-h-[240px] sm:min-h-[280px] lg:min-h-screen bg-[#0F223A] overflow-hidden flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        {!imageError ? (
          <img
            src="/src/assets/images/auth_editorial_study_1795437023110.jpg"
            alt="Quiet minimalist university reading room with travertine tables and natural window light"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-[#0F223A] via-[#1B3354] to-[#2F466F] flex items-center justify-center"
          >
            <BookOpen className="w-20 h-20 text-white/15" />
          </div>
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0F223A] via-[#0F223A]/65 to-[#0F223A]/45"
        />

        <div className="relative z-10">
          <BrandLogo variant="light" showTagline />
        </div>

        <div className="relative z-10 max-w-md mt-10 lg:mt-0">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-[40px] font-semibold tracking-tight text-white leading-[1.15] text-balance">
            Track Smart. Stay Ahead.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#E6E8EB] leading-relaxed">
            Precision attendance intelligence, recovery forecasting, and structured semester planning built for calm academic clarity.
          </p>
          <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#D3D1CE]">
            <span>75% Benchmark Tracking</span>
            <span aria-hidden="true">·</span>
            <span>Cloud Sync & Offline Mode</span>
            <span aria-hidden="true">·</span>
            <span>Exam Readiness</span>
          </div>
        </div>
      </div>

      {/* Right Auth Form Panel */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-10 lg:p-14 bg-[#EDEAE6]">
        <div className="w-full max-w-[440px] bg-white border border-[#D3D1CE] rounded-xl p-6 sm:p-8">
          <div className="pb-5 border-b border-[#EDEAE6]">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[#0A0A0A]">
              {mode === 'login' ? 'Student Sign In' : 'Create Student Account'}
            </h2>
            <p className="mt-1 text-sm text-[#262E36]">
              {mode === 'login'
                ? 'Access your synced semester attendance ledger and recovery insights.'
                : 'Configure your academic profile and target threshold.'}
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            {isFirebaseConfigured && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignIn}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-[#D3D1CE] bg-white text-[#0A0A0A] text-sm font-medium hover:border-[#0F223A] hover:bg-[#EDEAE6]/40 disabled:opacity-50 transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleGuestAccess}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-[#2F466F] bg-[#EDEAE6]/45 text-[#0F223A] text-sm font-semibold hover:bg-[#EDEAE6] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue as Guest Student</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <p className="text-center text-xs text-[#262E36]">
              Instant offline/demo access with UIT Sem 1 ECE (Section A) data
            </p>
          </div>

          <div className="relative my-6 flex items-center">
            <div className="flex-1 border-t border-[#D3D1CE]" />
            <span className="px-3 text-xs text-[#536878]">or continue with email</span>
            <div className="flex-1 border-t border-[#D3D1CE]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Patel"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F] focus:ring-1 focus:ring-[#2F466F]"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                University Email
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F] focus:ring-1 focus:ring-[#2F466F]"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F] focus:ring-1 focus:ring-[#2F466F]"
              />
            </div>

            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="auth-program" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Degree Program
                  </label>
                  <input
                    id="auth-program"
                    type="text"
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F] focus:ring-1 focus:ring-[#2F466F]"
                  />
                </div>
                <div>
                  <label htmlFor="auth-semester" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Current Term
                  </label>
                  <input
                    id="auth-semester"
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F] focus:ring-1 focus:ring-[#2F466F]"
                  />
                </div>
              </div>
            )}

            {errorMessage && (
              <p role="alert" className="text-xs font-medium text-[#8B2626] leading-relaxed">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#0F223A] text-white text-sm font-medium hover:bg-[#2F466F] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting
                ? 'Authenticating...'
                : mode === 'login'
                  ? 'Sign In to AttendIQ'
                  : 'Create Student Account'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#EDEAE6] text-center text-sm text-[#262E36]">
            {mode === 'login' ? (
              <span>
                New to AttendIQ?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-[#0F223A] hover:text-[#2F466F] underline underline-offset-4"
                >
                  Create an account
                </Link>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-[#0F223A] hover:text-[#2F466F] underline underline-offset-4"
                >
                  Sign in here
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
