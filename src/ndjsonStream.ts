import {useCallback, useEffect, useRef} from 'react';

export interface NdjsonStreamOptions<T = unknown> {
  /** Called with each parsed JSON value, one per newline-delimited line. */
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
  fetchParams?: RequestInit;
}

export interface NdjsonStreamHook {
  close: () => void;
}

/**
 * React hook for streaming [newline-delimited JSON](https://jsonlines.org/).
 * A convenience wrapper over the same transport as `useStream` that buffers
 * across chunk boundaries with a streaming decoder (so multi-byte characters
 * are not corrupted) and calls `onData` with each parsed line.
 */
export function useNdjsonStream<T = unknown>(
  url: string,
  params?: NdjsonStreamOptions<T>
): NdjsonStreamHook {
  if (typeof params !== 'object' || params === null) {
    params = {};
  }

  const streamRef = useRef<AbortController | undefined>(undefined);
  const onData = useRef(params.onData);
  const onError = useRef(params.onError);
  const onDone = useRef(params.onDone);

  const close = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.abort();
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    streamRef.current = controller;
    startNdjsonStream(url, controller, params.fetchParams, {
      onData,
      onError,
      onDone
    });
    return () => controller.abort();
  }, [url, params.fetchParams]);

  useEffect(() => {
    onData.current = params.onData;
  }, [params.onData]);

  useEffect(() => {
    onError.current = params.onError;
  }, [params.onError]);

  useEffect(() => {
    onDone.current = params.onDone;
  }, [params.onDone]);

  return {close};
}

interface NdjsonRefs<T> {
  onData: {current: ((data: T) => void) | undefined};
  onError: {current: ((err: Error) => void) | undefined};
  onDone: {current: (() => void) | undefined};
}

async function startNdjsonStream<T>(
  url: string,
  controller: AbortController,
  fetchParams: RequestInit | undefined,
  refs: NdjsonRefs<T>
): Promise<void> {
  const {onData, onError, onDone} = refs;
  const {signal} = controller;

  const emit = (line: string) => {
    const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (trimmed === '') {
      return; // blank line between records
    }
    const data = JSON.parse(trimmed);
    if (typeof onData.current === 'function') {
      onData.current(data);
    }
  };

  try {
    const res = await fetch(url, {method: 'GET', ...fetchParams, signal});
    if (!res.body) {
      throw new TypeError('Response has no readable body');
    }
    const reader = res.body.getReader();
    signal.addEventListener('abort', () => reader.cancel().catch(() => {}), {
      once: true,
      passive: true
    });

    const decoder = new TextDecoder();
    let buf = '';

    for (;;) {
      const {done, value} = await reader.read();
      if (done) {
        buf += decoder.decode(); // flush any pending bytes
        emit(buf); // trailing line without a final newline
        if (typeof onDone.current === 'function') {
          onDone.current();
        }
        return;
      }

      buf += decoder.decode(value, {stream: true});
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        emit(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    }
  } catch (e) {
    if (signal.aborted) {
      return;
    }
    if (typeof onError.current === 'function') {
      onError.current(e as Error);
    }
  }
}
