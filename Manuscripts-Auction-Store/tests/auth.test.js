const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { connectToDatabase } = require('../config/db');

let app;
let mongoServer;

async function createAuthenticatedAgent() {
  const agent = request.agent(app);
  const csrfResponse = await agent.get('/api/auth/csrf-token');
  return {
    agent,
    csrfToken: csrfResponse.body.csrfToken,
  };
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-for-csrf';
  process.env.MONGO_URI = mongoServer.getUri('rarefinds');

  app = require('../server');
  await connectToDatabase();
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('successful registration creates a user', async () => {
  const { agent, csrfToken } = await createAuthenticatedAgent();

  const response = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Alice Example', email: 'alice@example.com', password: 'password123' });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, 'alice@example.com');
  assert.equal(response.body.user.role, 'user');
});

test('duplicate email registration is rejected', async () => {
  const { agent, csrfToken } = await createAuthenticatedAgent();

  const response = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Alice Duplicate', email: 'alice@example.com', password: 'password123' });

  assert.equal(response.status, 409);
  assert.match(response.body.message, /already exists/i);
});

test('invalid registration data is rejected', async () => {
  const { agent, csrfToken } = await createAuthenticatedAgent();

  const response = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'A', email: 'not-an-email', password: 'short' });

  assert.equal(response.status, 400);
});

test('successful login creates a user session', async () => {
  const { agent, csrfToken } = await createAuthenticatedAgent();

  const registerResponse = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Bob Example', email: 'bob@example.com', password: 'password123' });

  const loginTokenResponse = await agent.get('/api/auth/csrf-token');

  const loginResponse = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', loginTokenResponse.body.csrfToken)
    .send({ email: 'bob@example.com', password: 'password123' });

  const sessionResponse = await agent.get('/api/auth/session');

  assert.equal(registerResponse.status, 201);
  assert.equal(loginResponse.status, 200);
  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionResponse.body.user.email, 'bob@example.com');
});

test('incorrect password is rejected without revealing user existence', async () => {
  const { agent, csrfToken } = await createAuthenticatedAgent();

  await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Charlie Example', email: 'charlie@example.com', password: 'password123' });

  const loginTokenResponse = await agent.get('/api/auth/csrf-token');
  const response = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', loginTokenResponse.body.csrfToken)
    .send({ email: 'charlie@example.com', password: 'wrongpassword' });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Invalid email or password.');
});

test('logout destroys the session and clears authentication', async () => {
  const { agent, csrfToken } = await createAuthenticatedAgent();

  await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Dana Example', email: 'dana@example.com', password: 'password123' });

  const loginToken = (await agent.get('/api/auth/csrf-token')).body.csrfToken;
  await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', loginToken)
    .send({ email: 'dana@example.com', password: 'password123' });

  const logoutToken = (await agent.get('/api/auth/csrf-token')).body.csrfToken;
  const logoutResponse = await agent
    .post('/api/auth/logout')
    .set('X-CSRF-Token', logoutToken)
    .send();

  const sessionResponse = await agent.get('/api/auth/session');

  assert.equal(logoutResponse.status, 200);
  assert.equal(sessionResponse.status, 401);
});

test('protected routes reject unauthenticated access', async () => {
  const agent = request.agent(app);
  const response = await agent.get('/api/auth/session');

  assert.equal(response.status, 401);
});

test('role restricted routes reject access for the wrong role', async () => {
  const { agent, csrfToken } = await createAuthenticatedAgent();

  await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Eve User', email: 'eve@example.com', password: 'password123' });

  const loginToken = (await agent.get('/api/auth/csrf-token')).body.csrfToken;
  await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', loginToken)
    .send({ email: 'eve@example.com', password: 'password123' });

  const response = await agent.get('/api/auth/admin-only');

  assert.equal(response.status, 403);
});

test('session persists after a page refresh on the same browser session', async () => {
  const { agent, csrfToken } = await createAuthenticatedAgent();

  await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Frank User', email: 'frank@example.com', password: 'password123' });

  const loginToken = (await agent.get('/api/auth/csrf-token')).body.csrfToken;
  await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', loginToken)
    .send({ email: 'frank@example.com', password: 'password123' });

  const firstSession = await agent.get('/api/auth/session');
  const secondSession = await agent.get('/api/auth/session');

  assert.equal(firstSession.status, 200);
  assert.equal(secondSession.status, 200);
  assert.equal(secondSession.body.user.email, 'frank@example.com');
});

test('MongoDB connection failure is handled', async () => {
  const originalMongoUri = process.env.MONGO_URI;
  await mongoose.disconnect();
  process.env.MONGO_URI = 'mongodb://127.0.0.1:65535/does-not-exist';

  await assert.rejects(async () => {
    await connectToDatabase();
  }, /MongoDB connection failed|MONGO_URI|ECONNREFUSED|openUri/);

  process.env.MONGO_URI = originalMongoUri;
  await connectToDatabase();
});
