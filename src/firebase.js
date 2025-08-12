import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;

// Ensure all Firebase config values are provided and not placeholder text
const hasValidConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim() !== '' && !/^your[-_]/i.test(value)
);

if (hasValidConfig) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.error(
    'Firebase initialization error: missing or invalid configuration. Please check your environment variables.'
  );
}

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
