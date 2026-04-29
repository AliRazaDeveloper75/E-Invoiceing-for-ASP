"""
Root URL configuration.
All app endpoints are versioned under /api/v1/
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Django admin
    path('admin/', admin.site.urls),

    # ── API v1 ──────────────────────────────────────────────────────────────
    path('api/v1/auth/',         include('apps.accounts.urls',     namespace='accounts')),
    path('api/v1/companies/',    include('apps.companies.urls',    namespace='companies')),
    path('api/v1/customers/',    include('apps.customers.urls',    namespace='customers')),
    path('api/v1/invoices/',     include('apps.invoices.urls',     namespace='invoices')),
    path('api/v1/taxes/',        include('apps.taxes.urls',        namespace='taxes')),
    path('api/v1/integrations/', include('apps.integrations.urls', namespace='integrations')),
    path('api/v1/inbound/',      include('apps.inbound.urls',      namespace='inbound')),
    path('api/v1/admin/',        include('apps.admin_panel.urls',  namespace='admin_panel')),
    path('api/v1/chat/',         include('apps.chat.urls',         namespace='chat')),
    # Buyer Portal
    path('api/v1/buyers/',       include('apps.buyers.urls_invite', namespace='buyers')),
    path('api/v1/buyer/',        include('apps.buyers.urls_portal', namespace='buyer')),
]

# Serve media files in development only
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    try:
        import debug_toolbar
        urlpatterns = [
            path('__debug__/', include(debug_toolbar.urls)),
        ] + urlpatterns
    except ImportError:
        pass
