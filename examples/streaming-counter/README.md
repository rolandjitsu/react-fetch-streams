# Streaming counter demo

A minimal end-to-end demo of `useStream`: a Node server streams JSON chunks once
per 500ms, and a React page renders each one as it arrives. The **Stop** button
calls the hook's `close()` to abort the stream mid-flight.

## Run

From the repo root:

```bash
npm run build                              # produces dist/ (served as /rfs.js)
node examples/streaming-counter/server.js  # open the printed URL
```

React is loaded from the unpkg CDN (React 18 UMD, since the library's UMD build
reads a global `React`), so viewing the page needs a network connection.
