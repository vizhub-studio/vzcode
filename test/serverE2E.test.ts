import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
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

const getText = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });

describe('VZCode server end-to-end', () => {
  let server: VZCodeServer;
  let workspaceDir: string;
  let distDir: string;
  let port: number;
  const clients: Array<{ close: () => void }> = [];

  const connectClient = (): Promise<{
    connection: any;
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

  beforeAll(async () => {
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

  afterAll(async () => {
    for (const client of clients) client.close();
    if (server) await server.close();
    fs.rmSync(workspaceDir, {
      recursive: true,
      force: true,
    });
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('serves the built client over HTTP', async () => {
    const body = await getText(`http://127.0.0.1:${port}/`);
    expect(body).toContain('VZCode');
  });

  it('exposes the initial workspace files over ShareDB/WebSocket', async () => {
    const { connection, doc } = await connectClient();
    clients.push(connection);

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
  });

  it('applies a client edit through OT and saves it to disk', async () => {
    const { connection, doc } = await connectClient();
    clients.push(connection);

    const newFileId = 'e2eNewFile';
    const current = doc.data;
    const next = {
      ...current,
      files: {
        ...current.files,
        [newFileId]: {
          name: 'new-file.js',
          text: "console.log('created via OT');\n",
        },
      },
    };

    const op = diff(current, next);
    await new Promise<void>((resolve, reject) => {
      doc.submitOp(op, (error: Error | null) => {
        if (error) return reject(error);
        resolve();
      });
    });

    // The op must reach the server-side document's data before saving.
    await waitFor(() =>
      Boolean(server.shareDBDoc.data.files[newFileId]),
    );

    server.save();

    const written = fs.readFileSync(
      path.join(workspaceDir, 'new-file.js'),
      'utf8',
    );
    expect(written).toBe(
      "console.log('created via OT');\n",
    );
  });
});
