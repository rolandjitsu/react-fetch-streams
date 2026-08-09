import {afterEach, expect, test, vi} from 'vitest';
import {cleanup, renderHook} from '@testing-library/react';
import {useStream} from './stream';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The hook only reads `res.body`, so a fetch response is faked as `{body}`.
// Passing a ReadableStream straight through matches how a browser exposes it.
function mockFetch(makeStream: () => ReadableStream) {
  const fetch = vi.fn(async (..._args: unknown[]) => ({body: makeStream()}));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

test('useStream()', async () => {
  mockFetch(
    () =>
      new ReadableStream({
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.enqueue(JSON.stringify({count: 2}));
          ctrl.close();
        }
      })
  );

  const onNext = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();

  renderHook(() => useStream('/counter', {onNext, onError, onDone}));

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  let [res] = onNext.mock.calls[0];
  let data = await res.json();
  expect(data).toEqual({count: 1});

  await sleep(1);
  expect(onNext).toHaveBeenCalledTimes(2);
  res = onNext.mock.calls[1][0];
  data = await res.json();
  expect(data).toEqual({count: 2});

  expect(onError).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('useStream() fetch error', async () => {
  const fetch = vi.fn(async () => {
    throw new Error('Oops ...');
  });
  vi.stubGlobal('fetch', fetch);

  const onNext = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();

  renderHook(() => useStream('/counter', {onNext, onError, onDone}));

  await sleep(0.1);
  expect(onError).toHaveBeenCalledTimes(1);
  const [err] = onError.mock.calls[0];
  expect(err.message).toEqual('Oops ...');

  expect(onNext).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});

test('useStream() read error', async () => {
  mockFetch(
    () =>
      new ReadableStream({
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.error(new Error('Oops ...'));
        }
      })
  );

  const onNext = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();

  renderHook(() => useStream('/counter', {onNext, onError, onDone}));

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  const [res] = onNext.mock.calls[0];
  const data = await res.json();
  expect(data).toEqual({count: 1});

  await sleep(1);
  expect(onError).toHaveBeenCalledTimes(1);
  const [err] = onError.mock.calls[0];
  expect(err.message).toEqual('Oops ...');

  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onDone).not.toHaveBeenCalled();
});

test('useStream() close()', async () => {
  const onCancel = vi.fn();
  mockFetch(
    () =>
      new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.enqueue(JSON.stringify({count: 2}));
          ctrl.close();
        }
      })
  );

  const onNext = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();

  const {result} = renderHook(() =>
    useStream('/counter', {onNext, onError, onDone})
  );
  const {close} = result.current;

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  const [res] = onNext.mock.calls[0];
  const data = await res.json();
  expect(data).toEqual({count: 1});

  close();

  await sleep(1);
  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('useStream() unmount', async () => {
  const onCancel = vi.fn();
  mockFetch(
    () =>
      new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.enqueue(JSON.stringify({count: 2}));
          ctrl.close();
        }
      })
  );

  const onNext = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();

  const {unmount} = renderHook(() =>
    useStream('/counter', {onNext, onError, onDone})
  );

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);

  unmount();

  await sleep(1);
  // Unmounting aborts before the second chunk is read.
  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

test('useStream() URL change', async () => {
  const onCancel = vi.fn();
  mockFetch(
    () =>
      new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.close();
        }
      })
  );

  const onNext = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();

  const {rerender} = renderHook(
    props => useStream(props?.url ?? '/counter-1', {onNext, onError, onDone}),
    {initialProps: {url: '/counter-1'}}
  );

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  let [res] = onNext.mock.calls[0];
  let data = await res.json();
  expect(data).toEqual({count: 1});

  rerender({url: '/counter-2'});

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(2);
  res = onNext.mock.calls[1][0];
  data = await res.json();
  expect(data).toEqual({count: 1});

  await sleep(1);
  expect(onError).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(2);
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('useStream() fetch params change', async () => {
  const onCancel = vi.fn();
  const fetch = mockFetch(
    () =>
      new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.close();
        }
      })
  );

  const onNext = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();

  const fp = {};
  const {rerender} = renderHook(
    props =>
      useStream('/counter', {
        onNext,
        onError,
        onDone,
        fetchParams: props?.fetchParams ?? fp
      }),
    {initialProps: {fetchParams: fp}}
  );

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  let [res] = onNext.mock.calls[0];
  let data = await res.json();
  expect(data).toEqual({count: 1});

  rerender({fetchParams: {mode: 'cors'}});

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(2);
  res = onNext.mock.calls[1][0];
  data = await res.json();
  expect(data).toEqual({count: 1});

  await sleep(1);
  expect(onError).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(2);
  expect(onCancel).toHaveBeenCalledTimes(1);

  const lastInit = fetch.mock.calls[
    fetch.mock.calls.length - 1
  ][1] as RequestInit;
  expect(lastInit.mode).toEqual('cors');
});

test('useStream() onNext() change', async () => {
  const onCancel = vi.fn();
  mockFetch(
    () =>
      new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.enqueue(JSON.stringify({count: 2}));
          ctrl.close();
        }
      })
  );

  const onNext1 = vi.fn();
  const onError = vi.fn();
  const onDone = vi.fn();

  const {rerender} = renderHook(
    props =>
      useStream('/counter', {
        onError,
        onDone,
        onNext: props?.onNext ?? onNext1
      }),
    {initialProps: {onNext: onNext1}}
  );

  await sleep(0.1);
  expect(onNext1).toHaveBeenCalledTimes(1);
  let [res] = onNext1.mock.calls[0];
  let data = await res.json();
  expect(data).toEqual({count: 1});

  const onNext2 = vi.fn();
  rerender({onNext: onNext2});

  await sleep(1);
  expect(onNext2).toHaveBeenCalledTimes(1);
  res = onNext2.mock.calls[0][0];
  data = await res.json();
  expect(data).toEqual({count: 2});

  expect(onNext1).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onCancel).not.toHaveBeenCalled();
});

test('useStream() onError() change', async () => {
  const onCancel = vi.fn();
  mockFetch(
    () =>
      new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.error(new Error('Oops ...'));
        }
      })
  );

  const onNext = vi.fn();
  const onError1 = vi.fn();
  const onDone = vi.fn();

  const {rerender} = renderHook(
    props =>
      useStream('/counter', {
        onNext,
        onDone,
        onError: props?.onError ?? onError1
      }),
    {initialProps: {onError: onError1}}
  );

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  const [res] = onNext.mock.calls[0];
  const data = await res.json();
  expect(data).toEqual({count: 1});

  const onError2 = vi.fn();
  rerender({onError: onError2});

  await sleep(1);
  expect(onError2).toHaveBeenCalledTimes(1);
  const [err] = onError2.mock.calls[0];
  expect(err.message).toEqual('Oops ...');

  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onError1).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
});

test('useStream() onDone() change', async () => {
  const onCancel = vi.fn();
  mockFetch(
    () =>
      new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.close();
        }
      })
  );

  const onNext = vi.fn();
  const onError = vi.fn();
  const onDone1 = vi.fn();

  const {rerender} = renderHook(
    props =>
      useStream('/counter', {
        onNext,
        onError,
        onDone: props?.onDone ?? onDone1
      }),
    {initialProps: {onDone: onDone1}}
  );

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  const [res] = onNext.mock.calls[0];
  const data = await res.json();
  expect(data).toEqual({count: 1});

  const onDone2 = vi.fn();
  rerender({onDone: onDone2});

  await sleep(1);
  expect(onDone2).toHaveBeenCalledTimes(1);

  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
  expect(onDone1).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
});

test('useStream() no params', async () => {
  const fetch = mockFetch(
    () =>
      new ReadableStream({
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.enqueue(JSON.stringify({count: 2}));
          ctrl.close();
        }
      })
  );

  renderHook(() => useStream('/counter'));

  await sleep(1.1);
  expect(fetch).toHaveBeenCalledTimes(1);
});

function sleep(sec: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, sec * 1000);
  });
}
