const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const { readFileSync } = require('fs');
const { spawn } = require('child_process');

const PORT = 8080;
const BRAVE_BIN = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const followerHTML = readFileSync(`${__dirname}/follower.html`, 'utf-8');

// HTTP server
const http = createServer((req, res) => {
  if (req.url === '/' || req.url === '/follower.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(followerHTML);
  } else {
    res.writeHead(404);
    res.end();
  }
});

// WebSocket relay
const wss = new WebSocketServer({ server: http });

let brave = null;
let pauseTimer = null;

function killBrave() {
  if (brave) {
    brave.kill();
    brave = null;
    console.log('⏸️  字幕 PiP 已關閉');
  }
}

function cancelKill() {
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
}

function spawnBrave() {
  if (brave) return; // already running
  brave = spawn(BRAVE_BIN, [
    '--new-window',
    `http://localhost:${PORT}`,
    '--user-data-dir=/tmp/brave-caption-pip',
  ]);
  brave.on('exit', () => { brave = null; });
  console.log('🚀 已啟動字幕 PiP');
}

function handlePlayState(isPaused) {
  if (isPaused) {
    cancelKill();
    pauseTimer = setTimeout(killBrave, 2000);
  } else {
    cancelKill();
    spawnBrave();
  }
}

wss.on('connection', (ws) => {
  console.log('🔗 一個組件已連入水管');

  ws.on('message', (data) => {
    const message = data.toString('utf-8');
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(message);
    });

    // Parse play state for auto launch/kill
    try {
      const { isPaused } = JSON.parse(message);
      handlePlayState(isPaused);
    } catch (_) {}
  });

  ws.on('close', () => console.log('❌ 一個組件斷開了連接'));
});

// Cleanup
function shutdown() {
  cancelKill();
  killBrave();
  process.exit();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

http.listen(PORT, () => {
  console.log(`🌊 3PiP 水管已在 http://localhost:${PORT} 啟動`);
});
