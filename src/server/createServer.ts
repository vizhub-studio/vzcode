import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import bodyParser from 'body-parser';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
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
}

export interface VZCodeServer {
  app: express.Express;
  httpServer: http.Server;
  shareDBBackend: ShareDB;
  /** The server-side ShareDB document for the workspace. */
  shareDBDoc: any;
  /** Resolves once the initial ShareDB document has been created. */
  ready: Promise<void>;
  /** Write changed files to disk (same routine used by auto-save). */
  save: () => void;
  /** Start listening; resolves with the actual bound port. */
  listen: (port: number) => Promise<number>;
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

  // Resolve file names from the ShareDB document against the workspace
  // root, so the server can operate on a directory other than the
  // process's current working directory.
  const resolvePath = (name: string): string =>
    path.resolve(cwd, name);

  const serveStaticDir =
    options.serveStaticDir === undefined
      ? path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          '..',
          '..',
          'dist',
        )
      : options.serveStaticDir;

  const initialDocument = computeInitialDocument({
    fullPath: cwd,
  });

  // Register our custom OT type,
  // because it does not ship with ShareDB.
  ShareDB.types.register(json1Presence.type);

  const app = express();

  // Use ShareDB over WebSocket
  const shareDBBackend = new ShareDB({
    // Enable presence
    presence: true,
    doNotForwardSendPresenceErrorsToClient: true,
  });
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
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
  let previousDocument = initialDocument;

  // Saves the files that changed.
  const save = () => {
    const currentDocument = shareDBDoc.data;

    // Take a look at each file (key) previously and currently.
    const allKeys = Object.keys({
      ...currentDocument.files,
      ...previousDocument.files,
    });

    const directoriesToDelete = [];

    for (const key of allKeys) {
      const previous = previousDocument.files[key];
      const current = currentDocument.files[key];

      // If this file was neither created nor deleted...
      if (previous && current) {
        // Handle changing of text content.
        if (previous.text !== current.text) {
          if (isImageFile(current.name)) {
            // Write image files as binary from base64
            const buffer = Buffer.from(
              current.text,
              'base64',
            );
            fs.writeFileSync(
              resolvePath(current.name),
              buffer,
            );
          } else {
            // Write non-image files as text
            fs.writeFileSync(
              resolvePath(current.name),
              current.text,
            );
          }
        }

        // Handle renaming files.
        if (previous.name !== current.name) {
          if (isDirectory(previous.name)) {
            // If the directory itself is being renamed,
            // Phase I: Ignore it, and get the files moved
            // Phase II: Keep track of these, and delete them after
            //           all the files moved.
            directoriesToDelete.push(previous.name);
          } else {
            const newDir = path.dirname(current.name);

            // Check if the new directory exists, if not, create it
            if (!fs.existsSync(resolvePath(newDir))) {
              fs.mkdirSync(resolvePath(newDir), {
                recursive: true,
              });
            }

            // Move the file to the new directory
            fs.renameSync(
              resolvePath(previous.name),
              resolvePath(current.name),
            );
          }
        }
      }

      // handle deleting files and directories.
      if (previous && !current) {
        const stats = fs.statSync(
          resolvePath(previous.name),
        );
        //Check if the file path we are trying to delete is a directory
        if (!stats.isDirectory()) {
          fs.unlinkSync(resolvePath(previous.name));
        } else {
          //Performs directory deletion.
          fs.rm(
            resolvePath(previous.name),
            {
              recursive: true, //Makes sure that all files in directory are deleted.
            },
            (error) => {
              if (error) {
                console.log(error);
              }
            },
          );
        }
      }

      // Handle creating files and Directories.
      if (!previous && current) {
        //File Creation
        if (!isDirectory(current.name)) {
          if (isImageFile(current.name)) {
            // Write image files as binary from base64
            const buffer = Buffer.from(
              current.text,
              'base64',
            );
            fs.writeFileSync(
              resolvePath(current.name),
              buffer,
            );
          } else {
            // Write non-image files as text
            fs.writeFileSync(
              resolvePath(current.name),
              current.text,
            );
          }
        } else {
          fs.mkdirSync(resolvePath(current.name), {
            recursive: true,
          });
        }
      }
    }
    // TODO deleted all directories under directoriesToDelete

    for (const dir of directoriesToDelete) {
      //Performs directory deletion.
      fs.rm(
        resolvePath(dir),
        {
          recursive: true, //Makes sure that all files in directory are deleted.
        },
        (error) => {
          if (error) {
            console.log(error);
          }
        },
      );
    }

    previousDocument = currentDocument;
  };

  let lastExecutedTime = Date.now();
  let lastChangeTimeout; // This timeout ensures the last change is saved

  // Function to throttle the saving
  function throttleSave() {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutedTime;

    if (timeSinceLastExecution > throttleTimeMS) {
      save();
      lastExecutedTime = now;
    } else {
      // Clear the previous timeout and set a new one to save the last change
      clearTimeout(lastChangeTimeout);
      lastChangeTimeout = setTimeout(() => {
        save();
        lastExecutedTime = now;
      }, throttleTimeMS - timeSinceLastExecution);
    }
  }

  // Function to debounce the saving
  let debounceTimeout;
  function debounceSave() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(
      save,
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
            // Subscribe to listen for modifications
            shareDBDoc.on('op', () => {
              if (shareDBDoc.data.isInteracting) {
                throttleSave();
              } else {
                debounceSave();
              }
            });
          }

          resolve();
        });
      },
    );
  });

  // Handle AI Assist requests.
  app.post(
    '/ai-assist',
    bodyParser.json(),
    handleAIAssist(shareDBDoc),
  );

  // Handle AI Copilot requests.
  app.post(
    '/ai-copilot',
    bodyParser.json(),
    handleAICopilot(),
  );

  // Handle AI Chat Message requests.
  app.post(
    '/ai-chat-message',
    bodyParser.json(),
    handleAIChatMessage({
      shareDBDoc,
      onCreditDeduction: undefined,
    }),
  );

  // Livekit Token Generator
  app.get('/livekit-token', async (req, res) => {
    const { room, username } = req.query;
    res.send(await createToken(room, username));
  });

  const listen = (port: number): Promise<number> =>
    new Promise((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      httpServer.once('error', onError);
      httpServer.listen(port, () => {
        httpServer.removeListener('error', onError);
        const address = httpServer.address();
        const actualPort =
          address && typeof address === 'object'
            ? address.port
            : port;
        resolve(actualPort);
      });
    });

  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      clearTimeout(lastChangeTimeout);
      clearTimeout(debounceTimeout);
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
    ready,
    save,
    listen,
    close,
  };
};
