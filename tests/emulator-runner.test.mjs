import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createEmulatorEnvironment } from '../scripts/run-firestore-emulator.mjs';

test('emulator child environment removes debug switches and secret-like variables', () => {
  const safe = createEmulatorEnvironment({
    PATH: 'tools',
    HOME: 'profile',
    DEBUG: '*',
    FIREBASE_DEBUG: '1',
    STITCH_API_KEY: 'sensitive',
    GEMINI_API_KEY: 'sensitive',
    SERVICE_ACCOUNT_PRIVATE_KEY: 'sensitive',
    GOOGLE_APPLICATION_CREDENTIALS: 'sensitive',
    USERNAME: 'developer',
  });

  assert.deepEqual(safe, {
    PATH: 'tools',
    HOME: 'profile',
    USERNAME: 'developer',
  });
});

test('emulator runner never prints parent secret or debug values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daily-os-emulator-runner-'));
  const sentinel = 'DO_NOT_PRINT_EMULATOR_SECRET_SENTINEL';
  const pathName = Object.keys(process.env).find((name) => name.toLowerCase() === 'path') ?? 'PATH';
  const fakeCli = process.platform === 'win32'
    ? join(directory, 'firebase.cmd')
    : join(directory, 'firebase');
  const fakeCliSource = process.platform === 'win32'
    ? '@echo off\necho STITCH=%STITCH_API_KEY%\necho GEMINI=%GEMINI_API_KEY%\necho DEBUG=%DEBUG%\nexit /b 0\n'
    : '#!/bin/sh\nprintf "STITCH=%s\\nGEMINI=%s\\nDEBUG=%s\\n" "$STITCH_API_KEY" "$GEMINI_API_KEY" "$DEBUG"\n';

  try {
    await writeFile(fakeCli, fakeCliSource, 'utf8');
    if (process.platform !== 'win32') await chmod(fakeCli, 0o755);
    const environment = {
      ...process.env,
      [pathName]: `${directory}${delimiter}${process.env[pathName] ?? ''}`,
      DEBUG: sentinel,
      FIREBASE_DEBUG: sentinel,
      STITCH_API_KEY: sentinel,
      GEMINI_API_KEY: sentinel,
    };
    const runnerPath = fileURLToPath(new URL('../scripts/run-firestore-emulator.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [runnerPath], {
      cwd: process.cwd(),
      env: environment,
      encoding: 'utf8',
      timeout: 10_000,
    });

    assert.equal(result.status, 0, 'fake emulator CLI should complete successfully');
    assert.equal(result.stdout.includes(sentinel), false, 'emulator output must not contain injected secrets or debug values');
    assert.equal(result.stderr.includes(sentinel), false, 'emulator errors must not contain injected secrets or debug values');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
