const router = require('express').Router();
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/', requireAuth, async (req, res) => {
  return res.status(200).json([
    {
      id: 1,
      status: 'completed',
      gross_amount: 1000,
      commission_rate: 0.20,
      created_at: new Date().toISOString(),
    },
  ]);
});

router.post('/', requireAuth, async (req, res) => {
  const { gross_amount, status } = req.body || {};
  if (!gross_amount || !status) {
    return res.status(400).json({ message: 'gross_amount and status are required' });
  }
  return res.status(201).json({ message: 'Order create endpoint ready', gross_amount, status });
});

module.exports = router;
