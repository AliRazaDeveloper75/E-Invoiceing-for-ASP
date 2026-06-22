"""Onboarding serializers."""
from rest_framework import serializers
from apps.companies.models import Company
from .models import CompanyInvitation, InvitationEmailLog, OnboardingDocument


class InvitationEmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InvitationEmailLog
        fields = ['id', 'sent_at', 'status', 'error_message']


class CompanyInvitationSerializer(serializers.ModelSerializer):
    invited_by_name      = serializers.SerializerMethodField()
    invited_by_email     = serializers.SerializerMethodField()
    email_logs           = InvitationEmailLogSerializer(many=True, read_only=True)
    is_link_active       = serializers.SerializerMethodField()
    minutes_until_expiry = serializers.SerializerMethodField()

    class Meta:
        model  = CompanyInvitation
        fields = [
            'id', 'token', 'email', 'first_name', 'last_name', 'company_name_hint',
            'role', 'status', 'message', 'expires_at', 'created_at',
            'invited_by_name', 'invited_by_email',
            # tracking
            'send_count', 'last_sent_at', 'last_delivery_status', 'last_error',
            'email_opened_at', 'link_accessed_at',
            'email_logs', 'is_link_active', 'minutes_until_expiry',
        ]
        read_only_fields = ['id', 'token', 'status', 'expires_at', 'created_at']

    def get_invited_by_name(self, obj):
        return obj.invited_by.full_name if obj.invited_by else None

    def get_invited_by_email(self, obj):
        return obj.invited_by.email if obj.invited_by else None

    def get_is_link_active(self, obj):
        return obj.is_valid

    def get_minutes_until_expiry(self, obj):
        from django.utils import timezone
        import math
        delta = obj.expires_at - timezone.now()
        return max(0, math.ceil(delta.total_seconds() / 60))


class CreateInvitationSerializer(serializers.Serializer):
    email             = serializers.EmailField()
    first_name        = serializers.CharField(max_length=150, required=False, default='')
    last_name         = serializers.CharField(max_length=150, required=False, default='')
    company_name_hint = serializers.CharField(max_length=255, required=False, default='')
    role              = serializers.ChoiceField(
        choices=['supplier', 'accountant', 'viewer'],
        default='supplier',
    )
    message = serializers.CharField(required=False, default='', allow_blank=True)


class ValidateTokenSerializer(serializers.Serializer):
    token = serializers.UUIDField()


class AcceptInvitationSerializer(serializers.Serializer):
    """Full onboarding payload submitted from the multi-step form."""

    token = serializers.UUIDField()

    # ── Account ───────────────────────────────────────────────────────────────
    first_name       = serializers.CharField(max_length=150)
    last_name        = serializers.CharField(max_length=150)
    password         = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)

    # ── Company (required) ────────────────────────────────────────────────────
    company_name         = serializers.CharField(max_length=255)
    company_legal_name   = serializers.CharField(max_length=255, required=False, allow_blank=True)
    trn                  = serializers.CharField(max_length=15)
    trade_license_number = serializers.CharField(max_length=30)
    business_type        = serializers.CharField(max_length=20, required=False, allow_blank=True)
    industry_type        = serializers.CharField(max_length=20, required=False, allow_blank=True)

    # ── Company address ───────────────────────────────────────────────────────
    street_address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    city           = serializers.CharField(max_length=100, required=False, allow_blank=True)
    emirate        = serializers.CharField(max_length=20, required=False, default='dubai')
    po_box         = serializers.CharField(max_length=20, required=False, allow_blank=True)
    country        = serializers.CharField(max_length=2, required=False, default='AE')

    # ── Contact ───────────────────────────────────────────────────────────────
    company_phone        = serializers.CharField(max_length=20, required=False, allow_blank=True)
    company_email        = serializers.EmailField(required=False, allow_blank=True)
    website              = serializers.CharField(max_length=200, required=False, allow_blank=True)
    contact_person_name  = serializers.CharField(max_length=255, required=False, allow_blank=True)
    contact_person_email = serializers.EmailField(required=False, allow_blank=True)
    contact_person_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        import re
        if not re.fullmatch(r'\d{15}', attrs['trn']):
            raise serializers.ValidationError({'trn': 'TRN must be exactly 15 numeric digits.'})
        tl = (attrs.get('trade_license_number') or '').strip()
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9\-/ ]{2,29}', tl):
            raise serializers.ValidationError({
                'trade_license_number': 'Use 3–30 letters, numbers, hyphens or slashes only.'
            })
        return attrs


class OnboardingDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = OnboardingDocument
        fields = [
            'id', 'document_type', 'file', 'file_name',
            'notes', 'verified', 'verified_at', 'created_at',
        ]
        read_only_fields = ['id', 'file_name', 'verified', 'verified_at', 'created_at']


class ReviewCompanySerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject', 'request_changes'])
    notes  = serializers.CharField(required=False, allow_blank=True, default='')


class OnboardingCompanySerializer(serializers.ModelSerializer):
    """Company with onboarding status for admin review list."""
    documents     = OnboardingDocumentSerializer(source='onboarding_documents', many=True, read_only=True)
    member_count  = serializers.SerializerMethodField()
    reviewed_by   = serializers.SerializerMethodField()
    logo_url      = serializers.SerializerMethodField()

    class Meta:
        model  = Company
        fields = [
            'id', 'name', 'legal_name', 'trn', 'business_type', 'industry_type',
            'onboarding_status', 'onboarding_notes', 'onboarding_reviewed_at',
            'street_address', 'city', 'emirate', 'country',
            'phone', 'email', 'website',
            'contact_person_name', 'contact_person_email', 'contact_person_phone',
            'legal_registration_id', 'legal_registration_type',
            'logo_url', 'documents', 'member_count', 'reviewed_by', 'created_at',
        ]

    def get_member_count(self, obj):
        return obj.members.filter(is_active=True).count()

    def get_reviewed_by(self, obj):
        if obj.onboarding_reviewed_by:
            return obj.onboarding_reviewed_by.full_name
        return None

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None
