from pathlib import Path
import contextlib
import io
import json

import torch
from huggingface_hub.utils import disable_progress_bars
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from transformers.utils import logging as transformers_logging

from ai.utils.text_preprocessing import build_email_text

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_DIR = BASE_DIR / "ml_models" / "mailmind_intent_distilbert"

intent_tokenizer = None
intent_model = None
intent_id2label = None


def load_intent_model():
    global intent_tokenizer, intent_model, intent_id2label

    if intent_model is None:
        if not MODEL_DIR.exists():
            raise FileNotFoundError(f"Intent model folder not found at: {MODEL_DIR}")

        disable_progress_bars()
        transformers_logging.set_verbosity_error()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            intent_tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
            intent_model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR, local_files_only=True)

        label_map_path = MODEL_DIR / "label_map.json"
        if not label_map_path.exists():
            raise FileNotFoundError(f"label_map.json not found at: {label_map_path}")

        with open(label_map_path, "r", encoding="utf-8") as file:
            label_map = json.load(file)

        intent_id2label = {int(key): value for key, value in label_map["id2label"].items()}

    return intent_tokenizer, intent_model, intent_id2label


def predict_intent(subject: str, body: str):
    tokenizer, model, id2label = load_intent_model()

    text = build_email_text(subject, body)

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=256,
        padding=True,
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1)
        pred_id = torch.argmax(probs, dim=-1).item()
        confidence = float(probs[0][pred_id].item())

    return {
        "intent": id2label[pred_id],
        "confidence": confidence,
        "text_used": text,
    }
