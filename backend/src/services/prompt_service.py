import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

MAX_HISTORY_MESSAGES = 6

PROMPTS_FILE_PATH = (
    Path(__file__).resolve().parent.parent / "config" / "prompts.json"
)

def load_prompt_config() -> Dict[str, Any]:
   
    if not PROMPTS_FILE_PATH.exists():
        raise FileNotFoundError(f"Prompt config not found: {PROMPTS_FILE_PATH}")

    with PROMPTS_FILE_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)

def get_system_prompt() -> str:
    
    config = load_prompt_config()
    system = config["system"]

    return "\n\n".join(
        [
            system["identity"],
            format_examples("Decision examples", system.get("examples", [])),
            format_rules("Critical safety rules", system["safetyRules"]),
            format_rules("Input Scope Rules", system["inputScopeRules"]),
            format_rules("Response decision rules", system["responseDecisionRules"]),
            format_rules("Language rules", system["languageRules"]),
            format_rules("JSON rules", system["jsonRules"]),
            format_schema("Non-medical response schema", system["responseSchemas"]["nonMedical"]),
            format_schema("Medical response schema",system["responseSchemas"]["medical"]),
            format_schema("False Input response schema",system["responseSchemas"]["falseInput"])
        ]
    )

def build_chat_prompt(
    message: str,
    animal_type: Optional[str] = None,
    image_observations: Optional[Dict[str, Any]] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    
    cleaned_message = clean_text(message)

    if not cleaned_message:
        raise ValueError("Message cannot be empty.")

    config = load_prompt_config()
    sections = config["userPrompt"]["sections"]
    closing_instructions = config["userPrompt"]["closingInstructions"]

    cleaned_history = remove_duplicate_latest_message(
        chat_history=chat_history,
        latest_message=cleaned_message,
    )

    animal_type = infer_animal_type(message=cleaned_message,chat_history=cleaned_history,animal_type=animal_type,)

    older_messages, recent_messages = split_chat_history(cleaned_history)

    case_summary_text = build_case_summary_text(older_messages=older_messages,animal_type=animal_type,)

    recent_history_text = build_chat_history_text(recent_messages)

    image_text = build_image_observation_text(image_observations)

    return "\n".join(
        [
            f"{sections['latestMessage']}:",
            cleaned_message,
            "",
            f"{sections['animalType']}:",
            clean_text(animal_type) if animal_type else "unknown",
            "",
            f"{sections['caseSummary']}:",
            case_summary_text,
            "",
            f"{sections['recentConversation']}:",
            recent_history_text,
            "",
            f"{sections['imageObservations']}:",
            image_text,
            "",
            "Decision checklist:",
            "- Check whether animal type is already available.",
            "- Check whether symptoms are already available.",
            "- Check whether symptom duration is already available.",
            "- Check whether eating/drinking status is already available.",
            "- If these are available, return medical.",
            "- Do not ask again for already provided information.",
            "",
            *closing_instructions,
        ]
    )

def build_groq_messages(
    system_prompt: str,
    message: str,
    animal_type: Optional[str] = None,
    image_observations: Optional[Dict[str, Any]] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> List[Dict[str, str]]:
    """
    - If conversation has up to 6 user messages, send full conversation with user/assistant roles.
    - If conversation has more than 6 user messages:
      - summarize older messages into first user message
      - append recent messages with original user/assistant roles
    - Latest message is always appended as the final user message.
    """

    cleaned_message = clean_text(message)

    if not cleaned_message:
        raise ValueError("Message cannot be empty.")

    cleaned_history = remove_duplicate_latest_message(chat_history=chat_history,latest_message=cleaned_message)

    animal_type = infer_animal_type(message=cleaned_message,chat_history=cleaned_history,animal_type=animal_type)

    full_conversation = cleaned_history + [
        {
            "role": "user",
            "content": cleaned_message,
        }
    ]

    older_messages, recent_messages = split_by_user_message_limit(
        messages=full_conversation,
        max_user_messages=6,
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    if older_messages:
        case_summary_text = build_case_summary_text(
            older_messages=older_messages,
            animal_type=animal_type,
        )

        context_message = build_context_message_text(
            animal_type=animal_type,
            case_summary_text=case_summary_text,
            image_observations=image_observations,
        )

        messages.append(
            {
                "role": "user",
                "content": context_message,
            }
        )
    # else:
    #     context_message = build_context_message_text(
    #         animal_type=animal_type,
    #         case_summary_text="none",
    #         image_observations=image_observations,
    #     )

        messages.append(
            {
                "role": "user",
                "content": context_message,
            }
        )

    for item in recent_messages:
        role = normalize_role(item.get("role", "user"))
        content = clean_text(item.get("content", ""))

        if role not in ["user", "assistant"]:
            role = "user"

        if content:
            messages.append(
                {
                    "role": role,
                    "content": content,
                }
            )

    return messages

def format_examples(title: str, examples: List[Dict[str, Any]]) -> str:
    return f"{title}:\n{json.dumps(examples, indent=2, ensure_ascii=False)}"

def build_retry_instruction(error: Exception) -> str:
    """
    Build a short retry instruction when AI response validation fails.
    """
    config = load_prompt_config()
    template = config["retry"]["instruction"]

    return "\n\n" + template.format(error=str(error))

def get_fallback_response() -> Dict[str, Any]:
    """
    Return fallback non_medical response from prompts.json.
    """
    config = load_prompt_config()
    return config["fallback"]

def remove_duplicate_latest_message(
    chat_history: Optional[List[Dict[str, str]]],
    latest_message: str,
) -> List[Dict[str, str]]:
    
    if not chat_history:
        return []

    latest_message = clean_text(latest_message)

    cleaned_history: List[Dict[str, str]] = []

    for item in chat_history:
        role = normalize_role(item.get("role", "user"))
        content = clean_text(item.get("content", ""))

        if content:
            cleaned_history.append(
                {
                    "role": role,
                    "content": content,
                }
            )

    if not cleaned_history:
        return []

    last_item = cleaned_history[-1]

    if (
        last_item["role"] == "user"
        and clean_text(last_item["content"]).lower() == latest_message.lower()
    ):
        return cleaned_history[:-1]

    return cleaned_history

def split_chat_history(
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
  
    if not chat_history:
        return [], []

    cleaned_history = []

    for item in chat_history:
        role = normalize_role(item.get("role", "user"))
        content = clean_text(item.get("content", ""))

        if content:
            cleaned_history.append(
                {
                    "role": role,
                    "content": content,
                }
            )

    if len(cleaned_history) <= MAX_HISTORY_MESSAGES:
        return [], cleaned_history

    return (
        cleaned_history[:-MAX_HISTORY_MESSAGES],
        cleaned_history[-MAX_HISTORY_MESSAGES:],
    )

def build_case_summary_text(
    older_messages: List[Dict[str, str]],
    animal_type: Optional[str] = None,
) -> str:
    
    if not older_messages:
        return "none"

    combined_text = " ".join(
        clean_text(item.get("content", "")) for item in older_messages
    )

    symptoms = extract_known_symptoms(combined_text)
    duration = extract_duration(combined_text)
    eating_drinking_status = extract_eating_drinking_status(combined_text)
    previous_advice = extract_previous_advice(older_messages)
    open_questions = extract_open_questions(older_messages)

    summary_parts = []

    animal_type = clean_text(animal_type)
    if animal_type:
        summary_parts.append(f"This case involves a {animal_type}.")

    if symptoms:
        summary_parts.append(
            "Earlier conversation mentioned symptoms/signs such as "
            + ", ".join(symptoms)
            + "."
        )

    if duration:
        summary_parts.append(f"Reported timing/duration: {duration}.")

    if eating_drinking_status:
        summary_parts.append(f"Eating/drinking status: {eating_drinking_status}.")

    if previous_advice:
        summary_parts.append(
            "Previous assistant guidance included "
            + ", ".join(previous_advice)
            + "."
        )

    if open_questions:
        summary_parts.append(
            "Earlier open questions included "
            + ", ".join(open_questions[:3])
            + "."
        )

    if not summary_parts:
        summary_parts.append(
            "Older conversation exists, but no clear symptoms or advice were extracted."
        )

    return " ".join(summary_parts)

def build_chat_history_text(
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """
    Format recent chat history for the prompt.
    This function expects already-split recent messages.
    """
    if not chat_history:
        return "none"

    lines = []

    for item in chat_history:
        role = normalize_role(item.get("role", "user"))
        content = clean_text(item.get("content", ""))

        if content:
            lines.append(f"{role}: {content}")

    return "\n".join(lines) if lines else "none"

def build_image_observation_text(
    image_observations: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Format internal image observations for the prompt.

    Frontend does not send image_observations.
    Backend vision_service creates one combined image_observations object
    from one or more uploaded images.
    """
    config = load_prompt_config()
    image_config = config["imageObservations"]

    if not image_observations:
        return image_config["noneText"]

    visible_symptoms = image_observations.get("visibleSymptoms", [])
    image_summary = clean_text(image_observations.get("imageSummary", ""))
    confidence = clean_text(str(image_observations.get("confidence", "unknown")))
    warning = clean_text(
        image_observations.get(
            "warning",
            image_config["defaultWarning"],
        )
    )

    if not isinstance(visible_symptoms, list):
        visible_symptoms = [str(visible_symptoms)]

    visible_symptoms = [
        clean_text(str(symptom)) for symptom in visible_symptoms if clean_text(str(symptom))
    ]

    return "\n".join(
        [
            f"Visible symptoms: {visible_symptoms if visible_symptoms else 'none'}",
            f"Image summary: {image_summary or 'none'}",
            f"Image confidence: {confidence or 'unknown'}",
            f"Image warning: {warning}",
        ]
    )

def extract_known_symptoms(text: str) -> List[str]:
    
    symptom_keywords = {
        "fever": ["fever", "bukhar", "temperature", "high temp"],
        "mouth blisters": [
            "mouth blister",
            "mouth blisters",
            "munh mein chalay",
            "mouth sores",
            "lesions",
        ],
        "drooling": ["drooling", "saliva", "rala", "thook"],
        "not eating": [
            "not eating",
            "not eat",
            "khana nahi",
            "khana nai",
            "not feeding",
            "loss of appetite",
        ],
        "not drinking": [
            "not drinking",
            "pani nahi",
            "pani nai",
            "not taking water",
        ],
        "diarrhea": ["diarrhea", "loose motion", "motions", "dast"],
        "coughing": ["cough", "coughing", "khansi"],
        "limping": ["limping", "langra", "lame", "walking problem"],
        "weakness": ["weak", "weakness", "kamzor", "unable to stand"],
        "breathing difficulty": [
            "breathing",
            "difficulty breathing",
            "saans",
            "respiratory",
        ],
        "swelling": ["swelling", "swollen", "soojan"],
        "discharge": ["discharge", "pus", "fluid", "naak se pani"],
    }

    lower_text = text.lower()
    detected = []

    for symptom, keywords in symptom_keywords.items():
        if any(keyword in lower_text for keyword in keywords):
            detected.append(symptom)

    return detected

def extract_duration(text: str) -> Optional[str]:
    
    lower_text = text.lower()

    duration_phrases = [
        "since today",
        "since morning",
        "since yesterday",
        "from yesterday",
        "for 1 day",
        "for one day",
        "for 2 days",
        "for two days",
        "for 3 days",
        "for three days",
        "for a week",
        "for one week",
        "kal se",
        "subah se",
        "aaj se",
        "2 din",
        "3 din",
        "ek din",
    ]

    for phrase in duration_phrases:
        if phrase in lower_text:
            return phrase

    return None

def extract_eating_drinking_status(text: str) -> Optional[str]:
    
    lower_text = text.lower()

    if any(
        phrase in lower_text
        for phrase in [
            "not eating",
            "khana nahi",
            "khana nai",
            "loss of appetite",
            "not feeding",
        ]
    ):
        return "not eating properly"

    if any(
        phrase in lower_text
        for phrase in [
            "not drinking",
            "pani nahi",
            "pani nai",
            "not taking water",
        ]
    ):
        return "not drinking properly"

    if any(
        phrase in lower_text
        for phrase in [
            "eating normally",
            "drinking normally",
            "eating and drinking",
        ]
    ):
        return "eating/drinking status was reported as normal"

    return None

def extract_previous_advice(messages: List[Dict[str, str]]) -> List[str]:
    """
    Extract simple previous advice from older assistant messages.
    """
    advice_keywords = {
        "isolate the animal": ["isolate", "separate", "alag"],
        "provide clean water": ["clean water", "saaf pani", "water"],
        "contact a veterinarian": ["vet", "veterinarian", "doctor"],
        "monitor symptoms": ["monitor", "observe", "check"],
        "keep animal calm and clean": ["clean place", "quiet", "calm", "dry place"],
    }

    assistant_text = " ".join(
        clean_text(item.get("content", ""))
        for item in messages
        if normalize_role(item.get("role", "user")) == "assistant"
    ).lower()

    detected = []

    for advice, keywords in advice_keywords.items():
        if any(keyword in assistant_text for keyword in keywords):
            detected.append(advice)

    return detected

def extract_open_questions(messages: List[Dict[str, str]]) -> List[str]:
    """
    Extract earlier assistant questions from older messages.
    """
    questions = []

    for item in messages:
        role = normalize_role(item.get("role", "user"))
        content = clean_text(item.get("content", ""))

        if role == "assistant" and "?" in content:
            split_questions = [q.strip() + "?" for q in content.split("?") if q.strip()]
            questions.extend(split_questions)

    return questions

def format_rules(title: str, rules: List[str]) -> str:
    
    formatted_rules = "\n".join(
        f"{index}. {rule}" for index, rule in enumerate(rules, start=1)
    )

    return f"{title}:\n{formatted_rules}"

def format_schema(title: str, schema: Dict[str, Any]) -> str:
    """
    Format response schema/example as pretty JSON text inside the prompt.
    """
    return f"{title}:\n{json.dumps(schema, indent=2, ensure_ascii=False)}"

def normalize_role(role: str) -> str:
    """
    Normalize chat roles.

    assistant, bot, ai -> assistant
    everything else -> user
    """
    cleaned_role = clean_text(role).lower()

    if cleaned_role in ["assistant", "bot", "ai"]:
        return "assistant"

    return "user"

def clean_text(value: Optional[Any]) -> str:
    
    if value is None:
        return ""

    return " ".join(str(value).strip().split())

def split_by_user_message_limit(
    messages: List[Dict[str, str]],
    max_user_messages: int = 6,
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:

    if not messages:
        return [], []

    user_count = 0
    split_index = 0

    for index in range(len(messages) - 1, -1, -1):
        role = normalize_role(messages[index].get("role", "user"))

        if role == "user":
            user_count += 1

        if user_count > max_user_messages:
            split_index = index + 1
            break

    if user_count <= max_user_messages:
        return [], messages

    older_messages = messages[:split_index]
    recent_messages = messages[split_index:]

    return older_messages, recent_messages

def build_context_message_text(
    animal_type: Optional[str],
    case_summary_text: str,
    image_observations: Optional[Dict[str, Any]] = None,
) -> str:

    config = load_prompt_config()
    sections = config["userPrompt"]["sections"]
    closing_instructions = config["userPrompt"]["closingInstructions"]

    image_text = build_image_observation_text(image_observations)

    return "\n".join(
        [
            "Backend context for this livestock health conversation:",
            "",
            f"{sections['animalType']}:",
            clean_text(animal_type) if animal_type else "unknown",
            "",
            f"{sections['caseSummary']}:",
            case_summary_text,
            "",
            f"{sections['imageObservations']}:",
            image_text,
            "",
            "Decision checklist:",
            "- Check whether animal type is already available.",
            "- Check whether symptoms are already available.",
            "- Check whether symptom duration is already available.",
            "- Check whether eating/drinking status is already available.",
            "- If animal type, symptoms, and useful health context are already available, return medical.",
            "- Do not ask again for information already provided in the conversation.",
            "",
            *closing_instructions,
        ]
    )

def infer_animal_type(message: str, chat_history: Optional[List[Dict[str, str]]] = None, animal_type: Optional[str] = None,) -> str:
    
    explicit_animal_type = clean_text(animal_type)
    if explicit_animal_type:
        return explicit_animal_type

    combined_text_parts = [clean_text(message)]

    if chat_history:
        combined_text_parts.extend(
            clean_text(item.get("content", "")) for item in chat_history
        )

    combined_text = " ".join(combined_text_parts).lower()

    """
        Todo: move this to aiconfig
    """
    animal_keywords = {
        "goat": ["goat", "bakri", "bakra"],
        "cow": ["cow", "gai", "gaaye"],
        "buffalo": ["buffalo", "bhains"],
        "sheep": ["sheep", "bhed"],
        "camel": ["camel", "oont"],
        "chicken": ["chicken", "murghi", "hen", "rooster"],
        "calf": ["calf", "bachra"],
    }

    for animal, keywords in animal_keywords.items():
        if any(keyword in combined_text for keyword in keywords):
            return animal

    return "unknown"