// content.js - Chạy trên mọi trang web
// (Tạo thông báo nhẹ ở góc phải)

console.log('🛡️ SafeNet Protector đang bảo vệ bạn!');

// Lắng nghe message từ background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_NOTIFICATION') {
        showToast(message.text, message.type);
    }
});

function showToast(text, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'danger' ? '#dc3545' : '#28a745'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 99999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        max-width: 350px;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = text;
    
    document.body.appendChild(toast);
    
    // Tự động biến mất sau 5 giây
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Thêm CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);