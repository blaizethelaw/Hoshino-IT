import { auth } from './firebaseConfig.js';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}
