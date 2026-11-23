import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import bodyParser from 'body-parser';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createAccessControl } from './accessControl.js';
import { createWorkspacePathResolver } from './workspaceSecurity.js';
import ShareDB from 'sharedb';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { json1Presence } from '../ot.js';
import { computeInitialDocument } from './computeInitialDocument.js';
import { handleAIAssist } from './handleAIAssist.js';
import { handleAICopilot } from './handleAICopilot.js';
import { handleAIChatMessage } from './handleAIChatMessage.js';
import { isDirectory } from './isDirectory.js';
import { createToken } from './livekit.js';
import './setupEnv.js';
import { diff } from '../ot.js';
import {
  copyFiles,
  diskMatchesBaseline,
  readWorkspaceDisk,
  reconcileDisk,
  type WorkspaceFiles,
} from './workspaceSync.js';

// The time in milliseconds by which auto-saving is debounced.
const autoSaveDebounceTimeMS = 800;

// The time in milliseconds by which auto-saving is throttled
// when the user is interacting with the widgets in the editor.
const throttleTimeMS = 100;

// The image file utility used when writing files to disk.
const isImageFile = (fileName) => {
  return (
    fileName.match(
      /\.(png|jpg|jpeg|gif|bmp|svg|webp)$/i,
    ) !== null
  );
};

export interface CreateVZCodeServerOptions {
  /** Workspace root whose files are loaded and auto-saved. */
  cwd?: string;
  /**
   * Directory of client build assets to serve statically. Defaults to
   * the repo's `dist` directory. Pass `null` to disable static serving.
   */
  serveStaticDir?: string | null;
  /**
   * Whether to write changed files to disk automatically. Defaults to
   * `true`. Tests can disable this and call `save()` directly.
   */
  autoSave?: boolean;
  /** Optional fixed capability token (otherwise generated per server). */
  accessToken?: string;
  /** Watch workspace files for out-of-editor edits (defaults to autoSave). */
  watchFiles?: boolean;
  /** Portable background rescan interval (default 1500ms). */
  scanIntervalMS?: number;
}

export interface VZCodeServer {
  app: express.Express;
  httpServer: http.Server;
  shareDBBackend: ShareDB;
  /** The server-side ShareDB document for the workspace. */
  shareDBDoc: any;
  /** Random per-server token used to mint scoped browser sessions. */
  accessToken: string;
  /** Resolves once the initial ShareDB document has been created. */
  ready: Promise<void>;
  /** Write changed files to disk (same routine used by auto-save). */
  save: () => void;
  /** Reconcile disk edits immediately; also useful for deterministic tests. */
  syncFromDisk: () => Promise<void>;
  /** Resolve a conflict explicitly by choosing the disk or editor version. */
  resolveConflict: (
    name: string,
    choice: 'disk' | 'editor',
  ) => Promise<void>;
  /** Start listening; resolves with the actual bound port. */
  listen: (port: number, host?: string) => Promise<number>;
  /** Stop the HTTP/WebSocket servers and close ShareDB. */
  close: () => Promise<void>;
}

/**
 * Creates a VZCode server instance without starting it.
 *
 * Splitting construction from `listen`/`open` makes the server testable
 * in-process (see `test/serverE2E.test.ts`). The production entry point
 * `src/server/index.ts` is a thin wrapper around this factory.
 */
export const createVZCodeServer = (
  options: CreateVZCodeServerOptions = {},
): VZCodeServer => {
  const cwd = options.cwd ?? process.cwd();
  const autoSave = options.autoSave ?? true;
  const watchFiles = options.watchFiles ?? autoSave;
  const scanIntervalMS = options.scanIntervalMS ?? 1500;
  const workspace = createWorkspacePathResolver(cwd);
  const access = createAccessControl(options.accessToken);

  // Resolve file names from the ShareDB document against the workspace
  // root, so the server can operate on a directory other than the
  // process's current working directory.
  const resolvePath = workspace.resolve;

  const serveStaticDir =
    options.serveStaticDir === undefined
      ? path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          '..',
          '..',
          'dist',
        )
      : options.serveStaticDir;

  const initialDocument = {
    ...computeInitialDocument({
      fullPath: workspace.root,
    }),
    workspaceConflicts: [] as string[],
  };
  workspace.validateFiles(initialDocument.files);

  // Register our custom OT type,
  // because it does not ship with ShareDB.
  ShareDB.types.register(json1Presence.type);

  const app = express();
  access.install(app);

  // Use ShareDB over WebSocket
  const shareDBBackend = new ShareDB({
    // Enable presence
    presence: true,
    doNotForwardSendPresenceErrorsToClient: true,
  });
  // Validate the committed post-operation snapshot, not merely the
  // operation payload. A rejected submission must never reach autosave.
  shareDBBackend.use('commit', (context: any, next) => {
    try {
      if (
        context.collection !== 'documents' ||
        context.id !== '1'
      ) {
        throw new Error('Unauthorized ShareDB document');
      }
      workspace.validateFiles(
        context.snapshot?.data?.files,
      );
      next();
    } catch (error: any) {
      next(error);
    }
  });
  const httpServer = http.createServer(app);
  // Authentication is enforced before ShareDB attaches to the socket.
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/ws') {
      socket.write(
        'HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n',
      );
      socket.destroy();
      return;
    }
    if (!access.authorized(req)) {
      socket.write(
        'HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n',
      );
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });
  wss.on('connection', (ws) => {
    const clientStream = new WebSocketJSONStream(ws);
    shareDBBackend.listen(clientStream);

    // Prevent server crashes on errors.
    clientStream.on('error', (error) => {
      console.log('clientStream error: ' + error.message);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.log('ws error: ' + error.message);
    });

    // Handle disconnections
    ws.on('close', () => {
      clientStream.end();
    });
  });

  // Serve static files
  if (serveStaticDir) {
    app.use(express.static(serveStaticDir));
  }

  // Create the initial "document",
  // which is a representation of files on disk.
  const shareDBConnection = shareDBBackend.connect();
  const shareDBDoc = shareDBConnection.get(
    'documents',
    '1',
  );

  // The state of the document when files were last auto-saved.
  let previousDocument: { files: WorkspaceFiles } = {
    ...initialDocument,
    files: copyFiles(initialDocument.files),
  };
  let identities: Record<string, string | undefined> = {};
  const initialDisk = readWorkspaceDisk(workspace.root);
  for (const [id, file] of Object.entries(
    previousDocument.files,
  )) {
    identities[id] = initialDisk.get(file.name)?.identity;
  }
  let conflictNames: string[] = [];
  let runningSync: Promise<void> | null = null;
  let closing = false;
  let watcher: fs.FSWatcher | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let changeTimer:
    ReturnType<typeof setTimeout> | undefined;

  // Saves the files that changed.
  const save = () => {
    const currentDocument: { files: WorkspaceFiles } =
      shareDBDoc.data;
    if (conflictNames.length) {
      throw new Error(
        'Workspace conflicts require resolution: ' +
          conflictNames.join(', '),
      );
    }
    // Do not write a single byte if the disk has changed since the
    // last successful save/import. This also protects against events
    // arriving before a filesystem watch callback is delivered.
    if (
      !diskMatchesBaseline(
        previousDocument.files,
        readWorkspaceDisk(workspace.root),
      )
    ) {
      void syncFromDisk().catch((error) =>
        console.error(
          'VZCode disk reconciliation failed:',
          error,
        ),
      );
      throw new Error(
        'External filesystem change detected; save deferred',
      );
    }
    // Fail closed before the first write in this batch. Repeat checks
    // at each filesystem call to reject newly created symlinks.
    workspace.validateFiles(previousDocument.files);
    workspace.validateFiles(currentDocument.files);

    const before = previousDocument.files;
    const after = currentDocument.files;
    const oldEntries = Object.entries(before);
    const newEntries = Object.entries(after);
    const depth = (name: string) => name.split('/').length;
    const removed = oldEntries.filter(([id]) => !after[id]);
    const changed = newEntries.filter(
      ([id]) => !!before[id],
    );
    const created = newEntries.filter(
      ([id]) => !before[id],
    );

    // Create destination directories first, including renamed folders.
    for (const [, file] of newEntries
      .filter(([, file]) => isDirectory(file.name))
      .sort(
        (a, b) => depth(a[1].name) - depth(b[1].name),
      )) {
      if (!fs.existsSync(resolvePath(file.name))) {
        fs.mkdirSync(resolvePath(file.name), {
          recursive: true,
        });
      }
    }

    // Delete removed files before moving another file into their path.
    for (const [, file] of removed.filter(
      ([, file]) => !isDirectory(file.name),
    )) {
      fs.unlinkSync(resolvePath(file.name));
    }

    // Move surviving files before writing their updated contents. Moving
    // only the leaf (not directories) preserves file IDs across folder
    // renames and avoids writing to the old location.
    for (const [id, current] of changed) {
      const previous = before[id];
      if (
        previous.name !== current.name &&
        !isDirectory(current.name)
      ) {
        const destinationDir = path.dirname(current.name);
        if (destinationDir !== '.') {
          fs.mkdirSync(resolvePath(destinationDir), {
            recursive: true,
          });
        }
        fs.renameSync(
          resolvePath(previous.name),
          resolvePath(current.name),
        );
      }
    }

    // Apply edited contents and new files, including binary images.
    for (const [id, current] of [...changed, ...created]) {
      if (isDirectory(current.name)) continue;
      if (!before[id] || before[id].text !== current.text) {
        const parent = path.dirname(current.name);
        if (parent !== '.') {
          fs.mkdirSync(resolvePath(parent), {
            recursive: true,
          });
        }
        const data = isImageFile(current.name)
          ? Buffer.from(current.text as string, 'base64')
          : (current.text as string);
        workspace.writeFile(current.name, data);
      }
    }

    // Remove obsolete directories after moving or removing children.
    const obsoleteDirs = [
      ...removed
        .filter(([, file]) => isDirectory(file.name))
        .map(([, file]) => file.name),
      ...changed
        .filter(
          ([id, file]) =>
            isDirectory(before[id].name) &&
            before[id].name !== file.name,
        )
        .map(([id]) => before[id].name),
    ];
    for (const name of [...new Set(obsoleteDirs)].sort(
      (a, b) => depth(b) - depth(a),
    )) {
      const full = resolvePath(name);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true });
      }
    }

    previousDocument = {
      ...currentDocument,
      files: copyFiles(currentDocument.files),
    };
    const disk = readWorkspaceDisk(workspace.root);
    identities = Object.fromEntries(
      Object.entries(previousDocument.files).map(
        ([id, file]) => [id, disk.get(file.name)?.identity],
      ),
    );
  };

  const publishDiskUpdate = (
    files: WorkspaceFiles,
    conflicts: string[],
  ): Promise<void> => {
    const current = shareDBDoc.data;
    const next = {
      ...current,
      files,
      workspaceConflicts: conflicts,
    };
    const operation = diff(current, next);
    if (
      !operation ||
      (Array.isArray(operation) && !operation.length)
    ) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      shareDBDoc.submitOp(
        operation,
        { source: 'filesystem' },
        (error: Error | null) => {
          if (error) reject(error);
          else resolve();
        },
      );
    });
  };

  /** Serialized rescans avoid overlapping external imports. */
  const syncFromDisk = (): Promise<void> => {
    if (runningSync) return runningSync;
    if (closing) return Promise.resolve();
    const scan = async () => {
      const disk = readWorkspaceDisk(workspace.root);
      if (
        !conflictNames.length &&
        diskMatchesBaseline(previousDocument.files, disk)
      ) {
        identities = Object.fromEntries(
          Object.entries(previousDocument.files).map(
            ([id, file]) => [
              id,
              disk.get(file.name)?.identity,
            ],
          ),
        );
        return;
      }
      const plan = reconcileDisk({
        baseline: previousDocument.files,
        current: shareDBDoc.data.files,
        disk,
        identities,
      });
      await publishDiskUpdate(plan.files, plan.conflicts);
      previousDocument = {
        ...previousDocument,
        files: plan.baseline,
      };
      identities = plan.identities;
      conflictNames = plan.conflicts;

      // A local edit may have been pending while an unrelated external
      // change was imported. Resume its save after the OT is committed.
      if (
        autoSave &&
        !conflictNames.length &&
        !diskMatchesBaseline(plan.files, disk)
      ) {
        debounceSave();
      }
    };
    runningSync = scan().finally(() => {
      runningSync = null;
    });
    return runningSync;
  };

  const resolveConflict = async (
    name: string,
    choice: 'disk' | 'editor',
  ): Promise<void> => {
    await syncFromDisk();
    if (!conflictNames.includes(name)) {
      throw new Error(
        'Unknown or already resolved conflict',
      );
    }
    const disk = readWorkspaceDisk(workspace.root);
    const nextFiles = copyFiles(shareDBDoc.data.files);
    const nextBaseline = copyFiles(previousDocument.files);
    const id =
      Object.keys(nextBaseline).find(
        (key) => nextBaseline[key].name === name,
      ) ??
      Object.keys(nextFiles).find(
        (key) => nextFiles[key].name === name,
      );
    if (!id) throw new Error('Conflict entry disappeared');

    let observed = disk.get(name);
    // External renames may have changed the path but preserved the inode.
    if (!observed && identities[id]) {
      const candidates = Array.from(disk.values()).filter(
        (file) => file.identity === identities[id],
      );
      if (candidates.length === 1) observed = candidates[0];
    }

    if (choice === 'disk') {
      if (observed) {
        nextFiles[id] = {
          name: observed.name,
          text: observed.text,
        };
      } else {
        delete nextFiles[id];
      }
    }
    if (observed) {
      nextBaseline[id] = {
        name: observed.name,
        text: observed.text,
      };
      identities[id] = observed.identity;
    } else {
      delete nextBaseline[id];
      delete identities[id];
    }
    const remaining = conflictNames.filter(
      (conflict) => conflict !== name,
    );
    // All other tracked files must still match disk before allowing an
    // editor-wins write. A new disk change requires another reconciliation.
    if (
      choice === 'editor' &&
      !remaining.length &&
      !diskMatchesBaseline(nextBaseline, disk)
    ) {
      throw new Error(
        'Disk changed again; retry after reconciling',
      );
    }
    await publishDiskUpdate(nextFiles, remaining);
    previousDocument = {
      ...previousDocument,
      files: nextBaseline,
    };
    conflictNames = remaining;
    if (autoSave && !remaining.length) {
      debounceSave();
    }
  };

  const scheduleSync = () => {
    if (closing) return;
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      void syncFromDisk().catch((error) =>
        console.error('VZCode disk watcher failed:', error),
      );
    }, 80);
  };

  // Invalid paths or external filesystem changes must not crash the
  // process from a delayed timer. Expose errors in logs for operators.
  const autoSaveSafely = () => {
    try {
      save();
    } catch (error) {
      console.error('VZCode autosave refused:', error);
    }
  };

  let lastExecutedTime = Date.now();
  let lastChangeTimeout; // This timeout ensures the last change is saved

  // Function to throttle the saving
  function throttleSave() {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutedTime;

    if (timeSinceLastExecution > throttleTimeMS) {
      autoSaveSafely();
      lastExecutedTime = now;
    } else {
      // Clear the previous timeout and set a new one to save the last change
      clearTimeout(lastChangeTimeout);
      lastChangeTimeout = setTimeout(() => {
        autoSaveSafely();
        lastExecutedTime = now;
      }, throttleTimeMS - timeSinceLastExecution);
    }
  }

  // Function to debounce the saving
  let debounceTimeout;
  function debounceSave() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(
      autoSaveSafely,
      autoSaveDebounceTimeMS,
    );
  }

  // Create the document, then subscribe so that the server-side doc
  // receives ops from connected clients.
  const ready = new Promise<void>((resolve, reject) => {
    shareDBDoc.create(
      initialDocument,
      json1Presence.type.uri,
      (createError) => {
        if (createError) return reject(createError);
        shareDBDoc.subscribe((subscribeError) => {
          if (subscribeError) return reject(subscribeError);

          if (autoSave) {
            // Filesystem imports must not trigger a write-back loop.
            shareDBDoc.on('op', (_op, source) => {
              if (source === 'filesystem') return;
              if (shareDBDoc.data.isInteracting) {
                throttleSave();
              } else {
                debounceSave();
              }
            });
          }

          if (watchFiles) {
            // Root watcher gives low-latency notifications. The periodic
            // recursive scan handles nested files and lost/coalesced events.
            try {
              watcher = fs.watch(
                workspace.root,
                scheduleSync,
              );
              watcher.on('error', (error) => {
                console.error(
                  'VZCode watcher error:',
                  error,
                );
              });
            } catch (error) {
              // Some filesystems do not offer watch notifications.
              console.warn(
                'VZCode using polling-only filesystem monitoring:',
                error,
              );
            }
            interval = setInterval(
              scheduleSync,
              scanIntervalMS,
            );
            interval.unref();
          }
          resolve();
        });
      },
    );
  });

  // Conflict decisions are explicit, authenticated user actions.
  app.post(
    '/workspace-conflicts/resolve',
    access.requireAuth,
    bodyParser.json(),
    async (req, res) => {
      const { name, choice } = req.body || {};
      if (
        typeof name !== 'string' ||
        (choice !== 'disk' && choice !== 'editor')
      ) {
        res
          .status(400)
          .json({ error: 'Invalid conflict resolution' });
        return;
      }
      try {
        await resolveConflict(name, choice);
        res.sendStatus(204);
      } catch (error: any) {
        res.status(409).json({ error: error.message });
      }
    },
  );

  // Handle AI Assist requests.
  app.post(
    '/ai-assist',
    access.requireAuth,
    bodyParser.json(),
    handleAIAssist(shareDBDoc),
  );

  // Handle AI Copilot requests.
  app.post(
    '/ai-copilot',
    access.requireAuth,
    bodyParser.json(),
    handleAICopilot(),
  );

  // Handle AI Chat Message requests.
  app.post(
    '/ai-chat-message',
    access.requireAuth,
    bodyParser.json(),
    handleAIChatMessage({
      shareDBDoc,
      onCreditDeduction: undefined,
    }),
  );

  // Livekit Token Generator
  app.get(
    '/livekit-token',
    access.requireAuth,
    async (req, res) => {
      const { room, username } = req.query;
      res.send(await createToken(room, username));
    },
  );

  const listen = (
    port: number,
    host?: string,
  ): Promise<number> =>
    new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        httpServer.removeListener('error', onError);
        reject(error);
      };
      httpServer.once('error', onError);
      const onListening = () => {
        httpServer.removeListener('error', onError);
        const address = httpServer.address();
        const actualPort =
          address && typeof address === 'object'
            ? address.port
            : port;
        resolve(actualPort);
      };
      if (host) {
        httpServer.listen(port, host, onListening);
      } else {
        httpServer.listen(port, onListening);
      }
    });

  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      closing = true;
      watcher?.close();
      clearInterval(interval);
      clearTimeout(changeTimer);
      clearTimeout(lastChangeTimeout);
      clearTimeout(debounceTimeout);
      access.close();
      // An upgraded WebSocket otherwise prevents CLI shutdown.
      for (const client of wss.clients) {
        client.terminate();
      }
      wss.close(() => {
        httpServer.close((error) => {
          if (error) return reject(error);
          shareDBBackend.close(() => resolve());
        });
      });
    });

  return {
    app,
    httpServer,
    shareDBBackend,
    shareDBDoc,
    accessToken: access.token,
    ready,
    save,
    syncFromDisk,
    resolveConflict,
    listen,
    close,
  };
};
