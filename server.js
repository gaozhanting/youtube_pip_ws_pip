// server.js
const { WebSocketServer } = require('ws');

// 在 8080 端口架設水管
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('🔗 一個組件已連入水管');

    // 修改後的 server.js 廣播部分
    ws.on('message', (data) => {
        // 強制將 Buffer 轉回 utf-8 字符串再發送
        const message = data.toString('utf-8'); 
        wss.clients.forEach((client) => {
            if (client.readyState === 1) {
                client.send(message); 
            }
        });
    });

    ws.on('close', () => console.log('❌ 一個組件斷開了連接'));
});

console.log('🌊 3PiP 透明水管已在 ws://localhost:8080 啟動');