const { afterAll, beforeAll, test } = require('@jest/globals');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const pool = require('./config/db');
const { generateToken } = require('./src/middleware/auth.middleware');
const app = require('./index');

let originalQuery;
const usersByEmail = new Map();
const usersById = new Map();
const itinerariesById = new Map();
const collaboratorsByItinerary = new Map();
const itemsById = new Map();
const owner = { id: randomUUID(), name: 'Owner User', email: 'owner@example.com', role: 'user' };
const viewer = { id: randomUUID(), name: 'Viewer User', email: 'viewer@example.com', role: 'user' };
const editor = { id: randomUUID(), name: 'Editor User', email: 'editor@example.com', role: 'user' };

const fetchApi = async (path, options = {}) => {
    const method = (options.method || 'GET').toLowerCase();
    let testRequest = request(app)[method](path);
    for (const [name, value] of Object.entries(options.headers || {})) {
        testRequest = testRequest.set(name, value);
    }
    if (options.body) {
        testRequest = testRequest.send(JSON.parse(options.body));
    }
    const response = await testRequest;
    return {
        status: response.status,
        headers: {
            get(name) {
                return response.headers[name.toLowerCase()] || null;
            },
        },
        async json() {
            return response.body;
        },
    };
};

beforeAll(async () => {
    for (const user of [owner, viewer, editor]) {
        usersByEmail.set(user.email, user);
        usersById.set(user.id, user);
    }

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
            usersById.set(user.id, user);
            return { rows: [{ id: user.id, name, email, role: user.role }] };
        }
        if (query.includes('SELECT id, name, email FROM users WHERE email')) {
            const user = usersByEmail.get(values[0]);
            return { rows: user ? [{ id: user.id, name: user.name, email: user.email }] : [] };
        }
        if (query.includes('FROM users')) {
            const user = usersByEmail.get(values[0]);
            return { rows: user ? [user] : [] };
        }
        if (query.includes('SELECT id FROM itineraries WHERE id = $1 AND user_id = $2')) {
            const itinerary = itinerariesById.get(values[0]);
            return {
                rows: itinerary && itinerary.user_id === values[1] ? [{ id: itinerary.id }] : [],
            };
        }
        if (query.includes('SELECT id FROM itineraries')) {
            const itinerary = itinerariesById.get(values[0]);
            const role = collaboratorsByItinerary.get(values[0])?.get(values[1]);
            return {
                rows: itinerary
                    && (itinerary.user_id === values[1] || role === 'editor')
                    ? [{ id: itinerary.id }]
                    : [],
            };
        }
        if (query.includes('SELECT i.id, i.user_id, i.is_public, i.start_date, i.end_date')) {
            const itinerary = itinerariesById.get(values[0]);
            const role = collaboratorsByItinerary.get(values[0])?.get(values[1]);
            return {
                rows: itinerary
                    ? [{ ...itinerary, collaborator_role: role || null }]
                    : [],
            };
        }
        if (query.includes('SELECT DISTINCT i.*')) {
            const visible = [...itinerariesById.values()].filter((itinerary) => (
                itinerary.is_public
                || itinerary.user_id === values[0]
                || collaboratorsByItinerary.get(itinerary.id)?.has(values[0])
            ));
            return { rows: visible };
        }
        if (query.includes('SELECT i.*, c.role AS collaborator_role')) {
            const itinerary = itinerariesById.get(values[0]);
            const role = collaboratorsByItinerary.get(values[0])?.get(values[1]);
            const accessible = itinerary && (
                itinerary.is_public
                || itinerary.user_id === values[1]
                || role
            );
            return {
                rows: accessible
                    ? [{ ...itinerary, collaborator_role: role || null }]
                    : [],
            };
        }
        if (query.includes('INSERT INTO itineraries')) {
            const [userId, title, description, destination, startDate, endDate] = values;
            const itinerary = {
                id: randomUUID(),
                user_id: userId,
                title,
                description,
                destination,
                start_date: startDate,
                end_date: endDate,
                is_public: false,
                created_at: new Date().toISOString(),
            };
            itinerariesById.set(itinerary.id, itinerary);
            collaboratorsByItinerary.set(itinerary.id, new Map());
            return { rows: [itinerary] };
        }
        if (query.includes('UPDATE itineraries')) {
            const [title, description, destination, startDate, endDate, itineraryId, userId] = values;
            const itinerary = itinerariesById.get(itineraryId);
            const collaboratorRole = collaboratorsByItinerary.get(itineraryId)?.get(userId);
            if (!itinerary || (itinerary.user_id !== userId && collaboratorRole !== 'editor')) {
                return { rows: [] };
            }
            const nextStartDate = startDate || itinerary.start_date;
            const nextEndDate = endDate || itinerary.end_date;
            const hasOutOfRangeItem = [...itemsById.values()].some((item) => (
                item.itinerary_id === itineraryId
                && item.item_type !== 'note'
                && (
                    item.starts_at.slice(0, 10) < nextStartDate
                    || item.ends_at.slice(0, 10) > nextEndDate
                )
            ));
            if (hasOutOfRangeItem) return { rows: [] };
            for (const [key, value] of Object.entries({
                title, description, destination, start_date: startDate, end_date: endDate,
            })) {
                if (value !== undefined && value !== null) itinerary[key] = value;
            }
            return { rows: [itinerary] };
        }
        if (query.includes('DELETE FROM itineraries')) {
            const [itineraryId, userId] = values;
            const itinerary = itinerariesById.get(itineraryId);
            if (!itinerary || itinerary.user_id !== userId) return { rows: [] };
            itinerariesById.delete(itineraryId);
            collaboratorsByItinerary.delete(itineraryId);
            return { rows: [itinerary] };
        }
        if (query.includes('SELECT c.user_id, u.name, u.email, c.role')) {
            const entries = [...(collaboratorsByItinerary.get(values[0]) || new Map())];
            return {
                rows: entries.map(([userId, role]) => ({
                    user_id: userId,
                    name: usersById.get(userId).name,
                    email: usersById.get(userId).email,
                    role,
                })),
            };
        }
        if (query.includes('INSERT INTO itinerary_collaborators')) {
            const [itineraryId, userId, role] = values;
            let itineraryCollaborators = collaboratorsByItinerary.get(itineraryId);
            if (!itineraryCollaborators) {
                itineraryCollaborators = new Map();
                collaboratorsByItinerary.set(itineraryId, itineraryCollaborators);
            }
            if (itineraryCollaborators.has(userId)) return { rows: [] };
            itineraryCollaborators.set(userId, role);
            return { rows: [{ user_id: userId, role, created_at: new Date().toISOString() }] };
        }
        if (query.includes('UPDATE itinerary_collaborators')) {
            const [itineraryId, userId, role] = values;
            const itineraryCollaborators = collaboratorsByItinerary.get(itineraryId);
            if (!itineraryCollaborators?.has(userId)) return { rows: [] };
            itineraryCollaborators.set(userId, role);
            return { rows: [{ user_id: userId, role }] };
        }
        if (query.includes('DELETE FROM itinerary_collaborators')) {
            const [itineraryId, userId] = values;
            const itineraryCollaborators = collaboratorsByItinerary.get(itineraryId);
            if (!itineraryCollaborators?.has(userId)) return { rows: [] };
            itineraryCollaborators.delete(userId);
            return { rows: [{ user_id: userId }] };
        }
        if (query.includes('INSERT INTO itinerary_items')) {
            const [itineraryId, itemType, title, description, startsAt, endsAt, userId] = values;
            const itinerary = itinerariesById.get(itineraryId);
            const role = collaboratorsByItinerary.get(itineraryId)?.get(userId);
            if (!itinerary || (itinerary.user_id !== userId && role !== 'editor')) {
                return { rows: [] };
            }
            const item = {
                id: randomUUID(),
                itinerary_id: itineraryId,
                item_type: itemType,
                title,
                description,
                starts_at: startsAt,
                ends_at: endsAt,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            itemsById.set(item.id, item);
            return { rows: [item] };
        }
        if (query.includes('SELECT id, itinerary_id, item_type, title, description, starts_at, ends_at')) {
            if (query.includes('WHERE itinerary_id = $1 AND id = $2')) {
                const item = itemsById.get(values[1]);
                return {
                    rows: item && item.itinerary_id === values[0] ? [item] : [],
                };
            }
            return {
                rows: [...itemsById.values()]
                    .filter((item) => item.itinerary_id === values[0]),
            };
        }
        if (query.includes('SELECT * FROM itinerary_items WHERE itinerary_id = $1 AND id = $2')) {
            const item = itemsById.get(values[1]);
            return { rows: item && item.itinerary_id === values[0] ? [item] : [] };
        }
        if (query.includes('UPDATE itinerary_items ii')) {
            const [title, description, startsAt, endsAt, itemId, itineraryId, userId] = values;
            const item = itemsById.get(itemId);
            const itinerary = itinerariesById.get(itineraryId);
            const role = collaboratorsByItinerary.get(itineraryId)?.get(userId);
            if (!item || item.itinerary_id !== itineraryId || !itinerary
                || (itinerary.user_id !== userId && role !== 'editor')) {
                return { rows: [] };
            }
            if (title !== null) item.title = title;
            if (description !== null) item.description = description;
            if (startsAt !== null) item.starts_at = startsAt;
            if (endsAt !== null) item.ends_at = endsAt;
            return { rows: [item] };
        }
        if (query.includes('DELETE FROM itinerary_items ii')) {
            const [itemId, itineraryId, userId] = values;
            const item = itemsById.get(itemId);
            const itinerary = itinerariesById.get(itineraryId);
            const role = collaboratorsByItinerary.get(itineraryId)?.get(userId);
            if (!item || item.itinerary_id !== itineraryId || !itinerary
                || (itinerary.user_id !== userId && role !== 'editor')) {
                return { rows: [] };
            }
            itemsById.delete(itemId);
            return { rows: [{ id: itemId }] };
        }
        throw new Error(`Unexpected query in auth route test: ${query}`);
    };
});

afterAll(() => {
    pool.query = originalQuery;
});

test('POST /api/auth/register - succeeds with valid user data', async()=>{
    const response = await fetchApi('/api/auth/register',{
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
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    const data = await response.json();
    assert.match(data.data.user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.equal(data.data.user.email, 'testuser@example.com');
    assert.match(usersByEmail.get('testuser@example.com').password_hash, /^scrypt\$/);
    assert.ok(data.data.token);
});

test('POST /api/auth/register - rejects invalid user data', async()=>{
    const response = await fetchApi('/api/auth/register',{
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
    const response = await fetchApi('/api/auth/register',{
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
    const response = await fetchApi('/api/auth/login',{
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
    const response = await fetchApi('/api/auth/login',{
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

test('itinerary owners can share; viewers cannot edit, editors can edit, and only owners can delete', async()=>{
    const ownerToken = generateToken(owner);
    const viewerToken = generateToken(viewer);
    const editorToken = generateToken(editor);

    const createResponse = await fetchApi('/api/itineraries', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: 'Shared trip',
            description: 'A trip shared with collaborators',
            destination: 'Rome',
            start_date: '2026-11-10',
            end_date: '2026-11-12',
        }),
    });
    assert.equal(createResponse.status, 201);
    const { data: itinerary } = await createResponse.json();

    const addViewerResponse = await fetchApi(`/api/itineraries/${itinerary.id}/collaborators`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: viewer.email, role: 'viewer' }),
    });
    assert.equal(addViewerResponse.status, 201);

    const editorCannotShareResponse = await fetchApi(`/api/itineraries/${itinerary.id}/collaborators`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${editorToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'new-collaborator@example.com', role: 'viewer' }),
    });
    assert.equal(editorCannotShareResponse.status, 404);

    const duplicateViewerResponse = await fetchApi(`/api/itineraries/${itinerary.id}/collaborators`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: viewer.email, role: 'viewer' }),
    });
    assert.equal(duplicateViewerResponse.status, 409);

    const addEditorResponse = await fetchApi(`/api/itineraries/${itinerary.id}/collaborators`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: editor.email, role: 'editor' }),
    });
    assert.equal(addEditorResponse.status, 201);

    const collaboratorListResponse = await fetchApi(`/api/itineraries/${itinerary.id}/collaborators`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(collaboratorListResponse.status, 200);
    assert.equal((await collaboratorListResponse.json()).count, 2);

    const viewerReadResponse = await fetchApi(`/api/itineraries/${itinerary.id}`, {
        headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(viewerReadResponse.status, 200);

    const viewerUpdateResponse = await fetchApi(`/api/itineraries/${itinerary.id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${viewerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Viewer cannot change this' }),
    });
    assert.equal(viewerUpdateResponse.status, 404);

    const editorUpdateResponse = await fetchApi(`/api/itineraries/${itinerary.id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${editorToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Updated by editor' }),
    });
    assert.equal(editorUpdateResponse.status, 200);

    const editorDeleteResponse = await fetchApi(`/api/itineraries/${itinerary.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${editorToken}` },
    });
    assert.equal(editorDeleteResponse.status, 404);

    const ownerDeleteResponse = await fetchApi(`/api/itineraries/${itinerary.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(ownerDeleteResponse.status, 200);
});

test('itinerary items support authorized CRUD and enforce itinerary date ranges', async()=>{
    const ownerToken = generateToken(owner);
    const viewerToken = generateToken(viewer);
    const editorToken = generateToken(editor);
    const createItineraryResponse = await fetchApi('/api/itineraries', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: 'Items trip',
            destination: 'Lisbon',
            start_date: '2026-11-10',
            end_date: '2026-11-12',
        }),
    });
    assert.equal(createItineraryResponse.status, 201);
    const { data: itinerary } = await createItineraryResponse.json();

    const addEditorResponse = await fetchApi(`/api/itineraries/${itinerary.id}/collaborators`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: editor.email, role: 'editor' }),
    });
    assert.equal(addEditorResponse.status, 201);

    const addViewerResponse = await fetchApi(`/api/itineraries/${itinerary.id}/collaborators`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: viewer.email, role: 'viewer' }),
    });
    assert.equal(addViewerResponse.status, 201);

    const createFlightResponse = await fetchApi(`/api/itineraries/${itinerary.id}/items`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${editorToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: 'flight',
            title: 'Flight to Lisbon',
            starts_at: '2026-11-10T09:00:00Z',
            ends_at: '2026-11-10T12:00:00Z',
        }),
    });
    assert.equal(createFlightResponse.status, 201);
    const { data: flight } = await createFlightResponse.json();

    const createNoteResponse = await fetchApi(`/api/itineraries/${itinerary.id}/items`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'note', title: 'Bring a rain jacket' }),
    });
    assert.equal(createNoteResponse.status, 201);

    const outOfRangeResponse = await fetchApi(`/api/itineraries/${itinerary.id}/items`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: 'activity',
            title: 'Outside the trip',
            starts_at: '2026-11-13T09:00:00Z',
            ends_at: '2026-11-13T10:00:00Z',
        }),
    });
    assert.equal(outOfRangeResponse.status, 400);

    const shrinkItineraryResponse = await fetchApi(`/api/itineraries/${itinerary.id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ start_date: '2026-11-11' }),
    });
    assert.equal(shrinkItineraryResponse.status, 409);

    const viewerCreateResponse = await fetchApi(`/api/itineraries/${itinerary.id}/items`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${generateToken(viewer)}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'note', title: 'Viewer write attempt' }),
    });
    assert.equal(viewerCreateResponse.status, 404);

    const updateResponse = await fetchApi(`/api/itineraries/${itinerary.id}/items/${flight.id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${editorToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Updated flight' }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).data.title, 'Updated flight');

    const listResponse = await fetchApi(`/api/itineraries/${itinerary.id}/items`, {
        headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(listResponse.status, 200);
    assert.equal((await listResponse.json()).count, 2);

    const deleteResponse = await fetchApi(`/api/itineraries/${itinerary.id}/items/${flight.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${editorToken}` },
    });
    assert.equal(deleteResponse.status, 200, JSON.stringify(await deleteResponse.json()));
});

test('authentication endpoints return 429 after the request limit', async()=>{
    let response;

    for (let attempt = 0; attempt < 6; attempt += 1) {
        response = await fetchApi('/api/auth/register',{
            method:'POST',
            headers:{
                'Content-Type' : 'application/json'
            },
            body: JSON.stringify({
                name: 'Test User',
                email: 'testuser@example.com',
                password: 'Password123',
            })
        });
    }

    assert.equal(response.status,429);
    assert.match(response.headers.get('ratelimit-policy'), /10/);
    const data = await response.json();
    assert.equal(data.status, 'fail');
});
