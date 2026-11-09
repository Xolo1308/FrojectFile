import pandas as pd
import re
import os


def clean_and_validate_url(url):

    if not url:
        return None

    url = url.strip() # xoa khoang trang thừa ở đầu

    # Loại bỏ dòng trống giua ky tu
    if not url:
        return None

    # Chuẩn hóa URL (thêm http:// nếu thiếu)
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url

    # Loại bỏ khoảng trắng thừa
    url = re.sub(r'\s+', '', url)

    # Kiểm tra URL hợp lệ
    if len(url) < 10:  # URL quá ngắn
        return None

    return url

def create_cleaned_dataset():
    """Làm sạch dữ liệu URL"""

    print(" BẮT ĐẦU LÀM SẠCH DỮ LIỆU...")

    # Tạo thư mục processed nếu chưa tồn tại
    os.makedirs('data/processed', exist_ok=True)

    try:
        # Đọc malicious URLs
        with open('data/raw/malicious_urls.txt', 'r', encoding='utf-8') as f:
            malicious_urls = [] # tạo list rỗng để chứa URL làm sạch
            for line in f:
                cleaned_url = clean_and_validate_url(line) # goi ham lam sach cho moi dong
                if cleaned_url:
                    malicious_urls.append(cleaned_url)

        # Đọc benign URLs
        with open('data/raw/benign_urls.txt', 'r', encoding='utf-8') as f:
            benign_urls = []
            for line in f:
                cleaned_url = clean_and_validate_url(line)
                if cleaned_url:
                    benign_urls.append(cleaned_url)

        print(f" Số lượng URLs sau làm sạch:")
        print(f" - Malicious: {len(malicious_urls)}")
        print(f" - Benign: {len(benign_urls)}")

        if len(malicious_urls) == 0 and len(benign_urls) == 0:
            print("Không có URL nào hợp lệ. Kiểm tra file dữ liệu!")
            return None

        # Tạo DataFrame gán nhãn cho dữ liệu
        malicious_df = pd.DataFrame({
            'url': malicious_urls, # cột url chứ ds urls lừa đảo đã làm sạch
            'label': 1  # 1 = malicious
        })

        benign_df = pd.DataFrame({
            'url': benign_urls, # cột url chứ ds urls an toàn đã làm sạch
            'label': 0  # 0 = benign
        })

        # Gộp dataset
        dataset = pd.concat([malicious_df, benign_df], ignore_index=True)

        # Xóa duplicates
        initial_count = len(dataset)
        dataset = dataset.drop_duplicates(subset=['url'])
        final_count = len(dataset)

        print(f"Đã xóa {initial_count - final_count} URLs trùng lặp")

        # Xáo trộn dữ liệu
        dataset = dataset.sample(frac=1, random_state=42).reset_index(drop=True) # lấy mẫu nn 100% dl

        # Lưu file CSV đã làm sạch - SỬA TÊN FILE Ở ĐÂY
        output_path = 'data/processed/cleaned_dataset1.csv'
        dataset.to_csv(output_path, index=False) # lưu thành file csv - k lưu cột index

        print(f"ĐÃ LƯU DATASET ĐÃ LÀM SẠCH: {output_path}")
        print(f"Tổng số URLs: {len(dataset)}")
        print(f" - Malicious: {len(malicious_df)}")
        print(f" - Benign: {len(benign_df)}")

    except FileNotFoundError as e:
        print(f"Lỗi: Không tìm thấy file {e.filename}")
        print("Kiểm tra cấu trúc thư mục:")
        print(" - data/raw/malicious_urls.txt")
        print("   - data/raw/benign_urls.txt")
        return None
    except Exception as e:
        print(f"Lỗi không xác định: {e}")
        return None


if __name__ == "__main__":
    create_cleaned_dataset()