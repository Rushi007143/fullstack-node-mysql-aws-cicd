const request = require('supertest');
const { authHeader } = require('./helpers');
let app;

beforeAll(() => { app = require('../src/app'); });
afterAll(async () => { if (app && app.closeConnections) await app.closeConnections(); });

describe('GET /api/orders', () => {
  test('Returns 200 with valid auth token', async () => {
    const res = await request(app).get('/api/orders').set(authHeader());
    expect(res.status).toBe(200);
  });

  test('Returns JSON content type', async () => {
    const res = await request(app).get('/api/orders').set(authHeader());
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('Returns an array', async () => {
    const res = await request(app).get('/api/orders').set(authHeader());
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Accepts query params without crashing', async () => {
    const res = await request(app).get('/api/orders?page=1&limit=10&start_date=2026-05-01&end_date=2026-05-31').set(authHeader());
    expect(res.status).not.toBe(500);
  });

  test('Order objects have required fields', async () => {
    const res = await request(app).get('/api/orders?limit=1').set(authHeader());
    expect(res.status).toBe(200);
    if (res.body.length === 0) return;
    const order = res.body[0];
    ['id', 'status', 'created_at'].forEach((field) => expect(order).toHaveProperty(field));
  });
});

describe('GET /api/users', () => {
  test('Returns 200 with valid auth', async () => {
    const res = await request(app).get('/api/users').set(authHeader());
    expect(res.status).toBe(200);
  });

  test('Returns JSON', async () => {
    const res = await request(app).get('/api/users').set(authHeader());
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /api/kpi', () => {
  test('Returns 200 with valid auth', async () => {
    const res = await request(app).get('/api/kpi').set(authHeader());
    expect(res.status).toBe(200);
  });

  test('KPI date filters do not crash', async () => {
    const res = await request(app).get('/api/kpi?start_date=2026-05-01&end_date=2026-05-31').set(authHeader());
    expect(res.status).not.toBe(500);
  });
});

describe('POST /api/orders', () => {
  test('Requires auth', async () => {
    const res = await request(app).post('/api/orders').send({ amount: 100 });
    expect([401, 403]).toContain(res.status);
  });

  test('Returns 400 or 422 for missing fields', async () => {
    const res = await request(app).post('/api/orders').set(authHeader()).send({});
    expect([400, 422]).toContain(res.status);
  });
});

describe('Security headers', () => {
  test('X-Powered-By header is disabled', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
