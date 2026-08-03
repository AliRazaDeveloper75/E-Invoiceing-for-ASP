"""
Core agent loop. Currently: no tools yet
"""
import logging
from apps.ai_assistant.agent.context_builder import build_messages
from apps.ai_assistant.agent.llm_client import get_completion

logger = logging.getLogger(__name__)

def run_agent(*, role: str, conversation, user_message: str) -> str:
    """
    Runs one turn of the agent loop and returns the assistant's reply text.
    Handles API exceptions gracefully to avoid breaking application execution.
    """
    try:
        # 1. Build messages payload
        messages = build_messages(role=role, conversation=conversation, new_message=user_message)
        
        # 2. Call LLM wrapper
        response_message = get_completion(messages=messages)
        
        # 3. Guard against empty response content
        if not response_message or not response_message.content:
            return "Unable to Process your request.Please Try Again Later"
            
        return response_message.content

    except Exception as e:
        logger.error(f"AI Agent Loop Error: {str(e)}", exc_info=True)
        return "There is a temporary error in the system.Please Try Again Later"
    