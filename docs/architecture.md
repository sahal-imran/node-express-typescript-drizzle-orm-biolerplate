# Architecture

Feature modules follow route → handler → validation → service → repository. Route factories register handlers; handler factories receive a service and preserve the HTTP response contract. Services are typed factory functions receiving repository interfaces. Repository factories receive the Drizzle database explicitly.

`src/dependencies.ts` composes the production repository and service. `createApp()` uses these defaults, or accepts an `AppDependencies` object containing a service and database readiness function for tests. No dependency container or application-owned classes are used.

Shared infrastructure owns typed configuration, structured logging, request IDs, and safe errors. `createAppError` produces native errors with structured discriminant and HTTP fields (without a custom class), preserving stack traces and compatibility with the existing lint rules; `isAppError` checks their structure in centralized middleware. Native and PostgreSQL errors retain their native detection. Express 5 propagates rejected async handlers to the centralized error middleware.
