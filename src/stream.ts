import {useCallback, useEffect, useRef} from 'react';

export interface ReactFetchStreamsOptions {
  onNext?: (res: Response) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
  fetchParams?: RequestInit;
}

export interface ReactFetchStreamsHook {
  close: () => void;
}

/**
 * React hook for the [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API).
 * Streams a response body from `url`, invoking `onNext` with a `Response` for
 * each chunk the reader yields.
 */
export function useStream(
  url: string,
  params?: ReactFetchStreamsOptions
): ReactFetchStreamsHook {
  if (typeof params !== 'object' || params === null) {
    params = {};
  }

  const streamRef = useRef<AbortController | undefined>(undefined);
  const onNext = useRef(params.onNext);
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
    startStream(url, {
      onNext,
      onError,
      onDone,
      fetchParams: {
        ...params.fetchParams,
        signal: controller.signal
      }
    });
    // Abort on unmount and before re-subscribing, so a changed url/params or a
    // torn-down component cancels the in-flight fetch and reader.
    return () => controller.abort();
  }, [url, params.fetchParams]);

  useEffect(() => {
    onNext.current = params.onNext;
  }, [params.onNext]);

  useEffect(() => {
    onError.current = params.onError;
  }, [params.onError]);

  useEffect(() => {
    onDone.current = params.onDone;
  }, [params.onDone]);

  return {close};
}

interface StreamRefs {
  onNext: {current: ReactFetchStreamsOptions['onNext']};
  onError: {current: ReactFetchStreamsOptions['onError']};
  onDone: {current: ReactFetchStreamsOptions['onDone']};
  fetchParams: RequestInit;
}

async function startStream(
  url: string,
  {onNext, onError, onDone, fetchParams}: StreamRefs
): Promise<void> {
  const errCb = (err: unknown) => {
    if (typeof onError.current === 'function') {
      onError.current(err as Error);
    }
  };

  try {
    const res = await fetch(url, {
      ...fetchParams,
      method: 'GET'
    });

    if (!res.body) {
      throw new TypeError('Response has no readable body');
    }
    const reader = res.body.getReader();

    if (fetchParams.signal instanceof AbortSignal) {
      // cancel() rejects if the stream has already errored; we surface stream
      // errors through read() below, so ignore the rejection here.
      fetchParams.signal.addEventListener(
        'abort',
        () => reader.cancel().catch(() => {}),
        {once: true, passive: true}
      );
    }

    while (true) {
      try {
        const {done, value} = await reader.read();
        if (done) {
          if (typeof onDone.current === 'function') {
            onDone.current();
          }
          return;
        }

        const res = new Response(value);
        if (typeof onNext.current === 'function') {
          onNext.current(res);
        }
      } catch (e) {
        errCb(e);
        return;
      }
    }
  } catch (e) {
    errCb(e);
  }
}
