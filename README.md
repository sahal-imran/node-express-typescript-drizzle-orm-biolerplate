# Ciao Away server: beginner's guide

This folder contains the backend API: the program that receives HTTP requests, validates data, applies user-management rules, and reads or writes PostgreSQL. It currently supports creating, listing, retrieving, updating, and soft-deleting users.

## Contents

- [Start the application](#start-the-application)
- [Environment settings](#environment-settings)
- [What the technologies do](#what-the-technologies-do)
- [Folder and file map](#folder-and-file-map)
- [How startup and requests work](#how-startup-and-requests-work)
- [Function-based architecture](#function-based-architecture)
- [Database and migrations](#database-and-migrations)
- [API reference and examples](#api-reference-and-examples)
- [Validation and current behavior](#validation-and-current-behavior)
- [Middleware, errors, and logging](#middleware-errors-and-logging)
- [TypeScript and the build](#typescript-and-the-build)
- [Tests and quality checks](#tests-and-quality-checks)
- [All npm commands](#all-npm-commands)
- [Git setup, automatic checks, and commit messages](#git-setup-automatic-checks-and-commit-messages)
- [Making your first change](#making-your-first-change)
- [Troubleshooting](#troubleshooting)

## Start the application

### 1. Open a terminal in this folder

If your VS Code terminal starts in the parent `Ciao Away` folder:

```bash
cd server
```

Run all subsequent commands from `server`, unless a step explicitly says otherwise. This matters because configuration, migration, and build paths are relative to this folder.

### 2. Select Node.js and install dependencies

The project requires Node.js **24.x** and npm **11 or newer**. Its `packageManager` field records npm `11.9.0`. `.nvmrc` and `.node-version` both select Node 24.

If you already use nvm:

```bash
nvm install 24
nvm use 24
node --version
npm --version
```

If you do not use nvm, install/select Node 24 with your existing Node installation method, then check those versions.

Install the dependencies recorded in the lockfile:

```bash
npm ci
```

`package.json` declares direct dependencies and available commands. `package-lock.json` records the resolved dependency tree. Direct dependencies are pinned to exact versions; `npm ci` installs the lockfile versions and replaces an existing `node_modules` directory. It does not intentionally upgrade dependencies.

Use `npm install package-name` when deliberately adding a dependency. Keep both package files together in version control.

### 3. Configure your local environment

Create `.env` only if it does not already exist:

```bash
if [ ! -f .env ]; then cp .env.example .env; fi
```

Open `.env` in VS Code. For a backend on port 4000 and a frontend on port 3000, use settings like these, replacing the database credentials with your own:

```dotenv
NODE_ENV=development
PORT=4000
API_PREFIX=/api/v1
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000
TRUST_PROXY=false
SHUTDOWN_TIMEOUT_MS=10000
```

These are example local credentials, not credentials created by the application. `.env` is ignored by Git; do not put real secrets in `.env.example` or the README.

### 4. Understand the database setup requirement

PostgreSQL is a separate running service. npm does not install or start it. You need a reachable PostgreSQL server, an existing database, and a role with access to that database. CI uses PostgreSQL 17.

For example, if your local PostgreSQL administrator role is named `postgres`, and `app` does not already exist:

```bash
createdb -h localhost -p 5432 -U postgres app
```

This command requires PostgreSQL's command-line tools and a running server. Supply your actual role name if it differs. It creates an empty database, not the application tables.

The intended next steps are:

```bash
npm run db:migrate
npm run db:seed
```

**Current setup blocker:** `src/database/migrations/meta/_journal.json` has an empty `entries` array, although `0000_initial.sql` exists. The migrator follows the journal, so it can log “Migrations applied” without executing that SQL.

A fresh database therefore needs the migration metadata repaired and reviewed before these commands can initialize it correctly. This README does not change migration history or silently apply SQL outside the migration system. Do not use `db:reset` to fix this: it deletes data and does not repair the journal. See [Database and migrations](#database-and-migrations) for verification commands.

The HTTP server starts only when PostgreSQL is reachable. If connectivity succeeds but table setup is pending, liveness and documentation remain available; user endpoints still need the actual table.

### 5. Start development mode

```bash
npm run dev
```

This runs `tsx watch src/server.ts`: it executes TypeScript and restarts the process when watched files change. Leave this terminal running. Look for the `API listening` log and its port. Stop it with **Ctrl+C**.

In a second terminal:

```bash
curl -i http://localhost:4000/health/live
curl -i http://localhost:4000/health/ready
```

- `/health/live` returning 200 means the HTTP application responds.
- `/health/ready` returning 200 means a PostgreSQL `select 1` query succeeded.
- Readiness returning 503 means the database connection/query failed.
- Readiness does **not** check that tables or migrations exist. It can return 200 while user requests fail because `users` is missing.

Open `http://localhost:4000/docs` for the Swagger documentation page. For normal daily development after setup, ensure PostgreSQL is running and use `npm run dev`.

### 6. Run compiled JavaScript

For the compiled execution path:

```bash
npm run build
npm start
```

Build first: `npm start` runs `dist/server.js`, not TypeScript source. Rebuild after source changes. To select production logging and environment behavior explicitly:

```bash
NODE_ENV=production npm start
```

Neither `build`, `start`, nor `dev` automatically migrates or seeds the database.

## Environment settings

`src/config/env.ts` loads `.env` through dotenv, validates values with Zod, and exports a frozen configuration object. Invalid configuration stops startup early. Environment variables already supplied by the shell take precedence over dotenv's normal loading of `.env`.

| Variable              | Fallback when absent    | Meaning                                                                                                          |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `development`           | `development`, `test`, or `production`; development enables readable Pino logs.                                  |
| `PORT`                | `4000`                  | HTTP listening port, an integer from 1 to 65535. `.env.example` explicitly sets 3000.                            |
| `API_PREFIX`          | `/api/v1`               | Prefix for user routes; must begin with `/`. Does not prefix health or docs routes.                              |
| `DATABASE_URL`        | None; required          | PostgreSQL connection string. Validation checks it is nonempty; connectivity is checked separately.              |
| `LOG_LEVEL`           | `info`                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`.                                                 |
| `CORS_ORIGINS`        | `http://localhost:3000` | Comma-separated browser origins, for example `http://localhost:3000,http://localhost:3001`. Entries are trimmed. |
| `TRUST_PROXY`         | `false`                 | String `true` or `false`; controls Express's trust in proxy information, including client IP interpretation.     |
| `SHUTDOWN_TIMEOUT_MS` | `10000`                 | Positive integer: maximum graceful-shutdown wait in milliseconds.                                                |

In `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`, the final path is the database name. The PostgreSQL port, typically 5432 locally, is independent of the HTTP server port.

## What the technologies do

| Technology                         | Job in this project                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Node.js                            | Runs server-side JavaScript and owns the HTTP server process.                          |
| Express 5                          | Matches incoming requests to routes and runs middleware/handlers.                      |
| TypeScript                         | Checks the shapes of inputs, dependencies, and return values during development/build. |
| PostgreSQL                         | Persists records in tables outside the Node process.                                   |
| `pg`                               | Connects Node to PostgreSQL; manages the connection pool.                              |
| Drizzle ORM                        | Builds typed SQL queries from the TypeScript schema.                                   |
| Drizzle Kit                        | Provides schema/migration development tools and database Studio.                       |
| Zod                                | Checks real incoming data at runtime; TypeScript alone cannot validate HTTP input.     |
| Pino / pino-http                   | Writes application and HTTP request logs.                                              |
| Helmet / CORS / express-rate-limit | Adds HTTP headers, browser cross-origin policy, and request limiting.                  |
| Swagger UI / OpenAPI               | Presents an API description in a browser.                                              |
| tsx / tsc / tsc-alias              | Runs TypeScript during development, compiles it, and rewrites build import aliases.    |
| Vitest / Supertest                 | Runs tests and sends test HTTP requests to Express.                                    |
| ESLint / Prettier                  | Checks code quality and applies consistent formatting.                                 |
| Husky / lint-staged / Commitlint   | Runs Git hooks, checks staged files, and checks commit messages.                       |

An API is a set of callable HTTP endpoints. JSON is the structured text format used for request and response data. CRUD means create, read, update, and delete.

## Folder and file map

```text
server/
├── src/
│   ├── server.ts                 # Process entry: listen and shut down
│   ├── app.ts                    # Express setup and top-level routes
│   ├── dependencies.ts           # Connect production factories together
│   ├── config/
│   │   └── env.ts                # Load and validate environment settings
│   ├── database/
│   │   ├── client.ts             # PostgreSQL pool and Drizzle client
│   │   ├── schema.ts             # Table definitions and inferred User type
│   │   ├── migrate.ts            # Apply journaled migrations
│   │   ├── seed.ts               # Insert the demo user
│   │   └── migrations/
│   │       ├── 0000_initial.sql   # Initial table/type/index SQL
│   │       └── meta/_journal.json # Migration ordering metadata (currently empty)
│   ├── modules/users/
│   │   ├── user.validation.ts    # Request schemas and inferred input types
│   │   ├── user.repository.ts    # Database queries
│   │   ├── user.service.ts       # Business operations
│   │   ├── user.handlers.ts      # Translate HTTP requests/responses
│   │   └── user.routes.ts        # Register methods and paths
│   ├── shared/
│   │   ├── errors.ts            # Structured error factory and type guard
│   │   ├── http.ts              # Request IDs, missing routes, error responses
│   │   └── logger.ts            # Pino configuration and redaction
│   └── docs/openapi.ts           # Manually maintained API description
├── tests/
│   ├── setup-env.ts              # Test environment values
│   ├── unit/                     # Service, validation, and error tests
│   └── integration/              # Express HTTP tests with injected fakes
├── scripts/
│   ├── generate-openapi.mjs      # Export built OpenAPI object as JSON
│   └── reset-database.ts         # Destructive development database reset
├── docs/                         # Short architecture/database/testing notes
├── .husky/                       # Git hook scripts
├── .env.example                  # Shareable environment template
├── .env                          # Local settings, ignored by Git
├── package.json                  # Scripts and direct dependency versions
├── package-lock.json             # Exact resolved dependency tree
├── tsconfig.json                 # Strict TypeScript checking configuration
├── tsconfig.build.json           # Application-only build configuration
├── drizzle.config.ts             # Schema and migration-tool paths
├── vitest.config.ts              # Test and coverage configuration
├── eslint.config.js              # Lint configuration
├── .prettierrc.json               # Formatting style
├── .prettierignore                # Files excluded from formatting
├── commitlint.config.js          # Conventional Commit rules
├── .nvmrc / .node-version         # Node major version selection
├── .gitignore                    # Generated/local files excluded from Git
├── README.md                     # This guide
├── CONTRIBUTING.md               # Contribution instructions
├── SECURITY.md                   # Vulnerability reporting guidance
├── CHANGELOG.md                   # Project change history
└── LICENSE                       # License terms
```

Generated/local folders include `node_modules` (installed packages), `dist` (compiled application), and `coverage` (test reports). `openapi.generated.json` is an exported document. Edit source files rather than generated output.

## How startup and requests work

### Startup

1. `npm run dev` executes `src/server.ts`.
2. Module imports load validated environment settings, the logger, and database client.
3. `dependencies.ts` constructs the repository and service objects through factories.
4. The imported `createApp` factory is available to install middleware, health/docs routes, user routes, and error handling after the connectivity check.
5. `server.ts` awaits `checkDatabase()` before creating the HTTP server or calling `createApp()`. If the query fails, it logs a fatal startup message, closes the database pool, and exits with code 1 without listening. Cleanup failures are also logged.
6. After a successful check, it logs confirmation, creates the Node HTTP server with `createServer(createApp())`, and calls `server.listen(env.PORT)` to accept requests.

Startup now waits for a successful `select 1` query. There is one startup attempt; if it fails, fix the connection and restart the app. With `npm run dev`, the watcher may remain running after the server process exits. The check proves connectivity, not that migrations or tables exist. Readiness continues checking connectivity after startup and returns 503 if PostgreSQL later becomes unavailable.

`app.ts` builds an Express application without opening a listening port. `server.ts` owns the process lifecycle. Keeping them separate lets tests exercise the application without starting the normal server entry point.

## Function-based architecture

Application-owned code uses functions and object literals. A **factory** is a function that creates and returns an object containing related functions.

The production composition in `dependencies.ts` is:

```ts
export const userRepository = createUserRepository(db);
export const userService = createUserService(userRepository);
export const dependencies: AppDependencies = { userService, checkDatabase };
```

The database is passed into the repository; the repository is passed into the service; the service is passed into the router/handlers. This is **dependency injection**: supplying what a function needs as an argument.

A **closure** lets the returned service methods remember the repository passed to `createUserService`. They do not need a constructor or `this`.

| Layer       | Responsibility                                                    | Example                                                       |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Route       | Register an HTTP method and path.                                 | `router.post('/', handlers.createUser)`                       |
| Handler     | Read HTTP data, validate it, call the service, send the response. | Parse `req.body`; return status 201.                          |
| Validation  | Define acceptable runtime input and normalization.                | Require a valid email; lowercase it.                          |
| Service     | Coordinate application rules and outcomes.                        | Missing user becomes `USER_NOT_FOUND`; calculate page count.  |
| Repository  | Execute persistence operations.                                   | Insert a row; query only rows where `deletedAt` is null.      |
| Composition | Choose and connect concrete dependencies.                         | Connect the PostgreSQL-backed repository to the user service. |

The `UserRepository` and `UserService` interfaces are TypeScript contracts describing required functions and return types. They do not create objects or execute at runtime. `this: void` in the repository interface declares that functions do not depend on a bound `this` value.

For tests, `createUserService(fakeRepository)` uses a fake object instead of SQL. `createApp({ userService: fakeService, checkDatabase: async () => true })` supplies test dependencies. When passing dependencies to `createApp`, supply both fields; calling `createApp()` uses production defaults. Importing the app still imports production composition and configuration, which is why tests load their environment setup first.

Native/library constructions such as `new Date()` and `new Pool(...)` remain valid. No custom dependency-injection framework is used.

## Database and migrations

### Client and pool

`src/database/client.ts` creates a PostgreSQL pool with up to 10 connections, a 5-second connection timeout, and a 30-second idle timeout. A pool reuses connections rather than opening a new connection for every query. Drizzle wraps this pool and receives the schema definitions.

`checkDatabase()` executes `select 1` and returns a boolean. `closeDatabase()` ends the pool during shutdown or after successful standalone database work.

### Schema, SQL, and journal

- `schema.ts` describes the desired structure in TypeScript.
- A migration SQL file describes database changes to apply.
- The migration journal tells the migrator which files to run and in what order.
- Editing `schema.ts` alone does not change PostgreSQL.
- `db:check` checks migration consistency metadata; it is not a live schema or connection check.

The current empty journal is a known initialization issue. A successful `db:check` or `db:migrate` exit must not be interpreted as proof that the initial table exists.

If you have `psql`, check the same database specified in `.env` using your actual database/role values:

```bash
psql -h localhost -p 5432 -U postgres -d app -c 'select 1;'
psql -h localhost -p 5432 -U postgres -d app -c "select to_regclass('public.users');"
```

The first query tests connectivity. The second should return `users`; a null/blank result means the table is absent. These commands prompt for a password if PostgreSQL requires one. They do not automatically read this project's `.env`.

After migration history is repaired, the normal workflow for a deliberate schema change is: edit the schema, run `npm run db:generate`, review the generated SQL and metadata, then run `npm run db:migrate`. Review changes before applying them to a database containing data.

`db:seed` inserts `Demo User` with email `demo@example.com` and uses `onConflictDoNothing`, so repeating a successful seed does not duplicate that email.

**Destructive command:** `db:reset` drops the entire `public` schema with `CASCADE` and recreates it. It is blocked in production mode, but deletes data in other modes. It does not rebuild tables by itself or repair migration metadata. Do not use it as a routine startup step.

### Pagination, filtering, and sorting

```bash
curl -i 'http://localhost:4000/api/v1/users?page=1&limit=10&status=active&search=sahal&sort=name&order=asc'
```

Quote URLs containing `&` so your shell does not interpret them as command syntax.

| Query field | Default          | Accepted values                         |
| ----------- | ---------------- | --------------------------------------- |
| `page`      | `1`              | Positive integer.                       |
| `limit`     | `20`             | Integer from 1 through 100.             |
| `status`    | No status filter | `active` or `inactive`.                 |
| `search`    | No search filter | Trimmed string, maximum 120 characters. |
| `sort`      | `createdAt`      | `name`, `email`, or `createdAt`.        |
| `order`     | `desc`           | `asc` or `desc`.                        |

Search uses case-insensitive SQL `ILIKE` against name or email, with `%` surrounding the input. SQL wildcard characters in input retain their wildcard meaning. Status and search filters are combined with the undeleted-row condition. Sorting also uses ascending ID as a tie-breaker.

The list response is `{ "success": true, "data": [...], "meta": { "page": 1, "limit": 10, "pages": 3, "total": 21 } }`. These example counts mean 21 matching users split into three pages. `total` counts all matching undeleted records, not just returned items. Offset is `(page - 1) * limit`; pages is `Math.ceil(total / limit)`. No matches means an empty array, total 0, and pages 0.

## Middleware, errors, and logging

Middleware runs before or after route handlers and can inspect, modify, reject, or pass along a request. `app.ts` installs these in order:

1. **Request ID:** reuses up to 128 characters of `x-request-id`, or generates a UUID; sets the response header and response-local value.
2. **HTTP logging:** Pino logs request/response information.
3. **Helmet:** adds HTTP security headers; Express's `x-powered-by` header is also disabled.
4. **CORS:** allows configured browser origins and requests without an Origin header. CORS controls browser access to responses; it is not user authentication.
5. **Rate limiting:** 120 requests per 60 seconds per limiter key, normally derived from client IP. It applies before all routes, including health/docs, and uses the library's default in-memory store and rejection response.
6. **Body parsing:** JSON and non-extended URL-encoded bodies, currently limited to 10 MB each.
7. **Routes:** root, health, documentation, and users.
8. **Not-found middleware:** unmatched routes become 404 `ROUTE_NOT_FOUND`.
9. **Error middleware:** converts recognized errors into HTTP JSON responses.

### Application errors

`createAppError(status, code, message, details?)` creates a native `Error` augmented with `type: 'AppError'` and structured HTTP fields. This keeps a stack trace and satisfies lint rules without defining a custom class. `isAppError` checks its discriminant and field types.

A typical missing-user response is:

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "requestId": "example-request-id"
  }
}
```

| Case                                          | HTTP status / code                                             |
| --------------------------------------------- | -------------------------------------------------------------- |
| Recognized application error                  | Its supplied status and code.                                  |
| Invalid Zod input                             | 400 / `VALIDATION_ERROR`, with validation issues in `details`. |
| Missing user                                  | 404 / `USER_NOT_FOUND`.                                        |
| Unregistered route                            | 404 / `ROUTE_NOT_FOUND`.                                       |
| Recognized direct duplicate error on creation | 409 / `EMAIL_EXISTS`.                                          |
| Other errors                                  | 500 / `INTERNAL_ERROR`, with a generic public message.         |

The handler only distinguishes application errors and Zod errors. Parser errors, such as malformed JSON or oversized bodies, currently fall into the generic error branch rather than preserving their parser status. Rate-limit rejections are handled directly by the limiter and do not use this JSON error envelope. Do not assume every response has the same shape.

`logger.ts` controls log level, readable development output, and redaction of configured paths such as authorization/cookie headers, passwords, and tokens. Unexpected request errors are logged with `err` and `requestId`; recognized application/validation errors are sent without that additional unexpected-error log. HTTP logging still runs.

### Shutdown

Ctrl+C sends SIGINT. SIGINT/SIGTERM trigger the shutdown function: stop accepting connections, wait for the HTTP server to close, close the database pool, and exit. A timer forces exit after the configured timeout. Uncaught exceptions and unhandled promise rejections are logged as fatal and trigger shutdown with a failure exit code.

## TypeScript and the build

`tsconfig.json` enables strict checking, including unknown catch values, checked indexed access, unused-code checks, and exact optional property types. An optional property may be omitted; that does not automatically mean it accepts an explicit `undefined` assignment.

The project uses native ESM (`"type": "module"`) and NodeNext module resolution. Source imports use `.js` extensions because the built files will be JavaScript. Keep those extensions even when importing another `.ts` source file.

`@/` is an alias for `src/`. For example, `@/shared/errors.js` refers to the source shared-error module. `tsc-alias` rewrites aliases in compiled output so Node can resolve them.

`import type` imports TypeScript-only contracts without adding runtime imports. Types and interfaces disappear during compilation.

`npm run build` runs TypeScript with `tsconfig.build.json`, which builds application source into `dist`, with declarations and source maps, excluding tests. `npm start` enables source maps so runtime stack traces can refer back to source. `npm run typecheck` checks the broader project without emitting files. Formatting is separate from type checking.

## Tests and quality checks

Unit tests exercise services using fake repositories, validate schemas, and check structured errors. HTTP integration tests use Supertest against Express with injected services/readiness behavior. They cover response contracts, validation, errors, soft-deletion behavior with a fake, and health endpoints.

The current tests do **not** execute real repository queries against PostgreSQL. Passing tests does not prove migration setup, SQL behavior, or live duplicate-error wrapping. `tests/setup-env.ts` sets test configuration and a test database URL, but the HTTP tests supply fakes instead of relying on that database.

```bash
npm run test
npm run test:coverage
```

Coverage measures which code executes during tests. Vitest writes an HTML report into `coverage` and enforces minimums of 50% lines, statements, and functions, and 20% branches. Passing these thresholds is not complete behavioral coverage.

Before committing:

```bash
npm run validate
```

This runs formatting checks, lint, type checking, tests, and build. It does not include coverage, database checks, or docs generation; run those separately when relevant.

### Git hooks and CI

- `prepare` initializes Husky during npm installation in a Git checkout.
- Pre-commit runs lint-staged to fix applicable staged files, then `npm run validate:commit` to check the whole server. It checks formatting, lint, TypeScript, all tests, build, coverage thresholds, migration metadata, and OpenAPI generation. Any failure blocks the commit. These checks also run when committing through VS Code once Husky is installed.
- Commit-msg runs Commitlint. An example accepted style is `feat(users): add status filtering`.
- Pre-push runs type checking and unit tests.

`.github/workflows/ci.yml` describes GitHub checks for main-branch pushes and pull requests: Node 24, PostgreSQL 17, `npm ci`, migrations, validation, and dependency audit. It assumes the server package is the checkout root. If the parent `Ciao Away` becomes the Git repository root, this nested workflow needs deliberate integration into the repository-root workflow location and server working directory. Simply having the file in a nested folder does not activate GitHub Actions. The current workspace previously had no Git repository at the server/parent paths, so hooks/CI should not be assumed active until this is a Git checkout.

## All npm commands

| Command                    | Purpose                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- |
| `npm ci`                   | Install the exact lockfile dependencies for an existing checkout.                |
| `npm run dev`              | Run TypeScript with automatic restarts.                                          |
| `npm run build`            | Compile application source and rewrite aliases into `dist`.                      |
| `npm start`                | Run the previously built server.                                                 |
| `npm run typecheck`        | Check TypeScript without producing files.                                        |
| `npm run lint`             | Check ESLint rules; fail on warnings.                                            |
| `npm run lint:fix`         | Apply ESLint's available automatic fixes.                                        |
| `npm run format`           | Rewrite supported project files with Prettier.                                   |
| `npm run format:check`     | Check formatting without rewriting files.                                        |
| `npm run test`             | Run all tests once.                                                              |
| `npm run test:watch`       | Run Vitest interactively as files change.                                        |
| `npm run test:unit`        | Run only unit tests.                                                             |
| `npm run test:integration` | Run HTTP integration tests.                                                      |
| `npm run test:coverage`    | Run tests and produce coverage reports.                                          |
| `npm run db:generate`      | Generate migration files from schema changes; inspect output before applying.    |
| `npm run db:migrate`       | Apply migrations listed by migration metadata.                                   |
| `npm run db:check`         | Check migration metadata consistency; not live database health.                  |
| `npm run db:studio`        | Open Drizzle's database browsing/editing tool for the configured database.       |
| `npm run db:seed`          | Insert demo data after tables exist.                                             |
| `npm run db:reset`         | Destructively remove the public schema and its contents outside production mode. |
| `npm run docs:generate`    | Build, then export the OpenAPI object to `openapi.generated.json`.               |
| `npm run validate`         | Formatting check → lint → typecheck → tests → build.                             |
| `npm run prepare`          | Set up Husky hooks; normally called by npm installation.                         |

OpenAPI is maintained manually in `src/docs/openapi.ts`. The current document contains route summaries and selected response descriptions, not full body/parameter schemas. Its paths are fixed to `/api/v1`; changing `API_PREFIX` does not automatically update the documentation. Edit the source document, then regenerate the JSON. Do not edit generated JSON as the source of truth.

## Making your first change

Read these files in order: `server.ts`, `app.ts`, `dependencies.ts`, `user.routes.ts`, `user.handlers.ts`, `user.validation.ts`, `user.service.ts`, and `user.repository.ts`. Trace one GET or POST request through them before changing multiple layers.

| You want to change…                        | Start here                                                     |
| ------------------------------------------ | -------------------------------------------------------------- |
| A route's URL or HTTP method               | `user.routes.ts` and the OpenAPI source.                       |
| A response shape or status                 | `user.handlers.ts`, HTTP tests, and API documentation.         |
| Allowed request values                     | `user.validation.ts` and validation/HTTP tests.                |
| A business rule or missing-user outcome    | `user.service.ts` and service tests.                           |
| Filtering or database queries              | `user.repository.ts`; verify actual SQL behavior where needed. |
| A stored column or index                   | `database/schema.ts` and a reviewed migration workflow.        |
| The service implementation used at runtime | `dependencies.ts`.                                             |
| HTTP middleware or readiness wiring        | `app.ts`.                                                      |
| Startup, listening, or shutdown            | `server.ts`.                                                   |
| Configuration rules or log output          | `config/env.ts` or `shared/logger.ts`.                         |

For a small first exercise, change the root endpoint's displayed application name in `app.ts`, run the development server, and request `/`. Then run relevant checks. You do not need a migration for a response-label change.

For a new feature such as products, create a feature folder under `modules`, define input schemas and types, implement a repository and service factory, add handlers and a router, compose dependencies, register the router in `app.ts`, and add tests/docs. Add database migrations only if storage changes. Keep HTTP objects out of service and repository code so those functions stay reusable and easy to test.

## Troubleshooting

| Symptom                                     | What to check                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` cannot be found              | Run commands inside `server`.                                                                                                                                                                                                                                                                                           |
| Unsupported engine/version errors           | Run `node --version` and `npm --version`; select Node 24 and npm 11+.                                                                                                                                                                                                                                                   |
| `Invalid environment`                       | Read the Zod error and fix `.env`; `DATABASE_URL` is required.                                                                                                                                                                                                                                                          |
| `EADDRINUSE`                                | Another process uses the HTTP port. Stop it or choose another `PORT`, then adjust URLs.                                                                                                                                                                                                                                 |
| Browser cannot connect                      | Ensure the dev terminal is still running and use its logged port.                                                                                                                                                                                                                                                       |
| `/health/live` works but readiness is 503   | Check PostgreSQL service, host, port, role, password, and database name.                                                                                                                                                                                                                                                |
| Readiness is 200 but `users` does not exist | Connectivity succeeded but schema setup did not; inspect the empty migration journal issue above.                                                                                                                                                                                                                       |
| Seed fails after migration says success     | Verify `public.users`; an empty journal schedules no migrations.                                                                                                                                                                                                                                                        |
| 400 `VALIDATION_ERROR`                      | Check the response's `details`, UUID, field lengths, enum values, and JSON body fields.                                                                                                                                                                                                                                 |
| Duplicate email produces 500                | Current service only maps direct PostgreSQL errors on create; inspect server logs for wrapped errors.                                                                                                                                                                                                                   |
| PATCH unexpectedly activates a user         | The inherited status default applies; send the intended status explicitly.                                                                                                                                                                                                                                              |
| Browser frontend fails while curl works     | Check the exact frontend origin against `CORS_ORIGINS`, including its port.                                                                                                                                                                                                                                             |
| 429 response                                | The request limiter was exceeded; wait for the window to reset.                                                                                                                                                                                                                                                         |
| `dist/server.js` is missing                 | Run `npm run build` before `npm start`.                                                                                                                                                                                                                                                                                 |
| Source edits do not appear with `npm start` | Rebuild, or use `npm run dev` while developing.                                                                                                                                                                                                                                                                         |
| Formatting fails only inside VS Code        | Check Output → Prettier. The parent workspace currently points Prettier directly at `server/node_modules/prettier/index.mjs`; that relative path assumes `Ciao Away` is the opened folder. If opening `server` alone, its relative package path is `./node_modules/prettier/index.mjs`. CLI fallback: `npm run format`. |

For database failures, use the server logs and a read-only connectivity/schema query before attempting fixes. A passing HTTP test suite or “Migrations applied” log alone does not establish a usable database schema.

## Git setup, automatic checks, and commit messages

### Automatic checks on every commit

After hook setup, your normal workflow is `git add` followed by `git commit`; you do not need to run validation manually. The pre-commit hook runs `npm run validate:commit` after lint-staged. Commitlint then checks the commit message. Fix any reported failures and retry the commit. Full tests and coverage take longer than staged-file checks alone.

`validate:commit` does not apply migrations, seed data, or reset PostgreSQL. `db:check` validates migration metadata without proving a live database schema. The automated tests currently inject fake repositories, so commits do not require a live PostgreSQL instance. OpenAPI generation also runs the build; generated output remains ignored by Git.

**One-time activation:** there is currently no Git repository at the server or parent workspace path. If you choose a server-only Git repository, run these commands from `server` after initializing it with `git init`:

```bash
npm run prepare
git config --get core.hooksPath
```

The expected hook path is `.husky/_`. Future `npm ci` installs run `prepare` automatically. Run Git with Node 24 and npm 11+ available; this applies to VS Code's Git environment too.

If you instead initialize Git in the parent folder to track both client and server, do not assume these server-root hooks are active: the Husky install path and hooks need adapting to that repository layout first. Do not initialize a second nested repository just to activate hooks.

### What `npm run prepare` does

`npm run prepare` executes the `prepare` script in `package.json`, currently `husky`. Husky connects Git to the scripts in `.husky` by configuring Git's hooks path and installing its hook wrappers.

A **Git hook** is a script Git runs automatically at a particular point, such as before saving a commit. Installing a hook is different from running all the checks immediately: `prepare` installs the connection, and a later commit or push triggers the relevant checks.

| Hook file           | When it runs                        | What this project does                                                                                                                            |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.husky/pre-commit` | Before a commit is created          | Runs lint-staged fixes, then full formatting checks, lint, TypeScript, tests, build, coverage, migration metadata checks, and OpenAPI generation. |
| `.husky/commit-msg` | Before accepting the commit message | Runs Commitlint against your message.                                                                                                             |
| `.husky/pre-push`   | Before pushing commits              | Runs TypeScript checking and unit tests.                                                                                                          |

Run `npm run prepare` once after initializing Git if dependencies were installed before Git existed. Normal `npm install` and `npm ci` executions also run the prepare lifecycle unless scripts are disabled. You do not need to run it before every commit. It does not stage files, create a commit, push code, start the server, or migrate the database.

### First-time Git setup

First run `git status` from your intended repository folder. If it already works, keep using that repository; do not initialize a nested one.

For a **new server-only repository**, run the following from `server` only when no repository exists:

```bash
git init -b main
npm run prepare
git config --get core.hooksPath
```

The last command should print `.husky/_`. If you want a single parent repository containing both frontend and backend, use the parent layout guidance above instead of these server-only initialization commands.

If Git asks who you are, configure your author identity for this repository, replacing the examples with your own name and email:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

These settings identify the commit author; they do not sign you into GitHub. GitHub authentication is separate and is needed when accessing your remote repository.

### Stage and commit from the terminal

A **staged file** is a change selected for the next commit. A **commit** saves a local snapshot of those staged changes. A **push** uploads commits to the remote repository.

Run these commands from the Git repository folder:

```bash
git status
git add .
git diff --cached --stat
git diff --cached
git commit -m "chore(server): run full validation before commits"
```

`git add .` stages changes beneath the current folder. To select only particular files, use their paths instead, such as `git add README.md`. Review the staged diff before committing, especially to ensure credentials and local environment files are not included.

The text after `-m` is the commit message. Git runs the installed hooks automatically. If a check fails, the commit is not created: read the failure, fix the problem, stage the fixes, and retry. If formatting checks report unstaged files, format and review those files before deciding whether to include them. Commitlint failures mean the message needs correcting.

You do not need to run `npm run validate` manually before each commit once the hooks are active. You can still run individual checks while developing to get faster feedback.

### How to write a commit message

Use Conventional Commit format:

```text
type(scope): short description
```

The **type** describes the kind of change. The optional **scope** identifies the affected area, such as `server` or `users`. The description says what changed. Write a clear, short description; messages such as `update` do not follow the expected format.

| Type       | Use for                                               | Example                                        |
| ---------- | ----------------------------------------------------- | ---------------------------------------------- |
| `feat`     | A new feature                                         | `feat(server): add database startup check`     |
| `fix`      | A bug fix                                             | `fix(users): handle missing users`             |
| `docs`     | Documentation                                         | `docs(server): explain setup and architecture` |
| `refactor` | Restructuring code without changing intended behavior | `refactor(users): use service factories`       |
| `test`     | Adding or changing tests                              | `test(server): cover database startup failure` |
| `chore`    | Maintenance or tooling                                | `chore(server): run checks before commits`     |

Examples of complete commands:

```bash
git commit -m "feat(server): check database connectivity before startup"
git commit -m "docs(server): explain Git hooks and commit messages"
```

Choose the command that describes your actual staged changes; these examples are alternatives, not a sequence to run. For a longer explanation, add a second message paragraph:

```bash
git commit -m "feat(server): check database before startup"   -m "Exit with code 1 when PostgreSQL is unavailable and close the pool before exiting."
```
