from __future__ import annotations

import json
import re
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_recall_fscore_support
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.linear_model import SGDClassifier


REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_PATH = REPO_ROOT / "task_dataset.csv"
MODEL_PATH = REPO_ROOT / "backend" / "ml_models" / "task_sentence_classifier.joblib"
METRICS_PATH = REPO_ROOT / "backend" / "ml_models" / "task_sentence_classifier_metrics.json"


TASK_NOISE_PATTERNS = [
    re.compile(r"not (?:the )?intended recipient", re.IGNORECASE),
    re.compile(r"unauthorized review", re.IGNORECASE),
    re.compile(r"distribution is prohibited", re.IGNORECASE),
    re.compile(r"disclosure by others is strictly prohibited", re.IGNORECASE),
    re.compile(r"destroy all copies", re.IGNORECASE),
    re.compile(r"copy or deliver this message", re.IGNORECASE),
    re.compile(r"strictly prohibited", re.IGNORECASE),
    re.compile(r"\bunsubscribe\b", re.IGNORECASE),
    re.compile(r"stop receiving", re.IGNORECASE),
    re.compile(r'word\s+"?remove"?\s+in the subject line', re.IGNORECASE),
    re.compile(r"contact the sender", re.IGNORECASE),
    re.compile(r"call me if you have any questions", re.IGNORECASE),
    re.compile(r"please call if you have any questions", re.IGNORECASE),
    re.compile(r"let us know if you have any questions", re.IGNORECASE),
]


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip())


def split_sentences(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", str(text or ""))
    return [clean_text(sentence) for sentence in sentences if clean_text(sentence)]


def normalize(text: str) -> str:
    return clean_text(text).lower()


def is_noise(text: str) -> bool:
    value = clean_text(text)
    if not value:
        return True

    words = value.split()
    if len(words) < 3 or len(words) > 80:
        return True

    lowered = value.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        return True

    return any(pattern.search(value) for pattern in TASK_NOISE_PATTERNS)


def build_sentence_dataset(df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    for idx, row in df.iterrows():
        email_text = row["email_text"]
        task_text = row["task"]
        task_norm = normalize(task_text)
        sentences = split_sentences(email_text) or [task_text]

        positives: list[str] = []
        negatives: list[str] = []

        for sentence in sentences:
            sentence_norm = normalize(sentence)
            if not sentence_norm:
                continue
            if task_norm in sentence_norm or sentence_norm in task_norm:
                positives.append(sentence)
            else:
                negatives.append(sentence)

        if not positives:
            positives = [task_text]

        positives = [sentence for sentence in positives if not is_noise(sentence)]
        negatives = [sentence for sentence in negatives if not is_noise(sentence)]

        if not positives:
            continue

        for sentence in positives:
            rows.append({"email_idx": idx, "sentence": sentence, "label": 1})

        for sentence in negatives[: max(1, len(positives))]:
            rows.append({"email_idx": idx, "sentence": sentence, "label": 0})

    sentence_df = pd.DataFrame(rows).drop_duplicates().reset_index(drop=True)
    sentence_df["word_count"] = sentence_df["sentence"].str.split().str.len()
    sentence_df = sentence_df[(sentence_df["word_count"] >= 3) & (sentence_df["word_count"] <= 80)].copy()
    return sentence_df.reset_index(drop=True)


def select_threshold(model: Pipeline, val_sentences: pd.Series, val_labels: pd.Series) -> tuple[float, dict[str, float]]:
    probs = model.predict_proba(val_sentences)[:, 1]
    best_threshold = 0.50
    best_metrics = None
    best_score = -1.0

    for threshold in [round(step, 2) for step in [0.45, 0.50, 0.55, 0.60, 0.65, 0.70]]:
        preds = (probs >= threshold).astype(int)
        precision, recall, f1, _ = precision_recall_fscore_support(
            val_labels,
            preds,
            average="binary",
            zero_division=0,
        )
        # Favor precision slightly so app users see fewer false task detections.
        score = (precision * 0.6) + (f1 * 0.4)
        if score > best_score:
            best_score = score
            best_threshold = threshold
            best_metrics = {
                "precision": float(precision),
                "recall": float(recall),
                "f1": float(f1),
            }

    return best_threshold, best_metrics or {}


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Task dataset not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    if "body" in df.columns:
        df["email_text"] = df["body"].fillna("").astype(str)
    elif "email_text" in df.columns:
        df["email_text"] = df["email_text"].fillna("").astype(str)
    else:
        raise ValueError("task_dataset.csv needs body or email_text column")

    df["task"] = df["task"].fillna("").astype(str)
    df["email_text"] = df["email_text"].map(clean_text)
    df["task"] = df["task"].map(clean_text)
    df = df[(df["email_text"] != "") & (df["task"] != "")].drop_duplicates(subset=["email_text", "task"]).reset_index(drop=True)
    df = df[~df["task"].map(is_noise)].reset_index(drop=True)

    sentence_df = build_sentence_dataset(df)

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.1, random_state=42)
    train_idx, val_idx = next(splitter.split(sentence_df["sentence"], sentence_df["label"], groups=sentence_df["email_idx"]))
    train_df = sentence_df.iloc[train_idx].reset_index(drop=True)
    val_df = sentence_df.iloc[val_idx].reset_index(drop=True)

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
                    max_features=20000,
                ),
            ),
            (
                "clf",
                SGDClassifier(
                    loss="log_loss",
                    class_weight="balanced",
                    alpha=1e-5,
                    max_iter=30,
                    tol=1e-3,
                    average=True,
                    random_state=42,
                ),
            ),
        ]
    )

    pipeline.fit(train_df["sentence"], train_df["label"])

    threshold, threshold_metrics = select_threshold(pipeline, val_df["sentence"], val_df["label"])
    val_probs = pipeline.predict_proba(val_df["sentence"])[:, 1]
    val_preds = (val_probs >= threshold).astype(int)

    metrics = {
        "dataset_rows": int(len(df)),
        "sentence_rows": int(len(sentence_df)),
        "train_rows": int(len(train_df)),
        "val_rows": int(len(val_df)),
        "threshold": threshold,
        "accuracy": float(accuracy_score(val_df["label"], val_preds)),
        "weighted_f1": float(f1_score(val_df["label"], val_preds, average="weighted")),
        "macro_f1": float(f1_score(val_df["label"], val_preds, average="macro")),
        "task_metrics": threshold_metrics,
        "classification_report": classification_report(
            val_df["label"],
            val_preds,
            target_names=["Not Task", "Task"],
            output_dict=True,
            zero_division=0,
        ),
    }

    joblib.dump({"pipeline": pipeline, "threshold": threshold}, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(json.dumps(metrics, indent=2))
    print(f"Saved task model to {MODEL_PATH}")
    print(f"Saved task metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
