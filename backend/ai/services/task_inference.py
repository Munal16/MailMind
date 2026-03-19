from pathlib import Path
import warnings

import joblib
from sklearn.exceptions import InconsistentVersionWarning

from ai.utils.sentence_utils import split_sentences

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = BASE_DIR / "ml_models" / "task_sentence_classifier.joblib"

task_model = None


def load_task_model():
    global task_model
    if task_model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Task model not found at: {MODEL_PATH}")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", InconsistentVersionWarning)
            task_model = joblib.load(MODEL_PATH)
    return task_model


def extract_tasks_from_email(body: str, threshold: float = 0.50):
    model = load_task_model()
    sentences = split_sentences(body)

    if not sentences:
        return []

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(sentences)[:, 1]
    else:
        preds = model.predict(sentences)
        probs = [1.0 if pred == 1 else 0.0 for pred in preds]

    tasks = []
    for sentence, prob in zip(sentences, probs):
        if prob >= threshold:
            tasks.append(
                {
                    "task_text": sentence,
                    "score": float(prob),
                }
            )

    return tasks
