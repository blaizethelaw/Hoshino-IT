import { functions } from './firebaseConfig.js';
import { httpsCallable } from 'firebase/functions';

export const createTicket = async (data) => {
  const fn = httpsCallable(functions, 'createTicket');
  return (await fn(data)).data;
};

export const addComment = async (data) => {
  const fn = httpsCallable(functions, 'addComment');
  return (await fn(data)).data;
};

export const updateTicket = async (data) => {
  const fn = httpsCallable(functions, 'updateTicket');
  return (await fn(data)).data;
};
