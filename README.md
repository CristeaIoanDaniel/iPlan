# iPlan
iPlan is a social travel and booking platform where instead of just booking a room, travelers can discover complete, community-recommended multi-day trip itineraries, save their favorite routes, and book stays and activities directly within one unified platform. 

## Tests

Run the unit tests with:

```sh
npm test
```

The current tests cover itinerary and authentication input schemas, validation middleware, and JWT authentication middleware. They do not connect to PostgreSQL or verify database-backed routes.

## Authentication API

The registration endpoint is `POST /api/auth/register` and expects a JSON body with `name`, `email`, and `password`. Opening this URL in a browser sends a `GET` request, which is not supported; use an API client or send a `POST` request instead.

Registration and login use the PostgreSQL `users` table. Before starting the server, apply database migrations with `npx knex migrate:latest`; make sure the database settings used by `knexfile.js` point to the same database as the server. The migration adds user foreign keys to itineraries and bookings, so it will fail if existing records contain `user_id` values that do not belong to a user. Resolve any such legacy rows before retrying the migration.
