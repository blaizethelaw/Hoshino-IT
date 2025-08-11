import http from 'node:http';
import { createTicket } from './src/tickets.js';

const PORT = process.env.PORT || 3000;

http
  .createServer(async (req, res) => {
    if (req.url === '/demo') {
      try {
        const ticket = await createTicket({
          title: 'Demo Ticket',
          priority: 'low',
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ticket));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Portal dev server is up ✅\n');
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}`));
