const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const { readFileSync } = require('fs');
const { spawn } = require('child_process');

const PORT = 8080;
const followerHTML = readFileSync(`${__dirname}/follower.html`, 'utf-8');

// HTTP server: serve follower.html, 404 for everything else
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

wss.on('connection', (ws) => {
  console.log('🔗 一個組件已連入水管');

  // First connection → launch separate Brave for caption PiP
  if (!brave) {
    brave = spawn('open', [
      '-n', '-a', 'Brave Browser',
      '--args',
      '--new-window',
      `http://localhost:${PORT}`,
      '--user-data-dir=/tmp/brave-caption-pip',
    ]);
    console.log('🚀 已啟動獨立 Brave 進程加載字幕 PiP');
  }

  ws.on('message', (data) => {
    const message = data.toString('utf-8');
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(message);
    });
  });

  ws.on('close', () => console.log('❌ 一個組件斷開了連接'));
});

// Cleanup
process.on('SIGINT', () => {
  if (brave) brave.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  if (brave) brave.kill();
  process.exit();
});

http.listen(PORT, () => {
  console.log(`🌊 3PiP 水管已在 http://localhost:${PORT} 啟動`);
});
