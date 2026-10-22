import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {
  createVZCodeServer,
  VZCodeServer,
} from '../src/server/createServer.js';

// Environment variables that would let the background AI processing
// reach a real provider. Deleting them makes `new OpenAI(...)` throw,
// which exercises the error path deterministically and offline.
const AI_ENV_KEYS = [
  'OPENAI_API_KEY',
  'VZCODE_AI_API_KEY',
  'VZCODE_AI_BASE_URL',
  'VZCODE_EDIT_WITH_AI_API_KEY',
  'VZCODE_EDIT_WITH_AI_BASE_URL',
];

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

const postJson = (
  url: string,
  payload: unknown,
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body,
          }),
        );
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });

describe('POST /ai-chat-message', () => {
  let server: VZCodeServer;
  let workspaceDir: string;
  let port: number;
  const savedEnv: Record<string, string | undefined> = {};

  const url = () =>
    `http://127.0.0.1:${port}/ai-chat-message`;

  beforeAll(async () => {
    for (const key of AI_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }

    workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vzcode-ai-route-'),
    );
    fs.writeFileSync(
      path.join(workspaceDir, 'index.js'),
      "console.log('hello');\n",
    );

    server = createVZCodeServer({
      cwd: workspaceDir,
      autoSave: false,
      serveStaticDir: null,
    });
    await server.ready;
    port = await server.listen(0);
  });

  afterAll(async () => {
    await server.close();
    fs.rmSync(workspaceDir, {
      recursive: true,
      force: true,
    });
    for (const key of AI_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('rejects a request without a string content', async () => {
    const { status, body } = await postJson(url(), {
      chatId: 'chat-1',
    });
    expect(status).toBe(400);
    expect(body).toContain('content is required');
  });

  it('rejects a request without a string chatId', async () => {
    const { status, body } = await postJson(url(), {
      content: 'hello',
    });
    expect(status).toBe(400);
    expect(body).toContain('chatId is required');
  });

  it('accepts a valid request, persists the user message, and handles the background failure', async () => {
    // The background failure intentionally logs to console.error/warn.
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    try {
      const { status, body } = await postJson(url(), {
        content: 'Hello AI',
        chatId: 'chat-valid',
      });
      expect(status).toBe(200);
      expect(JSON.parse(body)).toBe('success');

      // The user message is added synchronously before the response.
      await waitFor(() =>
        Boolean(
          server.shareDBDoc.data.chats?.['chat-valid'],
        ),
      );
      const chat =
        server.shareDBDoc.data.chats['chat-valid'];
      expect(
        chat.messages.some(
          (message: any) =>
            message.role === 'user' &&
            message.content === 'Hello AI',
        ),
      ).toBe(true);

      // The background AI request fails (no provider configured) and is
      // surfaced as an assistant error message rather than crashing.
      await waitFor(() =>
        chat.messages.some(
          (message: any) =>
            message.role === 'assistant' &&
            /encountered an error/i.test(message.content),
        ),
      );
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
