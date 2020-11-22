import {cleanup, renderHook} from '@testing-library/react-hooks';
import fetchMock from 'fetch-mock-jest';
import {useStream} from './stream';

afterEach(async () => {
  fetchMock.reset();
  await cleanup();
});

test('useStream()', async () => {
  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(JSON.stringify({count: 1}));
      await sleep(1);
      ctrl.enqueue(JSON.stringify({count: 2}));
      ctrl.close();
    }
  });
  const response = new Response();
  // NOTE: This is a hack; we should pass the stream
  // to the Response (not supported yet).
  response.body = stream;

  fetchMock.mock('*', null, {response});

  const onNext = jest.fn();
  const onError = jest.fn();
  const onDone = jest.fn();

  const {result} = renderHook(() =>
    useStream('/counter', {onNext, onError, onDone})
  );
  expect(result.error).toBeUndefined();

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
  fetchMock.mock('*', {throws: new Error('Oops ...')});

  const onNext = jest.fn();
  const onError = jest.fn();
  const onDone = jest.fn();

  const {result} = renderHook(() =>
    useStream('/counter', {onNext, onError, onDone})
  );
  expect(result.error).toBeUndefined();

  await sleep(0.1);
  expect(onError).toHaveBeenCalledTimes(1);
  const [err] = onError.mock.calls[0];
  expect(err.message).toEqual('Oops ...');

  expect(onNext).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});

test('useStream() read error', async () => {
  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(JSON.stringify({count: 1}));
      await sleep(1);
      ctrl.error(new Error('Oops ...'));
      ctrl.close();
    }
  });
  const response = new Response();
  // NOTE: This is a hack; we should pass the stream
  // to the Response (not supported yet).
  response.body = stream;

  fetchMock.mock('*', null, {response});

  const onNext = jest.fn();
  const onError = jest.fn();
  const onDone = jest.fn();

  const {result} = renderHook(() =>
    useStream('/counter', {onNext, onError, onDone})
  );
  expect(result.error).toBeUndefined();

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
  const onCancel = jest.fn();
  const stream = new ReadableStream({
    cancel: onCancel,
    async start(ctrl) {
      ctrl.enqueue(JSON.stringify({count: 1}));
      await sleep(1);
      ctrl.enqueue(JSON.stringify({count: 2}));
      ctrl.close();
    }
  });
  const response = new Response(stream);
  // NOTE: This is a hack; we should pass the stream
  // to the Response (not supported yet).
  response.body = stream;

  fetchMock.mock('*', null, {response});

  const onNext = jest.fn();
  const onError = jest.fn();
  const onDone = jest.fn();

  const {result} = renderHook(() =>
    useStream('/counter', {onNext, onError, onDone})
  );
  const {close} = result.current;

  expect(result.error).toBeUndefined();

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

test('useStream() URL change', async () => {
  const onCancel = jest.fn();
  fetchMock.mock('*', null, {
    response: () => {
      const stream = new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.close();
        }
      });
      const response = new Response(stream);
      // NOTE: This is a hack; we should pass the stream
      // to the Response (not supported yet).
      response.body = stream;

      return response;
    }
  });

  const onNext = jest.fn();
  const onError = jest.fn();
  const onDone = jest.fn();

  const {result, rerender} = renderHook(props =>
    useStream(
      isObject(props) && typeof props.url === 'string'
        ? props.url
        : '/counter-1',
      {onNext, onError, onDone}
    )
  );

  expect(result.error).toBeUndefined();

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
  const onCancel = jest.fn();
  fetchMock.mock('*', null, {
    response: () => {
      const stream = new ReadableStream({
        cancel: onCancel,
        async start(ctrl) {
          ctrl.enqueue(JSON.stringify({count: 1}));
          await sleep(1);
          ctrl.close();
        }
      });
      const response = new Response(stream);
      // NOTE: This is a hack; we should pass the stream
      // to the Response (not supported yet).
      response.body = stream;

      return response;
    }
  });

  const onNext = jest.fn();
  const onError = jest.fn();
  const onDone = jest.fn();

  const fp = {};
  const {result, rerender} = renderHook(props =>
    useStream('/counter', {
      onNext,
      onError,
      onDone,
      fetchParams:
        isObject(props) && typeof props.fetchParams !== 'undefined'
          ? props.fetchParams
          : fp
    })
  );

  expect(result.error).toBeUndefined();

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

  expect(fetchMock.lastCall()[1].mode).toEqual('cors');
});

test('useStream() onNext() change', async () => {
  const onCancel = jest.fn();
  const stream = new ReadableStream({
    cancel: onCancel,
    async start(ctrl) {
      ctrl.enqueue(JSON.stringify({count: 1}));
      await sleep(1);
      ctrl.enqueue(JSON.stringify({count: 2}));
      ctrl.close();
    }
  });
  const response = new Response(stream);
  // NOTE: This is a hack; we should pass the stream
  // to the Response (not supported yet).
  response.body = stream;

  fetchMock.mock('*', null, {response});

  const onNext1 = jest.fn();
  const onError = jest.fn();
  const onDone = jest.fn();

  const {result, rerender} = renderHook(props =>
    useStream('/counter', {
      onError,
      onDone,
      onNext:
        isObject(props) && typeof props.onNext !== 'undefined'
          ? props.onNext
          : onNext1
    })
  );

  expect(result.error).toBeUndefined();

  await sleep(0.1);
  expect(onNext1).toHaveBeenCalledTimes(1);
  let [res] = onNext1.mock.calls[0];
  let data = await res.json();
  expect(data).toEqual({count: 1});

  const onNext2 = jest.fn();
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
  const onCancel = jest.fn();
  const stream = new ReadableStream({
    cancel: onCancel,
    async start(ctrl) {
      ctrl.enqueue(JSON.stringify({count: 1}));
      await sleep(1);
      ctrl.error(new Error('Oops ...'));
      ctrl.close();
    }
  });
  const response = new Response(stream);
  // NOTE: This is a hack; we should pass the stream
  // to the Response (not supported yet).
  response.body = stream;

  fetchMock.mock('*', null, {response});

  const onNext = jest.fn();
  const onError1 = jest.fn();
  const onDone = jest.fn();

  const {result, rerender} = renderHook(props =>
    useStream('/counter', {
      onNext,
      onDone,
      onError:
        isObject(props) && typeof props.onError !== 'undefined'
          ? props.onError
          : onError1
    })
  );

  expect(result.error).toBeUndefined();

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  let [res] = onNext.mock.calls[0];
  let data = await res.json();
  expect(data).toEqual({count: 1});

  const onError2 = jest.fn();
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
  const onCancel = jest.fn();
  const stream = new ReadableStream({
    cancel: onCancel,
    async start(ctrl) {
      ctrl.enqueue(JSON.stringify({count: 1}));
      await sleep(1);
      ctrl.close();
    }
  });
  const response = new Response(stream);
  // NOTE: This is a hack; we should pass the stream
  // to the Response (not supported yet).
  response.body = stream;

  fetchMock.mock('*', null, {response});

  const onNext = jest.fn();
  const onError = jest.fn();
  const onDone1 = jest.fn();

  const {result, rerender} = renderHook(props =>
    useStream('/counter', {
      onNext,
      onError,
      onDone:
        isObject(props) && typeof props.onDone !== 'undefined'
          ? props.onDone
          : onDone1
    })
  );

  expect(result.error).toBeUndefined();

  await sleep(0.1);
  expect(onNext).toHaveBeenCalledTimes(1);
  let [res] = onNext.mock.calls[0];
  let data = await res.json();
  expect(data).toEqual({count: 1});

  const onDone2 = jest.fn();
  rerender({onDone: onDone2});

  await sleep(1);
  expect(onDone2).toHaveBeenCalledTimes(1);

  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
  expect(onDone1).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
});

test('useStream() no params', async () => {
  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(JSON.stringify({count: 1}));
      await sleep(1);
      ctrl.enqueue(JSON.stringify({count: 2}));
      ctrl.close();
    }
  });
  const response = new Response();
  // NOTE: This is a hack; we should pass the stream
  // to the Response (not supported yet).
  response.body = stream;

  fetchMock.mock('*', null, {response});

  const {result} = renderHook(() => useStream('/counter'));
  expect(result.error).toBeUndefined();

  await sleep(1.1);
  expect(fetchMock.calls()).toHaveLength(1);
});

function isObject(o) {
  return typeof o === 'object' && o !== null;
}

function sleep(sec) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), sec * 1000);
  });
}
