from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from apps.invoices.permissions import get_company_and_membership
from apps.ai_assistant.permissions import get_user_role
from apps.ai_assistant.serializers import ChatRequestSerializer, ChatResponseSerializer
from apps.ai_assistant.models import AIConversation, AIMessage
from apps.ai_assistant.agent.orchestrator import run_agent
class AIAssistantChatView(APIView):
    """
    POST /api/v1/ai-assistant/chat/?company_id=<uuid>

    Phase 2 skeleton: resolves company + role, creates/continues a
    conversation, saves the user message, and returns a DUMMY reply.
    No LLM call yet — that gets wired in once this flow is confirmed working.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company_id = request.query_params.get('company_id')
        # In user request the company id must be present
        if not company_id:
            return Response(
                {"error": "company_id query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company, membership = get_company_and_membership(request.user, company_id)
        if company is None:
            return Response(
                {"error": "Company not found or you are not a member of it."},
                status=status.HTTP_404_NOT_FOUND,
            )

        req_serializer = ChatRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        message_text = req_serializer.validated_data['message']
        conversation_id = req_serializer.validated_data.get('conversation_id')

        role = get_user_role(request.user, company)

        # Resolve or create the conversation
        if conversation_id:
            conversation = AIConversation.objects.filter(
                id=conversation_id, user=request.user, company=company
            ).first()
            if conversation is None:
                return Response(
                    {"error": "Conversation not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            conversation = AIConversation.objects.create(
                user=request.user,
                company=company,
                role_snapshot=role,
            )

        # Save the user's message
        AIMessage.objects.create(
            conversation=conversation,
            role='user',
            content=message_text,
        )

        # ── LLM Reply──────────────────────────────────
        # ── Agent reply (with conversation history + role-aware prompt) ─
        llm_reply = run_agent(role=role, conversation=conversation, user_message=message_text)
        # ── Real LLM reply ─────────────────────────────────────────────
        
        # Save the assistant's (du
        # mmy) reply too, so history stays consistent
        AIMessage.objects.create(
            conversation=conversation,
            role='assistant',
            content=llm_reply,
        )

        response_data = {
            "conversation_id": conversation.id,
            "reply": llm_reply,
            "role": role,
        }
        resp_serializer = ChatResponseSerializer(response_data)
        return Response(resp_serializer.data, status=status.HTTP_200_OK)