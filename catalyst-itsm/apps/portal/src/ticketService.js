import { collection, doc, getDocs, onSnapshot, query, where, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig.js";

// Fetch all tickets for a given tenant using getDocs
export const fetchTickets = async (tenantId) => {
  const q = query(collection(db, "tickets"), where("tenantId", "==", tenantId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Listen to realtime updates for tickets belonging to a tenant
export const listenToTickets = (tenantId, callback) => {
  const q = query(collection(db, "tickets"), where("tenantId", "==", tenantId));
  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(tickets);
  });
};

// Create a new ticket under tickets/{ticketId} with tenantId
export const createTicket = async (ticketId, tenantId, data) => {
  const ticketRef = doc(db, "tickets", ticketId);
  await setDoc(ticketRef, { ...data, tenantId, createdAt: serverTimestamp() });
  return ticketRef.id;
};

// Add a comment under tickets/{ticketId}/comments/{commentId} with tenantId
export const addComment = async (ticketId, commentId, tenantId, data) => {
  const commentRef = doc(db, "tickets", ticketId, "comments", commentId);
  await setDoc(commentRef, { ...data, tenantId, createdAt: serverTimestamp() });
  return commentRef.id;
};
