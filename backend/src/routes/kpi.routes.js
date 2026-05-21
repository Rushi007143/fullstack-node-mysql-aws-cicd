const router = require('express').Router();
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/', requireAuth, async (req, res) => {
  return res.status(200).json({ total_orders: 1, total_revenue: 1000, database: 'mysql' });
});

module.exports = router;
