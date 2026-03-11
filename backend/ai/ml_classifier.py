from pathlib import Path
import joblib

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "ml" / "models"

URGENCY_MODEL_PATH = MODEL_DIR / "urgency_model.joblib"
INTENT_MODEL_PATH = MODEL_DIR / "intent_model.joblib"

urgency_model = None
intent_model = None


def load_models():
    global urgency_model, intent_model

    if URGENCY_MODEL_PATH.exists():
        urgency_model = joblib.load(URGENCY_MODEL_PATH)

    if INTENT_MODEL_PATH.exists():
        intent_model = joblib.load(INTENT_MODEL_PATH)


def predict_with_ml(subject: str, snippet: str):
    if urgency_model is None or intent_model is None:
        raise ValueError("ML models are not loaded.")

    text = f"{subject or ''} {snippet or ''}".strip()

    urgency = urgency_model.predict([text])[0]
    intent = intent_model.predict([text])[0]

    base_score = 10

    if urgency == "High":
        base_score += 50
    elif urgency == "Medium":
        base_score += 25

    if intent == "Payment":
        base_score += 20
    elif intent == "Support":
        base_score += 20
    elif intent == "Meeting":
        base_score += 10

    base_score = max(0, min(100, base_score))

    return {
        "urgency": urgency,
        "intent": intent,
        "priority_score": base_score,
        "explanation": "Predicted using trained TF-IDF + Logistic Regression models.",
    }
