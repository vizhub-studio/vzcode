# Filesystem synchronization

VZCode's standalone server watches the local workspace. Edits made by
Git, formatters, build tools, or another editor are synchronized to the
ShareDB document that all connected browser clients are editing.

## Behavior

- A root `fs.watch` receives fast notifications. A periodic full scan
  (default 1.5 seconds) catches nested-directory changes, coalesced
  events, and platforms without recursive notifications.
- The scan uses the same `.gitignore`, `.ignore`, `.vzignore`, and default
  excludes as startup. Symlinks are not imported or traversed.
- The previous saved disk snapshot is compared with both the current
  ShareDB document and the newest disk snapshot.
- External creations, deletions, edits, binary image updates, and
  directory changes enter the ShareDB document as one OT operation.
- An external rename preserves the existing VZCode file ID when the
  filesystem reports an unambiguous inode identity. On filesystems
  without usable identity information, rename may appear as a
  removal and creation.
- Internal autosaves do not produce another external-update loop.
- Before any autosave writes, VZCode re-reads the disk. If the disk has
  changed, it defers writing and reconciles first; this protects even
  when an event arrives later than the autosave timer.

## Conflicts

If the editor and the disk changed the same entry after the last saved
baseline, the server leaves the disk untouched, preserves the editor
content, and publishes `workspaceConflicts` on the ShareDB document.
The standalone editor displays a persistent warning until every conflict
is handled. While a conflict exists, autosave is blocked for the whole
workspace. This is deliberately conservative.

Choose **Load disk version** to discard the editor's conflicting edits,
or **Overwrite disk with editor** to explicitly accept the local editing
version and let autosave write it. The overwrite choice requires an
extra browser confirmation. The authenticated API
`POST /workspace-conflicts/resolve` accepts JSON
`{"name":"index.js","choice":"disk"}` or choice `"editor"`.
Changes arriving during resolution require another reconciliation.

## Programmatic and testing controls

`createVZCodeServer({ watchFiles, scanIntervalMS, autoSave })` supports
disabling the watcher for deterministic tests or embedded hosts. `watchFiles`
defaults to the value of `autoSave` (both enabled by default).
`server.syncFromDisk()` performs an immediate reconciliation, while
`server.resolveConflict(name, choice)` provides an explicit resolution
method. `server.close()` stops watchers, timers, WebSockets, and ShareDB.

Validation:

```bash
npm run typecheck
npm run lint
npm run test:sync
npm run test:e2e
npm run e2e
```

Unit tests exercise the three-way merge and rename semantics. Server
integration tests exercise real ShareDB/WebSocket clients, file operations,
conflicts, auth, timers, nested changes and binary files. Browser E2E
tests verify external edits appear in the actual editor.

## Limitations

- Large workspaces are scanned repeatedly, which may affect CPU and I/O.
  Very large repositories may need incremental watching in a later PR.
- External file updates are not an OS-level transaction: a process that
  races a write or swaps a parent directory can still create a TOCTOU
  window. Avoid running VZCode against workspaces mutable by untrusted
  processes; see [security](SECURITY.md).
- The merge is intentionally conservative: same-file concurrent edits
  require manual selection rather than automatic three-way text merging.
- Binary files other than supported image formats are not automatically
  treated as binary by VZCode's current loading system.
