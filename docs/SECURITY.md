# Standalone server security

## Access model

VZCode runs as a local development tool and edits files using the privileges
of the operating-system account running its server. Treat it like a local
code editor, not a multi-tenant production service.

- The CLI binds to `127.0.0.1` and generates a cryptographically random
  256-bit access token on each start.
- The terminal prints an access URL using a fragment (`#vzcode-token=`);
  URL fragments are not sent in HTTP requests. The client exchanges the
  token using `POST /auth/session`, then removes it from browser history.
- The server issues a random, HttpOnly, SameSite=Strict cookie for the
  running process. There is no persistent user database or role hierarchy.
- ShareDB WebSocket upgrades and AI/LiveKit endpoints require an authorized
  session or an explicit Bearer token. Browser-originated requests from
  other web origins are rejected. Only the `/ws` upgrade path is accepted.
- `GET /auth/status` reports whether the caller is authenticated.
  `POST /auth/logout` revokes the current cookie's session.
- All holders of a valid token or session have **editor** privileges for
  the entire workspace. Use separate processes/workspaces when isolation
  between users is required.

## Workspace confinement

The initial workspace scan ignores symbolic links and nonregular files.
Before committing a ShareDB snapshot, the server validates every file
path and entry. The autosave routine repeats validation and checks each
existing path component with `lstat` before reading, writing, renaming or
deleting. Absolute paths, parent traversal, Windows drive paths,
backslashes, malformed paths, duplicate names, and symlink traversal are
rejected. Failed background saves are logged rather than crashing the
process.

**Residual risks:** Node's regular filesystem operations do not guarantee
race-free containment if another process can replace directory components
with symlinks between validation and use. Run VZCode only against trusted
local workspaces; avoid untrusted processes with write access to workspace
directories. VZCode now detects external file edits and pauses autosave on simultaneous
changes. The explicit conflict actions let an editor choose which version
to retain. The periodic scan is not an operating-system filesystem sandbox;
watcher events and other processes can still race with disk operations.

## Remote deployment

Public exposure is **not supported** in this PR. The CLI remains bound to
loopback. Do not forward the port or publish it behind a public tunnel:
this implementation has capability-based editor access only, no
per-user permissions, audit log, remote session management, or tested
TLS termination. A future deployment mode should enforce HTTPS/WSS,
trusted proxy/origin configuration, rotation/revocation, rate limits,
and explicit read/write authorization before it is advertised.

## Verification

Run `npm run build:server`, `npm run typecheck`, and `npm test` to exercise
the security test suite. `test/secureServer.test.ts` covers HTTP and
WebSocket denial, session bootstrap, origin rejection, and malicious
ShareDB writes. `test/workspaceSecurity.test.ts` covers path traversal,
symlink reads, and malformed file entries. `npm run test:package` verifies
an installed CLI artifact after `npm run build-release`.

To report vulnerabilities, use GitHub's private security advisory workflow
for `vizhub-studio/vzcode` rather than filing a public exploit issue.
