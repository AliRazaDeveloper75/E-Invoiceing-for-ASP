"""
Chat API view.

POST /api/v1/chat/   — AI agent endpoint powered by OpenAI ChatGPT
"""
import os
import logging
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from apps.common.utils import success_response, error_response

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert assistant for a UAE e-invoicing platform built on the PEPPOL / PINT UBL 2.1 standard.

You help users with:
- Creating and managing invoices (tax invoices, credit notes, continuous supply)
- UAE VAT rules: standard rate (5%), zero-rated, and exempt supplies
- PEPPOL BIS 3.0 / UAE PINT field requirements (IBT codes, BTAE extensions)
- Company and customer management
- Supplier portal and inbound invoices
- Platform navigation and troubleshooting

Keep answers concise, accurate, and specific to UAE e-invoicing. If asked something outside this domain, politely redirect to invoice-related topics."""


class ChatView(APIView):
    """POST /api/v1/chat/ — accepts messages array, returns AI reply."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        messages = request.data.get('messages', [])
        if not messages or not isinstance(messages, list):
            return error_response(
                'messages is required and must be a non-empty list.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        for msg in messages:
            if not isinstance(msg, dict) or msg.get('role') not in ('user', 'assistant'):
                return error_response(
                    'Each message must have role ("user" or "assistant") and content.',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            if not msg.get('content'):
                return error_response(
                    'Message content cannot be empty.',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            logger.error('OPENAI_API_KEY not set in environment')
            return error_response(
                'AI service is not configured. Please contact support.',
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)

            response = client.chat.completions.create(
                model='gpt-4o-mini',
                max_tokens=1024,
                messages=[
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    *[
                        {'role': m['role'], 'content': str(m['content'])}
                        for m in messages
                    ],
                ],
            )

            reply = response.choices[0].message.content
            return success_response(data={'reply': reply})

        except Exception:
            logger.exception('OpenAI API call failed')
            return error_response(
                'AI service is temporarily unavailable. Please try again.',
                status_code=status.HTTP_502_BAD_GATEWAY,
            )
