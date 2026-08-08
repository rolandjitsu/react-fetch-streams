import {useCallback, useEffect, useRef} from 'react';

/**
 * @typedef {object} EventStreamEvent
 * @property {string} event - Event name; `message` when the stream omits one
 * @property {string} data - Event payload with the trailing newline removed
 * @property {string} id - Last seen event id (empty if none)
 */

/**
 * @typedef {object} EventStreamHook
 * @property {function()} close - Close the connection and stop reconnecting
 */

/**
 * React hook for [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
 * parsed over `fetch`. Unlike `useEventSource` it can send custom headers, a
 * body, and any method (via `fetchParams`), at the cost of reconnection being
 * handled here rather than by the browser.
 * @param {string} url
 * @param {object} [params]
 * @param {function(EventStreamEvent)} [params.onEvent]
 * @param {function(Response)} [params.onOpen]
 * @param {function(Error)} [params.onError]
 * @param {RequestInit} [params.fetchParams]
 * @param {number|false} [params.retry=3000] - Reconnect delay in ms; `false` disables reconnecting
 *
 * @returns {EventStreamHook}
 */
export function useEventStream(url, params) {
  if (typeof params !== 'object' || params === null) {
    params = {};
  }

  const streamRef = useRef();
  const onEvent = useRef(params.onEvent);
  const onOpen = useRef(params.onOpen);
  const onError = useRef(params.onError);

  const close = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.abort();
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    streamRef.current = controller;
    startEventStream(url, controller, params.fetchParams, params.retry, {
      onEvent,
      onOpen,
      onError
    });
    return () => controller.abort();
  }, [url, params.fetchParams, params.retry]);

  useEffect(() => {
    onEvent.current = params.onEvent;
  }, [params.onEvent]);

  useEffect(() => {
    onOpen.current = params.onOpen;
  }, [params.onOpen]);

  useEffect(() => {
    onError.current = params.onError;
  }, [params.onError]);

  return {close};
}

async function startEventStream(url, controller, fetchParams, retry, refs) {
  const {onEvent, onOpen, onError} = refs;
  const {signal} = controller;
  const reconnect = retry !== false && retry !== null;
  let retryMs = typeof retry === 'number' ? retry : 3000;
  let lastEventId = '';

  while (!signal.aborted) {
    try {
      const headers = new Headers(fetchParams && fetchParams.headers);
      headers.set('Accept', 'text/event-stream');
      if (lastEventId) {
        headers.set('Last-Event-ID', lastEventId);
      }

      const res = await fetch(url, {
        method: 'GET',
        ...fetchParams,
        headers,
        signal
      });
      if (typeof onOpen.current === 'function') {
        onOpen.current(res);
      }

      const reader = res.body.getReader();
      signal.addEventListener('abort', () => reader.cancel().catch(() => {}), {
        once: true,
        passive: true
      });

      const decoder = new TextDecoder();
      let buf = '';
      let bom = true;
      let eventName = '';
      let data = '';

      for (;;) {
        const {done, value} = await reader.read();
        if (done) {
          break;
        }

        buf += decoder.decode(value, {stream: true});
        if (bom) {
          if (buf.charCodeAt(0) === 0xfeff) {
            buf = buf.slice(1);
          }
          bom = false;
        }

        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) {
            line = line.slice(0, -1);
          }

          if (line === '') {
            if (data !== '') {
              if (data.endsWith('\n')) {
                data = data.slice(0, -1);
              }
              if (typeof onEvent.current === 'function') {
                onEvent.current({
                  event: eventName || 'message',
                  data,
                  id: lastEventId
                });
              }
            }
            eventName = '';
            data = '';
            continue;
          }
          if (line[0] === ':') {
            continue; // comment
          }

          const colon = line.indexOf(':');
          const field = colon === -1 ? line : line.slice(0, colon);
          let val = colon === -1 ? '' : line.slice(colon + 1);
          if (val[0] === ' ') {
            val = val.slice(1);
          }

          if (field === 'event') {
            eventName = val;
          } else if (field === 'data') {
            data += val + '\n';
          } else if (field === 'id') {
            if (!val.includes('\u0000')) {
              lastEventId = val;
            }
          } else if (field === 'retry' && /^\d+$/.test(val)) {
            retryMs = parseInt(val, 10);
          }
        }
      }
    } catch (e) {
      if (signal.aborted) {
        return;
      }
      if (typeof onError.current === 'function') {
        onError.current(e);
      }
    }

    if (signal.aborted || !reconnect) {
      return;
    }
    await delay(retryMs, signal);
  }
}

function delay(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted) {
      return resolve();
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      {once: true}
    );
  });
}
