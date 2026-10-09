const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const pool = require('./config/db');
const app = require('./index');

let server;
let baseUrl;
let originalQuery;
const usersByEmail = new Map();

before(async () => {
    originalQuery = pool.query;
    pool.query = async (query, values) => {
        if (query.includes('INSERT INTO users')) {
            const [name, email, password_hash] = values;
            if (usersByEmail.has(email)) {
                const error = new Error('duplicate email');
                error.code = '23505';
                throw error;
            }
            const user = {
                id: randomUUID(),
                name,
                email,
                role: 'user',
                password_hash,
            };
            usersByEmail.set(email, user);
            return { rows: [{ id: user.id, name, email, role: user.role }] };
        }
        if (query.includes('FROM users')) {
            const user = usersByEmail.get(values[0]);
            return { rows: user ? [user] : [] };
        }
        throw new Error(`Unexpected query in auth route test: ${query}`);
    };

    server = app.listen(0);
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
    pool.query = originalQuery;
});

test('POST /api/auth/register - succeeds with valid user data', async()=>{
    const response = await fetch(`${baseUrl}/api/auth/register`,{
        method:'POST',
        headers:{
            'Content-type' : 'application/json'
        },
        body: JSON.stringify({
            email : 'testuser@example.com',
            password: 'Password123',
            name : 'Test user '
        })
    });
    assert.equal(response.status,201);
    const data = await response.json();
    assert.match(data.data.user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.equal(data.data.user.email, 'testuser@example.com');
    assert.match(usersByEmail.get('testuser@example.com').password_hash, /^scrypt\$/);
    assert.ok(data.data.token);
});

test('POST /api/auth/register - rejects invalid user data', async()=>{
    const response = await fetch(`${baseUrl}/api/auth/register`,{
        method:'POST',
        headers:{
            'Content-Type' : 'application/json'
        },
        body: JSON.stringify({
            email :'invalid_user',
            password : '123',
        })
    });
    assert.equal(response.status,400);
    const data = await response.json();
    assert.equal(data.status, 'fail');
});

test('POST /api/auth/register - rejects an email that is already registered', async()=>{
    const response = await fetch(`${baseUrl}/api/auth/register`,{
        method:'POST',
        headers:{
            'Content-Type' : 'application/json'
        },
        body: JSON.stringify({
            name: 'Test User',
            email: 'TESTUSER@example.com',
            password: 'Password123',
        })
    });
    assert.equal(response.status,409);
});

test('POST /api/auth/login - succeeds with valid credentials', async()=>{
    const response = await fetch(`${baseUrl}/api/auth/login`,{
        method : 'POST',
        headers:{
            'Content-Type' : 'application/json'
        },
        body:JSON.stringify({
            email : 'testuser@example.com',
            password: 'Password123',
        })
    });
    assert.equal(response.status,200);
    const data = await response.json();
    assert.ok(data.data.token);
});

test('POST /api/auth/login - rejects an incorrect password', async()=>{
    const response = await fetch(`${baseUrl}/api/auth/login`,{
        method:'POST',
        headers:{
            'Content-Type' : 'application/json'
        },
        body:JSON.stringify({
            email : 'testuser@example.com',
            password: 'WrongPassword123',
        })
    });
    assert.equal(response.status,401);
});
