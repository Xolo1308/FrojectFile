// popup.js - Phiên bản đầy đủ với Đăng nhập Agent

// =============================================
// ⭐ HÀM BẬT/TẮT THẺ (TOÀN CỤC)
// =============================================

function toggleCollapsible(cardId) {
    console.log('🔄 Toggle collapsible:', cardId);
    
    const card = document.getElementById(cardId);
    if (!card) {
        console.warn('⚠️ Không tìm thấy card:', cardId);
        return;
    }
    
    const content = card.querySelector('.collapsible-content');
    const icon = card.querySelector('.toggle-icon');
    
    if (!content) {
        console.warn('⚠️ Không tìm thấy content trong card:', cardId);
        return;
    }
    
    const isOpen = content.style.display === 'block';
    
    if (isOpen) {
        content.style.display = 'none';
        if (icon) icon.textContent = '▼';
        card.classList.remove('open');
        console.log('📁 Đã đóng:', cardId);
    } else {
        content.style.display = 'block';
        if (icon) icon.textContent = '▲';
        card.classList.add('open');
        console.log('📂 Đã mở:', cardId);
    }
}

// =============================================
// ⭐ KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP
// =============================================

async function checkAuthStatus() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_AUTH_STATUS'
        });
        
        if (response.isLoggedIn) {
            document.getElementById('userStatus').textContent = `👤 ${response.user.email}`;
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('logoutSection').style.display = 'block';
            document.getElementById('loggedUser').textContent = response.user.email;
        } else {
            document.getElementById('userStatus').textContent = '🔍 Chưa đăng nhập';
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('logoutSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Lỗi kiểm tra auth:', error);
    }
}

// =============================================
// ⭐ XỬ LÝ ĐĂNG NHẬP
// =============================================

document.getElementById('loginBtn').addEventListener('click', async function() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const message = document.getElementById('loginMessage');
    
    if (!email || !password) {
        message.innerHTML = '<span style="color: #d32f2f;">⚠️ Vui lòng nhập email và mật khẩu</span>';
        return;
    }
    
    this.disabled = true;
    this.textContent = '⏳ Đang đăng nhập...';
    message.innerHTML = '<span style="color: #667eea;">Đang xác thực...</span>';
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'AGENT_LOGIN',
            email: email,
            password: password
        });
        
        if (response.success) {
            message.innerHTML = '<span style="color: #2e7d32;">✅ Đăng nhập thành công!</span>';
            setTimeout(() => {
                checkAuthStatus();
                loadBlockedList();
                this.disabled = false;
                this.textContent = '🔐 Đăng nhập';
            }, 500);
        } else {
            message.innerHTML = `<span style="color: #d32f2f;">❌ ${response.error}</span>`;
            this.disabled = false;
            this.textContent = '🔐 Đăng nhập';
        }
    } catch (error) {
        message.innerHTML = `<span style="color: #d32f2f;">❌ ${error.message}</span>`;
        this.disabled = false;
        this.textContent = '🔐 Đăng nhập';
    }
});

// =============================================
// ⭐ XỬ LÝ ĐĂNG XUẤT
// =============================================

document.getElementById('logoutBtn').addEventListener('click', async function() {
    if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
    
    try {
        await chrome.runtime.sendMessage({ type: 'AGENT_LOGOUT' });
        checkAuthStatus();
        loadBlockedList();
        alert('✅ Đã đăng xuất thành công');
    } catch (error) {
        alert('❌ Lỗi đăng xuất: ' + error.message);
    }
});

// =============================================
// ⭐ HÀM TẢI DANH SÁCH CHẶN
// =============================================

async function loadBlockedList() {
    const container = document.getElementById('blockedList');
    if (!container) return;
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_BLOCKED_LIST'
        });
        
        const countSpan = document.getElementById('blockedCount');
        
        if (!response || !response.success) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #999;">
                    <p>❌ Lỗi tải danh sách</p>
                    <button onclick="loadBlockedList()" 
                            style="margin-top: 10px; padding: 6px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🔄 Thử lại
                    </button>
                </div>
            `;
            if (countSpan) countSpan.textContent = '❌ Lỗi';
            return;
        }
        
        const list = response.data || [];
        
        if (countSpan) {
            countSpan.textContent = list.length + ' domain';
        }
        
        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #999;">
                    <p style="font-size: 40px; margin-bottom: 8px;">🔓</p>
                    <p>Chưa có domain nào bị chặn</p>
                    <p style="font-size: 12px; margin-top: 4px;">Khi bạn chặn một domain, nó sẽ xuất hiện ở đây</p>
                </div>
            `;
            return;
        }
        
        let html = `<div style="margin-top: 8px;">`;
        list.forEach((item) => {
            const date = new Date(item.blockedAt);
            const dateStr = date.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; 
                            background: #f5f5f5; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;
                            border-left: 3px solid #d32f2f;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 14px; color: #d32f2f; word-break: break-all;">
                            🔴 ${item.domain}
                        </div>
                        <div style="font-size: 11px; color: #999; margin-top: 2px;">
                            📅 ${dateStr}
                            ${item.reason ? ` | 📝 ${item.reason.substring(0, 30)}${item.reason.length > 30 ? '...' : ''}` : ''}
                        </div>
                    </div>
                    <button class="unblock-btn" data-domain="${item.domain}" 
                            style="padding: 4px 12px; background: #2e7d32; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap; margin-left: 8px;">
                        🔓 Bỏ chặn
                    </button>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
        
        document.querySelectorAll('.unblock-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const domain = this.dataset.domain;
                if (confirm(`Bạn có chắc muốn bỏ chặn ${domain}?`)) {
                    try {
                        const response = await chrome.runtime.sendMessage({
                            type: 'AGENT_UNBLOCK',
                            domain: domain
                        });
                        if (response.success) {
                            alert('✅ Đã bỏ chặn thành công: ' + domain);
                            loadBlockedList();
                        } else {
                            alert('❌ Lỗi: ' + response.error);
                        }
                    } catch (error) {
                        alert('❌ Lỗi: ' + error.message);
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Lỗi tải danh sách chặn:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #999;">
                <p>❌ Lỗi tải danh sách</p>
                <p style="font-size: 12px;">${error.message}</p>
                <button onclick="loadBlockedList()" 
                        style="margin-top: 10px; padding: 6px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔄 Thử lại
                </button>
            </div>
        `;
        const countSpan = document.getElementById('blockedCount');
        if (countSpan) countSpan.textContent = '❌ Lỗi';
    }
}

// =============================================
// ⭐ XỬ LÝ POPUP
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
    const urlDisplay = document.getElementById('currentUrl');
    const checkBtn = document.getElementById('checkBtn');
    const resultContainer = document.getElementById('resultContainer');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentUrl = tab.url;
        urlDisplay.textContent = currentUrl;
        urlDisplay.dataset.url = currentUrl;
    } catch (error) {
        urlDisplay.textContent = '❌ Không lấy được URL';
        console.error('Lỗi:', error);
    }

    checkBtn.addEventListener('click', async () => {
        const url = urlDisplay.dataset.url;
        
        if (!url || url === 'Đang tải...') {
            showResult('⚠️ Không có URL để kiểm tra', 'warning');
            return;
        }

        checkBtn.disabled = true;
        checkBtn.textContent = '⏳ Đang kiểm tra...';
        resultContainer.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div class="spinner"></div>
                <p style="margin-top: 10px; color: #6c757d; font-size: 14px;">Đang phân tích...</p>
            </div>
        `;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CHECK_URL',
                url: url
            });

            if (!response.success) {
                throw new Error(response.error || 'Lỗi không xác định');
            }

            const result = response.result;
            console.log('📊 Kết quả:', result);
            showResult(result);

        } catch (error) {
            console.error('❌ Lỗi:', error);
            resultContainer.innerHTML = `
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px;">
                    <p style="color: #856404; font-weight: bold;">❌ Không kết nối được Server!</p>
                    <p style="color: #856404; font-size: 13px; margin-top: 6px;">
                        Vui lòng chạy Website Local: <br>
                        <code style="background: #f8f9fa; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 4px;">
                            python app.py
                        </code>
                    </p>
                    <p style="color: #856404; font-size: 12px; margin-top: 6px;">
                        Lỗi: ${error.message}
                    </p>
                </div>
            `;
        }

        checkBtn.disabled = false;
        checkBtn.textContent = '🔍 Kiểm tra bảo mật';
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            document.querySelectorAll('.tab-content').forEach(el => {
                el.style.display = 'none';
            });
            document.getElementById('tab-' + tabId).style.display = 'block';
            
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.style.background = '#eee';
                b.style.color = '#333';
            });
            this.style.background = '#667eea';
            this.style.color = 'white';
            
            if (tabId === 'blocked') {
                loadBlockedList();
            }
        });
    });

    // Collapsible for blocked list
    const blockedHeader = document.getElementById('blocked-list-header');
    if (blockedHeader) {
        blockedHeader.addEventListener('click', function() {
            const card = this.closest('.collapsible-card');
            if (card) {
                toggleCollapsible(card.id);
                if (card.classList.contains('open')) {
                    loadBlockedList();
                }
            }
        });
    }

    // Kiểm tra trạng thái đăng nhập
    await checkAuthStatus();
});

// =============================================
// ⭐ HIỂN THỊ KẾT QUẢ
// =============================================

function showResult(data) {
    const container = document.getElementById('resultContainer');
    
    if (typeof data === 'string') {
        container.innerHTML = `<p style="color: #856404;">${data}</p>`;
        return;
    }
    
    let statusClass, statusText, scoreColor;
    if (data.score >= 70) {
        statusClass = 'danger';
        statusText = '🔴 NGUY HIỂM';
        scoreColor = '#dc3545';
    } else if (data.score >= 60) {
        statusClass = 'warning';
        statusText = '🟡 CẢNH BÁO';
        scoreColor = '#e65100';
    } else if (data.score >= 40) {
        statusClass = 'warning';
        statusText = '🟡 NGHI VẤN';
        scoreColor = '#f57c00';
    } else {
        statusClass = 'safe';
        statusText = '🟢 AN TOÀN';
        scoreColor = '#28a745';
    }

    let html = `
        <div class="result-card ${statusClass}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                    <span class="status status-${statusClass}">${statusText}</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 13px; color: #6c757d;">Điểm nguy hiểm</span>
                    <div class="score" style="color: ${scoreColor}; font-size: 32px; font-weight: bold;">
                        ${data.score}%
                    </div>
                </div>
            </div>
            
            <div style="background: ${data.score >= 60 ? '#ffebee' : '#e8f5e9'}; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; border-left: 4px solid ${scoreColor};">
                <p style="margin: 0; font-weight: bold; color: ${scoreColor}; font-size: 13px;">
                    ${data.recommendation || (data.score >= 60 ? '⚠️ KHÔNG NÊN TRUY CẬP' : '✅ AN TOÀN')}
                </p>
            </div>
            
            ${data.reasons && data.reasons.length > 0 ? `
                <div class="collapsible-card" id="reasons-card">
                    <div class="collapsible-header" id="reasons-header">
                        <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                            <span style="font-size: 16px;">📋</span>
                            <span style="font-weight: 600; font-size: 14px; color: #495057;">LÝ DO PHÂN TÍCH</span>
                            <span style="background: #e9ecef; color: #6c757d; font-size: 11px; padding: 2px 10px; border-radius: 12px; margin-left: auto;">
                                ${data.reasons.length} lý do
                            </span>
                            <span class="toggle-icon" style="font-size: 14px; color: #6c757d; transition: transform 0.3s;">▼</span>
                        </div>
                    </div>
                    <div class="collapsible-content" style="display: none;">
                        <ul style="margin: 0; padding-left: 20px; list-style: disc;">
                            ${data.reasons.map(r => `
                                <li style="font-size: 13px; color: #444; margin-bottom: 4px; line-height: 1.5;">
                                    ${r}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            ` : ''}
            
            ${data.recommendations && data.recommendations.length > 0 ? `
                <div class="collapsible-card" id="recommendations-card">
                    <div class="collapsible-header" id="recommendations-header">
                        <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                            <span style="font-size: 16px;">💡</span>
                            <span style="font-weight: 600; font-size: 14px; color: #0d47a1;">KHUYẾN NGHỊ HÀNH ĐỘNG</span>
                            <span style="background: #bbdefb; color: #0d47a1; font-size: 11px; padding: 2px 10px; border-radius: 12px; margin-left: auto;">
                                ${data.recommendations.length} khuyến nghị
                            </span>
                            <span class="toggle-icon" style="font-size: 14px; color: #6c757d; transition: transform 0.3s;">▼</span>
                        </div>
                    </div>
                    <div class="collapsible-content" style="display: none;">
                        <ul style="margin: 0; padding-left: 20px; list-style: disc;">
                            ${data.recommendations.map(r => `
                                <li style="font-size: 13px; color: #1a237e; margin-bottom: 4px; line-height: 1.5;">
                                    ${r}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            ` : ''}
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                <div style="font-size: 11px; color: #adb5bd;">
                    📊 Phân tích ${data.features_used || 25} đặc trưng bảo mật
                </div>
                ${data.score >= 60 ? `
                    <div style="font-size: 11px; color: #d32f2f; font-weight: 600;">
                        ⚠️ Đã hiển thị cảnh báo trên trang
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const card = this.closest('.collapsible-card');
            if (card) {
                toggleCollapsible(card.id);
            }
        });
    });
}