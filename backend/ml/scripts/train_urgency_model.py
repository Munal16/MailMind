from __future__ import annotations

import json
import re
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC


REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_PATH = REPO_ROOT / "urgency_dataset.csv"
MODEL_PATH = REPO_ROOT / "backend" / "ml_models" / "urgency_linearsvc.joblib"
METRICS_PATH = REPO_ROOT / "backend" / "ml_models" / "urgency_linearsvc_metrics.json"


def normalize_text(text: str) -> str:
    value = str(text or "").lower()
    value = re.sub(r"\s+", " ", value).strip()
    words = value.split()
    if len(words) > 512:
        value = " ".join(words[:512])
    return value


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Urgency dataset not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    if "email_text" in df.columns:
        df["text"] = df["email_text"].fillna("").astype(str)
    elif "text" in df.columns:
        df["text"] = df["text"].fillna("").astype(str)
    elif {"subject", "body"}.issubset(df.columns):
        df["text"] = (df["subject"].fillna("").astype(str) + " " + df["body"].fillna("").astype(str)).str.strip()
    else:
        raise ValueError("urgency_dataset.csv needs email_text, text, or subject/body columns")

    df["urgency"] = df["urgency"].fillna("").astype(str).str.strip().str.title()
    df["text"] = df["text"].map(normalize_text)
    df = df[(df["text"] != "") & df["urgency"].isin(["High", "Medium", "Low"])].drop_duplicates(subset=["text", "urgency"]).reset_index(drop=True)

    X_train, X_val, y_train, y_val = train_test_split(
        df["text"],
        df["urgency"],
        test_size=0.1,
        random_state=42,
        stratify=df["urgency"],
    )

    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    stop_words="english",
                    ngram_range=(1, 2),
                    min_df=2,
                    max_df=0.95,
                    sublinear_tf=True,
                    max_features=50000,
                ),
            ),
            (
                "clf",
                LinearSVC(
                    C=1.0,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )

    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_val)

    metrics = {
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "val_rows": int(len(X_val)),
        "accuracy": float(accuracy_score(y_val, preds)),
        "weighted_f1": float(f1_score(y_val, preds, average="weighted")),
        "macro_f1": float(f1_score(y_val, preds, average="macro")),
        "classification_report": classification_report(
            y_val,
            preds,
            output_dict=True,
            zero_division=0,
        ),
    }

    joblib.dump(pipeline, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(json.dumps(metrics, indent=2))
    print(f"Saved urgency model to {MODEL_PATH}")
    print(f"Saved urgency metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
