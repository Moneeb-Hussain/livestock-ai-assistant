import json

from src.services.ai_service import (
    generate_livestock_response,
    validate_ai_response,
    validate_non_medical_response,
    validate_medical_response,
)


def test_non_medical_response_validation():
    response = {
        "responseType": "non_medical",
        "chatReply": "I need more information before I can suggest possible causes.",
        "missingInfo": ["symptom duration", "eating or drinking status"],
        "questions": [
            "When did the symptoms start?",
            "Is the animal eating or drinking normally?"
        ],
        "safeNote": "If the animal is struggling to breathe or getting worse quickly, contact a veterinarian urgently."
    }

    validated = validate_ai_response(response)

    assert validated["responseType"] == "non_medical"
    assert validated["chatReply"]
    assert len(validated["questions"]) > 0


def test_medical_response_validation():
    response = {
        "responseType": "medical",
        "severity": "urgent",
        "possibleConditions": [
            "Possible FMD-like illness",
            "Mouth infection"
        ],
        "chatReply": "These signs may indicate a serious infectious condition.",
        "careSteps": [
            "Separate the animal from the herd.",
            "Provide clean drinking water.",
            "Contact a qualified veterinarian urgently."
        ],
        "treatmentPlan": {
            "immediateCare": [
                "Isolate the animal from other animals."
            ],
            "supportiveCare": [
                "Keep clean water available."
            ],
            "whenToCallVet": [
                "If the animal is not eating or drinking."
            ],
            "monitoringChecklist": [
                "Appetite",
                "Water intake",
                "Drooling"
            ],
            "followUpQuestions": [
                "Are other animals showing similar symptoms?"
            ]
        },
        "disclaimer": "This is general guidance only and not a veterinary diagnosis. Please consult a qualified veterinarian."
    }

    validated = validate_ai_response(response)

    assert validated["responseType"] == "medical"
    assert validated["severity"] == "urgent"
    assert len(validated["possibleConditions"]) > 0
    assert len(validated["careSteps"]) > 0
    assert "treatmentPlan" in validated


def test_non_medical_fails_when_questions_empty():
    response = {
        "responseType": "non_medical",
        "chatReply": "I need more information.",
        "missingInfo": ["animal type"],
        "questions": [],
        "safeNote": "Contact a vet urgently if symptoms are severe."
    }

    try:
        validate_non_medical_response(response)
        assert False, "Validation should have failed"
    except ValueError as error:
        assert "questions must be a non-empty list" in str(error)


def test_medical_fails_without_disclaimer():
    response = {
        "responseType": "medical",
        "severity": "medium",
        "possibleConditions": ["Possible infection"],
        "chatReply": "This may indicate infection.",
        "careSteps": ["Keep the animal comfortable."],
        "treatmentPlan": {
            "immediateCare": ["Keep the animal separate."],
            "supportiveCare": ["Provide clean water."],
            "whenToCallVet": ["If symptoms worsen."],
            "monitoringChecklist": ["Appetite"],
            "followUpQuestions": ["When did symptoms start?"]
        }
    }

    try:
        validate_medical_response(response)
        assert False, "Validation should have failed"
    except ValueError as error:
        assert "disclaimer" in str(error)


def test_medical_fails_when_treatment_plan_key_fields_empty():
    response = {
        "responseType": "medical",
        "severity": "medium",
        "possibleConditions": ["Possible infection"],
        "chatReply": "This may indicate infection.",
        "careSteps": ["Keep the animal comfortable."],
        "treatmentPlan": {
            "immediateCare": [],
            "supportiveCare": ["Provide clean water."],
            "whenToCallVet": [],
            "monitoringChecklist": [],
            "followUpQuestions": ["When did symptoms start?"]
        },
        "disclaimer": "This is general guidance only and not a veterinary diagnosis."
    }

    try:
        validate_medical_response(response)
        assert False, "Validation should have failed"
    except ValueError as error:
        assert "must be a non-empty list of strings" in str(error)


def test_generate_livestock_response_with_mocked_medical_response(monkeypatch):
    fake_groq_response = {
        "responseType": "medical",
        "severity": "urgent",
        "possibleConditions": [
            "Possible FMD-like illness",
            "Mouth infection"
        ],
        "chatReply": "Based on the symptoms, this may indicate a serious infectious condition.",
        "careSteps": [
            "Separate the goat from the herd.",
            "Provide clean drinking water.",
            "Contact a veterinarian urgently."
        ],
        "treatmentPlan": {
            "immediateCare": [
                "Isolate the goat from other animals."
            ],
            "supportiveCare": [
                "Keep clean water available."
            ],
            "whenToCallVet": [
                "If the goat is not eating or drinking."
            ],
            "monitoringChecklist": [
                "Appetite",
                "Water intake",
                "Drooling"
            ],
            "followUpQuestions": [
                "Are other animals showing similar symptoms?"
            ]
        },
        "disclaimer": "This is general guidance only and not a veterinary diagnosis. Please consult a qualified veterinarian."
    }

    def fake_call_groq(system_prompt, user_prompt, attempt):
        return json.dumps(fake_groq_response)

    monkeypatch.setattr("src.services.ai_service.call_groq", fake_call_groq)

    result = generate_livestock_response(
        message="My goat has fever and mouth blisters since yesterday. It is not eating.",
        animal_type="goat",
        chat_history=[],
        image_observations=None,
    )

    assert result["responseType"] == "medical"
    assert result["severity"] == "urgent"
    assert len(result["possibleConditions"]) > 0


def test_generate_livestock_response_with_mocked_non_medical_response(monkeypatch):
    fake_groq_response = {
        "responseType": "non_medical",
        "chatReply": "I need more information before I can suggest possible causes.",
        "missingInfo": [
            "animal type",
            "symptom duration"
        ],
        "questions": [
            "What animal is affected?",
            "When did the symptoms start?"
        ],
        "safeNote": "If the animal is struggling to breathe or getting worse quickly, contact a veterinarian urgently."
    }

    def fake_call_groq(system_prompt, user_prompt, attempt):
        return json.dumps(fake_groq_response)

    monkeypatch.setattr("src.services.ai_service.call_groq", fake_call_groq)

    result = generate_livestock_response(
        message="My animal is sick.",
        animal_type=None,
        chat_history=[],
        image_observations=None,
    )

    assert result["responseType"] == "non_medical"
    assert len(result["questions"]) > 0


def test_generate_livestock_response_retries_and_returns_valid_response(monkeypatch):
    calls = {"count": 0}

    invalid_response = {
        "responseType": "medical",
        "severity": "urgent"
    }

    valid_response = {
        "responseType": "non_medical",
        "chatReply": "I need more information before I can suggest possible causes.",
        "missingInfo": ["symptom duration"],
        "questions": ["When did the symptoms start?"],
        "safeNote": "If symptoms are severe, contact a vet urgently."
    }

    def fake_call_groq(system_prompt, user_prompt, attempt):
        calls["count"] += 1

        if calls["count"] == 1:
            return json.dumps(invalid_response)

        return json.dumps(valid_response)

    monkeypatch.setattr("src.services.ai_service.call_groq", fake_call_groq)

    result = generate_livestock_response(
        message="My goat is sick.",
        animal_type="goat",
        chat_history=[],
        image_observations=None,
    )

    assert calls["count"] == 2
    assert result["responseType"] == "non_medical"


def test_generate_livestock_response_returns_fallback_after_failed_retries(monkeypatch):
    def fake_call_groq(system_prompt, user_prompt, attempt):
        return "{ invalid json"

    monkeypatch.setattr("src.services.ai_service.call_groq", fake_call_groq)

    result = generate_livestock_response(
        message="My animal is sick.",
        animal_type=None,
        chat_history=[],
        image_observations=None,
    )

    assert result["responseType"] == "non_medical"
    assert len(result["questions"]) > 0