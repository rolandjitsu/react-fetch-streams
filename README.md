# react-fetch-streams

> A react hook for using the [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) with the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to stream data from a server.

[![npm](https://img.shields.io/npm/v/react-fetch-streams.svg?style=flat-square)](https://www.npmjs.com/package/react-fetch-streams)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/rolandjitsu/react-fetch-streams/Test?label=tests&style=flat-square)](https://github.com/rolandjitsu/react-fetch-streams/actions?query=workflow%3ATest)
[![Coveralls Github Branch](https://img.shields.io/coveralls/github/rolandjitsu/react-fetch-streams/master?style=flat-square)](https://coveralls.io/github/rolandjitsu/react-fetch-streams?branch=master)

# Table of Contents

* [Installation](#installation)
* [Usage](#usage)
* [Browser Support](#browser-support)
* [Contribute](#contribute)

### Installation
----------------
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
<script type="text/javascript" src="https://unpkg.com/react-fetch-streams/dist/index.min.js"></script>

<script type="text/javascript">
    const {useStream} = reactFetchStreams;
    ...
</script>

```

### Usage
---------
Stream some data from some server:
```jsx
import React, {useCallback, useState} from 'react';
import {useStream} from 'react-fetch-streams';

const MyComponent = props => {
    const [data, setData] = useState({});
    const onNext = useCallback(async res => {
        const data = await res.json();
        setData(data);
    }, [setData]);
    useStream('http://myserver.io/stream', {onNext});

    return (
        <React.Fragment>
            {data.myProp}
        </React.Fragment>
    );
};
```

You can also pass the fetch request init props using `fetchParams`:
```jsx
import React, {useCallback, useState} from 'react';
import {useStream} from 'react-fetch-streams';

const fetchParams = {mode: 'cors'}

const MyComponent = props => {
    const [data, setData] = useState({});
    const onNext = useCallback(async res => {
        const data = await res.json();
        setData(data);
    }, [setData]);
    useStream('http://myserver.io/stream', {onNext, fetchParams});

    return (
        <React.Fragment>
            {data.myProp}
        </React.Fragment>
    );
};
```

For more examples, please check the [tests](./src/stream.test.js).

### Browser Support
-------------------
You can expect this hook to work wherever the following APIs are supported:
* [File API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API#Browser_compatibility)
* [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#Browser_compatibility)
* [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController#Browser_compatibility)
* [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal#Browser_compatibility)

Check [browserslist.dev](https://bit.ly/3lSuUsQ) for an overview.

### Contribute
--------------
If you wish to contribute, please use the following guidelines:
* Use [Conventional Commits](https://conventionalcommits.org)
