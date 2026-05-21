const router = require('express').Router();
const { getPool } = require('../config/db');

router.get('/health', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await getPool().query('SELECT 1');
    }
    return res.status(200).json({ status: 'ok', service: 'node-mysql-backend' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Database health failed' });
  }
});

module.exports = router;
