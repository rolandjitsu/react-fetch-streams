import {useCallback, useEffect, useRef} from 'react';

export interface EventSourceOptions {
  /** Handles unnamed `message` events. */
  onMessage?: (event: MessageEvent) => void;
  /** Handlers keyed by event name. */
  onEvent?: Record<string, (event: MessageEvent) => void>;
  onOpen?: (event: Event) => void;
  onError?: (event: Event) => void;
  withCredentials?: boolean;
}

export interface EventSourceHook {
  close: () => void;
}

/**
 * React hook for [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
 * built on the native [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).
 * The browser handles reconnection and `Last-Event-ID` resumption. For custom
 * headers or a request body (which EventSource cannot send), use `useEventStream`.
 */
export function useEventSource(
  url: string,
  params?: EventSourceOptions
): EventSourceHook {
  if (typeof params !== 'object' || params === null) {
    params = {};
  }

  const sourceRef = useRef<EventSource | undefined>(undefined);
  const onMessage = useRef(params.onMessage);
  const onOpen = useRef(params.onOpen);
  const onError = useRef(params.onError);
  const onEvent = useRef(params.onEvent);

  const close = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
    }
  }, []);

  // Resubscribe only when the connection or the set of named events changes;
  // handler identity is held in refs so swapping a callback does not reconnect.
  const eventNames = params.onEvent
    ? Object.keys(params.onEvent).sort().join(' ')
    : '';

  useEffect(() => {
    const source = new EventSource(url, {
      withCredentials: params.withCredentials
    });
    sourceRef.current = source;

    source.onopen = evt => {
      if (typeof onOpen.current === 'function') {
        onOpen.current(evt);
      }
    };
    source.onerror = evt => {
      if (typeof onError.current === 'function') {
        onError.current(evt);
      }
    };
    source.onmessage = evt => {
      if (typeof onMessage.current === 'function') {
        onMessage.current(evt);
      }
    };

    const listeners = (eventNames ? eventNames.split(' ') : []).map<
      [string, (evt: Event) => void]
    >(name => {
      const handler = (evt: Event) => {
        const map = onEvent.current;
        if (map && typeof map[name] === 'function') {
          map[name](evt as MessageEvent);
        }
      };
      source.addEventListener(name, handler);
      return [name, handler];
    });

    return () => {
      for (const [name, handler] of listeners) {
        source.removeEventListener(name, handler);
      }
      source.close();
    };
  }, [url, params.withCredentials, eventNames]);

  useEffect(() => {
    onMessage.current = params.onMessage;
  }, [params.onMessage]);

  useEffect(() => {
    onOpen.current = params.onOpen;
  }, [params.onOpen]);

  useEffect(() => {
    onError.current = params.onError;
  }, [params.onError]);

  useEffect(() => {
    onEvent.current = params.onEvent;
  }, [params.onEvent]);

  return {close};
}
