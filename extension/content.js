let socket;
let lastProcessedText = "";
let ghostObserverV35 = null;

function sendStatus(isPaused) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ text: lastProcessedText, isPaused }));
    }
}

// 1. 接通水管邏輯
function connect() {
    if (socket && socket.readyState === WebSocket.OPEN) return;

    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log("🎯 [V35 Leader] 數據水管已接通");
        const video = document.querySelector('video');
        if (video) sendStatus(video.paused);
    };

    socket.onclose = () => {
        console.log("⚠️ [V35 Leader] 水管斷開，2秒後重連...");
        setTimeout(connect, 2000);
    };

    socket.onerror = (err) => {
        console.error("❌ WebSocket 錯誤:", err);
    };
}

// 2. 核心抓取邏輯
const grabAction = () => {
    const segments = document.querySelectorAll('.ytp-caption-segment');
    if (segments.length === 0) return;

    const currentRaw = Array.from(segments)
        .map(s => s.innerText)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (currentRaw && currentRaw !== lastProcessedText) {
        lastProcessedText = currentRaw;
        sendStatus(document.querySelector('video')?.paused || false);
    }
};

// 3. 綁定視頻播放/暫停事件
function bindVideoEvents() {
    const video = document.querySelector('video');
    if (!video) return;

    video.addEventListener('play', () => sendStatus(false));
    video.addEventListener('playing', () => sendStatus(false));
    video.addEventListener('pause', () => sendStatus(true));
    video.addEventListener('ended', () => sendStatus(true));
}

// 4. 啟動監控
function start() {
    console.log("🛠️ [V35 Leader] 正在初始化監控...");

    const target = document.body;

    if (ghostObserverV35) {
        ghostObserverV35.disconnect();
    }

    ghostObserverV35 = new MutationObserver(grabAction);
    ghostObserverV35.observe(target, {
        childList: true,
        subtree: true,
        characterData: true
    });

    connect();
    bindVideoEvents();
}

// 5. 確保頁面加載完成後啟動
if (document.readyState === 'complete') {
    start();
} else {
    window.addEventListener('load', start);
}

// 對位：YouTube SPA 切換視頻時重新初始化
window.addEventListener('yt-navigate-finish', () => {
    console.log("📺 [V35 Leader] 檢測到視頻切換，重新對位...");
    start();
});
