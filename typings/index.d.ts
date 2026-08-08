export function useStream(
  url: string,
  options?: ReactFetchStreamsOptions
): ReactFetchStreamsHook;

export interface ReactFetchStreamsOptions {
  onNext?: (res: Response) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
  fetchParams?: RequestInit;
}

export interface ReactFetchStreamsHook {
  close: () => void;
}

export function useEventSource(
  url: string,
  options?: EventSourceOptions
): EventSourceHook;

export interface EventSourceOptions {
  onMessage?: (event: MessageEvent) => void;
  onEvent?: Record<string, (event: MessageEvent) => void>;
  onOpen?: (event: Event) => void;
  onError?: (event: Event) => void;
  withCredentials?: boolean;
}

export interface EventSourceHook {
  close: () => void;
}
