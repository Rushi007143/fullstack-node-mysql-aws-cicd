const router = require('express').Router();
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/', requireAuth, async (req, res) => {
  return res.status(200).json([
    { id: 1, name: 'CI Test User', email: 'ci@example.com', role: 'admin' },
  ]);
});

module.exports = router;
