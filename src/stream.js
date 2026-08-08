import {useCallback, useEffect, useRef} from 'react';

/**
 * @typedef {object} StreamHook
 * @property {function()} close - Close the stream
 */

/**
 * React hook for the [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API).
 * Use this hook to stream data from a URL.
 * @param {string} url
 * @param {object} [params]
 * @param {function(Response)} [params.onNext]
 * @param {function(Error)} [params.onError]
 * @param {function()} [params.onDone]
 * @param {RequestInit} [params.fetchParams]
 *
 * @returns {StreamHook}
 */
export function useStream(url, params) {
  if (typeof params !== 'object' || params === null) {
    params = {};
  }

  const streamRef = useRef();
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

/**
 * Use this function to start streaming data from an URL
 * @param {string} url
 * @param {object} params
 * @param {React.MutableRefObject<function(Response)>} params.onNext
 * @param {React.MutableRefObject<function(Error)>} params.onError
 * @param {React.MutableRefObject<function()>} params.onDone
 * @param {RequestInit} params.fetchParams
 */
async function startStream(url, {onNext, onError, onDone, fetchParams}) {
  const errCb = err => {
    if (typeof onError.current === 'function') {
      onError.current(err);
    }
  };

  try {
    const res = await fetch(url, {
      ...fetchParams,
      method: 'GET'
    });

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
