import { auth } from './firebaseConfig.js';
import { onAuthStateChanged } from 'firebase/auth';

let currentUser = null;
const listeners = new Set();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  listeners.forEach((cb) => cb(user));
});

export function getCurrentUser() {
  return currentUser;
}

export function onUserChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
