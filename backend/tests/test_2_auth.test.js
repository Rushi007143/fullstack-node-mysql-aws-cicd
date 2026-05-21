const request = require('supertest');
const { authHeader, GARBAGE_TOKEN, MALFORMED_TOKEN, BASIC_AUTH, EMPTY_BEARER, EXPIRED_TOKEN } = require('./helpers');
let app;

beforeAll(() => { app = require('../src/app'); });
afterAll(async () => { if (app && app.closeConnections) await app.closeConnections(); });

describe('Protected routes reject requests without token', () => {
  test.each(['/api/orders', '/api/users', '/api/kpi'])('GET %s without token returns 401 or 403', async (route) => {
    const res = await request(app).get(route);
    expect([401, 403]).toContain(res.status);
  });
});

test('Garbage JWT token is rejected', async () => {
  const res = await request(app).get('/api/orders').set('Authorization', GARBAGE_TOKEN);
  expect([401, 403]).toContain(res.status);
});

test('Malformed Bearer token is rejected', async () => {
  const res = await request(app).get('/api/orders').set('Authorization', MALFORMED_TOKEN);
  expect([401, 403]).toContain(res.status);
});

test('Basic auth prefix is rejected', async () => {
  const res = await request(app).get('/api/orders').set('Authorization', BASIC_AUTH);
  expect([401, 403]).toContain(res.status);
});

test('Expired JWT token is rejected', async () => {
  const res = await request(app).get('/api/orders').set('Authorization', EXPIRED_TOKEN);
  expect([401, 403]).toContain(res.status);
});

test('Empty Bearer token is rejected', async () => {
  const res = await request(app).get('/api/orders').set('Authorization', EMPTY_BEARER);
  expect([401, 403]).toContain(res.status);
});

test('Valid test token is accepted', async () => {
  const res = await request(app).get('/api/orders').set(authHeader());
  expect(res.status).toBe(200);
});

test('Login with empty body returns 400 or 422', async () => {
  const res = await request(app).post('/api/auth/login').send({});
  expect([400, 422]).toContain(res.status);
});

test('Login with missing password returns 400 or 422', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'test@test.com' });
  expect([400, 422]).toContain(res.status);
});

test('Login with missing email returns 400 or 422', async () => {
  const res = await request(app).post('/api/auth/login').send({ password: 'somepassword' });
  expect([400, 422]).toContain(res.status);
});

test('Wrong credentials never return 200', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'wrong@example.com', password: 'wrongPassword999!!!' });
  expect(res.status).not.toBe(200);
});

test('SQL injection string does not crash login', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: "' OR 1=1; --", password: 'anything' });
  expect(res.status).not.toBe(500);
});
