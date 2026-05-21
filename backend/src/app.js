const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { closePool } = require('./config/db');

const app = express();
app.disable('x-powered-by');

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'node-mysql-backend' });
});

app.use('/', require('./routes/health.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/orders', require('./routes/orders.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/kpi', require('./routes/kpi.routes'));
app.use('/api/dashboard', require('./routes/kpi.routes'));

app.closeConnections = async function closeConnections() {
  await closePool();
};

module.exports = app;
