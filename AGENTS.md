# Agent Guidelines for VZCode

## Build/Test Commands

- **Build**: `npm run build` (builds client and server) - DO NOT RUN THIS EVER, it will crash the machine
- **Type Check**: `npm run typecheck` (expect 0 errors) - run this instead of `npm run build` to validate changes
- **Tests**: `npm test` (all tests) or `npx vitest run test/filename.test.ts` (single test)
- **E2E Tests**: `npm run test:e2e` runs `test/serverE2E.test.ts`, which boots a real server in-process (HTTP + ShareDB/WebSocket) against a temp workspace. The server factory lives in `src/server/createServer.ts`; the entry point `src/server/index.ts` is a thin wrapper.
- **Browser E2E**: `npm run e2e` (Playwright) drives the real client + backend. Playwright's `webServer` starts the backend (port 3030, from `e2e/start-backend.ts`) and Vite (port 5199), and resets `e2e/.workspace` from `e2e/fixtures/workspace`. Specs are `e2e/*.e2e.ts` (Vitest ignores them). Run `npx playwright install chromium` once if browsers are missing. This is the one case where a dev server is started automatically; it is torn down when the run finishes.
- **Lint**: `npm run lint` or `npm run lint:fix`
- **Format**: `npm run prettier` (ALWAYS run after making a series of code changes)
- **Dev Server**: `npm run test-interactive` (port 3030) or `npm run dev` (port 5173 with hot reload) - DO NOT RUN THIS EVER, it will crash the process, always ask for manual testing

DO NOT run `git commit`, that will be done manually.

## Code Style

- **Imports**: ES6 modules (`import`/`export`), use `.js` extensions for local imports
- **Formatting**: Prettier with single quotes, 60 char line width
- **Types**: TypeScript with interface for objects, type for unions/primitives, prefer explicit types
- **Naming**: camelCase for variables/functions, PascalCase for components/types, UPPER_CASE for constants
- **React**: Functional components with hooks, React 18 (no import React in JSX)
- **Error Handling**: Prefer try/catch, log errors with `console.error`, use status/error state patterns
- **Comments**: Use JSDoc for public APIs, inline comments for complex logic
- **Files**: Organize by feature in `src/client/` and `src/server/`, `index.ts` for exports

## Key Rules from Copilot Instructions

- Reference .github/copilot-instructions.md for build commands and validation
- Run `npm run prettier` before every commit
- Validate changes by starting server and testing in browser at http://localhost:3030
- Known baseline: 0 test failures (1 skipped), 0 TypeScript errors (do not introduce new ones)
