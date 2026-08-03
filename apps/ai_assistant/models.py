import uuid
from django.db import models
from django.conf import settings
from apps.common.constants import USER_ROLE_CHOICES

class AIConversation(models.Model):
    """
    One AI Assistant chat session for a single user within a single company.
    A user can have multiple conversations over time (like chat "threads").
    """

    ROLE_ADMIN = 'admin'
    ROLE_ACCOUNTANT = 'accountant'
    ROLE_SUPPLIER = 'supplier'
    ROLE_VIEWER = 'viewer'
    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_ACCOUNTANT, 'Accountant'),
        (ROLE_SUPPLIER, 'Supplier'),
        (ROLE_VIEWER, 'Viewer'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_conversations',
    )

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='ai_conversations',
    )

    # Snapshot of the role at conversation start — even if the user's role
    # changes later, we know what permissions this conversation was created
    # under.
    role_snapshot = models.CharField(max_length=20, choices=USER_ROLE_CHOICES)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    last_active_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ai_conversations'
        ordering = ['-last_active_at']
        indexes = [
            models.Index(fields=['user', 'company'], name='idx_aiconv_user_company'),
        ]

    def __str__(self):
        return f'AIConversation({self.id}) — {self.user_id} @ {self.company_id}'
    

class AIMessage(models.Model):
    """
    A single message inside an AIConversation — either from the user,
    the assistant, or a tool result. Mirrors the standard chat-completion
    message shape (role + content) so it maps cleanly onto the LLM API.
    """
    ROLE_USER = 'user'
    ROLE_ASSISTANT = 'assistnat'
    ROLE_TOOL = 'tool'
    ROLE_CHOICES = [
        (ROLE_USER, 'User'),
        (ROLE_ASSISTANT, 'Assistant'),
        (ROLE_TOOL, 'Tool'),
    ]

    conversation = models.ForeignKey(
        AIConversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField(blank=True,default='')

    # Raw tool-call payload from the LLM response, if this message triggered
    # one or more tool calls. Stored as JSON for full fidelity/debugging.
    tool_calls_json = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at'], name='idx_aimsg_conv_created'),
        ]

    def __str__(self):
        preview = (self.content[:40] + '…') if len(self.content) > 40 else self.content
        return f'AIMessage({self.role}): {preview}'
    

class AIToolCallLog(models.Model):
    """
    This data model will save every record in database what AI has done 
    which tool has used what input tool take what output tool has given
    what result occur after tool calling 
    """

    STATUS_PREVIEW = 'preview'      # write-tool proposed an action, not yet confirmed
    STATUS_CONFIRMED = 'confirmed'  # write-tool action was confirmed and executed
    STATUS_EXECUTED = 'executed'    # read-tool ran immediately (no confirmation needed)
    STATUS_REJECTED = 'rejected'    # user declined a proposed action
    STATUS_ERROR = 'error'          # tool raised an exception (e.g. permission denied)
    STATUS_CHOICES = [
        (STATUS_PREVIEW, 'Preview'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_EXECUTED, 'Executed'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_ERROR, 'Error'),
    ]

    message = models.ForeignKey(
        AIMessage,
        on_delete=models.CASCADE,
        related_name='tool_call_logs',
    )

    tool_name = models.CharField(max_length=100)
    arguments_json = models.JSONField(default=dict)
    result_json = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES)

    # Denormalized for fast auditing/filtering without joining through
    # message → conversation every time.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='ai_tool_calls',
    )
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.SET_NULL,
        null=True,
        related_name='ai_tool_calls',
    )

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    error_detail = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_tool_call_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'created_at'], name='idx_aitool_company_created'),
            models.Index(fields=['tool_name', 'status'], name='idx_aitool_name_status'),
        ]

    def __str__(self):
        return f'{self.tool_name} [{self.status}] @ {self.created_at}'


class AIPendingAction(models.Model):
    """
    A write-action proposed by a tool but not yet executed. The user must
    explicitly confirm before the underlying Django model (Invoice, Customer,
    etc.) is actually created or modified. This is the single choke point
    through which every AI-initiated write must pass.
    """

    STATUS_PENDING = 'pending'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_EXPIRED = 'expired'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_EXPIRED, 'Expired'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    ACTION_CREATE_INVOICE = 'create_invoice'
    ACTION_ADD_CUSTOMER = 'add_customer'
    ACTION_MARK_PAID = 'mark_paid'
    ACTION_TYPE_CHOICES = [
        (ACTION_CREATE_INVOICE, 'Create Invoice'),
        (ACTION_ADD_CUSTOMER, 'Add Customer'),
        (ACTION_MARK_PAID, 'Mark Paid'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    conversation = models.ForeignKey(
        AIConversation,
        on_delete=models.CASCADE,
        related_name='pending_actions',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_pending_actions',
    )
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='ai_pending_actions',
    )

    action_type = models.CharField(max_length=30, choices=ACTION_TYPE_CHOICES)
    payload_json = models.JSONField(
        help_text='Full proposed data for the action (e.g. draft invoice fields).'
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_PENDING)

    # Result of the action once confirmed — e.g. the created Invoice's id.
    result_object_id = models.CharField(max_length=64, blank=True, default='')

    expires_at = models.DateTimeField(
        help_text='Pending actions auto-expire (e.g. 15 minutes) to avoid stale confirmations.'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ai_pending_actions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status'], name='idx_aipending_user_status'),
            models.Index(fields=['company', 'status'], name='idx_aipending_company_status'),
        ]

    def __str__(self):
        return f'{self.action_type} [{self.status}] — {self.user_id} @ {self.company_id}'
    
