from pathlib import Path
import json
import joblib
import pandas as pd

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "email_training_data.csv"
MODEL_DIR = BASE_DIR / "models"

MODEL_DIR.mkdir(parents=True, exist_ok=True)


def combine_text(df: pd.DataFrame) -> pd.Series:
    return (df["subject"].fillna("") + " " + df["snippet"].fillna("")).str.strip()


def train_single_model(X, y, model_name: str):
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(max_features=3000, ngram_range=(1, 2))),
        ("clf", LogisticRegression(max_iter=1000)),
    ])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)

    report = classification_report(y_test, preds, output_dict=True)
    accuracy = accuracy_score(y_test, preds)

    print(f"\n=== {model_name.upper()} MODEL REPORT ===")
    print(classification_report(y_test, preds))
    print(f"Accuracy: {accuracy:.4f}")

    model_path = MODEL_DIR / f"{model_name}_model.joblib"
    metrics_path = MODEL_DIR / f"{model_name}_metrics.json"

    joblib.dump(pipeline, model_path)

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "model_name": model_name,
                "accuracy": accuracy,
                "classification_report": report,
                "train_size": len(X_train),
                "test_size": len(X_test),
            },
            f,
            indent=2,
        )

    print(f"Saved model to: {model_path}")
    print(f"Saved metrics to: {metrics_path}")


def main():
    df = pd.read_csv(DATA_PATH)

    required_cols = {"subject", "snippet", "urgency", "intent"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in dataset: {missing}")

    X = combine_text(df)

    train_single_model(X, df["urgency"], "urgency")
    train_single_model(X, df["intent"], "intent")


if __name__ == "__main__":
    main()
