const request = require('supertest');
const { authHeader } = require('./helpers');
const { calculateGST, calculateNetPayout } = require('../src/utils/calculations');
let app;

beforeAll(() => { app = require('../src/app'); });
afterAll(async () => { if (app && app.closeConnections) await app.closeConnections(); });

describe('GST / Tax Calculations', () => {
  test('GST rate is exactly 18 percent', () => {
    expect(calculateGST(1000)).toBeCloseTo(180, 2);
  });

  test('GST on zero commission is zero', () => {
    expect(calculateGST(0)).toBe(0);
  });

  test('GST never exceeds base commission', () => {
    [100, 500, 1000, 5000, 50000].forEach((commission) => expect(calculateGST(commission)).toBeLessThan(commission));
  });
});

describe('Net Payout Calculations', () => {
  test('Net payout is less than gross revenue', () => {
    expect(calculateNetPayout(10000, 0.20)).toBeLessThan(10000);
  });

  test('Net payout equals expected value', () => {
    expect(calculateNetPayout(10000, 0.20)).toBeCloseTo(7640, 1);
  });

  test('Net payout is always positive for valid orders', () => {
    [{ gross: 500, rate: 0.20 }, { gross: 1000, rate: 0.24 }, { gross: 2000, rate: 0.22 }, { gross: 10000, rate: 0.30 }]
      .forEach(({ gross, rate }) => expect(calculateNetPayout(gross, rate)).toBeGreaterThan(0));
  });
});

describe('No endpoint returns 500 on normal authenticated request', () => {
  test.each(['/api/orders', '/api/users', '/api/kpi'])('GET %s does not return 500', async (endpoint) => {
    const res = await request(app).get(endpoint).set(authHeader());
    expect(res.status).not.toBe(500);
  });
});
