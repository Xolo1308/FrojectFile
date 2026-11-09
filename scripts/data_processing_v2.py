import pandas as pd
import re
import os
import random

def clean_and_validate_url(url):
    if not url:
        return None
    url = url.strip()
    if not url:
        return None
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url
    url = re.sub(r'\s+', '', url)
    if len(url) < 10:
        return None
    return url

# ==========================================
# [MỚI] HÀM AUGMENTATION TẠO URL GIẢ MẠO
# ==========================================
# Từ điển ký tự Latinh -> Ký tự ngoại lai giống hệt
HOMOGRAPH_MAP = {
    'a': ['а', 'ɑ', 'α'],  # a (Latinh) -> а (Nga), ɑ (Latinh mở rộng), α (Hy Lạp)
    'e': ['е', 'ε'],       # e (Latinh) -> е (Nga), ε (Hy Lạp)
    'o': ['о', 'ο'],       # o (Latinh) -> о (Nga), ο (Hy Lạp)
    'p': ['р', 'ρ'],       # p (Latinh) -> р (Nga), ρ (Hy Lạp)
    'c': ['с', 'ϲ'],       # c (Latinh) -> с (Nga), ϲ (Hy Lạp)
    'x': ['х', 'χ'],       # x (Latinh) -> х (Nga), χ (Hy Lạp)
    'y': ['у', 'γ'],       # y (Latinh) -> у (Nga), γ (Hy Lạp)
}

def obfuscate_url(url):
    """Trộn ký tự Latinh với ký tự nước ngoài để tạo URL giả mạo"""
    url_list = list(url)
    for i, char in enumerate(url_list):
        # Chỉ làm bẩn các ký tự nằm trong phần tên miền (trước dấu / đầu tiên)
        if char.lower() in HOMOGRAPH_MAP and random.random() < 0.3: # Tỷ lệ 30% để không làm hỏng toàn bộ
            url_list[i] = random.choice(HOMOGRAPH_MAP[char.lower()])
    return "".join(url_list)

def augment_unicode_phishing_data(df, num_samples=2000):
    """Tạo thêm dữ liệu lừa đảo giả mạo từ dữ liệu gốc"""
    print(f"Đang tạo thêm {num_samples} mẫu lừa đảo Unicode...")
    
    # Lấy ngẫu nhiên các URL (ưu tiên lấy từ tập Benign hoặc Malicious)
    sample_urls = df['url'].sample(n=num_samples, random_state=42).tolist()
    
    augmented_data = []
    for url in sample_urls:
        new_url = obfuscate_url(url)
        # Chỉ giữ lại nếu URL thực sự bị thay đổi
        if new_url != url:
            augmented_data.append({"url": new_url, "label": 1}) # Nhãn 1: Phishing
            
    df_augmented = pd.DataFrame(augmented_data)
    # Gộp vào dataset gốc
    df_final = pd.concat([df, df_augmented], ignore_index=True)
    
    print(f"✅ Đã tạo thêm {len(df_augmented)} mẫu. Tổng cộng: {len(df_final)} mẫu.")
    return df_final

# ==========================================
# HÀM CHÍNH
# ==========================================
def create_cleaned_dataset():
    print(" BẮT ĐẦU LÀM SẠCH DỮ LIỆU...")
    os.makedirs('data/processed', exist_ok=True)

    try:
        with open('data/raw/malicious_urls.txt', 'r', encoding='utf-8') as f:
            malicious_urls = [clean_and_validate_url(line) for line in f if clean_and_validate_url(line)]

        with open('data/raw/benign_urls.txt', 'r', encoding='utf-8') as f:
            benign_urls = [clean_and_validate_url(line) for line in f if clean_and_validate_url(line)]

        print(f" Số lượng URLs sau làm sạch: Malicious: {len(malicious_urls)}, Benign: {len(benign_urls)}")

        malicious_df = pd.DataFrame({'url': malicious_urls, 'label': 1})
        benign_df = pd.DataFrame({'url': benign_urls, 'label': 0})

        # Gộp dataset
        dataset = pd.concat([malicious_df, benign_df], ignore_index=True)
        
        # Xóa trùng lặp
        dataset = dataset.drop_duplicates(subset=['url'])
        
        # ==========================================
        # [QUAN TRỌNG] GỌI HÀM AUGMENTATION Ở ĐÂY
        # ==========================================
        dataset = augment_unicode_phishing_data(dataset, num_samples=2000)
        
        # Xóa trùng lặp lần 2 (đề phòng augmentation tạo ra URL trùng)
        dataset = dataset.drop_duplicates(subset=['url'])
        
        # Xáo trộn
        dataset = dataset.sample(frac=1, random_state=42).reset_index(drop=True) 

        # Lưu file CSV
        output_path = 'data/processed/cleaned_dataset1.csv'
        dataset.to_csv(output_path, index=False)
        print(f"ĐÃ LƯU DATASET ĐÃ LÀM SẠCH VÀ AUGMENT: {output_path}")
        print(f"Tổng số URLs: {len(dataset)}")

    except Exception as e:
        print(f"Lỗi: {e}")

if __name__ == "__main__":
    create_cleaned_dataset()