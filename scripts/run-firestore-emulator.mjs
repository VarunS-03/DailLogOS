import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function createEmulatorEnvironment(source) {
  return Object.fromEntries(
    Object.entries(source).filter(([name]) =>
      name !== 'DEBUG' &&
      name !== 'FIREBASE_DEBUG' &&
      !/(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PRIVATE[_-]?KEY|CREDENTIAL)/i.test(name),
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const isWindows = process.platform === 'win32';
  const command = isWindows
    ? 'firebase.cmd emulators:exec --project demo-daily-os --only firestore "tsx tests/day-sync-emulator.test.ts"'
    : 'firebase';
  const args = isWindows
    ? []
    : ['emulators:exec', '--project', 'demo-daily-os', '--only', 'firestore', 'tsx tests/day-sync-emulator.test.ts'];
  const child = spawn(
    command,
    args,
    {
      cwd: process.cwd(),
      env: createEmulatorEnvironment(process.env),
      stdio: 'inherit',
      shell: isWindows,
    },
  );

  child.once('error', (error) => {
    process.stderr.write(`Could not start Firestore Emulator test runner: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
