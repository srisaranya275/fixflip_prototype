import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ShieldCheck,
  Store,
  Wrench,
} from 'lucide-react';
import { auth } from '../firebase/config';
import { createUserProfile, fetchUserProfile } from '../services/firestoreService';
import { UserProfile, UserRole } from '../types/repairloop';

interface AuthViewProps {
  onAuthenticated: (profile: UserProfile) => void;
  pendingGoogleUser: { uid: string; email: string; displayName: string } | null;
  onCancelPendingGoogle: () => void;
}

const ROLE_OPTIONS: {
  role: UserRole;
  title: string;
  summary: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    role: 'customer',
    title: 'Customer',
    summary: 'Submit repairs, compare mechanic quotes, track warranties & sell devices.',
    Icon: ShieldCheck,
  },
  {
    role: 'mechanic',
    title: 'Mechanic',
    summary: 'Inspect open requests, submit confidential quotes & update repair progress.',
    Icon: Wrench,
  },
  {
    role: 'vendor',
    title: 'Vendor',
    summary: 'Browse resale inventory, place private offers & manage acquired stock.',
    Icon: Store,
  },
];

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthenticated,
  pendingGoogleUser,
  onCancelPendingGoogle,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [googleRole, setGoogleRole] = useState<UserRole>('customer');
  const [googleName, setGoogleName] = useState(pendingGoogleUser?.displayName || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'register') {
        if (fullName.trim().length < 2) {
          throw new Error('Please enter your full name (at least 2 characters).');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: fullName.trim() });

        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user).catch(() => {});
          setInfoMessage(
            'Account created. Please check your inbox to verify your email address before saving records, or sign in with Google for instant verified access.'
          );
          return;
        }

        const profile = await createUserProfile(
          cred.user.uid,
          fullName.trim(),
          cred.user.email || email.trim(),
          role
        );
        onAuthenticated(profile);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user).catch(() => {});
          setInfoMessage(
            'Please verify your email address via the verification link sent to your inbox, then sign in again.'
          );
          return;
        }
        const existing = await fetchUserProfile(cred.user.uid);
        if (existing) {
          onAuthenticated(existing);
        } else {
          const profile = await createUserProfile(
            cred.user.uid,
            cred.user.displayName || 'RepairLoop Member',
            cred.user.email || email.trim(),
            role
          );
          onAuthenticated(profile);
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMessage(
          'Email/Password sign-in is not yet enabled in the Firebase Console for this project. Use "Continue with Google" below for instant access, or enable Email/Password under Authentication → Sign-in method in Firebase Console.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setErrorMessage('Invalid email or password. Please try again.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email already exists. Switch to Sign In.');
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'Authentication failed. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const existing = await fetchUserProfile(result.user.uid);
      if (existing) {
        onAuthenticated(existing);
      }
      // If no profile exists yet, App.tsx transitions into pendingGoogleUser role selection!
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code !== 'auth/popup-closed-by-user') {
        setErrorMessage(
          err instanceof Error ? err.message : 'Google sign-in could not be completed.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGoogleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const chosenName =
        (googleName || pendingGoogleUser.displayName || 'RepairLoop Member').trim();
      const profile = await createUserProfile(
        pendingGoogleUser.uid,
        chosenName,
        pendingGoogleUser.email,
        googleRole
      );
      onAuthenticated(profile);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to create user profile.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-xl font-bold tracking-tight text-navy-950 whitespace-nowrap shrink-0"
          >
            RepairLoop
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#workflows"
              className="hover:text-navy-900 transition-colors whitespace-nowrap shrink-0"
            >
              Workflows
            </a>
            <a
              href="#decision-logic"
              className="hover:text-navy-900 transition-colors whitespace-nowrap shrink-0"
            >
              Decision Engine
            </a>
            <a
              href="#roles"
              className="hover:text-navy-900 transition-colors whitespace-nowrap shrink-0"
            >
              Platform Roles
            </a>
            <a
              href="#architecture"
              className="hover:text-navy-900 transition-colors whitespace-nowrap shrink-0"
            >
              Java Core
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Split Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Editorial + Visual Workbench */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-8 pb-6">
                <p className="text-xs font-semibold tracking-wide text-teal-700 mb-2">
                  Repair. Reuse. Renew.
                </p>
                <h1 className="text-3xl lg:text-4xl font-bold text-navy-950 tracking-tight leading-tight text-balance mb-4">
                  Intelligent Repair, Resale &amp; Lifecycle Decisions for Electronics
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                  Connect customers, certified mechanics, and refurbishment vendors in one
                  transparent workspace. Compare isolated mechanic quotations, track repairs
                  end-to-end, manage product warranties, and evaluate repair-vs-replace
                  economics before spending.
                </p>
              </div>

              <div className="relative h-64 lg:h-72 w-full bg-navy-950 overflow-hidden mt-auto">
                <img
                  src="/src/assets/images/hero_repair_workbench_1795191301515.jpg"
                  alt="Precision electronics diagnostics and repair workbench"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/75 via-navy-950/20 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6 flex flex-wrap items-center justify-between gap-4 text-white">
                  <div className="text-sm font-medium">
                    Role-isolated quotations &amp; vendor offers backed by Firestore
                  </div>
                  <div className="text-xs font-mono text-teal-300 tabular-nums">
                    Java 21 RepairLoopCore Module Included
                  </div>
                </div>
              </div>
            </div>

            {/* Right Authentication Card */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-center">
              {pendingGoogleUser ? (
                <form onSubmit={handleCompleteGoogleOnboarding} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-navy-950">
                      Complete Account Setup
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Signed in as <span className="font-medium text-slate-900">{pendingGoogleUser.email}</span>. Choose your RepairLoop workspace role.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={googleName}
                      onChange={(e) => setGoogleName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Role
                    </label>
                    <div className="space-y-2.5">
                      {ROLE_OPTIONS.map((opt) => {
                        const Icon = opt.Icon;
                        const active = googleRole === opt.role;
                        return (
                          <button
                            key={opt.role}
                            type="button"
                            onClick={() => setGoogleRole(opt.role)}
                            className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer flex items-start gap-3 ${
                              active
                                ? 'border-teal-600 bg-teal-50/60'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <Icon
                              className={`w-5 h-5 mt-0.5 shrink-0 ${
                                active ? 'text-teal-700' : 'text-slate-500'
                              }`}
                            />
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {opt.title}
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                {opt.summary}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                      {errorMessage}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {submitting ? 'Creating Workspace...' : 'Enter Workspace'}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelPendingGoogle}
                      className="py-2.5 px-4 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      Back
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer ${
                        mode === 'login'
                          ? 'bg-white text-navy-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer ${
                        mode === 'register'
                          ? 'bg-white text-navy-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    {mode === 'register' && (
                      <div>
                        <label
                          htmlFor="reg-fullname"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Full Name
                        </label>
                        <input
                          id="reg-fullname"
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Alex Morgan"
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Email Address
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="auth-password"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Password
                      </label>
                      <input
                        id="auth-password"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                      />
                    </div>

                    {mode === 'register' && (
                      <div>
                        <label
                          htmlFor="auth-role"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Account Role
                        </label>
                        <select
                          id="auth-role"
                          value={role}
                          onChange={(e) => setRole(e.target.value as UserRole)}
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                        >
                          <option value="customer">Customer</option>
                          <option value="mechanic">Mechanic</option>
                          <option value="vendor">Vendor</option>
                        </select>
                      </div>
                    )}

                    {errorMessage && (
                      <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg leading-relaxed">
                        {errorMessage}
                      </div>
                    )}

                    {infoMessage && (
                      <div className="p-3 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg leading-relaxed">
                        {infoMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <span>
                        {submitting
                          ? 'Authenticating...'
                          : mode === 'register'
                          ? 'Register Account'
                          : 'Sign In with Email'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-3 text-slate-500">
                        Recommended quick sign-in
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={submitting}
                    className="w-full py-2.5 px-4 text-sm font-semibold text-navy-950 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Platform Highlights & Role Architecture */}
        <section id="workflows" className="max-w-7xl mx-auto px-6 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <Wrench className="w-5 h-5 text-teal-600 mb-3" />
              <h3 className="text-base font-semibold text-navy-950 mb-1.5">
                Confidential Quotations &amp; Tracking
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Customers receive blind mechanic bids without price-undercutting leaks.
                Accepting one quote atomically closes competing bids and opens a 5-stage
                repair timeline.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <Calculator className="w-5 h-5 text-teal-600 mb-3" />
              <h3 className="text-base font-semibold text-navy-950 mb-1.5">
                Weighted Repair-vs-Replace Engine
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Evaluate cost ratio, device age, expected lifespan extension, prior repair
                count, and recurring faults with a transparent 100-point rubric.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <Store className="w-5 h-5 text-teal-600 mb-3" />
              <h3 className="text-base font-semibold text-navy-950 mb-1.5">
                Warranty Register &amp; Circular Resale
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Track active or expiring appliance warranties and list end-of-life devices
                for verified vendors to bid on with atomic single-buyer purchase protection.
              </p>
            </div>
          </div>
        </section>

        <section id="decision-logic" className="max-w-7xl mx-auto px-6 pb-12">
          <div id="roles" className="bg-white border border-slate-200 rounded-xl p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-xl font-bold text-navy-950 mb-2">
                  Three Dedicated Role Workspaces
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Every account operates inside strict Firestore security boundaries
                  enforced at both the UI and database rule layers.
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-navy-950">Customer:</strong> Manage repair
                      requests, compare quotes, track repairs, log warranties &amp; sell
                      used appliances.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-navy-950">Mechanic:</strong> Review open
                      requests, submit private quotations &amp; advance active repair
                      milestones.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-navy-950">Vendor:</strong> Bid privately on
                      available resale listings &amp; track completed purchase orders.
                    </span>
                  </div>
                </div>
              </div>

              <div
                id="architecture"
                className="bg-navy-950 text-white rounded-xl p-6 space-y-3"
              >
                <div className="text-xs font-mono text-teal-400">
                  RepairLoopCore — Plain Java 21 Module
                </div>
                <h3 className="text-lg font-semibold">
                  Independent Object-Oriented Business Logic
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Alongside this live React + Firebase web application, the repository
                  contains the standalone <code className="font-mono text-teal-300">RepairLoopCore</code> Java
                  21 module implementing <code className="font-mono text-teal-300">RepairDecisionEngine</code>,{' '}
                  <code className="font-mono text-teal-300">QuotationManager</code>,{' '}
                  <code className="font-mono text-teal-300">RepairTracker</code>,{' '}
                  <code className="font-mono text-teal-300">VendorOfferManager</code>, and a built-in JDK
                  HTTP bridge without Spring Boot.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>RepairLoop — Repair. Reuse. Renew.</span>
          <span>Circular Electronics &amp; Appliance Lifecycle Platform</span>
        </div>
      </footer>
    </div>
  );
};
