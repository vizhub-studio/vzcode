import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import WebSocket from 'ws';
import ShareDBClient from 'sharedb/lib/client/index.js';
import { json1Presence, diff } from '../src/ot.js';
import {
  createVZCodeServer,
  VZCodeServer,
} from '../src/server/createServer.js';

// The ShareDB client must know the OT type to apply ops locally.
ShareDBClient.types.register(json1Presence.type);

// A minimal 1x1 pixel PNG (base64).
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGAnqnXAAAAElFTkSuQmCC';

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 5000,
): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const httpRequest = (
  url: string,
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body,
          }),
        );
      })
      .on('error', reject);
  });

const findIdByName = (
  files: Record<string, { name: string }>,
  name: string,
): string => {
  const id = Object.keys(files).find(
    (key) => files[key].name === name,
  );
  if (!id) throw new Error(`No file named ${name}`);
  return id;
};

describe('VZCode server end-to-end', () => {
  let server: VZCodeServer;
  let workspaceDir: string;
  let distDir: string;
  let port: number;

  const connectClient = (): Promise<{
    connection: { close: () => void };
    doc: any;
  }> =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${port}`,
      );
      const connection = new ShareDBClient.Connection(
        socket,
      );
      const doc = connection.get('documents', '1');
      doc.subscribe((error: Error | null) => {
        if (error) return reject(error);
        resolve({ connection, doc });
      });
    });

  // Connects a real ShareDB client, applies a `files` mutation via a
  // real json1 op, waits for the server-side doc to observe it, then
  // triggers a save to disk (autoSave is disabled in tests).
  const editFiles = async ({
    mutate,
    until,
  }: {
    mutate: (
      files: Record<string, any>,
    ) => Record<string, any>;
    until: () => boolean;
  }): Promise<void> => {
    const { connection, doc } = await connectClient();
    try {
      const current = doc.data;
      const next = {
        ...current,
        files: mutate({ ...current.files }),
      };
      const op = diff(current, next);
      await new Promise<void>((resolve, reject) => {
        doc.submitOp(op, (error: Error | null) =>
          error ? reject(error) : resolve(),
        );
      });
      await waitFor(until);
      server.save();
    } finally {
      connection.close();
    }
  };

  beforeEach(async () => {
    workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-e2e-workspace-'),
    );
    fs.writeFileSync(
      path.join(workspaceDir, 'index.js'),
      "console.log('hello');\n",
    );
    fs.writeFileSync(
      path.join(workspaceDir, 'styles.css'),
      'body { color: red; }\n',
    );

    distDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-e2e-dist-'),
    );
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<h1>VZCode</h1>',
    );

    server = createVZCodeServer({
      cwd: workspaceDir,
      autoSave: false,
      serveStaticDir: distDir,
    });
    await server.ready;
    port = await server.listen(0);
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(workspaceDir, {
      recursive: true,
      force: true,
    });
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('serves the built client over HTTP', async () => {
    const { status, body } = await httpRequest(
      `http://127.0.0.1:${port}/`,
    );
    expect(status).toBe(200);
    expect(body).toContain('VZCode');
  });

  it('returns 404 for unknown routes', async () => {
    const { status } = await httpRequest(
      `http://127.0.0.1:${port}/does-not-exist`,
    );
    expect(status).toBe(404);
  });

  it('exposes the initial workspace files over ShareDB/WebSocket', async () => {
    const { connection, doc } = await connectClient();
    try {
      const files = Object.values(doc.data.files) as Array<{
        name: string;
        text: string;
      }>;
      const names = files.map((file) => file.name).sort();
      expect(names).toEqual(['index.js', 'styles.css']);
      const indexJs = files.find(
        (file) => file.name === 'index.js',
      );
      expect(indexJs?.text).toBe("console.log('hello');\n");
    } finally {
      connection.close();
    }
  });

  it('creates new files on disk', async () => {
    await editFiles({
      mutate: (files) => ({
        ...files,
        e2eNewFile: {
          name: 'new-file.js',
          text: "console.log('created via OT');\n",
        },
      }),
      until: () =>
        Boolean(server.shareDBDoc.data.files.e2eNewFile),
    });
    expect(
      fs.readFileSync(
        path.join(workspaceDir, 'new-file.js'),
        'utf8',
      ),
    ).toBe("console.log('created via OT');\n");
  });

  it('saves text edits to existing files', async () => {
    const id = findIdByName(
      server.shareDBDoc.data.files,
      'index.js',
    );
    const updatedText = "console.log('changed');\n";
    await editFiles({
      mutate: (files) => ({
        ...files,
        [id]: { ...files[id], text: updatedText },
      }),
      until: () =>
        server.shareDBDoc.data.files[id].text ===
        updatedText,
    });
    expect(
      fs.readFileSync(
        path.join(workspaceDir, 'index.js'),
        'utf8',
      ),
    ).toBe(updatedText);
  });

  it('renames files on disk', async () => {
    const id = findIdByName(
      server.shareDBDoc.data.files,
      'index.js',
    );
    await editFiles({
      mutate: (files) => ({
        ...files,
        [id]: { ...files[id], name: 'renamed.js' },
      }),
      until: () =>
        server.shareDBDoc.data.files[id].name ===
        'renamed.js',
    });
    expect(
      fs.existsSync(path.join(workspaceDir, 'index.js')),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(workspaceDir, 'renamed.js')),
    ).toBe(true);
    expect(
      fs.readFileSync(
        path.join(workspaceDir, 'renamed.js'),
        'utf8',
      ),
    ).toBe("console.log('hello');\n");
  });

  it('deletes files from disk', async () => {
    const id = findIdByName(
      server.shareDBDoc.data.files,
      'styles.css',
    );
    await editFiles({
      mutate: (files) => {
        const next = { ...files };
        delete next[id];
        return next;
      },
      until: () => !server.shareDBDoc.data.files[id],
    });
    expect(
      fs.existsSync(path.join(workspaceDir, 'styles.css')),
    ).toBe(false);
  });

  it('creates directories on disk', async () => {
    await editFiles({
      mutate: (files) => ({
        ...files,
        e2eNewDir: { name: 'newdir/', text: null },
      }),
      until: () =>
        Boolean(server.shareDBDoc.data.files.e2eNewDir),
    });
    const dir = path.join(workspaceDir, 'newdir');
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  it('deletes directories from disk', async () => {
    await editFiles({
      mutate: (files) => ({
        ...files,
        e2eNewDir: { name: 'newdir/', text: null },
      }),
      until: () =>
        Boolean(server.shareDBDoc.data.files.e2eNewDir),
    });
    const dir = path.join(workspaceDir, 'newdir');
    expect(fs.existsSync(dir)).toBe(true);

    await editFiles({
      mutate: (files) => {
        const next = { ...files };
        delete next.e2eNewDir;
        return next;
      },
      until: () => !server.shareDBDoc.data.files.e2eNewDir,
    });
    // Directory removal is asynchronous (fs.rm with a callback).
    await waitFor(() => !fs.existsSync(dir));
  });

  it('writes image files as binary', async () => {
    await editFiles({
      mutate: (files) => ({
        ...files,
        e2eImage: {
          name: 'pixel.png',
          text: PIXEL_PNG_BASE64,
        },
      }),
      until: () =>
        Boolean(server.shareDBDoc.data.files.e2eImage),
    });
    const written = fs.readFileSync(
      path.join(workspaceDir, 'pixel.png'),
    );
    expect(
      written.equals(
        Buffer.from(PIXEL_PNG_BASE64, 'base64'),
      ),
    ).toBe(true);
  });
});
