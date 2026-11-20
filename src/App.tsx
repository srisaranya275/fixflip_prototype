import { useEffect, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, signOut, User } from 'firebase/auth';
import { MailCheck, RefreshCw } from 'lucide-react';
import { AuthView } from './components/AuthView';
import { CustomerWorkspace } from './components/CustomerWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MechanicWorkspace } from './components/MechanicWorkspace';
import { VendorWorkspace } from './components/VendorWorkspace';
import { auth, testConnection } from './firebase/config';
import { fetchUserProfile } from './services/firestoreService';
import { UserProfile } from './types/repairloop';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
  } | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState<string | null>(null);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setPendingGoogleUser(null);
        setAuthReady(true);
        return;
      }

      if (!user.emailVerified) {
        setProfile(null);
        setPendingGoogleUser(null);
        setAuthReady(true);
        return;
      }

      try {
        const existing = await fetchUserProfile(user.uid);
        if (existing) {
          setProfile(existing);
          setPendingGoogleUser(null);
        } else {
          setProfile(null);
          setPendingGoogleUser({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'RepairLoop Member',
          });
        }
      } catch {
        setProfile(null);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setProfile(null);
    setPendingGoogleUser(null);
  };

  const handleRefreshVerification = async () => {
    if (!firebaseUser) return;
    setVerificationBusy(true);
    setVerificationMsg(null);
    try {
      await firebaseUser.reload();
      if (auth.currentUser?.emailVerified) {
        const existing = await fetchUserProfile(auth.currentUser.uid);
        if (existing) {
          setProfile(existing);
        } else {
          setPendingGoogleUser({
            uid: auth.currentUser.uid,
            email: auth.currentUser.email || '',
            displayName: auth.currentUser.displayName || 'RepairLoop Member',
          });
        }
      } else {
        setVerificationMsg('Email is still unverified. Please click the link in your inbox.');
      }
    } finally {
      setVerificationBusy(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-navy-900 border-t-teal-600 rounded-full animate-spin mx-auto" />
          <div className="text-sm font-medium text-slate-600">
            Loading RepairLoop workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {firebaseUser && !firebaseUser.emailVerified ? (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-7 space-y-4">
            <MailCheck className="w-8 h-8 text-teal-600" />
            <h1 className="text-xl font-bold text-navy-950">
              Verify Your Email Address
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              We sent a verification link to{' '}
              <strong className="text-navy-950">{firebaseUser.email}</strong>. Verify
              your email to activate your RepairLoop workspace, or sign out and continue
              with Google Sign-In.
            </p>
            {verificationMsg && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {verificationMsg}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleRefreshVerification}
                disabled={verificationBusy}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>I&apos;ve Verified</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await sendEmailVerification(firebaseUser);
                  setVerificationMsg('Verification email resent.');
                }}
                className="px-4 py-2 text-sm font-medium text-navy-950 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-navy-950 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      ) : !profile ? (
        <AuthView
          pendingGoogleUser={pendingGoogleUser}
          onCancelPendingGoogle={handleSignOut}
          onAuthenticated={(loadedProfile) => {
            setProfile(loadedProfile);
            setPendingGoogleUser(null);
          }}
        />
      ) : profile.role === 'customer' ? (
        <CustomerWorkspace user={profile} onSignOut={handleSignOut} />
      ) : profile.role === 'mechanic' ? (
        <MechanicWorkspace user={profile} onSignOut={handleSignOut} />
      ) : (
        <VendorWorkspace user={profile} onSignOut={handleSignOut} />
      )}
    </ErrorBoundary>
  );
}
