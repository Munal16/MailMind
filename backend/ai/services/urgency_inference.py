from pathlib import Path
import warnings

import joblib
from sklearn.exceptions import InconsistentVersionWarning

from ai.utils.text_preprocessing import build_email_text

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = BASE_DIR / "ml_models" / "urgency_linearsvc.joblib"

urgency_model = None


def load_urgency_model():
    global urgency_model
    if urgency_model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Urgency model not found at: {MODEL_PATH}")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", InconsistentVersionWarning)
            urgency_model = joblib.load(MODEL_PATH)
    return urgency_model


def predict_urgency(subject: str, body: str):
    model = load_urgency_model()
    text = build_email_text(subject, body)

    pred = model.predict([text])[0]

    confidence = None
    if hasattr(model, "decision_function"):
        try:
            raw = model.decision_function([text])
            if getattr(raw, "ndim", 1) == 1:
                confidence = float(raw[0])
            else:
                confidence = float(raw.max())
        except Exception:
            confidence = None

    return {
        "urgency": pred,
        "confidence": confidence,
        "text_used": text,
    }
