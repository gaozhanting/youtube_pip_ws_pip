const http = require('http');
const { readFileSync } = require('fs');
const { spawn } = require('child_process');
const WS = require('ws');
const { WebSocketServer } = WS;

const PORT = 8080;
const CDP_PORT = 9223;
const BRAVE_BIN = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const followerHTML = readFileSync(`${__dirname}/follower.html`, 'utf-8');

// HTTP server
const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/follower.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(followerHTML);
  } else {
    res.writeHead(404);
    res.end();
  }
});

// WebSocket relay
const wss = new WebSocketServer({ server: httpServer });
let brave = null;

// CDP: click follower page to trigger documentPictureInPicture
function cdpClick() {
  const attempt = (n) => {
    if (n > 20) return;
    http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const target = JSON.parse(data).find(t => t.url.includes(`localhost:${PORT}`));
          if (!target) return setTimeout(() => attempt(n + 1), 500);
          const cdp = new WS(target.webSocketDebuggerUrl);
          cdp.on('open', () => {
            cdp.send(JSON.stringify({ id: 1, method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x: 200, y: 200, button: 'left', clickCount: 1 } }));
            cdp.send(JSON.stringify({ id: 2, method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x: 200, y: 200, button: 'left', clickCount: 1 } }));
            cdp.close();
            console.log('🖱️  已觸發字幕 PiP');
          });
        } catch (_) { setTimeout(() => attempt(n + 1), 500); }
      });
    }).on('error', () => setTimeout(() => attempt(n + 1), 500));
  };
  setTimeout(() => attempt(1), 1500);
}

function spawnBrave() {
  if (brave) return;
  brave = spawn(BRAVE_BIN, [
    `http://localhost:${PORT}`,
    `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=/tmp/brave-caption-pip',
    '--no-first-run',
    '--no-default-browser-check',
  ]);
  brave.on('exit', () => { brave = null; });
  console.log('🚀 已啟動字幕 Brave');
}

wss.on('connection', (ws) => {
  console.log('🔗 一個組件已連入水管');
  ws.on('message', (data) => {
    const message = data.toString('utf-8');
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(message); });
    try {
      const { isPaused } = JSON.parse(message);
      if (!isPaused) { spawnBrave(); cdpClick(); }
    } catch (_) {}
  });
  ws.on('close', () => console.log('❌ 一個組件斷開了連接'));
});

function shutdown() {
  if (brave) { brave.kill(); brave = null; }
  process.exit();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

httpServer.listen(PORT, () => console.log(`🌊 3PiP 水管已在 http://localhost:${PORT} 啟動`));
