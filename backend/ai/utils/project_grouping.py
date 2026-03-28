import math
import re
from collections import Counter, defaultdict

from ai.utils.text_preprocessing import build_email_text, normalize_text
from emails.models import EmailMessage


GENERIC_SUBJECT_PARTS = {
    "re",
    "fwd",
    "fw",
    "urgent",
    "action required",
    "please review",
    "update",
    "status update",
    "meeting notes",
    "verification code",
    "account verification",
    "payment due",
}

GENERIC_NAME_PARTS = {
    "noreply",
    "no-reply",
    "notifications",
    "notification",
    "support",
    "updates",
    "team",
    "admin",
    "mail",
    "email",
}

GENERIC_CLUSTER_TERMS = {
    "email",
    "emails",
    "message",
    "messages",
    "mail",
    "account",
    "click",
    "read",
    "view",
    "update",
    "updates",
    "please",
    "thanks",
    "thank",
    "team",
    "attached",
    "attachment",
    "attachments",
}


def _clean_candidate(candidate: str):
    candidate = normalize_text(candidate)
    candidate = re.sub(r"^(?:re|fwd|fw)\s*[:\-]\s*", "", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"\s+", " ", candidate).strip(" -:|")
    return candidate


def _looks_like_project(candidate: str):
    if not candidate:
        return False

    normalized = candidate.lower()
    if normalized in GENERIC_SUBJECT_PARTS:
        return False

    words = [word for word in re.split(r"\s+", candidate) if word]
    if len(words) >= 2:
        return True

    return bool(re.search(r"[A-Z]{2,}|\d", candidate))


def infer_project_name(subject: str, body: str):
    subject_text = _clean_candidate(subject)
    body_text = normalize_text(body)

    subject_segments = re.split(r"\s*[:\-|]\s*", subject_text)
    for segment in subject_segments:
        candidate = _clean_candidate(segment)
        if _looks_like_project(candidate):
            return candidate[:120]

    project_patterns = [
        r"\bproject\s+([A-Z0-9][A-Za-z0-9&/#.\-]*(?:\s+[A-Z0-9][A-Za-z0-9&/#.\-]*){0,3})",
        r"\b(?:initiative|program|campaign|sprint|release|phase)\s+([A-Z0-9][A-Za-z0-9&/#.\-]*(?:\s+[A-Z0-9][A-Za-z0-9&/#.\-]*){0,3})",
    ]

    for pattern in project_patterns:
        match = re.search(pattern, body_text, re.IGNORECASE)
        if match:
            candidate = _clean_candidate(match.group(1))
            if _looks_like_project(candidate):
                return candidate[:120]

    title_case_runs = re.findall(r"\b(?:[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){1,3})\b", subject_text)
    for run in title_case_runs:
        candidate = _clean_candidate(run)
        if _looks_like_project(candidate):
            return candidate[:120]

    return None


def _sender_brand(sender: str):
    raw = _clean_candidate(sender)
    if not raw:
        return None

    display = re.sub(r"\s*<[^>]+>\s*$", "", raw).strip().strip('"')
    if not display or "@" in display:
        match = re.search(r"<([^>]+)>", raw)
        email_address = match.group(1) if match else raw
        local_part = email_address.split("@", 1)[0].replace(".", " ").replace("_", " ").replace("-", " ")
        display = local_part

    display = _clean_candidate(display)
    if not display:
        return None

    words = [word for word in display.split() if word]
    meaningful = [word for word in words if word.lower() not in GENERIC_NAME_PARTS]
    chosen = meaningful[:2] or words[:2]
    brand = " ".join(chosen).strip()
    if not brand:
        return None

    return brand[:60]


def _build_document(email):
    sender_brand = _sender_brand(email.sender) or ""
    fallback_hint = infer_project_name(email.subject or "", email.full_body_text or email.snippet or "") or ""
    text = build_email_text(email.subject or "", email.full_body_text or email.snippet or "")
    clipped_body = normalize_text(text)[:900]
    return normalize_text(
        " ".join(
            part
            for part in [
                sender_brand,
                sender_brand,
                email.subject or "",
                email.subject or "",
                fallback_hint,
                clipped_body,
            ]
            if part
        )
    )


def _candidate_project_count(total):
    if total < 6:
        return [2]
    upper = min(8, max(2, int(math.sqrt(total)) + 1))
    return list(range(2, upper + 1))


def _pick_cluster_count(reduced_matrix):
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score

    sample_count = len(reduced_matrix)
    if sample_count < 6:
        return 2

    best_k = 2
    best_score = -1

    for candidate in _candidate_project_count(sample_count):
        if candidate >= sample_count:
            continue

        model = KMeans(n_clusters=candidate, random_state=42, n_init=10)
        labels = model.fit_predict(reduced_matrix)
        label_counts = Counter(labels)
        if len(label_counts) < 2 or min(label_counts.values()) < 2:
            continue

        score = silhouette_score(reduced_matrix, labels, metric="cosine")
        if score > best_score:
            best_score = score
            best_k = candidate

    return best_k


def _clean_term(term: str):
    cleaned = re.sub(r"[_\-]+", " ", str(term or "")).strip()
    if not cleaned or cleaned.lower() in GENERIC_CLUSTER_TERMS:
        return None
    return " ".join(part.capitalize() for part in cleaned.split())


def _top_cluster_terms(center_vector, feature_names, limit=4):
    ranked = center_vector.argsort()[::-1]
    terms = []
    for index in ranked:
        term = _clean_term(feature_names[index])
        if not term:
            continue
        if term.lower() in {existing.lower() for existing in terms}:
            continue
        terms.append(term)
        if len(terms) >= limit:
            break
    return terms


def _cluster_name(cluster_emails, center_vector, feature_names):
    brands = [_sender_brand(email.sender) for email in cluster_emails]
    brand_counts = Counter(brand for brand in brands if brand)

    hints = [
        infer_project_name(email.subject or "", email.full_body_text or email.snippet or "")
        for email in cluster_emails
    ]
    hint_counts = Counter(hint for hint in hints if hint)

    dominant_brand = None
    if brand_counts:
        candidate, count = brand_counts.most_common(1)[0]
        if count >= max(2, math.ceil(len(cluster_emails) * 0.35)):
            dominant_brand = candidate

    repeated_hint = None
    if hint_counts:
        candidate, count = hint_counts.most_common(1)[0]
        if count >= max(2, math.ceil(len(cluster_emails) * 0.35)):
            repeated_hint = candidate

    top_terms = _top_cluster_terms(center_vector, feature_names)
    dominant_intent = None
    try:
        intent_counts = Counter(
            email.prediction.intent
            for email in cluster_emails
            if getattr(getattr(email, "prediction", None), "intent", None)
        )
        dominant_intent = intent_counts.most_common(1)[0][0] if intent_counts else None
    except Exception:
        dominant_intent = None

    descriptor = repeated_hint or (top_terms[0] if top_terms else None) or dominant_intent

    if dominant_brand and repeated_hint:
        if repeated_hint.lower().startswith(dominant_brand.lower()):
            name = repeated_hint
        else:
            name = f"{dominant_brand} {repeated_hint}"
    elif dominant_brand and descriptor:
        if descriptor.lower().startswith(dominant_brand.lower()):
            name = descriptor
        else:
            name = f"{dominant_brand} {descriptor}"
    elif repeated_hint:
        name = repeated_hint
    elif len(top_terms) >= 2:
        name = f"{top_terms[0]} {top_terms[1]}"
    elif top_terms:
        name = top_terms[0]
    elif dominant_brand:
        name = f"{dominant_brand} Updates"
    else:
        name = "General Inbox"

    name = re.sub(r"\s+", " ", name).strip(" -:|")
    return name[:120] or "General Inbox"


def _fallback_assignments(emails):
    assignments = {}
    for email in emails:
        fallback = infer_project_name(email.subject or "", email.full_body_text or email.snippet or "")
        if not fallback:
            fallback = _sender_brand(email.sender)
        assignments[email.id] = (fallback or "General Inbox")[:120]
    return assignments


def cluster_project_assignments(emails):
    from sklearn.cluster import KMeans
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import Normalizer

    email_list = [email for email in emails if build_email_text(email.subject or "", email.full_body_text or email.snippet or "") or email.sender]
    if not email_list:
        return {}

    if len(email_list) < 4:
        return _fallback_assignments(email_list)

    documents = [_build_document(email) for email in email_list]

    try:
        vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=5000,
            ngram_range=(1, 2),
            max_df=0.9,
        )
        matrix = vectorizer.fit_transform(documents)
    except ValueError:
        return _fallback_assignments(email_list)

    if matrix.shape[0] < 4 or matrix.shape[1] < 2:
        return _fallback_assignments(email_list)

    components = max(2, min(50, matrix.shape[0] - 1, matrix.shape[1] - 1))
    reduced = matrix
    if components >= 2:
        reduced = TruncatedSVD(n_components=components, random_state=42).fit_transform(matrix)
        reduced = Normalizer(copy=False).fit_transform(reduced)

    cluster_count = _pick_cluster_count(reduced)
    clusterer = KMeans(n_clusters=cluster_count, random_state=42, n_init=10)
    labels = clusterer.fit_predict(reduced)

    grouped_indices = defaultdict(list)
    for index, label in enumerate(labels):
        grouped_indices[label].append(index)

    feature_names = vectorizer.get_feature_names_out()
    used_names = Counter()
    assignments = {}

    for label, indices in grouped_indices.items():
        cluster_emails = [email_list[index] for index in indices]
        center = clusterer.cluster_centers_[label]
        project_name = _cluster_name(cluster_emails, center, feature_names)

        used_names[project_name] += 1
        if used_names[project_name] > 1:
            project_name = f"{project_name} {used_names[project_name]}"

        for email in cluster_emails:
            assignments[email.id] = project_name[:120]

    return assignments


def refresh_project_groups_for_user(user, queryset=None):
    emails = list(
        queryset
        if queryset is not None
        else EmailMessage.objects.filter(user=user).select_related("prediction").order_by("-internal_date", "-created_at")
    )
    if not emails:
        return {}

    assignments = cluster_project_assignments(emails)
    changed = []

    for email in emails:
        project_name = assignments.get(email.id) or infer_project_name(email.subject or "", email.full_body_text or email.snippet or "") or "General Inbox"
        if email.project_name != project_name:
            email.project_name = project_name
            changed.append(email)

    if changed:
        EmailMessage.objects.bulk_update(changed, ["project_name"])

    return {email.gmail_id: email.project_name for email in emails}
