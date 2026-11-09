// storage.js - Tạo file mới hoặc thêm vào background.js

// ⭐ HÀM QUẢN LÝ DANH SÁCH CHẶN
const BlockedStorage = {
  // Lấy danh sách domain đã chặn
  async getBlockedDomains() {
    try {
      const result = await chrome.storage.local.get('blockedDomains');
      return result.blockedDomains || [];
    } catch (error) {
      console.error('Lỗi lấy danh sách chặn:', error);
      return [];
    }
  },

  // Thêm domain vào danh sách chặn
  async addBlockedDomain(domain, reason = '') {
    try {
      const list = await this.getBlockedDomains();
      
      // Kiểm tra đã tồn tại chưa
      if (list.some(item => item.domain === domain)) {
        console.log('Domain đã có trong danh sách:', domain);
        return false;
      }
      
      // Thêm mới
      const newEntry = {
        domain: domain,
        blockedAt: new Date().toISOString(),
        reason: reason || 'Người dùng chặn thủ công'
      };
      
      list.push(newEntry);
      await chrome.storage.local.set({ blockedDomains: list });
      console.log('✅ Đã chặn:', domain);
      return true;
      
    } catch (error) {
      console.error('Lỗi thêm domain chặn:', error);
      return false;
    }
  },

  // Xóa domain khỏi danh sách chặn
  async removeBlockedDomain(domain) {
    try {
      let list = await this.getBlockedDomains();
      list = list.filter(item => item.domain !== domain);
      await chrome.storage.local.set({ blockedDomains: list });
      console.log('✅ Đã bỏ chặn:', domain);
      return true;
      
    } catch (error) {
      console.error('Lỗi xóa domain chặn:', error);
      return false;
    }
  },

  // Kiểm tra domain có bị chặn không
  async isBlocked(domain) {
    try {
      const list = await this.getBlockedDomains();
      return list.some(item => item.domain === domain);
    } catch (error) {
      console.error('Lỗi kiểm tra chặn:', error);
      return false;
    }
  },

  // Lấy thông tin chi tiết của domain bị chặn
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