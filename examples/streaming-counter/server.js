// Minimal demo for useStream: a server that streams JSON chunks over time, and a
// page that renders them live and can stop the stream with close().
//
// Build the library first (`npm run build` at the repo root), then run:
//
//   node examples/streaming-counter/server.js
//
// and open the printed URL.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', '..', 'dist', 'index.min.js');
const PORT = process.env.PORT || 3000;

const PAGE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>useStream demo</title>
  </head>
  <body>
    <h1>useStream demo</h1>
    <button id="stop" disabled>Stop</button>
    <ul id="log"></ul>
    <!-- React 18 UMD: the library's UMD build reads a global React. -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="/rfs.js"></script>
    <script>
      const {useStream} = reactFetchStreams;
      const {useState, useCallback, createElement: h} = React;

      function App() {
        const [items, setItems] = useState([]);
        const [done, setDone] = useState(false);
        const onNext = useCallback(async res => {
          const data = await res.json();
          setItems(prev => prev.concat(data));
        }, []);
        const onDone = useCallback(() => setDone(true), []);
        const {close} = useStream('/stream', {onNext, onDone});

        const stop = document.getElementById('stop');
        stop.disabled = done;
        stop.onclick = () => close();

        return h(
          'ul',
          {id: 'log'},
          items.map((it, i) => h('li', {key: i}, 'count=' + it.count + ' @ ' + it.at))
        );
      }

      ReactDOM.createRoot(document.getElementById('log')).render(h(App));
    </script>
  </body>
</html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/') {
    res.writeHead(200, {'content-type': 'text/html'});
    return res.end(PAGE);
  }

  if (url === '/rfs.js') {
    if (!fs.existsSync(DIST)) {
      res.writeHead(500, {'content-type': 'text/plain'});
      return res.end(
        'Build the library first: run "npm run build" at the repo root.'
      );
    }
    res.writeHead(200, {'content-type': 'text/javascript'});
    return fs.createReadStream(DIST).pipe(res);
  }

  if (url === '/stream') {
    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-cache'
    });
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > 10) {
        clearInterval(timer);
        return res.end();
      }
      // One JSON value per flushed chunk; the delay keeps chunks from coalescing.
      res.write(JSON.stringify({count, at: new Date().toLocaleTimeString()}));
    }, 500);
    req.on('close', () => clearInterval(timer));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`useStream demo running at http://localhost:${PORT}`);
});
