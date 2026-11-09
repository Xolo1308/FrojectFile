# scripts/balanced_training.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV, learning_curve
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, precision_score, recall_score,
                             f1_score, roc_auc_score, roc_curve, precision_recall_curve, auc)
import joblib
import os
import matplotlib.pyplot as plt
import seaborn as sns

def balanced_training():
    print("=" * 60)
    print("⚖️ HUẤN LUYỆN CÂN BẰNG - TỐC ĐỘ & CHẤT LƯỢNG")
    print("=" * 60)

    # Load data
    df = pd.read_csv('data/features/url_features_high_quality1.csv')
    print(f"\n📊 Dữ liệu: {len(df)} mẫu, {len(df.columns) - 1} đặc trưng")

    X = df.drop('label', axis=1)
    y = df['label']

    # Kiểm tra phân bố nhãn
    print(f"📈 Phân bố nhãn:")
    print(f"   - An toàn (0): {(y == 0).sum()}")
    print(f"   - Lừa đảo (1): {(y == 1).sum()}")

    # Chia data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\n📦 Chia dữ liệu: {X_train.shape[0]} train, {X_test.shape[0]} test")

    # ==========================================
    # [CẢI TIẾN 1] THÊM CLASS WEIGHT VÀO GRID SEARCH
    # ==========================================
    param_grid = {
        'n_estimators': [100, 200, 300],
        'max_depth': [15, 20, None],
        'min_samples_split': [2, 5],
        'min_samples_leaf': [1, 2],
        'max_features': ['sqrt', 'log2'],
        # Thêm class_weight để phạt nặng lỗi đoán sai lừa đảo
        'class_weight': ['balanced', {0: 1.0, 1: 2.0}] 
    }

    rf = RandomForestClassifier(random_state=42, n_jobs=-1)

    grid_search = GridSearchCV(
        estimator=rf,
        param_grid=param_grid,
        cv=3,
        scoring='f1', # [CẢI TIẾN 2] Đổi từ 'accuracy' sang 'f1' để tối ưu cân bằng
        n_jobs=-1,
        verbose=1
    )

    print("\n🎯 Đang tìm parameters tối ưu (Ưu tiên F1-Score)...")
    grid_search.fit(X_train, y_train)

    print(f"\n✅ Best Parameters: {grid_search.best_params_}")

    # Đánh giá
    best_model = grid_search.best_estimator_
    
    # ==========================================
    # [CẢI TIẾN 3] ĐIỀU CHỈNH NGƯỠNG (THRESHOLD TUNING)
    # Hạ ngưỡng xuống 0.45 để bắt được nhiều lừa đảo hơn (tăng Recall)
    # ==========================================
    CUSTOM_THRESHOLD = 0.45 
    print(f"\n Áp dụng Decision Threshold tùy chỉnh: {CUSTOM_THRESHOLD}")

    y_pred_proba = best_model.predict_proba(X_test)[:, 1] # Xác suất lớp 1 (lừa đảo)
    y_pred = (y_pred_proba >= CUSTOM_THRESHOLD).astype(int) # Phân loại dựa trên ngưỡng mới

    print("\n" + "=" * 60)
    print("KẾT QUẢ ĐÁNH GIÁ CHI TIẾT")
    print("=" * 60)

    # 1. CONFUSION MATRIX
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    print("\n CONFUSION MATRIX:")
    print("                    Dự đoán")
    print("                 An toàn  Lừa đảo")
    print(f"Thực tế An toàn    {tn:7d}   {fp:7d}")
    print(f"        Lừa đảo    {fn:7d}   {tp:7d}")

    # 2. CÁC CHỈ SỐ CƠ BẢN
    print("\n CÁC CHỈ SỐ ĐÁNH GIÁ:")
    print("-" * 40)
    print(f" True Positives (TP):  {tp:7d}  - Lừa đảo được phát hiện đúng")
    print(f" False Positives (FP): {fp:7d}  - An toàn bị nhầm thành lừa đảo")
    print(f" False Negatives (FN): {fn:7d}  - Lừa đảo bị bỏ sót")
    print(f" True Negatives (TN):  {tn:7d}  - An toàn được phát hiện đúng")
    print("-" * 40)

    # 3. CÁC TỶ LỆ ĐÁNH GIÁ
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    npv = tn / (tn + fn) if (tn + fn) > 0 else 0

    print("\n CHỈ SỐ CHẤT LƯỢNG:")
    print(f"   Accuracy  (Độ chính xác):     {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print(f"   Precision (Độ chính xác dự đoán): {precision:.4f} ({precision * 100:.2f}%)")
    print(f"   Recall    (Độ nhạy/TPR):      {recall:.4f} ({recall * 100:.2f}%)")
    print(f"   F1-Score  (Điểm cân bằng):    {f1:.4f} ({f1 * 100:.2f}%)")
    print(f"   FPR       (False Positive Rate): {fpr:.4f} ({fpr * 100:.2f}%)")
    print(f"   Specificity (Độ đặc hiệu):    {specificity:.4f} ({specificity * 100:.2f}%)")
    print(f"   NPV       (Negative Predictive Value): {npv:.4f} ({npv * 100:.2f}%)")

    # 4. BÁO CÁO PHÂN LOẠI
    print("\n CLASSIFICATION REPORT:")
    print(classification_report(y_test, y_pred, target_names=['An toàn', 'Lừa đảo']))

    # 5. AUC-ROC (Sử dụng xác suất gốc, không bị ảnh hưởng bởi threshold)
    try:
        auc_roc = roc_auc_score(y_test, y_pred_proba)
        print(f"\n AUC-ROC: {auc_roc:.4f} ({auc_roc * 100:.2f}%)")
    except:
        auc_roc = None
        print("\n Không tính được AUC-ROC")

    # 6. CROSS-VALIDATION
    cv_scores = cross_val_score(best_model, X, y, cv=5, scoring='f1') # Dùng F1 để nhất quán
    print(f"\n CROSS-VALIDATION (5-fold):")
    print(f"   Scores: {cv_scores}")
    print(f"   Mean: {cv_scores.mean():.4f} (±{cv_scores.std():.4f})")

    # 7. VẼ CONFUSION MATRIX
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=['An toàn (0)', 'Lừa đảo (1)'],
                yticklabels=['An toàn (0)', 'Lừa đảo (1)'])
    plt.title(f'Confusion Matrix (Threshold = {CUSTOM_THRESHOLD})')
    plt.ylabel('Thực tế')
    plt.xlabel('Dự đoán')

    os.makedirs('models', exist_ok=True)
    plt.savefig('models/confusion_matrix_v2.png', dpi=300, bbox_inches='tight')
    print(f"\nĐã lưu confusion matrix: models/confusion_matrix_v2.png")
    plt.show()

    # 8. VẼ ROC CURVE
    if auc_roc:
        fpr_curve, tpr_curve, thresholds = roc_curve(y_test, y_pred_proba)
        plt.figure(figsize=(8, 6))
        plt.plot(fpr_curve, tpr_curve, 'b-', label=f'Random Forest (AUC = {auc_roc:.4f})')
        plt.plot([0, 1], [0, 1], 'r--', label='Random Classifier')
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title('ROC Curve')
        plt.legend()
        plt.grid(True)
        plt.savefig('models/roc_curve_v2.png', dpi=300, bbox_inches='tight')
        print(f"Đã lưu ROC curve: models/roc_curve_v2.png")
        plt.show()

    # ==========================================
    # [MỚI] 9. VẼ PRECISION-RECALL CURVE
    # ==========================================
    print("\n📈 Đang vẽ Precision-Recall Curve...")
    precision_curve, recall_curve, _ = precision_recall_curve(y_test, y_pred_proba)
    pr_auc = auc(recall_curve, precision_curve)

    plt.figure(figsize=(8, 6))
    plt.plot(recall_curve, precision_curve, 'g-', linewidth=2, label=f'PR Curve (AUC = {pr_auc:.4f})')
    plt.axhline(y=y_test.mean(), color='r', linestyle='--', label=f'Baseline (Tỷ lệ lừa đảo = {y_test.mean():.2f})')
    plt.xlabel('Recall (Độ nhạy)')
    plt.ylabel('Precision (Độ chính xác)')
    plt.title('Precision-Recall Curve')
    plt.legend(loc='best')
    plt.grid(True, alpha=0.3)
    plt.savefig('models/precision_recall_curve_v2.png', dpi=300, bbox_inches='tight')
    print(f"Đã lưu Precision-Recall Curve: models/precision_recall_curve_v2.png")
    plt.show()

    # ==========================================
    # [MỚI] 10. VẼ LEARNING CURVE
    # ==========================================
    print("\n📈 Đang vẽ Learning Curve (Quá trình này có thể mất vài phút)...")
    train_sizes, train_scores, test_scores = learning_curve(
        best_model, X_train, y_train, cv=3, n_jobs=-1,
        train_sizes=np.linspace(0.1, 1.0, 5), scoring='f1'
    )

    train_scores_mean = np.mean(train_scores, axis=1)
    train_scores_std = np.std(train_scores, axis=1)
    test_scores_mean = np.mean(test_scores, axis=1)
    test_scores_std = np.std(test_scores, axis=1)

    plt.figure(figsize=(8, 6))
    plt.fill_between(train_sizes, train_scores_mean - train_scores_std,
                     train_scores_mean + train_scores_std, alpha=0.1, color="b")
    plt.fill_between(train_sizes, test_scores_mean - test_scores_std,
                     test_scores_mean + test_scores_std, alpha=0.1, color="orange")
    plt.plot(train_sizes, train_scores_mean, 'o-', color="b", label="Training F1-Score")
    plt.plot(train_sizes, test_scores_mean, 'o-', color="orange", label="Cross-validation F1-Score")
    plt.xlabel('Số lượng mẫu huấn luyện')
    plt.ylabel('F1-Score')
    plt.title('Learning Curve - Random Forest')
    plt.legend(loc="best")
    plt.grid(True, alpha=0.3)
    plt.savefig('models/learning_curve_v2.png', dpi=300, bbox_inches='tight')
    print(f"Đã lưu Learning Curve: models/learning_curve_v2.png")
    plt.show()

    # 11. BÁO CÁO TỔNG KẾT
    print("\n" + "=" * 60)
    print("📊 BÁO CÁO TỔNG KẾT")
    print("=" * 60)
    print(f"""
     MODEL RANDOM FOREST (V2 - CẢI TIẾN)
    ─────────────────────────────────────────────
     Độ chính xác (Accuracy):     {accuracy:.2%}
     Độ chính xác dự đoán (Precision): {precision:.2%}
     Độ nhạy (Recall/TPR):        {recall:.2%}
     Điểm F1 (F1-Score):          {f1:.2%}
     False Positive Rate (FPR):   {fpr:.2%}
     AUC-ROC:                     {auc_roc:.2%}
     AUC-PR:                      {pr_auc:.2%}

    PHÂN TÍCH:
    - Số lừa đảo phát hiện đúng: {tp}
    - Số lừa đảo bỏ sót: {fn}
    - Số an toàn bị nhầm: {fp}
    - Số an toàn đúng: {tn}
    """)

    # Lưu model (Lưu ý: Lưu best_model, nhưng khi dự đoán ở App phải dùng Custom Threshold 0.45)
    joblib.dump(best_model, 'models/balanced_model_v2.pkl')
    print(f"\n💾 Đã lưu model: models/balanced_model_v2.pkl")
    print(f"⚠️ LƯU Ý KHI CHẠY APP: Phải dùng threshold >= {CUSTOM_THRESHOLD} thay vì 0.5 mặc định!")

    return best_model, {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'fpr': fpr,
        'auc_roc': auc_roc,
        'auc_pr': pr_auc,
        'confusion_matrix': cm
    }


if __name__ == "__main__":
    model, metrics = balanced_training()