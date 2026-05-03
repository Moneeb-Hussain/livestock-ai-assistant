import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from dotenv import load_dotenv
from groq import Groq

from src.services.prompt_service import (
    build_groq_messages,
    build_retry_instruction,
    get_fallback_response,
    get_system_prompt,
)

load_dotenv()

BACKEND_ROOT = Path(__file__).resolve().parents[2]
CONFIG_FILE_PATH = BACKEND_ROOT / "src" / "config" / "ai_config.json"

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Add it to your .env file.")

client = Groq(api_key=GROQ_API_KEY)

def load_ai_config() -> Dict[str, Any]:
    
    if not CONFIG_FILE_PATH.exists():
        raise FileNotFoundError(f"AI config file not found: {CONFIG_FILE_PATH}")

    with CONFIG_FILE_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)

AI_CONFIG = load_ai_config()

GROQ_CONFIG = AI_CONFIG["groq"]
VALIDATION_CONFIG = AI_CONFIG["validation"]
LOGGING_CONFIG = AI_CONFIG["logging"]
CONTEXT_VALIDATION_CONFIG = AI_CONFIG["contextValidation"]

MAX_ATTEMPTS = GROQ_CONFIG["maxAttempts"]
MAX_OUTPUT_TOKENS = GROQ_CONFIG["maxOutputTokens"]

LOG_GROQ_API = os.getenv(
    "LOG_GROQ_API",
    str(LOGGING_CONFIG["enabledByDefault"]).lower(),
).lower() == "true"

LOG_DIR = BACKEND_ROOT / LOGGING_CONFIG["logDirectory"]
GROQ_LOG_FILE = LOG_DIR / LOGGING_CONFIG["groqLogFile"]


def generate_livestock_response(
    message: str,
    animal_type: Optional[str] = None,
    image_observations: Optional[Dict[str, Any]] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Flow:
    - Build prompts through prompt_service.
    - Call Groq.
    - Parse JSON.
    - Validate schema.
    - Validate non_medical response against known context to avoid loops.
    - Retry up to configured max attempts.
    - Return fallback if all attempts fail.
    """
    system_prompt = get_system_prompt()
    base_messages = build_groq_messages(system_prompt=system_prompt,message=message,animal_type=animal_type,image_observations=image_observations,chat_history=chat_history)
    last_error: Optional[Exception] = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        request_id = build_groq_request_id()
        
        raw_response: Optional[str] = None
        parsed_response: Optional[Dict[str, Any]] = None
        validated_response: Optional[Dict[str, Any]] = None

        messages = [item.copy() for item in base_messages]
        if last_error:
            messages.append(
                {
                    "role": "user",
                    "content": build_retry_instruction(last_error),
                }
            )

        try:
            raw_response = call_groq(messages=messages,attempt=attempt)
            parsed_response = parse_json_response(raw_response)

            print(f"Parsed Response: {str(parsed_response)}")

            validated_response = validate_ai_response(parsed_response)

            # validate_response_against_prompt_context(response=validated_response,message=message,chat_history=chat_history)

            log_groq_interaction(
                request_id=request_id,
                attempt=attempt,
                messages=messages,
                raw_response=raw_response,
                parsed_response=parsed_response,
                validated_response=validated_response,
                validation_status="passed",
                validation_error=None,
            )

            return validated_response

        except Exception as error:
            last_error = error

            log_groq_interaction(
                request_id=request_id,
                attempt=attempt,
                messages=messages,
                raw_response=raw_response,
                parsed_response=parsed_response,
                validated_response=validated_response,
                validation_status="failed",
                validation_error=str(error),
            )

            print(f"Groq attempt {attempt} failed: {str(error)}")

    print(f"All Groq attempts failed. Last error: {str(last_error)}")
    return validate_non_medical_response(get_fallback_response())

def call_groq(
    messages: List[Dict[str, str]],
    attempt: int,
) -> str:
    
    temperature = get_temperature_for_attempt(attempt)

    request_payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "response_format": GROQ_CONFIG["responseFormat"],
    }

    print_groq_debug_log(
        attempt=attempt,
        request_payload=request_payload,
        response_payload=None,
    )

    completion = client.chat.completions.create(
    model=GROQ_MODEL,
    messages=messages,
    temperature=temperature,
    max_tokens=MAX_OUTPUT_TOKENS,
    response_format=GROQ_CONFIG["responseFormat"],
    )

    content = completion.choices[0].message.content

    print_groq_debug_log(
        attempt=attempt,
        request_payload=request_payload,
        response_payload=content,
    )

    if not content:
        raise ValueError("Groq returned an empty response.")

    return content

def get_temperature_for_attempt(attempt: int) -> float:
    
    if attempt == 1:
        return float(GROQ_CONFIG["temperature"]["firstAttempt"])

    return float(GROQ_CONFIG["temperature"]["retryAttempt"])

def parse_json_response(raw_response: str) -> Dict[str, Any]:
    """
    Parse raw Groq response into a JSON object.
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
    Validate response shape based on responseType.
    """
    response_type = response.get("responseType")

    if response_type not in VALIDATION_CONFIG["validResponseTypes"]:
        raise ValueError("responseType must be either 'medical', 'non_medical' or 'false_input'.")

    if response_type == "false_input":
        return response;
    if response_type == "non_medical":
        return validate_non_medical_response(response)
    if response_type == "medical":
        return validate_medical_response(response)
    
    raise ValueError("responseType must be either 'medical', 'non_medical' or 'false_input'.")

def validate_non_medical_response(response: Dict[str, Any]) -> Dict[str, Any]:
   
    ensure_fields_exist(
        data=response,
        required_fields=VALIDATION_CONFIG["requiredNonMedicalFields"],
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
        required_fields=VALIDATION_CONFIG["requiredMedicalFields"],
        context="medical",
    )

    if response["responseType"] != "medical":
        raise ValueError("medical response must have responseType='medical'.")

    if response["severity"] not in VALIDATION_CONFIG["validSeverityLevels"]:
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
    """
    if not isinstance(treatment_plan, dict):
        raise ValueError("treatmentPlan must be an object.")

    required_fields = VALIDATION_CONFIG["requiredTreatmentPlanFields"]
    required_non_empty_fields = set(
        VALIDATION_CONFIG["requiredNonEmptyTreatmentFields"]
    )

    ensure_fields_exist(
        data=treatment_plan,
        required_fields=required_fields,
        context="treatmentPlan",
    )

    validated: Dict[str, List[str]] = {}

    for field in required_fields:
        value = treatment_plan[field]

        if not is_string_list(value):
            raise ValueError(f"treatmentPlan.{field} must be a list of strings.")

        if field in required_non_empty_fields and not is_non_empty_string_list(value):
            raise ValueError(
                f"treatmentPlan.{field} must be a non-empty list of strings."
            )

        validated[field] = clean_string_list(value)

    return validated

def validate_response_against_prompt_context(
    response: Dict[str, Any],
    message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> None:
    """
    Validate response against known conversation context.

    - Medical responses: validate severity, possibleConditions quality,
      and repeated answered follow-up questions.
    - Non-medical responses: prevent asking for info already provided.
    """
    combined_text = build_context_text(message, chat_history)

    if response.get("responseType") == "medical":
        validate_medical_severity_against_context(response, message, chat_history)
        validate_possible_conditions_quality(response)
        validate_medical_followup_questions_against_context(
            response=response,
            combined_text=combined_text,
        )
        return

    if response.get("responseType") != "non_medical":
        return

    missing_info_text = " ".join(response.get("missingInfo", [])).lower()
    questions_text = " ".join(response.get("questions", [])).lower()

    if has_context("animalKeywords", combined_text) and asks_for(
        "animalType",
        missing_info_text,
        questions_text,
    ):
        raise ValueError(
            "LLM asked for animal type even though animal type was already provided."
        )

    if has_context("symptomKeywords", combined_text) and asks_for(
        "symptoms",
        missing_info_text,
        questions_text,
    ):
        raise ValueError(
            "LLM asked for symptoms even though symptoms were already provided."
        )

    if has_context("durationKeywords", combined_text) and asks_for(
        "duration",
        missing_info_text,
        questions_text,
    ):
        raise ValueError(
            "LLM asked for symptom duration even though it was already provided."
        )

    if has_context("eatingDrinkingKeywords", combined_text) and asks_for(
        "eatingDrinking",
        missing_info_text,
        questions_text,
    ):
        raise ValueError(
            "LLM asked for eating/drinking status even though it was already provided."
        )

    if has_context("urgentKeywords", combined_text):
        raise ValueError(
            "LLM returned non_medical even though urgent signs were already provided."
        )
        
def validate_medical_severity_against_context(
    response: Dict[str, Any],
    message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> None:
    combined_text = build_context_text(message, chat_history)

    has_mouth_blisters = any(
        keyword in combined_text
        for keyword in ["mouth blisters", "mouth blister", "blisters", "mouth sores"]
    )

    has_appetite_issue = any(
        keyword in combined_text
        for keyword in ["not eating", "eating less", "loss of appetite", "not feeding"]
    )

    has_urgent_context = has_context("urgentKeywords", combined_text)

    severity = response.get("severity")

    if has_urgent_context and severity != "urgent":
        raise ValueError(
            "Severity is too low. Urgent signs are present, so severity should be urgent."
        )

    if has_mouth_blisters and severity == "low":
        raise ValueError(
            "Severity is too low. Mouth blisters in livestock should be at least medium."
        )

    if has_mouth_blisters and has_appetite_issue and severity != "urgent":
        raise ValueError(
            "Severity is too low. Mouth blisters with reduced appetite should be urgent."
        )

def build_context_text(
    message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """
    Combine latest user message and chat history for context validation.
    """
    parts = [message]

    if chat_history:
        parts.extend(
            item.get("content", "")
            for item in chat_history
            if item.get("content")
        )

    return " ".join(parts).lower()

def has_context(keyword_group: str, combined_text: str) -> bool:
    """
    Check whether any keyword from a context group exists in conversation text.
    """
    keywords = CONTEXT_VALIDATION_CONFIG.get(keyword_group, [])
    return any(keyword.lower() in combined_text for keyword in keywords)

def asks_for(
    missing_info_group: str,
    missing_info_text: str,
    questions_text: str,
) -> bool:
    """
    Check whether the LLM is asking for a specific missing info group.
    """
    matchers = CONTEXT_VALIDATION_CONFIG["missingInfoMatchers"].get(
        missing_info_group,
        [],
    )

    combined_question_text = f"{missing_info_text} {questions_text}"

    return any(matcher.lower() in combined_question_text for matcher in matchers)

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
    cleaned_items = []

    for item in value:
        if not isinstance(item, str):
            continue

        cleaned = item.strip().lstrip("-*•").strip()

        if cleaned:
            cleaned_items.append(cleaned)

    return cleaned_items

def build_groq_request_id() -> str:
    """
    Build a unique request ID for each Groq attempt.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    unique_suffix = uuid4().hex[:8]
    return f"groq_{timestamp}_{unique_suffix}"

def log_groq_interaction(
    request_id: str,
    attempt: int,
    messages: List[Dict[str, str]],
    raw_response: Optional[str] = None,
    parsed_response: Optional[Dict[str, Any]] = None,
    validated_response: Optional[Dict[str, Any]] = None,
    validation_status: str = "unknown",
    validation_error: Optional[str] = None,
) -> None:
    """
    Log Groq request/response/debug information to a JSONL file.

    This does not log API keys.
    Each line is one JSON object.
    """
    if not LOG_GROQ_API:
        return

    LOG_DIR.mkdir(parents=True, exist_ok=True)

    log_entry = {
        "requestId": request_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "attempt": attempt,
        "model": GROQ_MODEL,
        "temperature": get_temperature_for_attempt(attempt),
        "maxOutputTokens": MAX_OUTPUT_TOKENS,
        "request": {
            "messages": messages,
        },
        "response": {
            "raw": raw_response,
            "parsed": parsed_response,
            "validated": validated_response,
        },
        "validation": {
            "status": validation_status,
            "error": validation_error,
        },
    }

    with GROQ_LOG_FILE.open("a", encoding="utf-8") as file:
        file.write(json.dumps(log_entry, ensure_ascii=False, default=str) + "\n")

def print_groq_debug_log(
    attempt: int,
    request_payload: Dict[str, Any],
    response_payload: Optional[Any] = None,
) -> None:
    print("\n" + "=" * 80)
    print(f"Attempt {attempt}")
    print("=" * 80)

    print("\nRequestPayload:")
    print(f"model: {request_payload.get('model')}")
    print(f"temperature: {request_payload.get('temperature')}")
    print(f"max_tokens: {request_payload.get('max_tokens')}")
    print(f"response_format: {request_payload.get('response_format')}")

    print("\nmessages:")
    for index, message in enumerate(request_payload.get("messages", []), start=1):
        role = message.get("role", "unknown")
        content = message.get("content", "")

        print("\n" + "-" * 60)
        print(f"Message {index}")
        print(f"Role: {role}")
        print("Content:")
        print(content)

    print("\nResponsePayload:")
    if response_payload is None:
        print("No response yet")
    elif isinstance(response_payload, str):
        try:
            parsed_response = json.loads(response_payload)
            print(json.dumps(parsed_response, indent=2, ensure_ascii=False))
        except json.JSONDecodeError:
            print(response_payload)
    else:
        print(response_payload)

    print("=" * 80 + "\n")

def validate_medical_followup_questions_against_context(
    response: Dict[str, Any],
    combined_text: str,
) -> None:
    """
    Validate medical follow-up questions against already-known context.

    Medical responses can ask optional follow-up questions, but they must not
    ask again for animal type, symptoms, duration, or eating/drinking status
    if those details are already available in the conversation context.
    """

    if response.get("responseType") != "medical":
        return

    treatment_plan = response.get("treatmentPlan", {})
    follow_up_questions = treatment_plan.get("followUpQuestions", [])

    if not isinstance(follow_up_questions, list):
        raise ValueError(
            "Medical response treatmentPlan.followUpQuestions must be an array."
        )

    questions_text = " ".join(
        str(question).lower() for question in follow_up_questions
    )

    context_text = combined_text.lower()

    has_animal = has_context("animalKeywords", context_text)
    has_duration = has_context("durationKeywords", context_text)
    has_eating_status = has_context("eatingStatusKeywords", context_text)
    has_drinking_status = has_context("drinkingStatusKeywords", context_text)

    if has_animal and asks_for("animalType", "", questions_text):
        raise ValueError(
            "Medical followUpQuestions asked for animal type even though animal type was already provided."
        )

    if has_duration and asks_for("duration", "", questions_text):
        raise ValueError(
            "Medical followUpQuestions asked for symptom duration even though duration was already provided."
        )

    if has_eating_status and asks_for("eatingStatus", "", questions_text):
        raise ValueError(
            "Medical followUpQuestions asked for eating status even though eating status was already provided."
        )

    if has_drinking_status and asks_for("drinkingStatus", "", questions_text):
        raise ValueError(
            "Medical followUpQuestions asked for drinking status even though drinking status was already provided."
        )

def validate_possible_conditions_quality(response: Dict[str, Any]) -> None:
    """
    Validate that possibleConditions are useful condition labels,
    not repeated symptoms or long sentences.
    """
    if response.get("responseType") != "medical":
        return

    weak_terms = {
        term.lower().strip()
        for term in CONTEXT_VALIDATION_CONFIG.get("weakPossibleConditionTerms", [])
    }

    for condition in response.get("possibleConditions", []):
        condition_text = condition.lower().strip().lstrip("-*•").strip()

        if condition_text in weak_terms:
            raise ValueError(
                "possibleConditions should be likely disease groups or health issues, not repeated symptoms."
            )

        if len(condition_text.split()) > 12:
            raise ValueError(
                "possibleConditions should be concise labels, not long sentences."
            )