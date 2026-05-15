let socket;
let lastProcessedText = "";
let ghostObserverV35 = null;

// 1. 接通水管邏輯
function connect() {
    // 如果已經連上了，就不重複連
    if (socket && socket.readyState === WebSocket.OPEN) return;

    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log("🎯 [V35 Leader] 數據水管已接通");
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
    // 每次變動都掃描當前所有的字幕片段
    const segments = document.querySelectorAll('.ytp-caption-segment');
    if (segments.length === 0) return;

    // 將碎片組合成誠實的文本流，並過濾掉重複空格
    const currentRaw = Array.from(segments)
        .map(s => s.innerText)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    // 只有當文本真的變了，才外噴數據
    if (currentRaw && currentRaw !== lastProcessedText) {
        lastProcessedText = currentRaw;
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                text: currentRaw,
                isPaused: document.querySelector('video')?.paused || false
            }));
        }
    }
};

// 3. 啟動監控
function start() {
    console.log("🛠️ [V35 Leader] 正在初始化監控...");
    
    // 監控全局 body 是最穩妥的，因為 SPA 跳轉時播放器容器可能會被銷毀重建
    const target = document.body;

    if (ghostObserverV35) {
        ghostObserverV35.disconnect();
    }

    ghostObserverV35 = new MutationObserver(grabAction);
    
    // 監控子節點、子樹以及字符變動
    ghostObserverV35.observe(target, { 
        childList: true, 
        subtree: true,
        characterData: true 
    });

    connect();
}

// 4. 確保頁面加載完成後啟動（主子交代的邏輯）
if (document.readyState === 'complete') {
    start();
} else {
    window.addEventListener('load', start);
}

// 額外對位：處理 YouTube 在 SPA 切換視頻時可能導致的狀態遺失
window.addEventListener('yt-navigate-finish', () => {
    console.log("📺 [V35 Leader] 檢測到視頻切換，重新對位...");
    start();
});