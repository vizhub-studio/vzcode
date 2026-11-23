// Integration smoke test for the tarball users actually install.
// Prerequisite: npm run build-release
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ShareDBClient from 'sharedb/lib/client/index.js';
import WebSocket from 'ws';
import { diff, json1Presence } from '../dist/ot.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = fs.mkdtempSync(
  path.join(os.tmpdir(), 'vzcode-package-smoke-'),
);
const installDir = path.join(tmp, 'install');
const workspace = path.join(tmp, 'workspace');
const npm =
  process.platform === 'win32' ? 'npm.cmd' : 'npm';
fs.mkdirSync(workspace, { recursive: true });
fs.writeFileSync(
  path.join(workspace, 'index.js'),
  'console.log("before");\n',
);

function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            command + ' failed (' + code + '): ' + stderr,
          ),
        );
      }
    });
  });
}

function startCLI(cliPath) {
  const child = spawn(
    process.execPath,
    [cliPath, workspace, '--port=0', '--no-open'],
    { cwd: tmp },
  );
  return child;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(
      () =>
        reject(
          new Error('CLI startup timed out: ' + output),
        ),
      15000,
    );
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(
        /Editor is live at http:\/\/127\.0\.0\.1:(\d+)\/#vzcode-token=([a-f0-9]{64})/,
      );
      if (match) {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolve({
          port: Number(match[1]),
          token: match[2],
        });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(
        new Error(
          'CLI exited before ready (' +
            code +
            '): ' +
            output,
        ),
      );
    });
  });
}

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function waitForSaved(file, expected) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (fs.readFileSync(file, 'utf8') === expected) {
      return;
    }
    await delay(50);
  }
  throw new Error('Edited workspace file was not saved');
}

async function checkCollaboration(port, token) {
  ShareDBClient.types.register(json1Presence.type);
  const socket = new WebSocket(
    'ws://127.0.0.1:' + port + '/ws',
    { headers: { Authorization: 'Bearer ' + token } },
  );
  const connection = new ShareDBClient.Connection(socket);
  try {
    const doc = connection.get('documents', '1');
    await new Promise((resolve, reject) =>
      doc.subscribe((error) =>
        error ? reject(error) : resolve(),
      ),
    );
    const fileId = Object.keys(doc.data.files).find(
      (id) => doc.data.files[id].name === 'index.js',
    );
    assert.ok(fileId, 'workspace file is loaded');
    const replacement = 'console.log("after");\n';
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
    await new Promise((resolve, reject) =>
      doc.submitOp(diff(doc.data, next), (error) =>
        error ? reject(error) : resolve(),
      ),
    );
    await waitForSaved(
      path.join(workspace, 'index.js'),
      replacement,
    );
  } finally {
    connection.close();
  }
}

async function stopCLI(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('CLI did not stop on SIGINT')),
      5000,
    );
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
  child.kill('SIGINT');
  const result = await exited;
  assert.equal(result.code, 0, 'clean shutdown');
}

let cli;
try {
  assert.ok(
    fs.existsSync(path.join(root, 'dist', 'index.html')),
    'Missing dist/index.html; run npm run build-release first',
  );
  assert.ok(
    fs.existsSync(path.join(root, 'dist', 'cli.js')),
    'Missing dist/cli.js; run npm run build-release first',
  );

  const output = await run(npm, [
    'pack',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    tmp,
  ]);
  const packed = JSON.parse(output)[0];
  const tarball = path.join(tmp, packed.filename);
  await run(npm, [
    'install',
    '--prefix',
    installDir,
    '--no-save',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    tarball,
  ]);

  const installed = path.join(
    installDir,
    'node_modules',
    'vzcode',
  );
  const cliPath = path.join(installed, 'dist', 'cli.js');
  assert.ok(
    fs.existsSync(
      path.join(installed, 'dist', 'index.html'),
    ),
    'Published tarball must include the client build',
  );

  cli = startCLI(cliPath);
  const { port, token } = await waitForServer(cli);
  const response = await fetch('http://127.0.0.1:' + port);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<div id="root"><\/div>/);
  const asset = html.match(/src="(\/assets\/[^"]+\.js)"/);
  assert.ok(asset, 'built JavaScript entry asset exists');
  const assetResponse = await fetch(
    'http://127.0.0.1:' + port + asset[1],
  );
  assert.equal(assetResponse.status, 200);
  await checkCollaboration(port, token);
  await stopCLI(cli);
  console.log('Packaged CLI smoke test passed.');
} finally {
  if (cli && cli.exitCode === null) {
    cli.kill('SIGKILL');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
