# react-fetch-streams

> A react hook for using the [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) with the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to stream data from a server.

[![npm](https://img.shields.io/npm/v/react-fetch-streams.svg?style=flat-square)](https://www.npmjs.com/package/react-fetch-streams)
[![CI](https://img.shields.io/github/actions/workflow/status/rolandjitsu/react-fetch-streams/ci.yml?branch=master&label=ci&style=flat-square)](https://github.com/rolandjitsu/react-fetch-streams/actions/workflows/ci.yml)
[![Coveralls Github Branch](https://img.shields.io/coveralls/github/rolandjitsu/react-fetch-streams/master?style=flat-square)](https://coveralls.io/github/rolandjitsu/react-fetch-streams?branch=master)

# Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Server-Sent Events](#server-sent-events)
- [Browser Support](#browser-support)
- [Contribute](#contribute)

### Installation

---

You can install this package from [NPM](https://www.npmjs.com):

```bash
npm add react-fetch-streams
```

Or with [Yarn](https://yarnpkg.com/en):

```bash
yarn add react-fetch-streams
```

#### CDN

For CDN, you can use [unpkg](https://unpkg.com):

[https://unpkg.com/react-fetch-streams/dist/index.min.js](https://unpkg.com/react-fetch-streams/dist/index.min.js)

The global namespace for react-fetch-streams is `reactFetchStreams`:

```html
<!-- The UMD build reads a global `React`. React 19 no longer ships a UMD build,
     so for <script> usage load React 18's UMD, or use the ESM build on React 19+. -->
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script type="text/javascript" src="https://unpkg.com/react-fetch-streams/dist/index.min.js"></script>

<script type="text/javascript">
    const {useStream} = reactFetchStreams;
    // ...
</script>
```

On React 19+, drop the UMD build and import the ESM entry through a bundler or
an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)
instead.

A runnable demo lives in [`examples/streaming-counter`](./examples/streaming-counter).

### Usage

---

Stream some data from some server:

```jsx
import React, {useCallback, useState} from 'react';
import {useStream} from 'react-fetch-streams';

const MyComponent = props => {
    const [data, setData] = useState({});
    const onNext = useCallback(
        async res => {
            const data = await res.json();
            setData(data);
        },
        [setData]
    );
    useStream('http://myserver.io/stream', {onNext});

    return <React.Fragment>{data.myProp}</React.Fragment>;
};
```

You can also pass the fetch request init props using `fetchParams`:

```jsx
import React, {useCallback, useState} from 'react';
import {useStream} from 'react-fetch-streams';

const fetchParams = {mode: 'cors'};

const MyComponent = props => {
    const [data, setData] = useState({});
    const onNext = useCallback(
        async res => {
            const data = await res.json();
            setData(data);
        },
        [setData]
    );
    useStream('http://myserver.io/stream', {onNext, fetchParams});

    return <React.Fragment>{data.myProp}</React.Fragment>;
};
```

For more examples, please check the [tests](./src/stream.test.js).

### Server-Sent Events

---

For [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events),
`useEventSource` wraps the native `EventSource`, so the browser handles
reconnection and `Last-Event-ID` resumption:

```jsx
import React, {useCallback, useState} from 'react';
import {useEventSource} from 'react-fetch-streams';

const MyComponent = props => {
    const [data, setData] = useState({});
    const onMessage = useCallback(evt => setData(JSON.parse(evt.data)), []);
    // Handle named events with `onEvent: {eventName: handler}`.
    useEventSource('http://myserver.io/events', {onMessage});

    return <React.Fragment>{data.myProp}</React.Fragment>;
};
```

`EventSource` can only issue GET requests and cannot send custom headers or a
body. When you need those (for example an `Authorization` header), use
`useEventStream`, which parses SSE over `fetch` and reconnects with
`Last-Event-ID` itself:

```jsx
import React, {useCallback, useState} from 'react';
import {useEventStream} from 'react-fetch-streams';

const fetchParams = {headers: {Authorization: 'Bearer token'}};

const MyComponent = props => {
    const [data, setData] = useState({});
    const onEvent = useCallback(evt => setData(JSON.parse(evt.data)), []);
    useEventStream('http://myserver.io/events', {onEvent, fetchParams});

    return <React.Fragment>{data.myProp}</React.Fragment>;
};
```

`onEvent` receives `{event, data, id}`. Reconnection is on by default; pass
`retry: false` to disable it or `retry: <ms>` to set the delay.

### Browser Support

---

You can expect this hook to work wherever the following APIs are supported:

- [File API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API#Browser_compatibility)
- [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#Browser_compatibility)
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController#Browser_compatibility)
- [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal#Browser_compatibility)

Check [browserslist.dev](https://bit.ly/3lSuUsQ) for an overview.

### Contribute

---

See [AGENTS.md](./AGENTS.md) for the full workflow and conventions. In short:

```bash
npm ci              # install dependencies
npm run lint        # oxlint
npm run format      # prettier
npm test            # vitest
npm run build       # tsdown
```

- Use [Conventional Commits](https://www.conventionalcommits.org).
- Every change ships with tests; keep coverage from dropping.
