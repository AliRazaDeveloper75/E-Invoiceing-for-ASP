"""
Abstract base models — all app models inherit from these.
Provides audit fields (created_at, updated_at, is_active) automatically.
"""
import uuid
from django.db import models


class TimeStampedModel(models.Model):
    """
    Abstract base: adds created_at and updated_at to every model.
    Always use this as the base for new models.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']


class UUIDModel(models.Model):
    """
    Abstract base: replaces integer PK with UUID.
    Use this for models exposed via API (prevents ID enumeration attacks).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    """
    Full base model: UUID PK + audit timestamps + soft delete.
    All primary domain models (Invoice, Company, Customer) inherit from this.
    """
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']
