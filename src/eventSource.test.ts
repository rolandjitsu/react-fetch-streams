import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import {cleanup, renderHook} from '@testing-library/react';
import {useEventSource} from './eventSource';

// jsdom has no EventSource; a controllable fake lets tests drive it.
type ESEvent = {type: string; data?: unknown};
type ESHandler = (event: ESEvent) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  withCredentials: boolean;
  closed = false;
  onopen: ESHandler | null = null;
  onmessage: ESHandler | null = null;
  onerror: ESHandler | null = null;
  listeners: Record<string, ESHandler[]> = {};

  constructor(url: string, init?: {withCredentials?: boolean}) {
    this.url = url;
    this.withCredentials = Boolean(init && init.withCredentials);
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: ESHandler) {
    (this.listeners[type] ||= []).push(fn);
  }
  removeEventListener(type: string, fn: ESHandler) {
    this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn);
  }
  close() {
    this.closed = true;
  }
  emitOpen() {
    this.onopen?.({type: 'open'});
  }
  emitMessage(data: unknown) {
    this.onmessage?.({type: 'message', data});
  }
  emitError() {
    this.onerror?.({type: 'error'});
  }
  emitNamed(type: string, data: unknown) {
    (this.listeners[type] || []).forEach(fn => fn({type, data}));
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const last = () =>
  FakeEventSource.instances[FakeEventSource.instances.length - 1];

test('useEventSource() messages, open, error', () => {
  const onMessage = vi.fn();
  const onOpen = vi.fn();
  const onError = vi.fn();

  renderHook(() => useEventSource('/events', {onMessage, onOpen, onError}));

  const es = last();
  expect(es.url).toEqual('/events');

  es.emitOpen();
  expect(onOpen).toHaveBeenCalledTimes(1);

  es.emitMessage(JSON.stringify({count: 1}));
  expect(onMessage).toHaveBeenCalledTimes(1);
  expect(JSON.parse(onMessage.mock.calls[0][0].data)).toEqual({count: 1});

  es.emitError();
  expect(onError).toHaveBeenCalledTimes(1);
});

test('useEventSource() named events', () => {
  const tick = vi.fn();
  const pong = vi.fn();

  renderHook(() => useEventSource('/events', {onEvent: {tick, pong}}));

  const es = last();
  es.emitNamed('tick', '1');
  es.emitNamed('pong', '2');

  expect(tick).toHaveBeenCalledTimes(1);
  expect(tick.mock.calls[0][0].data).toEqual('1');
  expect(pong).toHaveBeenCalledTimes(1);
});

test('useEventSource() withCredentials', () => {
  renderHook(() => useEventSource('/events', {withCredentials: true}));
  expect(last().withCredentials).toBe(true);
});

test('useEventSource() close()', () => {
  const {result} = renderHook(() => useEventSource('/events', {}));
  expect(last().closed).toBe(false);
  result.current.close();
  expect(last().closed).toBe(true);
});

test('useEventSource() URL change reconnects', () => {
  const {rerender} = renderHook(props => useEventSource(props.url, {}), {
    initialProps: {url: '/a'}
  });
  expect(FakeEventSource.instances).toHaveLength(1);
  const first = last();

  rerender({url: '/b'});
  expect(FakeEventSource.instances).toHaveLength(2);
  expect(first.closed).toBe(true); // old connection torn down
  expect(last().url).toEqual('/b');
});

test('useEventSource() onMessage change does not reconnect', () => {
  const onMessage1 = vi.fn();
  const {rerender} = renderHook(
    props => useEventSource('/events', {onMessage: props.onMessage}),
    {initialProps: {onMessage: onMessage1}}
  );
  const es = last();

  const onMessage2 = vi.fn();
  rerender({onMessage: onMessage2});

  expect(FakeEventSource.instances).toHaveLength(1); // same connection
  es.emitMessage('x');
  expect(onMessage1).not.toHaveBeenCalled();
  expect(onMessage2).toHaveBeenCalledTimes(1);
});

test('useEventSource() unmount closes', () => {
  const {unmount} = renderHook(() => useEventSource('/events', {}));
  const es = last();
  unmount();
  expect(es.closed).toBe(true);
});
