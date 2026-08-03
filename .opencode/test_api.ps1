$ErrorActionPreference = "Continue"
$loginResp = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/auth/login/' -Method POST -ContentType 'application/json' -Body '{"email":"ridairfan129@gmail.com","password":"Test@12345"}'
$token = $loginResp.data.access
$headers = @{Authorization = "Bearer $token"}

# Test 1: Create customer
Write-Output "`n=== TEST 1: Create Customer ==="
$customerBody = '{"name":"Test Customer E2E","email":"testcust_e2e@example.com","trn":"100200300400500","address":"Test Address, Dubai","phone":"+971501234567"}'
try {
    $resp = Invoke-WebRequest -Uri 'http://localhost:8000/api/v1/customers/' -Method POST -ContentType 'application/json' -Headers $headers -Body $customerBody
    Write-Output "STATUS: $($resp.StatusCode)"
    $custData = $resp.Content | ConvertFrom-Json
    Write-Output "SUCCESS: Customer created"
    Write-Output "RESPONSE: $($resp.Content)"
    $customerId = $custData.data.id
} catch {
    $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Output "FAILED: $($_.Exception.Response.StatusCode)"
    Write-Output "BODY: $($sr.ReadToEnd())"
    $customerId = $null
}

# Test 2: List customers
Write-Output "`n=== TEST 2: List Customers ==="
try {
    $resp = Invoke-WebRequest -Uri 'http://localhost:8000/api/v1/customers/' -Method GET -Headers $headers
    Write-Output "STATUS: $($resp.StatusCode)"
    $listData = $resp.Content | ConvertFrom-Json
    Write-Output "Total customers: $($listData.data.Count)"
    Write-Output "PASS: List customers OK"
} catch {
    $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Output "FAILED: $($_.Exception.Response.StatusCode) - $($sr.ReadToEnd())"
}

# Test 3: Create invoice
Write-Output "`n=== TEST 3: Create Invoice ==="
if ($customerId) {
    $invoiceBody = @"
{
    "customer": "$customerId",
    "reference": "E2E-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')",
    "items": [{
        "description": "Test Item",
        "quantity": 1,
        "unit_price": "100.00"
    }]
}
"@
    try {
        $resp = Invoke-WebRequest -Uri 'http://localhost:8000/api/v1/invoices/' -Method POST -ContentType 'application/json' -Headers $headers -Body $invoiceBody
        Write-Output "STATUS: $($resp.StatusCode)"
        $invData = $resp.Content | ConvertFrom-Json
        Write-Output "SUCCESS: Invoice created"
        Write-Output "Invoice ID: $($invData.data.id)"
        Write-Output "Invoice number: $($invData.data.invoice_number)"
        Write-Output "Status: $($invData.data.status)"
        $invoiceId = $invData.data.id
    } catch {
        $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "FAILED: $($_.Exception.Response.StatusCode)"
        Write-Output "BODY: $($sr.ReadToEnd())"
        $invoiceId = $null
    }
} else {
    Write-Output "SKIP: No customer ID"
}

# Test 4: Get invoice detail - verify no item_type fields
Write-Output "`n=== TEST 4: Verify Invoice Items (no item_type) ==="
if ($invoiceId) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/invoices/$invoiceId/" -Method GET -Headers $headers
        $invDetail = $resp.Content | ConvertFrom-Json
        $item = $invDetail.data.items[0]
        $hasItemType = $item.PSObject.Properties['item_type']
        $hasClassCode = $item.PSObject.Properties['item_classification_code']
        $hasServiceAcct = $item.PSObject.Properties['service_accounting_code']
        
        if ($hasItemType -or $hasClassCode -or $hasServiceAcct) {
            Write-Output "FAIL: Item still has removed fields!"
            Write-Output "item_type: $hasItemType, item_classification_code: $hasClassCode, service_accounting_code: $hasServiceAcct"
        } else {
            Write-Output "PASS: No item_type/item_classification_code/service_accounting_code on invoice item"
        }
        
        # Show actual fields
        Write-Output "Item fields: $($item.PSObject.Properties.Name -join ', ')"
    } catch {
        $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "FAILED: $($_.Exception.Response.StatusCode) - $($sr.ReadToEnd())"
    }
} else {
    Write-Output "SKIP: No invoice ID"
}

# Test 5: Verify customer has no legal_registration fields
Write-Output "`n=== TEST 5: Verify Customer (no legal_registration) ==="
if ($customerId) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/customers/$customerId/" -Method GET -Headers $headers
        $custDetail = $resp.Content | ConvertFrom-Json
        $hasRegId = $custDetail.data.PSObject.Properties['legal_registration_id']
        $hasRegType = $custDetail.data.PSObject.Properties['legal_registration_type']
        $hasRegAuth = $custDetail.data.PSObject.Properties['legal_registration_authority']
        
        if ($hasRegId -or $hasRegType -or $hasRegAuth) {
            Write-Output "FAIL: Customer still has legal_registration fields!"
        } else {
            Write-Output "PASS: No legal_registration fields on customer"
        }
        Write-Output "Customer fields: $($custDetail.data.PSObject.Properties.Name -join ', ')"
    } catch {
        $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "FAILED: $($_.Exception.Response.StatusCode) - $($sr.ReadToEnd())"
    }
} else {
    Write-Output "SKIP: No customer ID"
}

Write-Output "`n=== ALL TESTS COMPLETE ==="
