import json
from typing import Dict, List

from src.services.ai_service import generate_livestock_response


def print_header() -> None:
    print("\n" + "=" * 70)
    print("MaweshiAI Console Chatbot")
    print("=" * 70)
    print("Type naturally, like a farmer describing the animal problem.")
    print("Commands:")
    print("  /history   Show chat history")
    print("  /clear     Clear chat history")
    print("  /exit      Exit chatbot")
    print("=" * 70 + "\n")


def print_response(response: Dict) -> None:
    response_type = response.get("responseType")

    print("\nMaweshiAI:")

    if response_type == "non_medical":
        print(response.get("chatReply", ""))

        questions = response.get("questions", [])
        if questions:
            print("\nQuestions:")
            for index, question in enumerate(questions, start=1):
                print(f"{index}. {question}")

        safe_note = response.get("safeNote")
        if safe_note:
            print(f"\nSafety note: {safe_note}")

    elif response_type == "medical":
        print(response.get("chatReply", ""))

        print(f"\nSeverity: {response.get('severity', 'unknown')}")

        possible_conditions = response.get("possibleConditions", [])
        if possible_conditions:
            print("\nPossible conditions:")
            for item in possible_conditions:
                print(f"- {item}")

        care_steps = response.get("careSteps", [])
        if care_steps:
            print("\nCare steps:")
            for step in care_steps:
                print(f"- {step}")

        treatment_plan = response.get("treatmentPlan", {})
        if treatment_plan:
            print("\nTreatment plan:")

            for section_name, items in treatment_plan.items():
                print(f"\n{format_section_title(section_name)}:")
                if items:
                    for item in items:
                        print(f"- {item}")
                else:
                    print("- None")

        disclaimer = response.get("disclaimer")
        if disclaimer:
            print(f"\nDisclaimer: {disclaimer}")

    else:
        print(json.dumps(response, indent=2))

    print("\n" + "-" * 70)


def format_section_title(value: str) -> str:
    words = []
    current = ""

    for char in value:
        if char.isupper() and current:
            words.append(current)
            current = char
        else:
            current += char

    if current:
        words.append(current)

    return " ".join(words).title()


def build_assistant_history_content(response: Dict) -> str:
    """
    Store enough assistant context so the LLM remembers what it already asked or advised.
    """
    response_type = response.get("responseType")
    parts = [response.get("chatReply", "")]

    if response_type == "non_medical":
        questions = response.get("questions", [])
        if questions:
            parts.append("Questions asked:")
            parts.extend(f"- {question}" for question in questions)

        safe_note = response.get("safeNote")
        if safe_note:
            parts.append(f"Safety note: {safe_note}")

    elif response_type == "medical":
        possible_conditions = response.get("possibleConditions", [])
        if possible_conditions:
            parts.append("Possible conditions:")
            parts.extend(f"- {item}" for item in possible_conditions)

        care_steps = response.get("careSteps", [])
        if care_steps:
            parts.append("Care steps:")
            parts.extend(f"- {step}" for step in care_steps)

        treatment_plan = response.get("treatmentPlan", {})
        if treatment_plan:
            parts.append("Treatment plan:")
            for section_name, items in treatment_plan.items():
                parts.append(f"{section_name}:")
                parts.extend(f"- {item}" for item in items)

        disclaimer = response.get("disclaimer")
        if disclaimer:
            parts.append(f"Disclaimer: {disclaimer}")

    return "\n".join(part for part in parts if part)


def print_history(chat_history: List[Dict[str, str]]) -> None:
    if not chat_history:
        print("\nNo chat history yet.\n")
        return

    print("\nChat history:")
    for item in chat_history:
        role = item.get("role", "user")
        content = item.get("content", "")
        print(f"\n{role}: {content}")
    print()


def main() -> None:
    print_header()

    chat_history: List[Dict[str, str]] = []

    while True:
        user_input = input("\nYou > ").strip()

        if not user_input:
            continue

        if user_input.lower() == "/exit":
            print("\nGoodbye!")
            break

        if user_input.lower() == "/history":
            print_history(chat_history)
            continue

        if user_input.lower() == "/clear":
            chat_history.clear()
            print("\nChat history cleared.")
            continue

        try:
            response = generate_livestock_response(
                message=user_input,
                animal_type=None,
                chat_history=chat_history,
                image_observations=None,
            )

            print_response(response)

            chat_history.append(
                {
                    "role": "user",
                    "content": user_input,
                }
            )

            chat_history.append(
                {
                    "role": "assistant",
                    "content": build_assistant_history_content(response),
                }
            )

        except Exception as error:
            print(f"\nError: {str(error)}")


if __name__ == "__main__":
    main()