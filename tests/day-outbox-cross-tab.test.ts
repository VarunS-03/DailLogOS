import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, createDefaultDayRecord } from '../src/constants/templates';
import {
  closeDayOutboxDatabase,
  createDayMutation,
  indexedDbDayOutbox,
  subscribeToDayOutbox,
} from '../src/services/dayOutbox';

class MockBroadcastChannel {
  private static channels = new Map<string, Set<MockBroadcastChannel>>();
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(private readonly name: string) {
    const channels = MockBroadcastChannel.channels.get(name) ?? new Set<MockBroadcastChannel>();
    channels.add(this);
    MockBroadcastChannel.channels.set(name, channels);
  }

  postMessage(data: unknown): void {
    MockBroadcastChannel.channels.get(this.name)?.forEach((channel) => {
      if (channel !== this) channel.onmessage?.({ data } as MessageEvent);
    });
  }

  close(): void {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

async function main() {
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: MockBroadcastChannel,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { addEventListener: () => undefined },
  });

  const otherTab = await import(
    new URL('../src/services/dayOutbox.ts?isolated-tab=2', import.meta.url).href
  ) as typeof import('../src/services/dayOutbox');

  let firstTabNotifications = 0;
  let secondTabNotifications = 0;
  const unsubscribeFirst = subscribeToDayOutbox(() => { firstTabNotifications += 1; });
  const unsubscribeSecond = otherTab.subscribeToDayOutbox(() => { secondTabNotifications += 1; });

  const uid = 'cross-tab-user';
  await indexedDbDayOutbox.removeForUid(uid);
  firstTabNotifications = 0;
  secondTabNotifications = 0;
  const operation = createDayMutation(
    uid,
    createDefaultDayRecord('2026-10-17', DEFAULT_SETTINGS),
    { notes: 'visible in both tabs' }
  );
  await indexedDbDayOutbox.enqueue(operation);

  assert.equal(firstTabNotifications, 1);
  assert.equal(secondTabNotifications, 1);
  assert.equal((await otherTab.indexedDbDayOutbox.list(uid)).length, 1);
  console.log('PASS: A new outbox operation notifies independent tab contexts.');

  unsubscribeFirst();
  unsubscribeSecond();
  await indexedDbDayOutbox.removeForUid(uid);
  await closeDayOutboxDatabase();
  await otherTab.closeDayOutboxDatabase();
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: originalBroadcastChannel,
  });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
