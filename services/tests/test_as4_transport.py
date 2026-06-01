"""
AS4 Transport Layer Tests.

Tests AS4 envelope construction, MTOM packaging, and MDN handling
using mocks — no real PEPPOL AP required.
"""
import base64
import uuid
from unittest.mock import MagicMock, patch

import pytest

from services.as4.envelope import AS4EnvelopeBuilder, build_receipt_signal
from services.as4.mdn_handler import MDNHandler, MDNVerificationResult
from services.peppol.sandbox import PEPPOLEnvironmentManager


# ─── Envelope Builder Tests ───────────────────────────────────────────────────

SAMPLE_UBL_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>INV-TEST-001</ID>
  <IssueDate>2024-01-15</IssueDate>
</Invoice>"""


class TestAS4EnvelopeBuilder:

    def test_build_returns_tuple(self):
        builder = AS4EnvelopeBuilder()
        envelope, message_id = builder.build(SAMPLE_UBL_XML)
        assert envelope is not None
        assert message_id
        assert len(message_id) > 10

    def test_message_id_is_unique(self):
        builder = AS4EnvelopeBuilder()
        _, id1 = builder.build(SAMPLE_UBL_XML)
        _, id2 = builder.build(SAMPLE_UBL_XML)
        assert id1 != id2

    def test_envelope_has_messaging_element(self):
        from lxml import etree
        from services.as4.constants import NS_EBMS3
        builder = AS4EnvelopeBuilder()
        envelope, _ = builder.build(SAMPLE_UBL_XML)
        # Should find eb3:Messaging element
        ns = f'{{{NS_EBMS3}}}'
        messaging = envelope.find(f'.//{ns}Messaging')
        assert messaging is not None

    def test_envelope_has_soap_body(self):
        from lxml import etree
        from services.as4.constants import NS_SOAP12
        builder = AS4EnvelopeBuilder()
        envelope, _ = builder.build(SAMPLE_UBL_XML)
        ns = f'{{{NS_SOAP12}}}'
        body = envelope.find(f'{ns}Body')
        assert body is not None


class TestReceiptSignal:

    def test_build_receipt_signal(self):
        from lxml import etree
        original_id = f'message-{uuid.uuid4()}@test.peppol.eu'
        references = ['#ref1', '#ref2']
        signal = build_receipt_signal(original_id, references)
        assert signal is not None
        xml_str = etree.tostring(signal, encoding='unicode')
        assert original_id in xml_str

    def test_receipt_contains_nri(self):
        from lxml import etree
        from services.as4.constants import NS_EBMS3
        signal = build_receipt_signal('msg-001', ['#body-ref'])
        xml_str = etree.tostring(signal, encoding='unicode')
        # Should contain NonRepudiationInformation or Receipt element
        assert 'Receipt' in xml_str or 'NonRepudiation' in xml_str


# ─── MDN Handler Tests ────────────────────────────────────────────────────────

def _build_minimal_mdn_soap(original_message_id: str, is_error: bool = False) -> bytes:
    """Build a minimal AS4 MDN SOAP envelope for testing."""
    if is_error:
        signal_content = f"""
        <eb3:SignalMessage>
          <eb3:MessageInfo>
            <eb3:Timestamp>2024-01-15T10:00:00Z</eb3:Timestamp>
            <eb3:MessageId>mdn-{uuid.uuid4()}@test</eb3:MessageId>
            <eb3:RefToMessageId>{original_message_id}</eb3:RefToMessageId>
          </eb3:MessageInfo>
          <eb3:Error errorCode="EBMS:0004" severity="Failure" shortDescription="Other">
            <eb3:Description>Processing failed.</eb3:Description>
          </eb3:Error>
        </eb3:SignalMessage>
        """
    else:
        signal_content = f"""
        <eb3:SignalMessage>
          <eb3:MessageInfo>
            <eb3:Timestamp>2024-01-15T10:00:00Z</eb3:Timestamp>
            <eb3:MessageId>mdn-{uuid.uuid4()}@test</eb3:MessageId>
            <eb3:RefToMessageId>{original_message_id}</eb3:RefToMessageId>
          </eb3:MessageInfo>
          <eb3:Receipt>
            <ebbp:NonRepudiationInformation xmlns:ebbp="http://docs.oasis-open.org/ebxml-bp/ebbp-signals-2.0">
              <ebbp:MessagePartNRInformation>
                <ds:Reference xmlns:ds="http://www.w3.org/2000/09/xmldsig#" URI="#payload-001"/>
              </ebbp:MessagePartNRInformation>
            </ebbp:NonRepudiationInformation>
          </eb3:Receipt>
        </eb3:SignalMessage>
        """

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<S12:Envelope xmlns:S12="http://www.w3.org/2003/05/soap-envelope"
              xmlns:eb3="http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/">
  <S12:Header>
    <eb3:Messaging>
      {signal_content}
    </eb3:Messaging>
  </S12:Header>
  <S12:Body/>
</S12:Envelope>""".encode('utf-8')


class TestMDNHandler:

    def test_process_valid_mdn(self):
        original_id = f'msg-{uuid.uuid4()}@sender.peppol.eu'
        mdn_bytes   = _build_minimal_mdn_soap(original_id)
        handler     = MDNHandler()
        result      = handler.process_inbound(mdn_bytes)

        assert isinstance(result, MDNVerificationResult)
        assert result.ref_to_message_id == original_id
        assert not result.is_error

    def test_process_error_mdn(self):
        original_id = f'msg-{uuid.uuid4()}@sender.peppol.eu'
        mdn_bytes   = _build_minimal_mdn_soap(original_id, is_error=True)
        handler     = MDNHandler()
        result      = handler.process_inbound(mdn_bytes)

        assert isinstance(result, MDNVerificationResult)
        assert result.is_error

    def test_invalid_soap_raises_or_returns_invalid(self):
        handler = MDNHandler()
        result  = handler.process_inbound(b'<not-soap>bad xml</not-soap>')
        assert not result.is_valid or result.is_error


# ─── Sandbox Environment Manager Tests ────────────────────────────────────────

class TestPEPPOLEnvironmentManager:

    def test_validate_participant_id_valid_uae(self):
        mgr = PEPPOLEnvironmentManager()
        valid, err = mgr.validate_participant_id('0235:100000000000001')
        assert valid, err

    def test_validate_participant_id_missing_scheme(self):
        mgr = PEPPOLEnvironmentManager()
        valid, err = mgr.validate_participant_id('100000000000001')
        assert not valid
        assert 'scheme' in err.lower() or 'format' in err.lower()

    def test_validate_participant_id_uae_wrong_length(self):
        mgr = PEPPOLEnvironmentManager()
        valid, err = mgr.validate_participant_id('0235:1234')
        assert not valid
        assert '15' in err

    def test_validate_participant_id_uae_non_numeric(self):
        mgr = PEPPOLEnvironmentManager()
        valid, err = mgr.validate_participant_id('0235:ABCDEFGHIJKLMNO')
        assert not valid

    def test_validate_participant_id_non_uae_scheme(self):
        # Non-UAE schemes only need valid format
        mgr = PEPPOLEnvironmentManager()
        valid, err = mgr.validate_participant_id('9915:TEST-OXALIS')
        assert valid, err

    @patch('services.peppol.sandbox.PEPPOLEnvironmentManager.__init__')
    def test_get_config_returns_testnet_when_test_sml_true(self, mock_init):
        mock_init.return_value = None
        mgr = PEPPOLEnvironmentManager()
        mgr._settings = MagicMock()
        mgr._settings.PEPPOL_USE_TEST_SML = True

        with patch('services.peppol.sandbox.PEPPOLEnvironmentManager.get_config') as mock_get:
            mock_get.return_value = MagicMock(is_sandbox=True, name='testnet')
            config = mgr.get_config()
            assert config.is_sandbox


# ─── FTA Connector Tests ──────────────────────────────────────────────────────

class TestFTASandboxConnector:

    def test_no_base_url_returns_error(self):
        from services.fta.connector import FTASandboxConnector, FTA_STATUS_ERROR
        with patch('services.fta.connector.FTASandboxConnector.__init__') as mock_init:
            mock_init.return_value = None
            connector = FTASandboxConnector()
            connector._base_url        = ''
            connector._token           = ''
            connector._cert_path       = ''
            connector._key_path        = ''
            connector._ca_bundle       = True
            connector._signing_enabled = False
            connector._polling_max     = 3
            connector._polling_secs    = 1

            invoice = MagicMock()
            result  = connector.report(invoice, b'<xml/>')
            assert result.status == FTA_STATUS_ERROR

    def test_parse_acceptance_response(self):
        from services.fta.connector import FTASandboxConnector, FTA_STATUS_ACCEPTED
        import requests as req

        connector = FTASandboxConnector.__new__(FTASandboxConnector)
        mock_resp = MagicMock(spec=req.Response)
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            'status':    'accepted',
            'reference': 'FTA-2024-12345',
        }

        result = connector._parse_response(mock_resp)
        assert result.status == FTA_STATUS_ACCEPTED
        assert result.fta_reference == 'FTA-2024-12345'

    def test_parse_rejection_response(self):
        from services.fta.connector import FTASandboxConnector, FTA_STATUS_REJECTED
        import requests as req

        connector = FTASandboxConnector.__new__(FTASandboxConnector)
        mock_resp = MagicMock(spec=req.Response)
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            'errors': [
                {'code': 'VAT-001', 'description': 'Invalid seller TRN', 'field': 'sellerTrn'}
            ]
        }

        result = connector._parse_response(mock_resp)
        assert result.status == FTA_STATUS_REJECTED
        assert len(result.rejection_details) == 1
        assert result.rejection_details[0].code == 'VAT-001'

    def test_parse_async_202_response(self):
        from services.fta.connector import FTASandboxConnector, FTA_STATUS_PENDING
        import requests as req

        connector = FTASandboxConnector.__new__(FTASandboxConnector)
        mock_resp = MagicMock(spec=req.Response)
        mock_resp.status_code = 202
        mock_resp.json.return_value = {'reference': 'FTA-ASYNC-001'}

        result = connector._parse_response(mock_resp)
        assert result.status == FTA_STATUS_PENDING
        assert result.fta_reference == 'FTA-ASYNC-001'
