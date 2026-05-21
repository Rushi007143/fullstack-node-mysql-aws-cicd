const router = require('express').Router();
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Demo login for CI/testing. Replace with real MySQL lookup in production.
  if (email !== 'admin@example.com' || password !== 'Admin@123') {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: 1, email, role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
  return res.status(200).json({ token });
});

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  return res.status(201).json({ message: 'Register endpoint ready. Add MySQL insert logic here.' });
});

module.exports = router;
