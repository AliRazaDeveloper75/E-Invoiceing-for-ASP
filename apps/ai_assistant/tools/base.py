"""
Base class every tool must inherit from.

KEY RULE (architecture doc 2.1): execute() receives `user` and `company`
from the AUTHENTICATED request context — injected by the orchestrator,
NEVER taken from the LLM's tool-call arguments. A tool must never trust
the model for scoping (which company), only for intent (what to look up).
"""












