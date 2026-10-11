const assert = require('node:assert/strict');
const {
  createItinerarySchema,
  updateItinerarySchema,
  itineraryIdSchema,
} = require('./src/schemas/itinerary.schema');
const {
  createItemSchema,
  updateItemSchema,
} = require('./src/schemas/itinerary-item.schema');
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
  destination: 'Rome',
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

test('itinerary validation trims text and rejects unknown or object-shaped input', () => {
  const validResult = createItinerarySchema.safeParse({
    body: {
      ...validItinerary,
      title: ' Weekend in Rome ',
      destination: ' Rome ',
    },
  });

  assert.equal(validResult.success, true);
  assert.equal(validResult.data.body.title, 'Weekend in Rome');
  assert.equal(validResult.data.body.destination, 'Rome');

  const invalidResult = createItinerarySchema.safeParse({
    body: {
      ...validItinerary,
      title: { $ne: null },
      user_id: 'attacker-controlled-id',
    },
  });

  assert.equal(invalidResult.success, false);
});

test('itinerary update validation requires fields and a UUID route ID', () => {
  assert.equal(updateItinerarySchema.safeParse({
    params: { id: 'not-a-uuid' },
    body: { title: 'Updated title' },
  }).success, false);

  assert.equal(updateItinerarySchema.safeParse({
    params: { id: '123e4567-e89b-12d3-a456-426614174000' },
    body: {},
  }).success, false);

  assert.equal(itineraryIdSchema.safeParse({
    params: { id: '123e4567-e89b-12d3-a456-426614174000' },
  }).success, true);
});

test('itinerary item schemas require dated item ranges and leave notes undated', () => {
  const params = { id: '123e4567-e89b-12d3-a456-426614174000' };

  assert.equal(createItemSchema.safeParse({
    params,
    body: {
      type: 'flight',
      title: 'Flight',
      starts_at: '2026-10-10T09:00:00Z',
      ends_at: '2026-10-10T12:00:00Z',
    },
  }).success, true);

  assert.equal(createItemSchema.safeParse({
    params,
    body: { type: 'activity', title: 'Missing dates' },
  }).success, false);

  assert.equal(createItemSchema.safeParse({
    params,
    body: {
      type: 'note',
      title: 'Packing list',
      starts_at: '2026-10-10T09:00:00Z',
    },
  }).success, false);

  assert.equal(updateItemSchema.safeParse({
    params: { ...params, itemId: '123e4567-e89b-12d3-a456-426614174001' },
    body: { ends_at: '2026-10-10T08:00:00Z' },
  }).success, true);
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

test('auth schemas reject unexpected and object-shaped properties', () => {
  const result = registerSchema.safeParse({
    body: {
      name: 'Alex',
      email: { $ne: null },
      password: 'StrongPass1',
      role: 'admin',
    },
  });

  assert.equal(result.success, false);
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
