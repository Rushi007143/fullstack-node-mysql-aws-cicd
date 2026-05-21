const jwt = require('jsonwebtoken');

function generateTestToken(payload = {}) {
  const defaultPayload = { id: 1, email: 'ci@yourapp.com', role: 'admin', ...payload };
  return jwt.sign(defaultPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function authHeader(payload = {}) {
  return { Authorization: `Bearer ${generateTestToken(payload)}` };
}

const GARBAGE_TOKEN = 'Bearer garbage.fake.jwt.token.xyz123';
const MALFORMED_TOKEN = 'Bearer notavalidjwt';
const BASIC_AUTH = 'Basic dXNlcjpwYXNzd29yZA==';
const EMPTY_BEARER = 'Bearer ';
const EXPIRED_TOKEN = `Bearer ${jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'fallback-secret-minimum-32-chars', { expiresIn: '-1s' })}`;

module.exports = { generateTestToken, authHeader, GARBAGE_TOKEN, MALFORMED_TOKEN, BASIC_AUTH, EMPTY_BEARER, EXPIRED_TOKEN };
