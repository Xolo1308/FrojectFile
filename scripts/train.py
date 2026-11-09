# scripts/balanced_training.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, precision_score, recall_score,
                             f1_score, roc_auc_score, roc_curve)
import joblib
import os
import matplotlib.pyplot as plt
import seaborn as sns


def balanced_training():
    print("=" * 60)
    print("⚖️ HUẤN LUYỆN CÂN BẰNG - TỐC ĐỘ & CHẤT LƯỢNG")
    print("=" * 60)

    # Load data
    df = pd.read_csv('data/features/url_features_high_quality.csv')
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

    # Parameter grid vừa phải
    param_grid = {
        'n_estimators': [100, 200, 300],
        'max_depth': [15, 20, None],
        'min_samples_split': [2, 5],
        'min_samples_leaf': [1, 2],
        'max_features': ['sqrt', 'log2']
    }

    rf = RandomForestClassifier(random_state=42, n_jobs=-1)

    grid_search = GridSearchCV(
        estimator=rf,
        param_grid=param_grid,
        cv=3,
        scoring='accuracy',
        n_jobs=-1,
        verbose=1
    )

    print("\n🎯 Đang tìm parameters tối ưu...")
    grid_search.fit(X_train, y_train)

    print(f"\n✅ Best Parameters: {grid_search.best_params_}")

    # Đánh giá
    best_model = grid_search.best_estimator_
    y_pred = best_model.predict(X_test)
    y_pred_proba = best_model.predict_proba(X_test)[:, 1]  # Xác suất cho lớp 1 (lừa đảo)

    print("\n" + "=" * 60)
    print("📊 KẾT QUẢ ĐÁNH GIÁ CHI TIẾT")
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
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0  # False Positive Rate
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0  # Độ đặc hiệu
    npv = tn / (tn + fn) if (tn + fn) > 0 else 0  # Negative Predictive Value

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

    # 5. AUC-ROC
    try:
        auc_roc = roc_auc_score(y_test, y_pred_proba)
        print(f"\n AUC-ROC: {auc_roc:.4f} ({auc_roc * 100:.2f}%)")
        print(f"   (Diện tích dưới đường cong ROC - càng cao càng tốt)")
    except:
        print("\n Không tính được AUC-ROC")

    # 6. CROSS-VALIDATION
    cv_scores = cross_val_score(best_model, X, y, cv=5, scoring='accuracy')
    print(f"\n CROSS-VALIDATION (5-fold):")
    print(f"   Scores: {cv_scores}")
    print(f"   Mean: {cv_scores.mean():.4f} (±{cv_scores.std():.4f})")

    # 7. VẼ CONFUSION MATRIX
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=['An toàn (0)', 'Lừa đảo (1)'],
                yticklabels=['An toàn (0)', 'Lừa đảo (1)'])
    plt.title('Confusion Matrix - Random Forest Classifier')
    plt.ylabel('Thực tế')
    plt.xlabel('Dự đoán')

    # Lưu biểu đồ
    os.makedirs('models', exist_ok=True)
    plt.savefig('models/confusion_matrix.png', dpi=300, bbox_inches='tight')
    print(f"\n💾 Đã lưu confusion matrix: models/confusion_matrix.png")
    plt.show()

    # 8. VẼ ROC CURVE
    try:
        fpr_curve, tpr_curve, thresholds = roc_curve(y_test, y_pred_proba)

        plt.figure(figsize=(8, 6))
        plt.plot(fpr_curve, tpr_curve, 'b-', label=f'Random Forest (AUC = {auc_roc:.4f})')
        plt.plot([0, 1], [0, 1], 'r--', label='Random Classifier')
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title('ROC Curve')
        plt.legend()
        plt.grid(True)
        plt.savefig('models/roc_curve1.png', dpi=300, bbox_inches='tight')
        print(f"💾 Đã lưu ROC curve: models/roc_curve1.png")
        plt.show()
    except:
        pass

    # 9. BÁO CÁO TỔNG KẾT
    print("\n" + "=" * 60)
    print("📊 BÁO CÁO TỔNG KẾT")
    print("=" * 60)
    print(f"""
     MODEL RANDOM FOREST - HIỆU SUẤT
    ─────────────────────────────────────────────
     Độ chính xác (Accuracy):     {accuracy:.2%}
     Độ chính xác dự đoán (Precision): {precision:.2%}
     Độ nhạy (Recall/TPR):        {recall:.2%}
     Điểm F1 (F1-Score):          {f1:.2%}
     False Positive Rate (FPR):   {fpr:.2%}
     AUC-ROC:                     {auc_roc:.2%}

    PHÂN TÍCH:
    - Số lừa đảo phát hiện đúng: {tp}
    - Số lừa đảo bỏ sót: {fn}
    - Số an toàn bị nhầm: {fp}
    - Số an toàn đúng: {tn}
    """)

    # Lưu model
    joblib.dump(best_model, 'models/balanced_model2.pkl')
    print(f"\ Đã lưu model: models/balanced_model2.pkl")

    return best_model, {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'fpr': fpr,
        'auc_roc': auc_roc if 'auc_roc' in locals() else None,
        'confusion_matrix': cm
    }


if __name__ == "__main__":
    model, metrics = balanced_training()

