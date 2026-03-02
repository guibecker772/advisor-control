import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export const FIREBASE_REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

type FirebaseEnvKey = (typeof FIREBASE_REQUIRED_ENV_KEYS)[number];

type FirebaseEnv = Partial<Record<FirebaseEnvKey, string>>;

type FirebaseDetectedMap = Record<FirebaseEnvKey, boolean>;

export type FirebaseInitResult = {
  ok: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  googleProvider: GoogleAuthProvider | null;
  missingVars: FirebaseEnvKey[];
  detectedVars: FirebaseDetectedMap;
  message?: string;
};

let cachedInitResult: FirebaseInitResult | null = null;

function readFirebaseEnv(): FirebaseEnv {
  return {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function mapDetectedVars(firebaseEnv: FirebaseEnv): FirebaseDetectedMap {
  return FIREBASE_REQUIRED_ENV_KEYS.reduce((acc, key) => {
    acc[key] = typeof firebaseEnv[key] === 'string' && firebaseEnv[key]!.trim().length > 0;
    return acc;
  }, {} as FirebaseDetectedMap);
}

export function initFirebase(): FirebaseInitResult {
  if (cachedInitResult) {
    return cachedInitResult;
  }

  const firebaseEnv = readFirebaseEnv();
  const detectedVars = mapDetectedVars(firebaseEnv);

  const missingVars = FIREBASE_REQUIRED_ENV_KEYS.filter((key) => !detectedVars[key]);

  if (missingVars.length > 0) {
    cachedInitResult = {
      ok: false,
      app: null,
      auth: null,
      db: null,
      googleProvider: null,
      missingVars,
      detectedVars,
      message: `Variaveis VITE_FIREBASE_* ausentes: ${missingVars.join(', ')}`,
    };

    if (import.meta.env.DEV) {
      console.error('[firebase] Configuracao ausente:', cachedInitResult.message);
    }

    return cachedInitResult;
  }

  const firebaseConfig = {
    apiKey: firebaseEnv.VITE_FIREBASE_API_KEY as string,
    authDomain: firebaseEnv.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: firebaseEnv.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: firebaseEnv.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: firebaseEnv.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: firebaseEnv.VITE_FIREBASE_APP_ID as string,
  };

  const initializedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const initializedAuth = getAuth(initializedApp);
  const initializedDb = getFirestore(initializedApp);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  cachedInitResult = {
    ok: true,
    app: initializedApp,
    auth: initializedAuth,
    db: initializedDb,
    googleProvider: provider,
    missingVars: [],
    detectedVars,
  };

  return cachedInitResult;
}

export const firebaseInit = initFirebase();
export const app = firebaseInit.app;
export const auth = firebaseInit.auth;
export const db = firebaseInit.db;
export const googleProvider = firebaseInit.googleProvider;

export default app;
