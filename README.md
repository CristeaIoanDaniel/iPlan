# iPlan
iPlan is a social travel and booking platform where instead of just booking a room, travelers can discover complete, community-recommended multi-day trip itineraries, save their favorite routes, and book stays and activities directly within one unified platform. 

## Tests

Run the automated tests with:

```sh
npm test
```

Tests use Jest and Supertest. API route tests exercise the Express app over HTTP while replacing PostgreSQL queries with an in-memory test implementation; they do not connect to PostgreSQL or verify database-backed behavior.

## Authentication API

The registration endpoint is `POST /api/auth/register` and expects a JSON body with `name`, `email`, and `password`. Opening this URL in a browser sends a `GET` request, which is not supported; use an API client or send a `POST` request instead.

Registration and login use the PostgreSQL `users` table. Before starting the server, apply database migrations with `npx knex migrate:latest`; make sure the database settings used by `knexfile.js` point to the same database as the server. The migration adds user foreign keys to itineraries and bookings, so it will fail if existing records contain `user_id` values that do not belong to a user. Resolve any such legacy rows before retrying the migration.

## HTTP security

Helmet adds security-related HTTP response headers, including protections against MIME-type sniffing and framing. Authentication routes (`/api/auth/login` and `/api/auth/register`) share a limit of 10 requests per client IP per 15-minute window; requests over the limit receive HTTP 429. The default rate-limit store is in memory, so production deployments with multiple server instances should use a shared store. If running behind a reverse proxy, configure Express `trust proxy` only for the actual trusted proxy so client IP-based limits remain accurate.

## CORS and request validation

Set `CORS_ORIGINS` in `vault.env` to a comma-separated list of exact trusted frontend origins (for example, `http://localhost:5173,https://app.example.com`). An origin includes the scheme, host, and optional port, but no path or trailing slash. An empty list allows no browser origins. CORS does not authenticate API requests or block non-browser clients.

Authentication and itinerary request bodies are validated by Zod schemas. Text fields are trimmed and length/type constrained, and strict object schemas reject unknown properties (including client-supplied ownership fields). The services and bookings routes still need equivalent request schemas. SQL injection protection comes from parameterized PostgreSQL queries; do not strip SQL-looking characters from normal text, since that is unreliable and can damage legitimate input. This API uses PostgreSQL, so NoSQL-specific query sanitization is not applicable.

## Itinerary collaborators

Apply database migrations with `npx knex migrate:latest` before using collaboration endpoints. Public itineraries remain viewable without signing in. Private itineraries are visible only to their owner and invited collaborators. Collaborators can have the `viewer` or `editor` role; editors can update itinerary details, while only the owner can delete the itinerary or manage collaborators.

- `GET /api/itineraries/:id/collaborators` — owner lists collaborators.
- `POST /api/itineraries/:id/collaborators` — owner invites an existing account by email, with optional `role` (`viewer` by default, or `editor`).
- `PATCH /api/itineraries/:id/collaborators/:userId` — owner changes a collaborator’s role.
- `DELETE /api/itineraries/:id/collaborators/:userId` — owner removes a collaborator.

## Itinerary items

Apply migrations before using itinerary item endpoints. Owners and editor collaborators can create, update, and delete items; viewers can list and view items. Public itineraries and their items can be read without authentication.

- `GET /api/itineraries/:id/items` and `GET /api/itineraries/:id/items/:itemId` — list or view items.
- `POST /api/itineraries/:id/items` — add a `flight`, `hotel`, `activity`, or `note`.
- `PUT /api/itineraries/:id/items/:itemId` — update the title, description, or dated-item range.
- `DELETE /api/itineraries/:id/items/:itemId` — delete an item.

Flights, hotels, and activities require `starts_at` and `ends_at` ISO 8601 timestamps with a timezone, with the end after the start and the whole range inside the itinerary's date range. Notes have no dates. The database migration also enforces allowed item types and valid ranges.
