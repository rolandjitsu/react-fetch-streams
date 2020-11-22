export function useStream(url: string, options?: ReactFetchStreamsOptions): ReactFetchStreamsHook;

export interface ReactFetchStreamsOptions {
  onNext?: (res: Response) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
  fetchParams?: RequestInit;
}

export interface ReactFetchStreamsHook {
  close: () => void;
}
