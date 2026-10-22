import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVZCodeServer } from '../src/server/createServer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir =
  process.env.E2E_WORKSPACE ||
  path.join(here, '.workspace');
const fixturesDir = path.join(
  here,
  'fixtures',
  'workspace',
);
const port = Number(process.env.E2E_BACKEND_PORT || 3030);

// Reset the workspace from the committed fixtures for a deterministic run.
fs.rmSync(workspaceDir, { recursive: true, force: true });
fs.mkdirSync(workspaceDir, { recursive: true });
fs.cpSync(fixturesDir, workspaceDir, { recursive: true });

// The server factory does not auto-save as part of startup; it listens only
// when asked, and never opens a browser. That makes it safe to drive here.
const server = createVZCodeServer({
  cwd: workspaceDir,
  // The client is served by Vite in dev, so the backend serves no static files.
  serveStaticDir: null,
  autoSave: true,
});

// A readiness endpoint for Playwright's `webServer.url`.
server.app.get('/health', (_req, res) => {
  res.send('ok');
});

await server.ready;
await server.listen(port);
console.log(
  `E2E backend listening on http://localhost:${port} (workspace: ${workspaceDir})`,
);
