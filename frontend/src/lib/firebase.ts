// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  phoneNumber?: string;
}

let app;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let isRealFirebase = false;

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

try {
  if (hasFirebaseConfig) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    isRealFirebase = true;
  } else {
    console.warn('Firebase config missing — set VITE_FIREBASE_* in frontend/.env');
  }
} catch (error) {
  console.warn('Firebase initialization failed.', error);
  isRealFirebase = false;
  auth = null;
  db = null;
}

export { auth, db, isRealFirebase };

function requireAuth() {
  if (!auth || !isRealFirebase) {
    throw new Error(
      'Firebase Auth is not configured. Add VITE_FIREBASE_* keys and enable the sign-in methods you need in the Firebase console.'
    );
  }
  return auth;
}

export function mapFirebaseUser(user: User): AuthUser {
  const phone = user.phoneNumber || undefined;
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email || phone || 'User',
    photoURL:
      user.photoURL ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`,
    phoneNumber: phone,
  };
}

/** Persist session via Firebase Auth; subscribe to auth state (includes refresh). */
export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, (firebaseUser) => {
    callback(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
  });
}

/** Map Firebase Auth error codes to friendly UI copy. */
export function mapAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code || '')
      : '';
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: string }).message || '')
      : String(error || 'Something went wrong');

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support if you need help.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing. Please try again.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by the browser. Allow popups and try again.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in popup is already open.';
    case 'auth/invalid-phone-number':
      return 'Enter a valid phone number including country code (e.g. +14155552671).';
    case 'auth/missing-phone-number':
      return 'Phone number is required.';
    case 'auth/invalid-verification-code':
      return 'That verification code is incorrect. Please try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This code has expired. Request a new one.';
    case 'auth/missing-verification-code':
      return 'Enter the verification code from your SMS.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded for this project. Try again later.';
    case 'auth/captcha-check-failed':
      return 'Security check failed. Refresh the page and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Enable it in the Firebase console.';
    case 'auth/missing-email':
      return 'Email address is required.';
    case 'auth/requires-recent-login':
      return 'Please sign in again to continue.';
    default:
      if (message && !message.startsWith('Firebase:')) return message;
      return 'Authentication failed. Please try again.';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** E.164: + then country code and subscriber number (8–15 digits total after +). */
const E164_RE = /^\+[1-9]\d{7,14}$/;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Email is required.';
  if (!EMAIL_RE.test(value)) return 'Please enter a valid email address.';
  return null;
}

export function validatePassword(password: string, { isNew = false } = {}): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (isNew && password.length < 8) {
    return 'Choose a password with at least 8 characters.';
  }
  return null;
}

export function validateDisplayName(name: string): string | null {
  const value = name.trim();
  if (!value) return 'Name is required.';
  if (value.length < 2) return 'Name must be at least 2 characters.';
  if (value.length > 80) return 'Name is too long.';
  return null;
}

export function validatePhoneE164(phone: string): string | null {
  const value = phone.replace(/[\s()-]/g, '');
  if (!value) return 'Phone number is required.';
  if (!E164_RE.test(value)) {
    return 'Use international format with country code (e.g. +14155552671).';
  }
  return null;
}

export function validateOtpCode(code: string): string | null {
  const value = code.trim();
  if (!value) return 'Verification code is required.';
  if (!/^\d{6}$/.test(value)) return 'Enter the 6-digit code from SMS.';
  return null;
}

/** Google login with Firebase Auth popup. Session persists automatically. */
export async function loginWithGoogle(): Promise<AuthUser> {
  const authInstance = requireAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(authInstance, provider);
    return mapFirebaseUser(result.user);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

/** Email/password sign-up (creates account + optional display name). */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthUser> {
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);
  const passErr = validatePassword(password, { isNew: true });
  if (passErr) throw new Error(passErr);
  if (displayName) {
    const nameErr = validateDisplayName(displayName);
    if (nameErr) throw new Error(nameErr);
  }

  const authInstance = requireAuth();
  try {
    const result = await createUserWithEmailAndPassword(
      authInstance,
      email.trim(),
      password
    );
    if (displayName?.trim()) {
      await updateProfile(result.user, { displayName: displayName.trim() });
    }
    return mapFirebaseUser(result.user);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

/** Email/password sign-in. */
export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);
  const passErr = validatePassword(password);
  if (passErr) throw new Error(passErr);

  const authInstance = requireAuth();
  try {
    const result = await signInWithEmailAndPassword(authInstance, email.trim(), password);
    return mapFirebaseUser(result.user);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

/** Send password-reset email. */
export async function sendPasswordReset(email: string): Promise<void> {
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);

  const authInstance = requireAuth();
  try {
    await sendPasswordResetEmail(authInstance, email.trim());
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

let phoneRecaptcha: RecaptchaVerifier | null = null;

/** Clear and dispose any existing phone reCAPTCHA verifier. */
export function clearPhoneRecaptcha(): void {
  if (phoneRecaptcha) {
    try {
      phoneRecaptcha.clear();
    } catch {
      /* already cleared */
    }
    phoneRecaptcha = null;
  }
}

/**
 * Start phone OTP flow. `containerId` must be a DOM element id for reCAPTCHA
 * (invisible). Returns ConfirmationResult for confirmPhoneOtp.
 */
export async function startPhoneAuth(
  phoneNumber: string,
  containerId: string
): Promise<ConfirmationResult> {
  const normalized = phoneNumber.replace(/[\s()-]/g, '');
  const phoneErr = validatePhoneE164(normalized);
  if (phoneErr) throw new Error(phoneErr);

  const authInstance = requireAuth();
  clearPhoneRecaptcha();

  try {
    phoneRecaptcha = new RecaptchaVerifier(authInstance, containerId, {
      size: 'invisible',
    });
    await phoneRecaptcha.render();
    return await signInWithPhoneNumber(authInstance, normalized, phoneRecaptcha);
  } catch (error) {
    clearPhoneRecaptcha();
    throw new Error(mapAuthError(error));
  }
}

/** Confirm SMS OTP and complete phone sign-in. */
export async function confirmPhoneOtp(
  confirmation: ConfirmationResult,
  code: string
): Promise<AuthUser> {
  const codeErr = validateOtpCode(code);
  if (codeErr) throw new Error(codeErr);

  try {
    const result = await confirmation.confirm(code.trim());
    clearPhoneRecaptcha();
    return mapFirebaseUser(result.user);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function logoutFirebase(): Promise<void> {
  clearPhoneRecaptcha();
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Return a fresh Firebase ID token (forces refresh when forceRefresh=true).
 * Used as Authorization: Bearer for API calls and ?token= for media/SSE.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch (e) {
    console.warn('Failed to get Firebase ID token', e);
    return null;
  }
}

/**
 * Firestore rejects `undefined` field values.
 * Omit undefined keys; convert undefined array elements to null.
 * Preserves null / numbers / strings / nested objects as-is.
 */
export function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : sanitizeForFirestore(item)));
  }
  // Plain objects only (skip Date / special types by copying enumerable fields)
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested === undefined) {
      continue; // omit field (e.g. failureReason when not Failed)
    }
    out[key] = sanitizeForFirestore(nested);
  }
  return out;
}

export const saveUserProject = async (userId: string, project: any) => {
  if (isRealFirebase && db) {
    try {
      const docRef = doc(db, 'users', userId, 'projects', project.id);
      const payload = sanitizeForFirestore({
        ...project,
        updatedAt: new Date().toISOString(),
      }) as Record<string, unknown>;
      await setDoc(docRef, payload, { merge: true });
      return;
    } catch (e) {
      console.warn('Firestore save failed, falling back to localStorage', e);
    }
  }

  const key = `luminadub_projects_${userId}`;
  const existing = localStorage.getItem(key);
  const projects = existing ? JSON.parse(existing) : [];
  const idx = projects.findIndex((p: any) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  localStorage.setItem(key, JSON.stringify(projects));
};

export const deleteUserProject = async (userId: string, projectId: string) => {
  if (isRealFirebase && db) {
    try {
      const docRef = doc(db, 'users', userId, 'projects', projectId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Firestore delete failed, falling back to localStorage', e);
    }
  }

  const key = `luminadub_projects_${userId}`;
  const existing = localStorage.getItem(key);
  const projects = existing ? JSON.parse(existing) : [];
  localStorage.setItem(
    key,
    JSON.stringify(projects.filter((p: any) => p.id !== projectId))
  );
};

export const loadUserProjects = async (userId: string): Promise<any[]> => {
  if (isRealFirebase && db) {
    try {
      const colRef = collection(db, 'users', userId, 'projects');
      const snap = await getDocs(colRef);
      const list: any[] = [];
      snap.forEach((d) => {
        list.push(d.data());
      });
      if (list.length > 0) return list;
    } catch (e) {
      console.warn('Firestore load failed, falling back to localStorage', e);
    }
  }

  const key = `luminadub_projects_${userId}`;
  const existing = localStorage.getItem(key);
  return existing ? JSON.parse(existing) : [];
};

/** @deprecated Use loginWithGoogle */
export const loginWithGoogleMock = loginWithGoogle;
