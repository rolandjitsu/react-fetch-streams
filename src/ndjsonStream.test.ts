import {afterEach, expect, test, vi} from 'vitest';
import {cleanup, renderHook} from '@testing-library/react';
import {useNdjsonStream} from './ndjsonStream';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const enc = new TextEncoder();

// Stream the given chunks as bytes; strings are UTF-8 encoded, Uint8Arrays are
// sent as-is so tests can split a multi-byte character across chunks.
function mockFetch(chunks: Array<string | Uint8Array>, opts?: {end?: boolean}) {
  const fetch = vi.fn(async (..._args: unknown[]) => ({
    body: new ReadableStream({
      async start(ctrl) {
        for (const chunk of chunks) {
          ctrl.enqueue(typeof chunk === 'string' ? enc.encode(chunk) : chunk);
          await sleep(0.02);
        }
        if (opts?.end !== false) ctrl.close();
      }
    })
  }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const received = (onData: ReturnType<typeof vi.fn>) =>
  onData.mock.calls.map(c => c[0]);

test('useNdjsonStream() parses lines and reports done', async () => {
  mockFetch(['{"n":1}\n{"n":2}\n{"n":3}\n']);
  const onData = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();
  renderHook(() => useNdjsonStream('/x', {onData, onError, onDone}));

  await sleep(0.2);
  expect(received(onData)).toEqual([{n: 1}, {n: 2}, {n: 3}]);
  expect(onError).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('useNdjsonStream() reassembles a line split across chunks', async () => {
  mockFetch(['{"a":', '1}\n'], {end: false});
  const onData = vi.fn();
  renderHook(() => useNdjsonStream('/x', {onData}));

  await sleep(0.2);
  expect(received(onData)).toEqual([{a: 1}]);
});

test('useNdjsonStream() decodes a multi-byte char split across chunks', async () => {
  const bytes = enc.encode('{"s":"é"}\n'); // "é" is 0xC3 0xA9
  mockFetch([bytes.slice(0, 7), bytes.slice(7)], {end: false});
  const onData = vi.fn();
  renderHook(() => useNdjsonStream('/x', {onData}));

  await sleep(0.2);
  expect(received(onData)).toEqual([{s: 'é'}]);
});

test('useNdjsonStream() flushes a trailing line without a newline', async () => {
  mockFetch(['{"n":1}\n{"n":2}']); // no trailing newline
  const onData = vi.fn();
  const onDone = vi.fn();
  renderHook(() => useNdjsonStream('/x', {onData, onDone}));

  await sleep(0.2);
  expect(received(onData)).toEqual([{n: 1}, {n: 2}]);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('useNdjsonStream() skips blank lines', async () => {
  mockFetch(['{"n":1}\n\n{"n":2}\n'], {end: false});
  const onData = vi.fn();
  renderHook(() => useNdjsonStream('/x', {onData}));

  await sleep(0.2);
  expect(received(onData)).toEqual([{n: 1}, {n: 2}]);
});

test('useNdjsonStream() surfaces a malformed line and stops', async () => {
  mockFetch(['{"n":1}\nnot json\n{"n":3}\n'], {end: false});
  const onData = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();
  renderHook(() => useNdjsonStream('/x', {onData, onError, onDone}));

  await sleep(0.2);
  expect(received(onData)).toEqual([{n: 1}]);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onDone).not.toHaveBeenCalled();
});

test('useNdjsonStream() surfaces fetch errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('boom');
    })
  );
  const onError = vi.fn();
  renderHook(() => useNdjsonStream('/x', {onError}));

  await sleep(0.1);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError.mock.calls[0][0].message).toEqual('boom');
});

test('useNdjsonStream() close() stops the stream', async () => {
  mockFetch(['{"n":1}\n'], {end: false});
  const onData = vi.fn();
  const onError = vi.fn();
  const {result} = renderHook(() => useNdjsonStream('/x', {onData, onError}));

  await sleep(0.1);
  expect(received(onData)).toEqual([{n: 1}]);
  result.current.close();

  await sleep(0.1);
  expect(received(onData)).toEqual([{n: 1}]);
  expect(onError).not.toHaveBeenCalled();
});

function sleep(sec: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, sec * 1000);
  });
}
