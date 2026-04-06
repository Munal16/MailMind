from pathlib import Path
import warnings

import joblib
from sklearn.exceptions import InconsistentVersionWarning

from ai.utils.task_filters import is_task_noise, normalize_task_text
from ai.utils.sentence_utils import split_sentences

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = BASE_DIR / "ml_models" / "task_sentence_classifier.joblib"

task_model = None
task_threshold = 0.55


def load_task_model():
    global task_model, task_threshold
    if task_model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Task model not found at: {MODEL_PATH}")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", InconsistentVersionWarning)
            loaded = joblib.load(MODEL_PATH)
            if isinstance(loaded, dict) and "pipeline" in loaded:
                task_model = loaded["pipeline"]
                task_threshold = float(loaded.get("threshold", task_threshold))
            else:
                task_model = loaded
    return task_model


def extract_tasks_from_email(body: str, threshold: float | None = None):
    model = load_task_model()
    active_threshold = float(task_threshold if threshold is None else threshold)
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
        cleaned_sentence = normalize_task_text(sentence)
        if prob >= active_threshold and not is_task_noise(cleaned_sentence):
            tasks.append(
                {
                    "task_text": cleaned_sentence,
                    "score": float(prob),
                }
            )

    return tasks
