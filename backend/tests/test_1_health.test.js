const request = require('supertest');
let app;

beforeAll(() => { app = require('../src/app'); });
afterAll(async () => { if (app && app.closeConnections) await app.closeConnections(); });

test('App boots and responds to root route', async () => {
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
});

test('Health check endpoint responds with 200', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('POST /api/auth/login route exists and validates input', async () => {
  const res = await request(app).post('/api/auth/login').send({});
  expect(res.status).not.toBe(404);
  expect([400, 422]).toContain(res.status);
});

test('POST /api/auth/register route exists and validates input', async () => {
  const res = await request(app).post('/api/auth/register').send({});
  expect(res.status).not.toBe(404);
  expect([400, 422]).toContain(res.status);
});

test('GET /api/orders route exists and is protected', async () => {
  const res = await request(app).get('/api/orders');
  expect(res.status).not.toBe(404);
  expect([401, 403]).toContain(res.status);
});

test('GET /api/users route exists and is protected', async () => {
  const res = await request(app).get('/api/users');
  expect(res.status).not.toBe(404);
  expect([401, 403]).toContain(res.status);
});

test('GET /api/kpi route exists and is protected', async () => {
  const res = await request(app).get('/api/kpi');
  expect(res.status).not.toBe(404);
  expect([401, 403]).toContain(res.status);
});

test('Core GET routes do not crash with 500', async () => {
  for (const route of ['/api/orders', '/api/users', '/api/kpi']) {
    const res = await request(app).get(route);
    expect(res.status).not.toBe(500);
  }
});
