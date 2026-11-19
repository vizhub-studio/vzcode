import { describe, it, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import ShareDBClient from 'sharedb/lib/client/index.js';
import { diff, json1Presence } from '../src/ot.js';

const cliPath = fileURLToPath(
  new URL('../dist/cli.js', import.meta.url),
);

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function invoke(...args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    timeout: 10000,
  });
}

function waitForServer(child: ReturnType<typeof spawn>) {
  return new Promise<number>((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error('CLI did not start: ' + output));
    }, 10000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(
        /Editor is live at http:\/\/127\.0\.0\.1:(\d+)/,
      );
      if (match) {
        clearTimeout(timeout);
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
        resolve(Number(match[1]));
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error('CLI exited (' + code + '): ' + output));
    });
  });
}

async function stopCLI(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null) return;
  const exit = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('CLI did not exit after SIGINT')),
      5000,
    );
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error('CLI exited with status ' + code));
      } else {
        resolve();
      }
    });
  });
  child.kill('SIGINT');
  await exit;
}

describe('VZCode CLI', () => {
  it('explains the standalone browser startup', () => {
    const result = invoke('--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: vzcode');
    expect(result.stdout).toContain('--no-open');
    expect(result.stdout).toContain('--desktop');
  });

  it('rejects invalid options and ports', () => {
    const port = invoke('--port=not-a-number');
    expect(port.status).toBe(1);
    expect(port.stderr).toContain('Invalid port');

    const missing = invoke('/not/a/real/workspace');
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain(
      'Workspace is not a directory',
    );
  });

  it('starts a local server and persists ShareDB edits', async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-cli-'),
    );
    const file = path.join(dir, 'index.js');
    fs.writeFileSync(file, 'const before = 1;\n');
    const child = spawn(
      process.execPath,
      [cliPath, dir, '--port=0', '--no-open'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let connection: any;
    try {
      const port = await waitForServer(child);
      const response = await fetch(
        'http://127.0.0.1:' + port + '/not-a-route',
      );
      expect(response.status).toBe(404);

      ShareDBClient.types.register(json1Presence.type);
      const socket = new WebSocket(
        'ws://127.0.0.1:' + port + '/ws',
      );
      connection = new ShareDBClient.Connection(socket);
      const doc = connection.get('documents', '1');
      await new Promise<void>((resolve, reject) =>
        doc.subscribe((error: Error | null) =>
          error ? reject(error) : resolve(),
        ),
      );

      const fileId = Object.keys(doc.data.files).find(
        (id) => doc.data.files[id].name === 'index.js',
      );
      if (!fileId) {
        throw new Error('Missing index.js in ShareDB document');
      }
      const replacement = 'const after = 2;\n';
      const next = {
        ...doc.data,
        files: {
          ...doc.data.files,
          [fileId]: {
            ...doc.data.files[fileId],
            text: replacement,
          },
        },
      };
      await new Promise<void>((resolve, reject) =>
        doc.submitOp(
          diff(doc.data, next),
          (error: Error | null) =>
            error ? reject(error) : resolve(),
        ),
      );

      let saved = false;
      for (let i = 0; i < 100; i++) {
        if (fs.readFileSync(file, 'utf8') === replacement) {
          saved = true;
          break;
        }
        await delay(50);
      }
      expect(saved).toBe(true);

      connection.close();
      connection = null;
      await stopCLI(child);
    } finally {
      connection?.close();
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 20000);
});
