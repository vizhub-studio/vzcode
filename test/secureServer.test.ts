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
import WebSocket from 'ws';
import ShareDBClient from 'sharedb/lib/client/index.js';
import { diff, json1Presence } from '../src/ot.js';
import {
  createVZCodeServer,
  type VZCodeServer,
} from '../src/server/createServer.js';

ShareDBClient.types.register(json1Presence.type);

describe('standalone server security', () => {
  let parent: string;
  let root: string;
  let server: VZCodeServer;
  let port: number;

  const base = () => 'http://127.0.0.1:' + port;
  const wsUrl = () => 'ws://127.0.0.1:' + port + '/ws';

  beforeEach(async () => {
    parent = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-secure-server-'),
    );
    root = path.join(parent, 'workspace');
    fs.mkdirSync(root);
    fs.mkdirSync(path.join(parent, 'outside'));
    fs.writeFileSync(path.join(root, 'index.js'), 'original');
    fs.writeFileSync(path.join(parent, 'outside', 'secret.js'), 'secret');
    fs.symlinkSync(
      path.join(parent, 'outside'),
      path.join(root, 'linked'),
      'dir',
    );
    server = createVZCodeServer({
      cwd: root,
      serveStaticDir: null,
      autoSave: false,
    });
    await server.ready;
    port = await server.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(parent, { recursive: true, force: true });
  });

  const session = async () => {
    const response = await fetch(base() + '/auth/session', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + server.accessToken,
        Origin: base(),
      },
    });
    expect(response.status).toBe(204);
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    return cookie!.split(';')[0];
  };

  const client = (cookie: string) => {
    const socket = new WebSocket(wsUrl(), {
      headers: {
        Cookie: cookie,
        Origin: base(),
      },
    });
    const connection = new ShareDBClient.Connection(socket);
    const doc = connection.get('documents', '1');
    return { socket, connection, doc };
  };

  const submitFiles = async (
    doc: any,
    update: (files: Record<string, any>) => Record<string, any>,
  ) => {
    const next = {
      ...doc.data,
      files: update({ ...doc.data.files }),
    };
    await new Promise<void>((resolve, reject) =>
      doc.submitOp(diff(doc.data, next), (error: Error | null) =>
        error ? reject(error) : resolve(),
      ),
    );
  };

  it('denies anonymous and cross-origin HTTP requests', async () => {
    expect((await fetch(base() + '/auth/status')).status).toBe(401);
    expect(
      (
        await fetch(base() + '/auth/session', {
          method: 'POST',
          headers: { Authorization: 'Bearer wrong' },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(base() + '/ai-chat-message', {
          method: 'POST',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(base() + '/livekit-token')
      ).status,
    ).toBe(401);

    const cookie = await session();
    expect(
      (
        await fetch(base() + '/auth/status', {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(base() + '/auth/status', {
          headers: {
            Cookie: cookie,
            Origin: 'https://attacker.example',
          },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(base() + '/auth/session', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + server.accessToken,
            Origin: 'https://attacker.example',
          },
        })
      ).status,
    ).toBe(401);
  });

  it('revokes the browser session on logout', async () => {
    const cookie = await session();
    expect(
      (
        await fetch(base() + '/auth/status', {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(base() + '/auth/logout', {
          method: 'POST',
          headers: { Cookie: cookie, Origin: base() },
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await fetch(base() + '/auth/status', {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(401);
  });

  it('rejects unauthorized or cross-origin WebSocket upgrades', async () => {
    const denied = (headers: Record<string, string>) =>
      new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(wsUrl(), { headers });
        socket.once('open', () => {
          socket.terminate();
          reject(new Error('Unauthorized socket was accepted'));
        });
        socket.once('error', (error) => {
          if (/401/.test(error.message)) resolve();
          else reject(error);
        });
      });

    await denied({});
    const cookie = await session();
    await denied({
      Cookie: cookie,
      Origin: 'https://attacker.example',
    });
  });

  it('rejects edits if an existing file becomes a symlink', async () => {
    // A different process replaces the leaf after the initial scan.
    fs.rmSync(path.join(root, 'index.js'));
    fs.symlinkSync(
      path.join(parent, 'outside', 'secret.js'),
      path.join(root, 'index.js'),
    );

    const cookie = await session();
    const { connection, doc } = client(cookie);
    try {
      await new Promise<void>((resolve, reject) =>
        doc.subscribe((error: Error | null) =>
          error ? reject(error) : resolve(),
        ),
      );
      const id = Object.keys(doc.data.files).find(
        (key) => doc.data.files[key].name === 'index.js',
      );
      expect(id).toBeDefined();
      await expect(
        submitFiles(doc, (files) => ({
          ...files,
          [id!]: { ...files[id!], text: 'attack' },
        })),
      ).rejects.toThrow();
      expect(
        fs.readFileSync(
          path.join(parent, 'outside', 'secret.js'),
          'utf8',
        ),
      ).toBe('secret');
    } finally {
      connection.close();
    }
  });

  it('rejects traversal and symlink edits before committing', async () => {
    const cookie = await session();
    const { connection, doc } = client(cookie);
    try {
      await new Promise<void>((resolve, reject) =>
        doc.subscribe((error: Error | null) =>
          error ? reject(error) : resolve(),
        ),
      );
      const invalidNames = [
        '../outside/secret.js',
        '/tmp/vzcode-pwned.js',
        'linked/secret.js',
      ];
      for (const name of invalidNames) {
        await expect(
          submitFiles(doc, (files) => ({
            ...files,
            attack: { name, text: 'overwritten' },
          })),
        ).rejects.toThrow();
        expect(server.shareDBDoc.data.files.attack).toBeUndefined();
      }
      expect(
        fs.readFileSync(
          path.join(parent, 'outside', 'secret.js'),
          'utf8',
        ),
      ).toBe('secret');

      await submitFiles(doc, (files) => ({
        ...files,
        safeFile: { name: 'safe.js', text: 'safe' },
      }));
      expect(server.shareDBDoc.data.files.safeFile.name).toBe('safe.js');
      server.save();
      expect(
        fs.readFileSync(path.join(root, 'safe.js'), 'utf8'),
      ).toBe('safe');
    } finally {
      connection.close();
    }
  });
});
