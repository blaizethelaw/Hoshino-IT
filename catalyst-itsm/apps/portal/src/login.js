import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword } from 'firebase/auth';

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
