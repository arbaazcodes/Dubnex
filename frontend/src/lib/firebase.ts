// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
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

export function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email || 'User',
    photoURL:
      user.photoURL ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`,
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

/** Google login with Firebase Auth popup. Session persists automatically. */
export async function loginWithGoogle(): Promise<AuthUser> {
  if (!auth || !isRealFirebase) {
    throw new Error(
      'Firebase Auth is not configured. Add VITE_FIREBASE_* keys and enable Google sign-in.'
    );
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return mapFirebaseUser(result.user);
}

export async function logoutFirebase(): Promise<void> {
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

export const saveUserProject = async (userId: string, project: any) => {
  if (isRealFirebase && db) {
    try {
      const docRef = doc(db, 'users', userId, 'projects', project.id);
      await setDoc(docRef, { ...project, updatedAt: new Date().toISOString() }, { merge: true });
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
