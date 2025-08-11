import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

interface TicketData {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
}

interface CommentData {
  ticketId: string;
  comment: string;
  author?: string;
}

interface UpdateData {
  ticketId: string;
  updates: Partial<TicketData & { status: string }>; 
}

const SLA_HOURS: Record<string, number> = {
  high: 24,
  medium: 48,
  low: 72,
};

function calculateSla(priority: 'low' | 'medium' | 'high') {
  const hours = SLA_HOURS[priority] || SLA_HOURS.low;
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + hours);
  return admin.firestore.Timestamp.fromDate(dueDate);
}

function assignAgent(priority: 'low' | 'medium' | 'high', requested?: string) {
  if (requested) return requested;
  const defaults: Record<string, string> = {
    high: 'senior-agent',
    medium: 'support-agent',
    low: 'junior-agent',
  };
  return defaults[priority] || 'unassigned';
}

export const createTicket = functions.https.onCall(async (data: TicketData) => {
  const { title, description = '', priority, assignedTo } = data;
  const ticket = {
    title,
    description,
    priority,
    status: 'open',
    assignedTo: assignAgent(priority, assignedTo),
    createdAt: admin.firestore.Timestamp.now(),
    dueAt: calculateSla(priority),
  };
  const ref = await admin.firestore().collection('tickets').add(ticket);
  return { id: ref.id, ...ticket };
});

export const addComment = functions.https.onCall(async (data: CommentData) => {
  const { ticketId, comment, author } = data;
  const ticketRef = admin.firestore().collection('tickets').doc(ticketId);
  const commentData = {
    comment,
    author: author || 'anonymous',
    createdAt: admin.firestore.Timestamp.now(),
  };
  await ticketRef.collection('comments').add(commentData);
  await ticketRef.update({ updatedAt: commentData.createdAt });
  return { success: true };
});

export const updateTicket = functions.https.onCall(async (data: UpdateData) => {
  const { ticketId, updates } = data;
  const ticketRef = admin.firestore().collection('tickets').doc(ticketId);
  const snapshot = await ticketRef.get();
  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'Ticket not found');
  }
  const updateData: any = { ...updates, updatedAt: admin.firestore.Timestamp.now() };
  if (updates.priority) {
    updateData.dueAt = calculateSla(updates.priority);
    updateData.assignedTo = assignAgent(updates.priority, updates.assignedTo);
  }
  if (updates.status === 'resolved') {
    updateData.resolvedAt = admin.firestore.Timestamp.now();
  }
  await ticketRef.update(updateData);
  const newDoc = await ticketRef.get();
  return { id: ticketId, ...newDoc.data() };
});
