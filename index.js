require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const tickets = [];
const idempotency = new Map();

const app = express();

// Handle raw body for Square webhooks
app.use('/square/webhooks', express.raw({ type: '*/*' }));
app.use(express.json());

app.get('/readyz', (req, res) => {
  res.send('ok');
});

app.post('/tickets', (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key) {
    return res.status(400).json({ error: 'Idempotency-Key required' });
  }
  const existing = idempotency.get(key);
  if (existing && existing.expires > Date.now()) {
    return res.status(409).json({ error: 'Duplicate request' });
  }
  const { type, subject, requesterId } = req.body;
  const ticket = { id: crypto.randomUUID(), type, subject, requesterId };
  tickets.push(ticket);
  idempotency.set(key, { expires: Date.now() + IDEMPOTENCY_TTL_MS });

  console.log('autoresponder sent'); // TODO (FR-TK-1)

  res.status(201).json(ticket);
});

app.post('/tenants', async (req, res) => {
  const { name, plan } = req.body;
  const id = crypto.randomUUID();
  let subscriptionId;

  if (process.env.SQUARE_ACCESS_TOKEN) {
    try {
      const response = await fetch('https://connect.squareupsandbox.com/v2/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Square-Version': '2023-12-13',
          'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          location_id: 'L0cationId',
          plan_id: 'PlanId',
          customer_id: 'CustomerId'
        })
      });
      const data = await response.json();
      subscriptionId = data.subscription && data.subscription.id;
    } catch (err) {
      console.error('Square subscription failed', err);
    }
  }
  if (!subscriptionId) {
    subscriptionId = 'mock-' + crypto.randomUUID(); // TODO (TENT-4)
  }
  res.status(201).json({ id, plan, subscriptionId });
});

app.post('/square/webhooks', (req, res) => {
  const secret = process.env.SQUARE_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.get('x-square-hmacsha256') || '';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(req.body);
    const expected = hmac.digest('base64');
    if (expected !== signature) {
      return res.status(401).send('Invalid signature');
    }
  }
  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).send('Invalid JSON');
  }
  if (event.type && (event.type.startsWith('subscription.') || event.type.startsWith('invoice.')) ) {
    console.log('Square webhook', event.type);
  }
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
