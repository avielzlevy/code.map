# aviel-rules.md
> Coding principles. Framework/language-agnostic unless noted. If a referenced pattern doesn't exist, create it.

---

## ERRORS
- Throw the most specific exception type available. Never use a generic base exception when a specific one exists.
- If no specific exception fits, create one. Name it after the entity and situation (`UserNotFoundException`).
- Always include the entity identifier in the message — not just "not found".

## ARCHITECTURE
- Route/controller handlers extract inputs and call one service method. No logic lives in the handler.
- One service per domain entity. Never merge unrelated domains into one class/module.
- No repository abstraction layer unless the ORM genuinely requires it. Query the DB directly in the service.
- Constants in a dedicated `constants` file. No inline magic strings or numbers in logic.
- All environment variable reads happen in one place (`env-config` or equivalent). Everywhere else reads from that module.

## ASYNC
- `async`/`await` everywhere. No promise chaining (`.then()`).
- If using a reactive/observable library, convert to a promise at the boundary. Feature code never deals with observables.

## LOGGING
- Never use `console.log` or print statements in production code. Use a structured logger.
- Always pass context (class/module name) with every log call.
- If a structured logger wrapper doesn't exist, create one.

## DTOs / VALIDATION
- Validate and document every input at the boundary. If the framework supports decorators for this, use them.
- Required fields and optional fields must be explicitly distinguished in the schema/type.

## HTTP RESPONSES
- All API responses follow a uniform envelope: `{ status, data, meta? }`. If an interceptor/middleware for this doesn't exist, create it.
- Streaming/binary responses bypass the envelope.
- Pagination metadata goes in `meta`, not mixed into `data`.

## TESTING
- Unit tests mock external dependencies (DB, env config, HTTP clients). Never mock `process.env` or equivalent directly — mock the config module that wraps it.
- No real DB in unit tests.
- Test files live in a `spec/` (or `__tests__/`) subdirectory inside the module they test.

## CODE STYLE
- Early returns for guard clauses. Happy path at the bottom.
- `private readonly` (or equivalent) for all injected dependencies.
- Import order: framework → DB/ORM → infrastructure → feature services → utils → types.
- Use path aliases over deep relative imports.
- Always use type safety.

## FRONTEND
- No hardcoded user-facing strings. All text goes through the i18n layer.
- HTTP calls go through a single typed wrapper with auth and error handling. Never call the HTTP client directly.
- Every context/store hook must throw a clear error if used outside its provider.
- State tiers: local state → scoped context → global store (for persistent data only).
- Feature code lives in feature directories. Route files are thin shells.


## Prefered stack
- FastAPI (Python)
- NestJS
- NextJS
- TailwindCSS
