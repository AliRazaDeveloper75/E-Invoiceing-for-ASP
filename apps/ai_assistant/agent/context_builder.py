from apps.ai_assistant.agent.prompts import get_system_prompt

MAX_HISTORY_MESSAGES = 20


def build_messages(*, role: str, conversation, new_message: str) -> list[dict]:
    """
    Builds the message list (system + history + new message) sent to the LLM.
    """
    messages = [{"role": "system", "content": get_system_prompt(role)}]

    # Optimization 1: DB se sirf zaroori fields uthayein (Faster Query)
    history_qs = conversation.messages.filter(
        role__in=['user', 'assistant']
    ).order_by('-created_at').values('role', 'content')[:MAX_HISTORY_MESSAGES]

    history = list(reversed(history_qs))

    # Optimization 2: Ensure history starts with a 'user' message for better context flow
    if history and history[0]['role'] == 'assistant':
        history = history[1:]

    for msg in history:
        messages.append({"role": msg['role'], "content": msg['content']})

    # Add current message
    messages.append({"role": "user", "content": new_message})
    
    return messages