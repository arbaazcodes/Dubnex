// useAuth — Firebase authentication session state, secure media URL, auth modal.
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { subscribeToAuth, logoutFirebase } from '../lib/firebase';
import type { AuthUser } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [secureVideoSrc, setSecureVideoSrc] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Real Firebase Auth session persistence + token refresh via SDK
  useEffect(() => {
    const unsubscribe = subscribeToAuth((authUser) => {
      setUser(authUser);
      setAuthReady(true);
      if (!authUser) {
        setSecureVideoSrc('');
      }
    });
    return unsubscribe;
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logoutFirebase();
    } catch (e) {
      console.error('Logout failed:', e);
      toast.error('Sign-out failed', {
        description: 'You were signed out locally, but the session could not be closed on the server. Try again.',
      });
    }
    setUser(null);
    setSecureVideoSrc('');
    localStorage.removeItem('luminadub_user');
  };

  return {
    user,
    setUser,
    authReady,
    setAuthReady,
    secureVideoSrc,
    setSecureVideoSrc,
    showAuthModal,
    setShowAuthModal,
    handleLogout,
  };
}

export type AuthState = ReturnType<typeof useAuth>;
