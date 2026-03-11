from pathlib import Path
import pandas as pd

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "ml" / "data"
DATASET_PATH = DATA_DIR / "email_training_data.csv"

DATA_DIR.mkdir(parents=True, exist_ok=True)


REQUIRED_COLUMNS = {"subject", "snippet", "urgency", "intent"}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dataset_status(request):
    if not DATASET_PATH.exists():
        return Response({
            "exists": False,
            "path": str(DATASET_PATH),
            "rows": 0,
            "columns": [],
        })

    df = pd.read_csv(DATASET_PATH)

    return Response({
        "exists": True,
        "path": str(DATASET_PATH),
        "rows": int(len(df)),
        "columns": list(df.columns),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_dataset(request):
    file_obj = request.FILES.get("file")

    if not file_obj:
        return Response({"error": "No file uploaded. Use form-data key: file"}, status=400)

    if not file_obj.name.lower().endswith(".csv"):
        return Response({"error": "Only CSV files are allowed."}, status=400)

    try:
        df = pd.read_csv(file_obj)
    except Exception as e:
        return Response({"error": f"Failed to read CSV: {str(e)}"}, status=400)

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        return Response({
            "error": "CSV missing required columns.",
            "missing_columns": list(missing),
            "required_columns": list(REQUIRED_COLUMNS),
        }, status=400)

    # Optional cleanup
    df = df[["subject", "snippet", "urgency", "intent"]].copy()
    df["subject"] = df["subject"].fillna("")
    df["snippet"] = df["snippet"].fillna("")
    df["urgency"] = df["urgency"].fillna("").astype(str).str.strip()
    df["intent"] = df["intent"].fillna("").astype(str).str.strip()

    # Remove totally empty labels
    df = df[(df["urgency"] != "") & (df["intent"] != "")]

    df.to_csv(DATASET_PATH, index=False)

    return Response({
        "message": "Dataset uploaded successfully.",
        "rows": int(len(df)),
        "columns": list(df.columns),
        "saved_to": str(DATASET_PATH),
    })
