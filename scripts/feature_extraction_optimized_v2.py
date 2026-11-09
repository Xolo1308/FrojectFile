# scripts/feature_extraction_optimized_v2.py
import pandas as pd
import numpy as np
from urllib.parse import urlparse
import tldextract
import re
from difflib import SequenceMatcher
from collections import Counter

# Đảm bảo bạn có file utils.py với 2 hàm này, hoặc thay thế bằng code đọc/ghi file csv thông thường
try:
    from utils import load_cleaned_data, save_features
except ImportError:
    # Fallback nếu không tìm thấy utils.py
    def load_cleaned_data():
        try:
            return pd.read_csv('data/processed/cleaned_dataset.csv')
        except Exception as e:
            print(f"Lỗi đọc dữ liệu: {e}")
            return None
    def save_features(df, filename):
        df.to_csv(f'data/features/{filename}', index=False)

class URLFeatureExtractor:
    def __init__(self):
        # Giữ lại chỉ các từ khóa THỰC SỰ PHỔ BIẾN trong phishing
        self.suspicious_keywords = ['login', 'verify', 'banking', 'account', 'password', 'secure']

        # Mở rộng danh sách thương hiệu phổ biến (Thêm ngân hàng, TMĐT VN)
        self.popular_domains = [
            'facebook', 'google', 'amazon', 'paypal', 'apple', 'microsoft',
            'vietcombank', 'bidv', 'techcombank', 'shopee', 'lazada', 'tiki'
        ]
        
        # ==========================================
        # [MỚI] TỪ ĐIỂN HOMOGRAPH (Dùng để dịch ngược ký tự ngoại lai)
        # Ánh xạ từ ký tự giả mạo (Nga, Hy Lạp) về ký tự Latinh gốc
        # ==========================================
        self.homograph_map = {
            'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', # Tiếng Nga
            'ο': 'o', 'α': 'a', 'ν': 'v', 'ι': 'i', 'ρ': 'p', 'τ': 't',             # Tiếng Hy Lạp
            'ı': 'i', 'ɑ': 'a', 'ɡ': 'g', 'ϲ': 'c', 'χ': 'x', 'γ': 'y'              # Latinh mở rộng / Hy Lạp
        }

    def extract_high_quality_features(self, url):
        """Chỉ trích xuất features CÓ GIÁ TRỊ PHÂN BIỆT"""
        features = {}

        # 1. BASIC FEATURES - Luôn có giá trị
        features.update(self._extract_meaningful_basic_features(url))

        # 2. STRUCTURAL FEATURES - Cải tiến để có giá trị đa dạng
        features.update(self._extract_improved_structural_features(url))

        # 3. KEYWORD FEATURES - Chỉ lấy keywords thực sự xuất hiện
        features.update(self._extract_effective_keyword_features(url))

        # 4. TYPOSQUATTING - Giữ lại vì có giá trị đa dạng
        features.update(self._extract_typosquatting_features(url))

        # 5. ADVANCED FEATURES - Cải tiến để phát hiện tốt hơn
        features.update(self._extract_enhanced_advanced_features(url))

        # ==========================================
        # 6. [MỚI] HOMOGRAPH FEATURES (CHỐNG LỪA ĐẢO UNICODE)
        # ==========================================
        features.update(self._extract_advanced_homograph_features(url))

        return features

    def _extract_meaningful_basic_features(self, url):
        """Chỉ các basic features thực sự phân biệt"""
        features = {}
        features['url_length'] = len(url)
        features['num_special_chars'] = sum(not c.isalnum() for c in url)
        features['digit_ratio'] = sum(c.isdigit() for c in url) / len(url) if len(url) > 0 else 0
        features['special_char_ratio'] = features['num_special_chars'] / len(url) if len(url) > 0 else 0
        return features

    def _extract_improved_structural_features(self, url):
        """Structural features được cải tiến để có giá trị đa dạng"""
        features = {}
        try:
            parsed = urlparse(url)
            domain = parsed.netloc
            ext = tldextract.extract(domain)

            features['has_https'] = 1 if parsed.scheme == 'https' else 0
            features['domain_length'] = len(ext.domain)
            features['tld_length'] = len(ext.suffix)

            subdomains = [part for part in domain.split('.') if part]
            features['num_subdomains'] = len(subdomains) - 1 if len(subdomains) > 1 else 0

            path_parts = [part for part in parsed.path.split('/') if part]
            features['path_depth'] = len(path_parts)

            features['has_query'] = 1 if parsed.query else 0
            features['query_length'] = len(parsed.query)
            features['has_fragment'] = 1 if parsed.fragment else 0

        except Exception:
            features.update({
                'has_https': 0, 'domain_length': 0, 'tld_length': 0,
                'num_subdomains': 0, 'path_depth': 0, 'has_query': 0,
                'query_length': 0, 'has_fragment': 0
            })
        return features

    def _extract_effective_keyword_features(self, url):
        """Chỉ lấy keywords thực sự phổ biến trong phishing"""
        features = {}
        url_lower = url.lower()

        critical_keywords = ['login', 'verify', 'banking', 'password', 'secure']
        total_critical = 0
        for keyword in critical_keywords:
            has_kw = 1 if keyword in url_lower else 0
            features[f'has_{keyword}'] = has_kw
            total_critical += has_kw

        features['total_critical_keywords'] = total_critical
        features['has_any_critical_keyword'] = 1 if total_critical > 0 else 0
        features['has_suspicious_pattern'] = self._detect_suspicious_patterns(url_lower)

        return features

    def _extract_typosquatting_features(self, url):
        """Typosquatting features - thường có giá trị tốt"""
        features = {}
        try:
            domain = tldextract.extract(url).domain.lower()
            max_similarity = 0
            closest_domain = ""

            for popular in self.popular_domains:
                similarity = self._calculate_similarity(domain, popular)
                if similarity > max_similarity:
                    max_similarity = similarity
                    closest_domain = popular

            features['max_domain_similarity'] = max_similarity
            features['is_typosquatting'] = 1 if max_similarity > 0.75 else 0
            features['typo_confidence'] = max_similarity if max_similarity > 0.6 else 0
            features['levenshtein_distance'] = self._calculate_levenshtein(domain, closest_domain) if closest_domain else 0

        except Exception:
            features.update({
                'max_domain_similarity': 0, 'is_typosquatting': 0,
                'typo_confidence': 0, 'levenshtein_distance': 0
            })
        return features

    def _extract_enhanced_advanced_features(self, url):
        """Advanced features được cải tiến để phát hiện tốt hơn"""
        features = {}
        shorteners = [
            'bit.ly', 'goo.gl', 'tinyurl.com', 't.co', 'ow.ly', 'is.gd',
            'buff.ly', 'shorte.st', 'adf.ly', 'bitly.com'
        ]
        features['is_shortened'] = 1 if any(short in url.lower() for short in shorteners) else 0

        ip_patterns = [r'\b(?:\d{1,3}\.){3}\d{1,3}\b', r'\[[0-9a-fA-F:]+\]']
        features['uses_ip_address'] = 1 if any(re.search(pattern, url) for pattern in ip_patterns) else 0

        features['url_entropy'] = self._calculate_entropy(url)
        features['url_complexity'] = self._calculate_complexity(url)

        suspicious_tlds = ['.tk', '.ml', '.ga', '.cf', '.xyz', '.top']
        features['has_suspicious_tld'] = 1 if any(tld in url.lower() for tld in suspicious_tlds) else 0

        return features

    # ==========================================
    # [MỚI] HÀM TRÍCH XUẤT 4 ĐẶC TRƯNG CHỐNG UNICODE
    # ==========================================
    def _extract_advanced_homograph_features(self, url):
        features = {}
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            ext = tldextract.extract(domain)
            base_domain = ext.domain.lower() # Chỉ lấy tên miền chính (bỏ .com, .vn)

            # 1. Đặc trưng Punycode (Trình duyệt tự động dịch tên miền Unicode thành xn--)
            features['has_punycode'] = 1 if 'xn--' in domain else 0

            # 2. Tỷ lệ ký tự ngoại lai (Chữ Nga, Hy Lạp lẫn với chữ Latinh)
            total_chars = len(base_domain)
            non_ascii_chars = sum(1 for c in base_domain if ord(c) > 127)
            features['non_ascii_ratio'] = non_ascii_chars / total_chars if total_chars > 0 else 0.0

            # 3. Đặc trưng tương đồng hình ảnh (Visual Similarity)
            # Dịch ngược các ký tự giả mạo về Latinh
            translated_domain = "".join([self.homograph_map.get(c, c) for c in base_domain])
            
            max_sim = 0
            is_impersonating = 0

            for brand in self.popular_domains:
                # Nếu dịch xong giống hệt thương hiệu, NHƯNG lại có chứa ký tự ngoại lai -> Chắc chắn lừa đảo
                if translated_domain == brand and non_ascii_chars > 0:
                    is_impersonating = 1
                    max_sim = 1.0
                    break
                else:
                    # Tính độ tương đồng mờ nếu không giống hệt
                    sim = SequenceMatcher(None, translated_domain, brand).ratio()
                    if sim > max_sim and non_ascii_chars > 0:
                        max_sim = sim

            features['visual_similarity_score'] = max_sim
            features['is_impersonating'] = is_impersonating

        except Exception:
            features.update({
                'has_punycode': 0, 'non_ascii_ratio': 0.0,
                'visual_similarity_score': 0.0, 'is_impersonating': 0
            })

        return features

    # ==========================================
    # CÁC HÀM PHỤ TRỢ (Giữ nguyên)
    # ==========================================
    def _detect_suspicious_patterns(self, url_lower):
        suspicious_patterns = [
            r'login\.php', r'verify\.html', r'secure\-', r'banking\-',
            r'update[_-]', r'confirm[_-]', r'validation[_-]'
        ]
        return 1 if any(re.search(pattern, url_lower) for pattern in suspicious_patterns) else 0

    def _calculate_similarity(self, a, b):
        return SequenceMatcher(None, a, b).ratio()

    def _calculate_levenshtein(self, s1, s2):
        if len(s1) < len(s2):
            return self._calculate_levenshtein(s2, s1)
        if len(s2) == 0:
            return len(s1)
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        return previous_row[-1]

    def _calculate_entropy(self, text):
        if len(text) <= 1:
            return 0
        counter = Counter(text)
        text_length = len(text)
        entropy = 0.0
        for count in counter.values():
            p = count / text_length
            entropy -= p * np.log2(p)
        return entropy

    def _calculate_complexity(self, text):
        if len(text) == 0:
            return 0
        char_categories = 0
        if any(c.islower() for c in text): char_categories += 1
        if any(c.isupper() for c in text): char_categories += 1
        if any(c.isdigit() for c in text): char_categories += 1
        if any(not c.isalnum() for c in text): char_categories += 1
        return char_categories / 4.0


def get_high_quality_features():
    """Trả về danh sách 28 features chất lượng cao (Đã thêm 4 features mới)"""
    return [
        # Basic features (4)
        'url_length', 'num_special_chars', 'digit_ratio', 'special_char_ratio',

        # Structural features (8)
        'has_https', 'domain_length', 'tld_length', 'num_subdomains',
        'path_depth', 'has_query', 'query_length', 'has_fragment',

        # Keyword features (7)
        'has_login', 'has_verify', 'has_banking', 'has_password',
        'total_critical_keywords', 'has_any_critical_keyword', 'has_suspicious_pattern',

        # Typosquatting features (4)
        'max_domain_similarity', 'is_typosquatting', 'typo_confidence', 'levenshtein_distance',

        # Advanced features (4)
        'is_shortened', 'uses_ip_address', 'url_entropy', 'has_suspicious_tld',

        # [MỚI] Homograph Unicode features (4)
        'has_punycode', 'non_ascii_ratio', 'visual_similarity_score', 'is_impersonating',

        # Label
        'label'
    ]


def analyze_feature_variance(features_df):
    """Phân tích phương sai của features để loại bỏ features toàn 0"""
    print("\n🔍 PHÂN TÍCH PHƯƠNG SAI FEATURES:")

    # Danh sách các đặc trưng BẮT BUỘC PHẢI GIỮ (Dù toàn số 0)
    MUST_KEEP_FEATURES = ['has_punycode', 'non_ascii_ratio', 'visual_similarity_score', 'is_impersonating']

    variance_analysis = []
    for column in features_df.columns:
        if column != 'label':
            variance = features_df[column].var()
            zero_ratio = (features_df[column] == 0).mean()
            unique_values = features_df[column].nunique()

            # Logic: Nếu là đặc trưng mới thì BẮT BUỘC giữ (useful=True)
            is_useful = (variance > 0.001 and zero_ratio < 0.98) or (column in MUST_KEEP_FEATURES)

            variance_analysis.append({
                'feature': column,
                'variance': variance,
                'zero_ratio': zero_ratio,
                'unique_values': unique_values,
                'useful': is_useful
            })

    variance_df = pd.DataFrame(variance_analysis).sort_values('useful', ascending=False)

    print("📊 FEATURES HỮU ÍCH (phương sai > 0.001, zero_ratio < 98%):")
    useful_features = variance_df[variance_df['useful']]
    for _, row in useful_features.iterrows():
        print(f"   ✅ {row['feature']}: var={row['variance']:.4f}, zeros={row['zero_ratio']:.1%}")

    print("\n❌ FEATURES VÔ DỤNG (toàn 0 hoặc ít biến động):")
    useless_features = variance_df[~variance_df['useful']]
    for _, row in useless_features.iterrows():
        print(f"   ❌ {row['feature']}: var={row['variance']:.4f}, zeros={row['zero_ratio']:.1%}")

    return useful_features['feature'].tolist()


def main():
    """Hàm chính - Trích xuất 28 features chất lượng cao"""
    print("🚀 BẮT ĐẦU TRÍCH XUẤT 28 FEATURES (BAO GỒM CHỐNG UNICODE)...")

    # Load dữ liệu
    df = load_cleaned_data()
    if df is None:
        print("❌ Không tìm thấy dữ liệu. Hãy chạy file làm sạch dữ liệu trước.")
        return

    extractor = URLFeatureExtractor()
    features_list = []

    # Trích xuất features
    for idx, row in df.iterrows():
        if idx % 1000 == 0:
            print(f"⏳ Đang xử lý {idx}/{len(df)}...")

        try:
            features = extractor.extract_high_quality_features(row['url'])

            if 'label' in df.columns:
                features['label'] = row['label']

            features_list.append(features)
        except Exception as e:
            print(f"Lỗi tại URL {row['url']}: {e}")
            continue

    # Tạo DataFrame
    features_df = pd.DataFrame(features_list)

    # PHÂN TÍCH và CHỌN features chất lượng
    useful_features = analyze_feature_variance(features_df)

    # Đảm bảo có label
    if 'label' in features_df.columns and 'label' not in useful_features:
        useful_features.append('label')

    # Chỉ giữ lại features hữu ích
    high_quality_df = features_df[useful_features]

    print(f"\n🎉 KẾT QUẢ:")
    print(f"   📊 Số features ban đầu: {len(features_df.columns)}")
    print(f"   ✅ Số features chất lượng: {len(high_quality_df.columns)}")
    print(f"   🔥 Features được giữ lại: {list(high_quality_df.columns)}")

    # Lưu kết quả
    save_features(high_quality_df, 'url_features_high_quality1.csv')
    print(f"\n💾 ĐÃ LƯU: data/features/url_features_high_quality1.csv")


if __name__ == "__main__":
    main()