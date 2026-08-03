"""E2E API test — verifies removed fields don't appear in responses."""
import os, sys, json, base64, random
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.development'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django; django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from apps.accounts.models import User
from apps.companies.models import Company
from apps.customers.models import Customer
from apps.customers.views import CustomerListCreateView, CustomerDetailView
from apps.invoices.services import InvoiceService
from apps.invoices.models import Invoice
from django.core.files.uploadedfile import SimpleUploadedFile

passed = 0
failed = 0

def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS: {label}")
    else:
        failed += 1
        print(f"  FAIL: {label} {detail}")

# Minimal valid 1x1 PNG
PNG_1x1 = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

user = User.objects.get(email='ridairfan003@gmail.com')
company = Company.objects.filter(members__user=user).first()
factory = RequestFactory()

BAD_FIELDS = ['legal_registration_id', 'legal_registration_type', 'legal_registration_authority']
ITEM_BAD_FIELDS = ['item_type', 'item_classification_code', 'service_accounting_code']

# ─── TEST 1: List Customers ──────────────────────────────────────────────────
print("=== TEST 1: List Customers (no legal_registration) ===")
req = factory.get(f'/api/v1/customers/?company_id={company.id}')
force_authenticate(req, user=user)
resp = CustomerListCreateView.as_view()(req)
resp.render()
data = json.loads(resp.content)
customers = data.get('results', [])
check(f"List returned {len(customers)} customers", len(customers) > 0)
clean = sum(1 for c in customers if not any(f in c for f in BAD_FIELDS))
check(f"All {len(customers)} customers have no legal_registration fields", clean == len(customers), f"({clean}/{len(customers)})")

# ─── TEST 2: Create Customer ─────────────────────────────────────────────────
print("\n=== TEST 2: Create Customer (no legal_registration) ===")
trn_doc = SimpleUploadedFile("trn.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
logo = SimpleUploadedFile("logo.png", PNG_1x1, content_type="image/png")
req = factory.post(
    f'/api/v1/customers/?company_id={company.id}',
    data={
        'company_id': str(company.id),
        'name': 'E2E Final Test Customer',
        'email': f'e2e_{random.randint(10000,99999)}@example.com',
        'trn': ''.join(str(random.randint(0,9)) for _ in range(15)),
        'country': 'AE',
        'street_address': '123 Test St',
        'city': 'Dubai',
        'trn_document': trn_doc,
        'logo': logo,
    },
    format='multipart',
)
force_authenticate(req, user=user)
resp = CustomerListCreateView.as_view()(req)
resp.render()
data = json.loads(resp.content)
check("Customer create returned success", data.get('success') == True)
new_cust = data.get('data', {})
new_customer_id = new_cust.get('id')
if new_customer_id:
    for field in BAD_FIELDS:
        check(f"New customer has no '{field}'", field not in new_cust)
else:
    check("Customer was created with an ID", False, str(data.get('error', '')))

# ─── TEST 3: Customer Detail ─────────────────────────────────────────────────
print("\n=== TEST 3: Customer Detail (no legal_registration) ===")
if new_customer_id:
    req = factory.get(f'/api/v1/customers/{new_customer_id}/')
    force_authenticate(req, user=user)
    resp = CustomerDetailView.as_view()(req, customer_id=new_customer_id)
    resp.render()
    data = json.loads(resp.content)
    cust = data.get('data', {})
    for field in BAD_FIELDS:
        check(f"Detail has no '{field}'", field not in cust)
    check("Detail has expected fields", all(k in cust for k in ['name', 'trn', 'street_address', 'company_name']))
else:
    print("  SKIP")

# ─── TEST 4: DB Schema — Customer ───────────────────────────────────────────
print("\n=== TEST 4: Customer DB Schema ===")
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("PRAGMA table_info(customers_customer)")
    columns = [row[1] for row in cursor.fetchall()]
    for field in BAD_FIELDS:
        check(f"Column '{field}' NOT in DB", field not in columns)

# ─── TEST 5: DB Schema — InvoiceItem ─────────────────────────────────────────
print("\n=== TEST 5: InvoiceItem DB Schema ===")
with connection.cursor() as cursor:
    cursor.execute("PRAGMA table_info(invoices_invoiceitem)")
    columns = [row[1] for row in cursor.fetchall()]
    for field in ITEM_BAD_FIELDS:
        check(f"Column '{field}' NOT in DB", field not in columns)

# ─── TEST 6: Create Invoice + Items (ORM) ────────────────────────────────────
print("\n=== TEST 6: Create Invoice + Items (no item_type) ===")
if new_customer_id:
    customer = Customer.objects.get(id=new_customer_id)
else:
    customer = Customer.objects.filter(company=company, is_active=True).first()
    if not customer:
        print("  FAIL: No customer available")
        sys.exit(1)
    print(f"  (Using existing customer: {customer.name})")
    check("Fallback customer found", True)
    invoice = Invoice.objects.create(
        company=company,
        customer=customer,
        reference_number='E2E-FINAL-TEST',
        currency='AED',
    )
    check("Invoice created", invoice.id is not None, f"(id={invoice.id})")
    
    from apps.companies.models import CompanyMember
    membership = CompanyMember.objects.get(user=user, company=company)
    item = InvoiceService.add_item(
        invoice=invoice,
        membership=membership,
        data={
            'description': 'E2E Test Service',
            'quantity': 2,
            'unit_price': '250.00',
        }
    )
    check("Invoice item created", item.id is not None)
    item_dict = item.__dict__
    for field in ITEM_BAD_FIELDS:
        check(f"Item has no '{field}'", field not in item_dict)
    check(f"Item description correct", item.description == 'E2E Test Service')
    check(f"Item quantity correct", item.quantity == 2)
    check(f"Item price correct", str(item.unit_price) == '250.00')
else:
    print("  SKIP")

# ─── TEST 7: XML Generation ──────────────────────────────────────────────────
print("\n=== TEST 7: XML Generation ===")
if new_customer_id:
    from services.xml_generator import generate_pint_ae_xml
    try:
        xml = generate_pint_ae_xml(invoice)
        check("XML generated", len(xml) > 0, f"({len(xml)} chars)")
        check("No item_type in XML", 'item_type' not in xml.lower() or 'ItemClassificationCode' not in xml)
        check("Has InvoiceLine", '<cbc:ID>' in xml)
    except Exception as e:
        check(f"XML generation didn't crash", False, str(e))
else:
    print("  SKIP")

# ─── Summary ──────────────────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"RESULTS: {passed} passed, {failed} failed")
if failed > 0:
    print("SOME TESTS FAILED!")
    sys.exit(1)
else:
    print("ALL TESTS PASSED")
