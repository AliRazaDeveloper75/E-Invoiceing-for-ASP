"""
AI Service Layer — Phase 3 Intelligence & Automation.

Exports:
  get_ai_provider()  — factory that returns the configured AI provider
  AIProvider         — abstract base for all providers
  OCRService         — document OCR + data extraction
  FraudService       — invoice anomaly & fraud scoring
  AnalyticsService   — revenue forecasting + VAT trends
  AssistantService   — context-aware accounting assistant
  WorkflowService    — auto-approval + risk routing
"""
from .registry import get_ai_provider, AIRegistry

__all__ = ['get_ai_provider', 'AIRegistry']
