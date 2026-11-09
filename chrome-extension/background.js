// background.js - Phiên bản hoàn chỉnh với HEARTBEAT

console.log('🛡️ SecureShield Agent đã khởi động!');

// =============================================
// ⭐ CẤU HÌNH API SERVER
// =============================================

const API_BASE = 'https://glacial-rigging-hassle.ngrok-free.dev';

// =============================================
// ⭐ QUẢN LÝ DANH SÁCH CHẶN (BLOCKED STORAGE)
// =============================================

const BlockedStorage = {
  async getBlockedDomains() {
    try {
      const result = await chrome.storage.local.get('blockedDomains');
      return result.blockedDomains || [];
    } catch (error) {
      console.error('Lỗi lấy danh sách chặn:', error);
      return [];
    }
  },

  async addBlockedDomain(domain, reason = '') {
    try {
      const list = await this.getBlockedDomains();
      if (list.some(item => item.domain === domain)) {
        console.log('Domain đã có trong danh sách:', domain);
        return false;
      }
      const newEntry = {
        domain: domain,
        blockedAt: new Date().toISOString(),
        reason: reason || 'Người dùng chặn thủ công'
      };
      list.push(newEntry);
      await chrome.storage.local.set({ blockedDomains: list });
      console.log('✅ Đã chặn domain (local):', domain);
      return true;
    } catch (error) {
      console.error('Lỗi thêm domain chặn:', error);
      return false;
    }
  },

  async removeBlockedDomain(domain) {
    try {
      let list = await this.getBlockedDomains();
      list = list.filter(item => item.domain !== domain);
      await chrome.storage.local.set({ blockedDomains: list });
      console.log('✅ Đã bỏ chặn domain (local):', domain);
      return true;
    } catch (error) {
      console.error('Lỗi xóa domain chặn:', error);
      return false;
    }
  },

  async isBlocked(domain) {
    try {
      const list = await this.getBlockedDomains();
      return list.some(item => item.domain === domain);
    } catch (error) {
      console.error('Lỗi kiểm tra chặn:', error);
      return false;
    }
  },

  async getBlockedInfo(domain) {
    try {
      const list = await this.getBlockedDomains();
      return list.find(item => item.domain === domain) || null;
    } catch (error) {
      console.error('Lỗi lấy thông tin chặn:', error);
      return null;
    }
  }
};

// =============================================
// ⭐ QUẢN LÝ AUTH TOKEN
// =============================================

let authToken = null;
let userInfo = null;

// Đọc token từ storage khi khởi động
chrome.storage.local.get(['authToken', 'userInfo'], (result) => {
    if (result.authToken) {
        authToken = result.authToken;
        userInfo = result.userInfo;
        console.log('✅ Đã khôi phục token:', userInfo?.email);
        if (userInfo?.role === 'admin') {
            console.log('⚠️ Phát hiện Admin, tự động đăng xuất khỏi Extension');
            logoutAgent();
        } else {
            syncBlocklist();
            // ⭐ Bắt đầu gửi heartbeat nếu đã login
            startHeartbeat();
        }
    }
});

// =============================================
// ⭐ HÀM GỌI API (CÓ XÁC THỰC)
// =============================================

async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    return response.json();
}

// =============================================
// ⭐ LẤY TÊN MÁY
// =============================================

async function getAgentName() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['agentName'], async (result) => {
            if (result.agentName) {
                resolve(result.agentName);
            } else {
                // Lấy hostname hoặc tạo tên ngẫu nhiên
                let name = 'Unknown';
                try {
                    const response = await fetch('https://api.ipify.org?format=json');
                    const data = await response.json();
                    name = `PC_${data.ip.split('.').pop()}`;
                } catch (e) {
                    name = `PC_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                }
                chrome.storage.local.set({ agentName: name });
                resolve(name);
            }
        });
    });
}

// =============================================
// ⭐ LẤY IP MÁY
// =============================================

async function getAgentIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return '127.0.0.1';
    }
}

// =============================================
// ⭐ LẤY OS INFO
// =============================================

function getOSInfo() {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf('Windows') !== -1) return 'Windows';
    if (userAgent.indexOf('Mac') !== -1) return 'macOS';
    if (userAgent.indexOf('Linux') !== -1) return 'Linux';
    if (userAgent.indexOf('Android') !== -1) return 'Android';
    return 'Unknown';
}

// =============================================
// ⭐ GỬI HEARTBEAT (Tín hiệu online)
// =============================================

async function sendHeartbeat() {
    if (!authToken) {
        console.log('⚠️ Chưa đăng nhập, không gửi heartbeat');
        return;
    }
    
    try {
        const agentName = await getAgentName();
        const agentIP = await getAgentIP();
        const osInfo = getOSInfo();
        const extensionVersion = chrome.runtime.getManifest().version;
        
        await apiFetch('/api/agent/heartbeat', {
            method: 'POST',
            body: JSON.stringify({
                agent_name: agentName,
                agent_ip: agentIP,
                os: osInfo,
                browser: 'Chrome',
                extension_version: extensionVersion
            })
        });
        console.log('💓 Heartbeat gửi thành công');
        
    } catch (error) {
        console.error('❌ Lỗi gửi heartbeat:', error);
    }
}

// =============================================
// ⭐ KHỞI ĐỘNG HEARTBEAT
// =============================================

let heartbeatInterval = null;

function startHeartbeat() {
    // Xóa interval cũ nếu có
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    // Gửi ngay lập tức
    setTimeout(sendHeartbeat, 1000);
    
    // Gửi mỗi 30 giây
    heartbeatInterval = setInterval(sendHeartbeat, 30000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// =============================================
// ⭐ ĐĂNG NHẬP / ĐĂNG XUẤT
// =============================================

async function loginAgent(email, password) {
    try {
        const result = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await result.json();
        
        if (data.success) {
            if (data.user.role === 'admin') {
                throw new Error('⚠️ Tài khoản Admin không thể đăng nhập vào Extension. Vui lòng sử dụng Admin Dashboard.');
            }
            
            authToken = data.token;
            userInfo = data.user;
            
            await chrome.storage.local.set({
                authToken: authToken,
                userInfo: userInfo
            });
            
            console.log('✅ Đăng nhập thành công:', userInfo.email);
            await syncBlocklist();
            
            // ⭐ BẮT ĐẦU GỬI HEARTBEAT
            startHeartbeat();
            
            return data;
        } else {
            throw new Error(data.error || 'Đăng nhập thất bại');
        }
    } catch (error) {
        console.error('❌ Lỗi đăng nhập:', error);
        throw error;
    }
}

async function logoutAgent() {
    authToken = null;
    userInfo = null;
    await chrome.storage.local.remove(['authToken', 'userInfo']);
    
    // ⭐ DỪNG HEARTBEAT
    stopHeartbeat();
    
    console.log('✅ Đã đăng xuất');
}

// =============================================
// ⭐ ĐỒNG BỘ DANH SÁCH CHẶN TỪ SERVER
// =============================================

async function syncBlocklist() {
    if (!authToken) {
        console.log('⚠️ Chưa đăng nhập, không thể đồng bộ');
        return;
    }
    
    try {
        const result = await apiFetch('/api/agent/blocklist');
        
        if (result.success) {
            await chrome.storage.local.set({
                serverBlocklist: result.blocklist,
                blocklistLastSync: Date.now()
            });
            console.log('✅ Đã đồng bộ danh sách chặn:', result.count, 'domains');
        }
    } catch (error) {
        console.error('❌ Lỗi đồng bộ blocklist:', error);
    }
}

// =============================================
// ⭐ KIỂM TRA DOMAIN CÓ BỊ CHẶN KHÔNG
// =============================================

async function isDomainBlocked(domain) {
    const cached = await chrome.storage.local.get(['serverBlocklist']);
    if (cached.serverBlocklist && cached.serverBlocklist.includes(domain)) {
        return true;
    }
    
    const localBlocklist = await BlockedStorage.getBlockedDomains();
    if (localBlocklist.some(item => item.domain === domain)) {
        return true;
    }
    
    if (authToken) {
        try {
            const result = await apiFetch('/api/agent/check-blocked', {
                method: 'POST',
                body: JSON.stringify({ domain })
            });
            
            if (result.success && result.is_blocked) {
                const current = await chrome.storage.local.get(['serverBlocklist']);
                const list = current.serverBlocklist || [];
                if (!list.includes(domain)) {
                    list.push(domain);
                    await chrome.storage.local.set({ serverBlocklist: list });
                }
                return true;
            }
        } catch (error) {
            console.error('❌ Lỗi kiểm tra blocklist:', error);
        }
    }
    
    return false;
}

// =============================================
// ⭐ GỬI LOG LÊN SERVER
// =============================================

async function sendLogToServer(url, score, risk, action, reasons) {
    if (!authToken) {
        console.log('⚠️ Chưa đăng nhập, không gửi log');
        return false;
    }
    
    try {
        await apiFetch('/api/agent/log', {
            method: 'POST',
            body: JSON.stringify({
                url: url,
                score: score,
                risk: risk,
                action: action,
                reasons: reasons || []
            })
        });
        console.log('✅ Đã gửi log:', url);
        return true;
    } catch (error) {
        console.error('❌ Lỗi gửi log:', error);
        return false;
    }
}

// =============================================
// ⭐ AGENT CHẶN / BỎ CHẶN DOMAIN
// =============================================

async function agentBlockDomain(domain, reason) {
    if (!authToken) {
        throw new Error('Vui lòng đăng nhập để chặn domain');
    }
    
    try {
        const result = await apiFetch('/api/agent/block', {
            method: 'POST',
            body: JSON.stringify({ domain, reason })
        });
        
        if (result.success) {
            await syncBlocklist();
            await BlockedStorage.addBlockedDomain(domain, reason);
            return result;
        } else {
            throw new Error(result.error || 'Chặn thất bại');
        }
    } catch (error) {
        console.error('❌ Lỗi chặn domain:', error);
        throw error;
    }
}

async function agentUnblockDomain(domain) {
    if (!authToken) {
        throw new Error('Vui lòng đăng nhập để bỏ chặn');
    }
    
    try {
        const result = await apiFetch('/api/agent/unblock', {
            method: 'POST',
            body: JSON.stringify({ domain })
        });
        
        if (result.success) {
            await syncBlocklist();
            await BlockedStorage.removeBlockedDomain(domain);
            return result;
        } else {
            throw new Error(result.error || 'Bỏ chặn thất bại');
        }
    } catch (error) {
        console.error('❌ Lỗi bỏ chặn:', error);
        throw error;
    }
}

// =============================================
// ⭐ LẮNG NGHE TIN NHẮN TỪ POPUP
// =============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    if (message.type === 'CHECK_URL') {
        const url = message.url;
        
        checkUrl(url)
            .then(async (result) => {
                if (result.score >= 60) {
                    console.log('🚨 PHÁT HIỆN NGUY HIỂM! Điểm:', result.score);
                    
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs.length > 0) {
                            const tab = tabs[0];
                            showAppropriateWarning(tab, result);
                        }
                    });
                    
                    if (authToken) {
                        await sendLogToServer(
                            result.url,
                            result.score,
                            result.risk,
                            'blocked',
                            result.reasons || []
                        );
                    }
                }
                sendResponse({ success: true, result: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    // ===== ĐĂNG NHẬP =====
    if (message.type === 'AGENT_LOGIN') {
        loginAgent(message.email, message.password)
            .then(result => sendResponse({ success: true, user: result.user }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    // ===== ĐĂNG XUẤT =====
    if (message.type === 'AGENT_LOGOUT') {
        logoutAgent()
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    // ===== KIỂM TRA TRẠNG THÁI =====
    if (message.type === 'GET_AUTH_STATUS') {
        sendResponse({ 
            isLoggedIn: !!authToken, 
            user: userInfo 
        });
        return true;
    }
    
    // ===== LẤY DANH SÁCH CHẶN (LOCAL) =====
    if (message.type === 'GET_BLOCKED_LIST') {
        BlockedStorage.getBlockedDomains()
            .then(list => sendResponse({ success: true, data: list }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    // ===== LẤY DANH SÁCH CHẶN (SERVER) =====
    if (message.type === 'GET_SERVER_BLOCKLIST') {
        chrome.storage.local.get(['serverBlocklist'], (result) => {
            sendResponse({ blocklist: result.serverBlocklist || [] });
        });
        return true;
    }
    
    // ===== THÊM DOMAIN CHẶN (LOCAL) =====
    if (message.type === 'ADD_BLOCKED') {
        BlockedStorage.addBlockedDomain(message.domain, message.reason)
            .then(result => sendResponse({ success: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    // ===== XÓA DOMAIN CHẶN (LOCAL) =====
    if (message.type === 'REMOVE_BLOCKED') {
        BlockedStorage.removeBlockedDomain(message.domain)
            .then(result => sendResponse({ success: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    // ===== CHẶN DOMAIN (SERVER + LOCAL) =====
    if (message.type === 'AGENT_BLOCK') {
        agentBlockDomain(message.domain, message.reason)
            .then(result => sendResponse({ success: true, message: result.message }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    // ===== BỎ CHẶN DOMAIN (SERVER + LOCAL) =====
    if (message.type === 'AGENT_UNBLOCK') {
        agentUnblockDomain(message.domain)
            .then(result => sendResponse({ success: true, message: result.message }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    // ===== CHẶN DOMAIN TỪ OVERLAY =====
    if (message.type === 'BLOCK_DOMAIN_FROM_OVERLAY') {
        const domain = message.domain;
        const reason = message.reason || 'Phát hiện từ AI - Người dùng chặn';
        
        if (authToken) {
            agentBlockDomain(domain, reason)
                .then(result => {
                    if (result && sender.tab) {
                        chrome.tabs.sendMessage(sender.tab.id, {
                            type: 'BLOCK_SUCCESS',
                            domain: domain
                        });
                    }
                    sendResponse({ success: true });
                })
                .catch(error => sendResponse({ success: false, error: error.message }));
        } else {
            BlockedStorage.addBlockedDomain(domain, reason)
                .then(result => {
                    if (result && sender.tab) {
                        chrome.tabs.sendMessage(sender.tab.id, {
                            type: 'BLOCK_SUCCESS',
                            domain: domain
                        });
                    }
                    sendResponse({ success: result });
                })
                .catch(error => sendResponse({ success: false, error: error.message }));
        }
        return true;
    }
    
    // ===== LẤY LỊCH SỬ (SERVER) =====
    if (message.type === 'GET_HISTORY') {
        if (!authToken) {
            sendResponse({ success: false, error: 'Chưa đăng nhập' });
            return true;
        }
        
        apiFetch('/api/agent/history')
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

// =============================================
// ⭐ KIỂM TRA CHẶN TRƯỚC KHI TẢI TRANG
// =============================================

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;
    
    const url = details.url;
    if (url.startsWith('chrome://') || 
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:') ||
        url.startsWith('data:')) {
        return;
    }
    
    try {
        const domain = new URL(url).hostname;
        const isBlocked = await isDomainBlocked(domain);
        
        if (isBlocked) {
            console.log('🚫 DOMAIN ĐÃ BỊ CHẶN:', domain);
            const blockedUrl = chrome.runtime.getURL('blocked-page.html') + 
                `?domain=${encodeURIComponent(domain)}` +
                `&reason=${encodeURIComponent('Domain đã bị chặn bởi Admin hoặc bạn')}`;
            chrome.tabs.update(details.tabId, { url: blockedUrl });
        }
    } catch (error) {
        console.error('Lỗi kiểm tra chặn:', error);
    }
});

const urlCache = new Map();

// =============================================
// ⭐ CÁC HÀM HIỂN THỊ
// =============================================

function showAppropriateWarning(tab, data) {
    const url = tab.url || '';
    const isValid = !url.startsWith('chrome://') &&
                    !url.startsWith('chrome-extension://') &&
                    !url.startsWith('about:') &&
                    !url.startsWith('edge://') &&
                    !url.startsWith('data:') &&
                    tab.status !== 'loading' &&
                    tab.status !== 'unloaded';
    
    const isErrorPage = url.includes('netflix-renewal') || 
                        tab.title?.includes('Không thể truy cập') ||
                        tab.title?.includes('This site can’t be reached') ||
                        tab.title?.includes('DNS_PROBE');
    
    console.log('📊 Trạng thái trang:', {
        url: url,
        isValid: isValid,
        isErrorPage: isErrorPage,
        title: tab.title,
        status: tab.status
    });
    
    if (isValid && !isErrorPage) {
        console.log('✅ Trang hợp lệ, hiển thị overlay');
        showOverlay(tab.id, data);
    } else {
        console.log('⚠️ Trang lỗi, hiển thị trang cảnh báo');
        showWarningPage(tab.id, data);
    }
}

async function checkUrl(url) {
    try {
        if (urlCache.has(url)) {
            const cached = urlCache.get(url);
            if (Date.now() - cached.timestamp < 300000) {
                console.log('📦 Dùng cache:', url);
                return cached;
            }
        }
        
        const response = await fetch('https://glacial-rigging-hassle.ngrok-free.dev/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📊 Kết quả:', result);
        urlCache.set(url, { ...result, timestamp: Date.now() });
        return result;
        
    } catch (error) {
        console.error('❌ Lỗi kiểm tra URL:', error.message);
        throw error;
    }
}

// =============================================
// ⭐ OVERLAY VÀ CẢNH BÁO
// =============================================

function showOverlay(tabId, data) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (data) => {
            if (!document || !document.body) {
                console.warn('⚠️ Document chưa sẵn sàng');
                return;
            }
            
            const old = document.getElementById('safenet-warning');
            if (old) old.remove();
            
            const overlay = document.createElement('div');
            overlay.id = 'safenet-warning';
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(220, 0, 0, 0.92);
                z-index: 999999999;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                font-family: Arial, sans-serif;
                padding: 20px;
                text-align: center;
                color: white;
                animation: fadeInWarning 0.3s ease;
            `;
            
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeInWarning {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
            
            let domain = '';
            try { domain = new URL(data.url).hostname; } catch (e) { domain = data.url; }
            
            overlay.innerHTML = `
                <div style="max-width: 600px; background: white; padding: 40px; border-radius: 16px; color: #333; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; width: 100%;">
                    <h1 style="font-size: 48px; margin: 0 0 10px 0;">🚨</h1>
                    <h2 style="color: #d32f2f; margin: 0 0 20px 0;">CẢNH BÁO NGUY HIỂM!</h2>
                    
                    <div style="background: #fff3e0; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <div style="font-size: 56px; font-weight: bold; color: #d32f2f; line-height: 1;">
                            ${data.score}%
                        </div>
                        <div style="font-size: 14px; color: #666; margin-top: 4px;">
                            Điểm nguy hiểm
                        </div>
                        <div style="margin-top: 10px; background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${data.score}%; height: 100%; background: linear-gradient(to right, #ff9800, #d32f2f);"></div>
                        </div>
                    </div>
                    
                    <div style="background: #ffebee; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #d32f2f;">
                        <p style="margin: 0; font-weight: bold; color: #d32f2f;">
                            ⚠️ ${data.recommendation || 'KHÔNG NÊN TRUY CẬP - Trang web có dấu hiệu lừa đảo!'}
                        </p>
                    </div>
                    
                    ${data.reasons && data.reasons.length > 0 ? `
                        <div style="text-align: left; background: #f5f5f5; padding: 15px; border-radius: 10px; margin-bottom: 20px; max-height: 150px; overflow-y: auto;">
                            <p style="margin: 0 0 10px 0; font-weight: bold; color: #555; font-size: 13px;">⚠️ Lý do:</p>
                            ${data.reasons.map(r => `<p style="margin: 5px 0; font-size: 14px; color: #444;">• ${r}</p>`).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 10px;">
                        <button id="blockBtn" 
                                style="padding: 12px 25px; background: #1a237e; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                            🔒 Chặn vĩnh viễn
                        </button>
                        <button onclick="document.getElementById('safenet-warning').remove()" 
                                style="padding: 12px 25px; background: #d32f2f; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                            ⚠️ Tôi hiểu rủi ro, vẫn vào
                        </button>
                        <button onclick="window.history.back()" 
                                style="padding: 12px 25px; background: #666; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                            🔙 Quay lại
                        </button>
                    </div>
                    
                    <p style="font-size: 11px; color: #999; margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; word-break: break-all;">
                        🔗 ${data.url}
                    </p>
                </div>
            `;
            
            document.body.prepend(overlay);
            
            const blockBtn = document.getElementById('blockBtn');
            if (blockBtn) {
                blockBtn.addEventListener('click', function() {
                    const domain = new URL(data.url).hostname;
                    chrome.runtime.sendMessage({
                        type: 'BLOCK_DOMAIN_FROM_OVERLAY',
                        domain: domain,
                        reason: `Phát hiện từ AI - Điểm: ${data.score}%`
                    }, (response) => {
                        if (response && response.success) {
                            alert('✅ Đã chặn thành công: ' + domain);
                            document.getElementById('safenet-warning').remove();
                            window.location.href = chrome.runtime.getURL('blocked-page.html') + 
                                `?domain=${encodeURIComponent(domain)}` +
                                `&reason=${encodeURIComponent('Phát hiện từ AI - Điểm: ' + data.score + '%')}`;
                        } else {
                            alert('❌ Lỗi chặn domain: ' + (response?.error || 'Không xác định'));
                        }
                    });
                });
            }
        },
        args: [data]
    }, (results) => {
        if (chrome.runtime.lastError) {
            console.warn('⚠️ Lỗi chèn overlay:', chrome.runtime.lastError.message);
        }
    });
}

function showWarningPage(tabId, data) {
    console.log('📄 Tạo trang cảnh báo cho URL:', data.url);
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>⚠️ Cảnh báo an toàn</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                    background: #f8f9fa;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 20px;
                    margin: 0;
                }
                .container {
                    background: white;
                    max-width: 560px;
                    padding: 40px;
                    border-radius: 16px;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
                    text-align: center;
                }
                .icon { font-size: 56px; margin-bottom: 12px; }
                h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 12px; }
                .description { 
                    font-size: 15px; 
                    color: #555; 
                    line-height: 1.6; 
                    margin-bottom: 20px;
                }
                .description a { color: #1a73e8; text-decoration: none; }
                .divider { border: none; border-top: 1px solid #eee; margin: 20px 0; }
                .url-box { 
                    background: #f5f5f5; 
                    padding: 12px 16px; 
                    border-radius: 8px; 
                    font-size: 14px; 
                    color: #333; 
                    word-break: break-all; 
                    margin-bottom: 20px; 
                }
                .url-box span { font-weight: 600; color: #1a1a2e; }
                .score-section { 
                    background: #fff3e0; 
                    padding: 16px; 
                    border-radius: 12px; 
                    margin-bottom: 20px; 
                }
                .score { font-size: 42px; font-weight: bold; color: #d32f2f; }
                .score-label { font-size: 13px; color: #666; }
                .status-badge { 
                    display: inline-block; 
                    padding: 4px 16px; 
                    border-radius: 20px; 
                    font-size: 14px; 
                    font-weight: 600; 
                    margin-bottom: 16px; 
                }
                .badge-danger { background: #ffebee; color: #d32f2f; }
                .reasons-box { 
                    text-align: left; 
                    background: #fafafa; 
                    padding: 16px; 
                    border-radius: 10px; 
                    margin-bottom: 20px; 
                    max-height: 200px; 
                    overflow-y: auto; 
                }
                .reasons-box p { margin: 6px 0; font-size: 14px; color: #444; }
                .reasons-box .title { font-weight: 600; color: #d32f2f; margin-bottom: 8px; }
                .actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
                .btn { 
                    padding: 12px 30px; 
                    border: none; 
                    border-radius: 8px; 
                    font-size: 15px; 
                    font-weight: 600; 
                    cursor: pointer; 
                    transition: all 0.2s; 
                }
                .btn-danger { background: #d32f2f; color: white; }
                .btn-danger:hover { background: #b71c1c; }
                .btn-secondary { background: #e0e0e0; color: #333; }
                .btn-secondary:hover { background: #bdbdbd; }
                .footer { 
                    margin-top: 20px; 
                    padding-top: 16px; 
                    border-top: 1px solid #eee; 
                    font-size: 12px; 
                    color: #999; 
                }
                .footer a { color: #1a73e8; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">🚨</div>
                <h1>⚠️ Trang web nguy hiểm</h1>
                <p class="description">
                    Những kẻ tấn công trên trang web bạn đã truy cập có thể lừa bạn cài đặt phần mềm hoặc tiết lộ các thông tin như mật khẩu, số điện thoại hoặc số thẻ tín dụng.
                    Bạn nên quay lại trang an toàn.
                    <br><br>
                    <a href="#" onclick="alert('Cảnh báo bảo mật từ SafeNet Protector\\nURL: ${data.url}')">Tìm hiểu thêm về cảnh báo này</a>.
                </p>
                <hr class="divider">
                <div class="url-box">
                    <span>🌐 URL:</span> ${data.url}
                </div>
                <div class="score-section">
                    <div class="score">${data.score}%</div>
                    <div class="score-label">Điểm nguy hiểm</div>
                </div>
                <div>
                    <span class="status-badge badge-danger">⚠️ NGUY HIỂM</span>
                </div>
                <div class="reasons-box">
                    <p class="title">📋 Lý do phân tích:</p>
                    ${data.reasons && data.reasons.length > 0 
                        ? data.reasons.map(r => `<p>• ${r}</p>`).join('') 
                        : '<p>• Phát hiện dấu hiệu lừa đảo</p>'
                    }
                </div>
                <div class="actions">
                    <button onclick="window.close()" class="btn btn-danger">
                        ⚠️ Tôi hiểu rủi ro
                    </button>
                    <button onclick="window.history.back()" class="btn btn-secondary">
                        🔙 Quay lại trang an toàn
                    </button>
                </div>
                <div class="footer">
                    🛡️ SecureShield · Bảo vệ bởi AI
                </div>
            </div>
        </body>
        </html>
    `;

    const warningUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
    console.log('🔄 Chuyển đến trang cảnh báo...');
    chrome.tabs.update(tabId, { url: warningUrl }, () => {
        if (chrome.runtime.lastError) {
            console.error('❌ Lỗi tạo trang cảnh báo:', chrome.runtime.lastError.message);
            chrome.tabs.update(tabId, { url: 'about:blank' });
        } else {
            console.log('✅ Trang cảnh báo đã được hiển thị');
        }
    });
}

console.log('✅ SecureShield Agent sẵn sàng!');