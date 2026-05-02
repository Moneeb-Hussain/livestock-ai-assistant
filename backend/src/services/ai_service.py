import json
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from groq import Groq

from src.services.prompt_service import (
    build_chat_prompt,
    build_retry_instruction,
    get_fallback_response,
    get_system_prompt,
)


load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

MAX_ATTEMPTS = 3
MAX_OUTPUT_TOKENS = 1200

VALID_RESPONSE_TYPES = {"medical", "non_medical"}
VALID_SEVERITY_LEVELS = {"low", "medium", "urgent"}

REQUIRED_NON_MEDICAL_FIELDS = [
    "responseType",
    "chatReply",
    "missingInfo",
    "questions",
    "safeNote",
]

REQUIRED_MEDICAL_FIELDS = [
    "responseType",
    "severity",
    "possibleConditions",
    "chatReply",
    "careSteps",
    "treatmentPlan",
    "disclaimer",
]

REQUIRED_TREATMENT_PLAN_FIELDS = [
    "immediateCare",
    "supportiveCare",
    "whenToCallVet",
    "monitoringChecklist",
    "followUpQuestions",
]

REQUIRED_NON_EMPTY_TREATMENT_FIELDS = {
    "immediateCare",
    "whenToCallVet",
    "monitoringChecklist",
}


if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Add it to your .env file.")


client = Groq(api_key=GROQ_API_KEY)


def generate_livestock_response(
    message: str,
    animal_type: Optional[str] = None,
    image_observations: Optional[Dict[str, Any]] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Generate a MaweshiAI livestock response using Groq.

    The LLM decides whether the response should be:
    - non_medical: asks for missing information
    - medical: gives possible conditions, care steps, treatment plan, disclaimer

    If Groq returns invalid JSON or fails validation, retry up to MAX_ATTEMPTS.
    After all attempts fail, return validated fallback non_medical response.
    """
    system_prompt = get_system_prompt()
    base_user_prompt = build_chat_prompt(
        message=message,
        animal_type=animal_type,
        image_observations=image_observations,
        chat_history=chat_history,
    )

    last_error: Optional[Exception] = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            retry_instruction = (
                build_retry_instruction(last_error) if last_error else ""
            )

            raw_response = call_groq(
                system_prompt=system_prompt,
                user_prompt=base_user_prompt + retry_instruction,
                attempt=attempt,
            )

            parsed_response = parse_json_response(raw_response)
            validated_response = validate_ai_response(parsed_response)

            return validated_response

        except Exception as error:
            last_error = error
            print(f"Groq attempt {attempt} failed: {str(error)}")

    print(f"All Groq attempts failed. Last error: {str(last_error)}")
    return validate_non_medical_response(get_fallback_response())


def call_groq(
    system_prompt: str,
    user_prompt: str,
    attempt: int,
) -> str:
    """
    Call Groq chat completion API and return raw response text.

    First attempt uses temperature 0.2.
    Retry attempts use temperature 0.0 for more deterministic JSON.

    This function logs the full Groq request and response to the console
    for debugging during development.
    """
    temperature = 0.2 if attempt == 1 else 0.0

    print("\n" + "=" * 100)
    print(f"GROQ REQUEST - ATTEMPT {attempt}")
    print("=" * 100)
    print("\nMODEL:")
    print(GROQ_MODEL)

    print("\nTEMPERATURE:")
    print(temperature)

    print("\nMAX OUTPUT TOKENS:")
    print(MAX_OUTPUT_TOKENS)

    print("\nSYSTEM PROMPT:")
    print(system_prompt)

    print("\nUSER PROMPT:")
    print(user_prompt)
    print("=" * 100 + "\n")

    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        temperature=temperature,
        max_tokens=MAX_OUTPUT_TOKENS,
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content

    print("\n" + "=" * 100)
    print(f"GROQ RESPONSE - ATTEMPT {attempt}")
    print("=" * 100)
    print(content)
    print("=" * 100 + "\n")

    if not content:
        raise ValueError("Groq returned an empty response.")

    return content


def parse_json_response(raw_response: str) -> Dict[str, Any]:
    """
    Parse raw Groq response into JSON.

    Groq JSON mode should return valid JSON, but this function also tries
    to extract a JSON object if extra text somehow appears.
    """
    if not raw_response or not raw_response.strip():
        raise ValueError("AI response is empty.")

    try:
        parsed = json.loads(raw_response)
    except json.JSONDecodeError:
        start = raw_response.find("{")
        end = raw_response.rfind("}") + 1

        if start >= 0 and end > start:
            parsed = json.loads(raw_response[start:end])
        else:
            raise ValueError("AI response was not valid JSON.")

    if not isinstance(parsed, dict):
        raise ValueError("AI response must be a JSON object.")

    return parsed


def validate_ai_response(response: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate the Groq response based on responseType.
    """
    response_type = response.get("responseType")

    if response_type not in VALID_RESPONSE_TYPES:
        raise ValueError("responseType must be either 'medical' or 'non_medical'.")

    if response_type == "non_medical":
        return validate_non_medical_response(response)

    return validate_medical_response(response)


def validate_non_medical_response(response: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate response when LLM needs more information from user.
    """
    ensure_fields_exist(
        data=response,
        required_fields=REQUIRED_NON_MEDICAL_FIELDS,
        context="non_medical",
    )

    if response["responseType"] != "non_medical":
        raise ValueError("non_medical response must have responseType='non_medical'.")

    if not is_non_empty_string(response["chatReply"]):
        raise ValueError("chatReply must be a non-empty string.")

    if not is_string_list(response["missingInfo"]):
        raise ValueError("missingInfo must be a list of strings.")

    if not is_non_empty_string_list(response["questions"]):
        raise ValueError("questions must be a non-empty list of strings.")

    if not isinstance(response["safeNote"], str):
        raise ValueError("safeNote must be a string.")

    return {
        "responseType": "non_medical",
        "chatReply": response["chatReply"].strip(),
        "missingInfo": clean_string_list(response["missingInfo"]),
        "questions": clean_string_list(response["questions"]),
        "safeNote": response["safeNote"].strip(),
    }


def validate_medical_response(response: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate response when LLM has enough information to provide safe guidance.
    """
    ensure_fields_exist(
        data=response,
        required_fields=REQUIRED_MEDICAL_FIELDS,
        context="medical",
    )

    if response["responseType"] != "medical":
        raise ValueError("medical response must have responseType='medical'.")

    if response["severity"] not in VALID_SEVERITY_LEVELS:
        raise ValueError("severity must be one of: low, medium, urgent.")

    if not is_non_empty_string_list(response["possibleConditions"]):
        raise ValueError("possibleConditions must be a non-empty list of strings.")

    if not is_non_empty_string(response["chatReply"]):
        raise ValueError("chatReply must be a non-empty string.")

    if not is_non_empty_string_list(response["careSteps"]):
        raise ValueError("careSteps must be a non-empty list of strings.")

    treatment_plan = validate_treatment_plan(response["treatmentPlan"])

    if not is_non_empty_string(response["disclaimer"]):
        raise ValueError("disclaimer must be a non-empty string.")

    return {
        "responseType": "medical",
        "severity": response["severity"],
        "possibleConditions": clean_string_list(response["possibleConditions"]),
        "chatReply": response["chatReply"].strip(),
        "careSteps": clean_string_list(response["careSteps"]),
        "treatmentPlan": treatment_plan,
        "disclaimer": response["disclaimer"].strip(),
    }


def validate_treatment_plan(treatment_plan: Any) -> Dict[str, List[str]]:
    """
    Validate treatmentPlan object in a medical response.

    Required treatment fields must exist.
    Key fields must be non-empty so the frontend treatment plan has useful content.
    """
    if not isinstance(treatment_plan, dict):
        raise ValueError("treatmentPlan must be an object.")

    ensure_fields_exist(
        data=treatment_plan,
        required_fields=REQUIRED_TREATMENT_PLAN_FIELDS,
        context="treatmentPlan",
    )

    validated: Dict[str, List[str]] = {}

    for field in REQUIRED_TREATMENT_PLAN_FIELDS:
        value = treatment_plan[field]

        if not is_string_list(value):
            raise ValueError(f"treatmentPlan.{field} must be a list of strings.")

        if field in REQUIRED_NON_EMPTY_TREATMENT_FIELDS and not is_non_empty_string_list(
            value
        ):
            raise ValueError(
                f"treatmentPlan.{field} must be a non-empty list of strings."
            )

        validated[field] = clean_string_list(value)

    return validated


def ensure_fields_exist(
    data: Dict[str, Any],
    required_fields: List[str],
    context: str,
) -> None:
    """
    Raise validation error if required fields are missing.
    """
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        raise ValueError(
            f"Missing {context} field(s): {', '.join(missing_fields)}"
        )


def is_non_empty_string(value: Any) -> bool:
    """
    Check if value is a non-empty string.
    """
    return isinstance(value, str) and bool(value.strip())


def is_string_list(value: Any) -> bool:
    """
    Check if value is a list containing only strings.
    Empty list is allowed.
    """
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def is_non_empty_string_list(value: Any) -> bool:
    """
    Check if value is a non-empty list containing only non-empty strings.
    """
    return (
        isinstance(value, list)
        and len(value) > 0
        and all(is_non_empty_string(item) for item in value)
    )


def clean_string_list(value: List[str]) -> List[str]:
    """
    Trim strings and remove empty values from a list.
    """
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]