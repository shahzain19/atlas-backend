import express from 'express';
const router = express.Router();

// Lightweight subscribe endpoint: logs email and returns OK.
// TODO: persist in DB or integrate with mailing provider (Mailgun, Sendgrid) when ready.
router.post('/', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  console.log('New subscription:', email);

  return res.json({ ok: true });
});

export default router;
