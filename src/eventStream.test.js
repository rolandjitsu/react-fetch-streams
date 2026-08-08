import {afterEach, expect, test, vi} from 'vitest';
import {cleanup, renderHook} from '@testing-library/react';
import {useEventStream} from './eventStream';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Emit each chunk as encoded bytes so the hook's TextDecoder path runs. A gap
// between chunks keeps them from coalescing into a single read.
function sseBody(chunks, {end = true} = {}) {
  const enc = new TextEncoder();
  return {
    body: new ReadableStream({
      async start(ctrl) {
        for (const chunk of chunks) {
          ctrl.enqueue(enc.encode(chunk));
          await sleep(0.02);
        }
        if (end) ctrl.close();
      }
    })
  };
}

function mockFetch(chunks, opts) {
  const fetch = vi.fn(async () => sseBody(chunks, opts));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

test('useEventStream() parses consecutive events', async () => {
  mockFetch(['data: {"count":1}\n\n', 'data: {"count":2}\n\n'], {end: false});
  const onEvent = vi.fn();
  renderHook(() => useEventStream('/sse', {onEvent, retry: false}));

  await sleep(0.2);
  expect(onEvent).toHaveBeenCalledTimes(2);
  expect(onEvent.mock.calls[0][0].event).toEqual('message');
  expect(JSON.parse(onEvent.mock.calls[0][0].data)).toEqual({count: 1});
  expect(JSON.parse(onEvent.mock.calls[1][0].data)).toEqual({count: 2});
});

test('useEventStream() named event, id, and multi-line data', async () => {
  mockFetch(['event: tick\nid: 42\ndata: line1\ndata: line2\n\n'], {
    end: false
  });
  const onEvent = vi.fn();
  renderHook(() => useEventStream('/sse', {onEvent, retry: false}));

  await sleep(0.15);
  expect(onEvent).toHaveBeenCalledTimes(1);
  expect(onEvent.mock.calls[0][0]).toEqual({
    event: 'tick',
    data: 'line1\nline2',
    id: '42'
  });
});

test('useEventStream() ignores comments and retry lines', async () => {
  mockFetch([': keep-alive\nretry: 1000\ndata: hi\n\n'], {end: false});
  const onEvent = vi.fn();
  renderHook(() => useEventStream('/sse', {onEvent, retry: false}));

  await sleep(0.15);
  expect(onEvent).toHaveBeenCalledTimes(1);
  expect(onEvent.mock.calls[0][0].data).toEqual('hi');
});

test('useEventStream() reassembles a frame split across chunks', async () => {
  mockFetch(['data: hel', 'lo\n', '\n'], {end: false});
  const onEvent = vi.fn();
  renderHook(() => useEventStream('/sse', {onEvent, retry: false}));

  await sleep(0.2);
  expect(onEvent).toHaveBeenCalledTimes(1);
  expect(onEvent.mock.calls[0][0].data).toEqual('hello');
});

test('useEventStream() sends fetchParams and an SSE Accept header', async () => {
  const fetch = mockFetch(['data: x\n\n'], {end: false});
  const onEvent = vi.fn();
  renderHook(() =>
    useEventStream('/sse', {
      onEvent,
      retry: false,
      fetchParams: {
        method: 'POST',
        body: 'q',
        headers: {Authorization: 'Bearer t'}
      }
    })
  );

  await sleep(0.1);
  const init = fetch.mock.calls[0][1];
  expect(init.method).toEqual('POST');
  expect(init.body).toEqual('q');
  expect(init.headers.get('Authorization')).toEqual('Bearer t');
  expect(init.headers.get('Accept')).toEqual('text/event-stream');
});

test('useEventStream() reconnects with Last-Event-ID', async () => {
  const fetch = vi
    .fn()
    .mockImplementationOnce(async () =>
      sseBody(['id: 7\ndata: a\n\n'], {end: true})
    )
    .mockImplementationOnce(async () => sseBody(['data: b\n\n'], {end: false}));
  vi.stubGlobal('fetch', fetch);
  const onEvent = vi.fn();
  renderHook(() => useEventStream('/sse', {onEvent, retry: 20}));

  await sleep(0.3);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(onEvent.mock.calls[0][0].data).toEqual('a');
  expect(onEvent.mock.calls[1][0].data).toEqual('b');
  expect(fetch.mock.calls[1][1].headers.get('Last-Event-ID')).toEqual('7');
});

test('useEventStream() does not reconnect when retry is false', async () => {
  const fetch = mockFetch(['data: a\n\n'], {end: true});
  renderHook(() => useEventStream('/sse', {onEvent: vi.fn(), retry: false}));

  await sleep(0.2);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('useEventStream() surfaces fetch errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('boom');
    })
  );
  const onError = vi.fn();
  renderHook(() => useEventStream('/sse', {onError, retry: false}));

  await sleep(0.1);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError.mock.calls[0][0].message).toEqual('boom');
});

test('useEventStream() close() stops the stream', async () => {
  mockFetch(['data: a\n\n'], {end: false});
  const onEvent = vi.fn();
  const onError = vi.fn();
  const {result} = renderHook(() =>
    useEventStream('/sse', {onEvent, onError, retry: 20})
  );

  await sleep(0.1);
  expect(onEvent).toHaveBeenCalledTimes(1);
  result.current.close();

  await sleep(0.1);
  expect(onEvent).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

function sleep(sec) {
  return new Promise(resolve => {
    setTimeout(resolve, sec * 1000);
  });
}
