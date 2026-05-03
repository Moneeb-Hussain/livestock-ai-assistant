from src.services.ai_service import generate_livestock_response


VALID_RESPONSE_TYPES = {"medical", "non_medical"}
VALID_SEVERITY_LEVELS = {"low", "medium", "urgent"}


def assert_string(value, field_name, allow_empty=False):
    assert isinstance(value, str), f"{field_name} must be a string"

    if not allow_empty:
        assert value.strip(), f"{field_name} must not be empty"


def assert_string_list(value, field_name, allow_empty=False):
    assert isinstance(value, list), f"{field_name} must be a list"

    if not allow_empty:
        assert len(value) > 0, f"{field_name} must not be empty"

    for index, item in enumerate(value):
        assert isinstance(item, str), f"{field_name}[{index}] must be a string"
        assert item.strip(), f"{field_name}[{index}] must not be empty"


def assert_non_medical_response(response):
    required_fields = [
        "responseType",
        "chatReply",
        "missingInfo",
        "questions",
        "safeNote",
    ]

    for field in required_fields:
        assert field in response, f"Missing field: {field}"

    assert response["responseType"] == "non_medical"

    assert_string(response["chatReply"], "chatReply")
    assert_string_list(response["missingInfo"], "missingInfo", allow_empty=True)
    assert_string_list(response["questions"], "questions", allow_empty=False)
    assert_string(response["safeNote"], "safeNote", allow_empty=True)


def assert_medical_response(response):
    required_fields = [
        "responseType",
        "severity",
        "possibleConditions",
        "chatReply",
        "careSteps",
        "treatmentPlan",
        "disclaimer",
    ]

    for field in required_fields:
        assert field in response, f"Missing field: {field}"

    assert response["responseType"] == "medical"
    assert response["severity"] in VALID_SEVERITY_LEVELS

    assert_string_list(response["possibleConditions"], "possibleConditions", allow_empty=False)
    assert_string(response["chatReply"], "chatReply")
    assert_string_list(response["careSteps"], "careSteps", allow_empty=False)

    assert isinstance(response["treatmentPlan"], dict), "treatmentPlan must be an object"

    required_treatment_fields = [
        "immediateCare",
        "supportiveCare",
        "whenToCallVet",
        "monitoringChecklist",
        "followUpQuestions",
    ]

    for field in required_treatment_fields:
        assert field in response["treatmentPlan"], f"Missing treatmentPlan field: {field}"
        assert_string_list(
            response["treatmentPlan"][field],
            f"treatmentPlan.{field}",
            allow_empty=True,
        )

    assert_string_list(
        response["treatmentPlan"]["immediateCare"],
        "treatmentPlan.immediateCare",
        allow_empty=False,
    )
    assert_string_list(
        response["treatmentPlan"]["whenToCallVet"],
        "treatmentPlan.whenToCallVet",
        allow_empty=False,
    )
    assert_string_list(
        response["treatmentPlan"]["monitoringChecklist"],
        "treatmentPlan.monitoringChecklist",
        allow_empty=False,
    )

    assert_string(response["disclaimer"], "disclaimer")


def assert_valid_chat_response(response):
    assert isinstance(response, dict), "Response must be a dictionary"

    assert "responseType" in response, "Missing field: responseType"
    assert response["responseType"] in VALID_RESPONSE_TYPES

    if response["responseType"] == "non_medical":
        assert_non_medical_response(response)
    else:
        assert_medical_response(response)


def print_response(title, response):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)
    print(response)


def test_case_1_text_symptoms():
    response = generate_livestock_response(
        message=(
            "My goat has fever and mouth blisters since yesterday. "
            "It is not eating and is drooling."
        ),
        chat_history=[],
        image_observations=None,
    )

    print_response("TEST 1: Text symptoms", response)
    assert_valid_chat_response(response)


def test_case_2_missing_info():
    response = generate_livestock_response(
        message="My animal is sick.",
        chat_history=[],
        image_observations=None,
    )

    print_response("TEST 2: Missing info", response)
    assert_valid_chat_response(response)


def test_case_3_with_image_observations():
    response = generate_livestock_response(
        message="My goat has fever and is not eating since yesterday.",
        chat_history=[],
        image_observations={
            "visibleSymptoms": ["mouth blisters", "drooling"],
            "imageSummary": (
                "Across the uploaded images, visible signs appear to include "
                "lesions around the mouth and drooling."
            ),
            "confidence": "medium",
            "warning": "Image observations are not a veterinary diagnosis.",
        },
    )

    print_response("TEST 3: With image observations", response)
    assert_valid_chat_response(response)


def test_case_4_long_chat_history_summary():
    chat_history = [
        {"role": "user", "content": "My goat has fever."},
        {"role": "assistant", "content": "When did the fever start?"},
        {"role": "user", "content": "It started yesterday."},
        {"role": "assistant", "content": "Is the goat eating or drinking normally?"},
        {"role": "user", "content": "No, it is not eating properly."},
        {"role": "assistant", "content": "Do you see any mouth sores or drooling?"},
        {"role": "user", "content": "Yes, there are mouth blisters and drooling."},
        {"role": "assistant", "content": "Keep it separate and tell me if it is limping."},
    ]

    response = generate_livestock_response(
        message="Now it is also limping and looks weak.",
        chat_history=chat_history,
        image_observations=None,
    )

    print_response("TEST 4: Long chat history with case summary", response)
    assert_valid_chat_response(response)


if __name__ == "__main__":
    test_case_1_text_symptoms()
    test_case_2_missing_info()
    test_case_3_with_image_observations()
    test_case_4_long_chat_history_summary()