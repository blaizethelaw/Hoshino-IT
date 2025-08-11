import React, { useEffect, useState } from "react";
import { fetchTickets, listenToTickets } from "./ticketService.js";

// Component that renders tickets for a tenant using Firestore queries
export default function TicketList({ tenantId }) {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    // Initial fetch
    fetchTickets(tenantId).then(setTickets);
    // Realtime updates
    const unsubscribe = listenToTickets(tenantId, setTickets);
    return () => unsubscribe();
  }, [tenantId]);

  return (
    <ul>
      {tickets.map((t) => (
        <li key={t.id}>{t.title || t.id}</li>
      ))}
    </ul>
  );
}
