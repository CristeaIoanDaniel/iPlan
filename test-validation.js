const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createItinerarySchema,
} = require('./src/schemas/itinerary.schema');
const {
  registerSchema,
  loginSchema,
} = require('./src/schemas/auth.schema');
const { validate } = require('./src/middleware/validate.middleware');
const {
  authenticate,
  generateToken,
} = require('./src/middleware/auth.middleware');

const validItinerary = {
  title: 'Weekend in Rome',
  start_date: '2026-10-10',
  end_date: '2026-10-12',
};

function runValidation(schema, request) {
  const response = {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  validate(schema)(request, response, () => {
    nextCalled = true;
  });

  return { response, nextCalled, request };
}

test('itinerary validation rejects an end date before the start date', () => {
  const { response, nextCalled } = runValidation(
    createItinerarySchema,
    {
      body: {
        ...validItinerary,
        end_date: '2026-10-05',
      },
      query: {},
      params: {},
    },
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.status, 'fail');
  assert.ok(response.body.errors.some((error) => error.field === 'end_date'));
  assert.equal(nextCalled, false);
});

test('itinerary validation applies defaults to valid input', () => {
  const { response, nextCalled, request } = runValidation(
    createItinerarySchema,
    {
      body: { ...validItinerary },
      query: {},
      params: {},
    },
  );

  assert.equal(response.statusCode, undefined);
  assert.equal(nextCalled, true);
  assert.equal(request.body.is_public, false);
});

test('registration schema rejects invalid email and weak password', () => {
  const result = registerSchema.safeParse({
    body: {
      name: 'Alex',
      email: 'not-an-email',
      password: 'weak',
    },
  });

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path.includes('email')));
  assert.ok(result.error.issues.some((issue) => issue.path.includes('password')));
});

test('registration schema accepts valid credentials and trims values', () => {
  const result = registerSchema.safeParse({
    body: {
      name: ' Alex ',
      email: ' alex@example.com ',
      password: 'StrongPass1',
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.body.name, 'Alex');
  assert.equal(result.data.body.email, 'alex@example.com');
});

test('login schema requires an email and password', () => {
  const result = loginSchema.safeParse({
    body: { email: 'alex@example.com' },
  });

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path.includes('password')));
});

test('auth middleware rejects requests without a bearer token', () => {
  const request = { headers: {} };
  let receivedError;

  authenticate(request, {}, (error) => {
    receivedError = error;
  });

  assert.equal(receivedError.statusCode, 401);
  assert.match(receivedError.message, /Missing or invalid token format/);
});

test('auth middleware accepts a valid bearer token and sets req.user', () => {
  const user = { id: 'usr_test', role: 'user' };
  const request = {
    headers: { authorization: `Bearer ${generateToken(user)}` },
  };
  let nextCalled = false;

  authenticate(request, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(request.user.id, user.id);
  assert.equal(request.user.role, user.role);
});

test('auth middleware rejects an invalid bearer token', () => {
  const request = {
    headers: { authorization: 'Bearer not-a-valid-token' },
  };
  let receivedError;

  authenticate(request, {}, (error) => {
    receivedError = error;
  });

  assert.equal(receivedError.statusCode, 401);
  assert.match(receivedError.message, /Invalid token/);
});

test('auth middleware rejects an expired bearer token', () => {
  const request = {
    headers: { authorization: `Bearer ${generateToken({ id: 'usr_test' }, '-1s')}` },
  };
  let receivedError;

  authenticate(request, {}, (error) => {
    receivedError = error;
  });

  assert.equal(receivedError.statusCode, 401);
  assert.match(receivedError.message, /Token expired/);
});
