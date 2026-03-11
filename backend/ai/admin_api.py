from pathlib import Path
import json
import subprocess
import sys

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .ml_classifier import load_models


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "ml" / "models"
TRAIN_SCRIPT = BASE_DIR / "ml" / "scripts" / "train_model.py"


def read_json(path: Path):
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def model_metrics(request):
    urgency_metrics = read_json(MODEL_DIR / "urgency_metrics.json")
    intent_metrics = read_json(MODEL_DIR / "intent_metrics.json")

    return Response({
        "urgency": urgency_metrics,
        "intent": intent_metrics,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def retrain_models(request):
    try:
        result = subprocess.run(
            [sys.executable, str(TRAIN_SCRIPT)],
            capture_output=True,
            text=True,
            check=True,
        )

        load_models()

        return Response({
            "message": "Models retrained successfully.",
            "stdout": result.stdout,
            "stderr": result.stderr,
        })
    except subprocess.CalledProcessError as e:
        return Response({
            "error": "Retraining failed.",
            "stdout": e.stdout,
            "stderr": e.stderr,
        }, status=500)
