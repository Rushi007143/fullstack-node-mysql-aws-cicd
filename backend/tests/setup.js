process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3307';
process.env.DB_NAME = process.env.DB_NAME || 'testdb';
process.env.DB_USER = process.env.DB_USER || 'ci_user';
process.env.DB_PASS = process.env.DB_PASS || 'ci_pass_123';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-jwt-secret-minimum-32-chars-long-for-testing';
process.env.JWT_EXPIRES_IN = '1h';
process.env.FRONTEND_URL = '*';

global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: console.warn,
  error: console.error,
};

jest.setTimeout(30000);
