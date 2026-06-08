"""
PEPPOL AS4 SOAP/ebMS 3.0 Envelope Builder.

Constructs the SOAP 1.2 message envelope compliant with:
  - OASIS ebMS 3.0 Core Specification
  - PEPPOL AS4 Profile v2.0
  - WS-Security 1.1

The envelope is structured as:
  <S12:Envelope>
    <S12:Header>
      <eb3:Messaging>        ← ebMS 3.0 UserMessage
        <eb3:UserMessage>
          <eb3:MessageInfo>  ← Timestamp + MessageId
          <eb3:PartyInfo>    ← From/To with PEPPOL participant IDs
          <eb3:CollaborationInfo>  ← Service (process) + Action (doctype)
          <eb3:PayloadInfo>  ← Reference to MIME attachment by CID
        </eb3:UserMessage>
      </eb3:Messaging>
      <wsse:Security>        ← WS-Security (filled by signing module)
    </S12:Header>
    <S12:Body/>              ← Empty body (payload is a MIME attachment)
  </S12:Envelope>
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from lxml import etree

from .constants import (
    NS_SOAP12, NS_EBMS3, NS_WSSE, NS_WSU, NS_DS, NS_MAP,
    ROLE_INITIATOR, ROLE_RESPONDER,
    SERVICE_TYPE_CENBII, UAE_PEPPOL_PARTY_TYPE,
    PEPPOL_PROCESS_BIS30, PEPPOL_DOCTYPE_PINT_AE_INVOICE, PEPPOL_DOCTYPE_BIS30_INVOICE,
    PAYLOAD_CID_TEMPLATE, PAYLOAD_PART_HREF_TEMPLATE,
    TS_FORMAT,
)


class AS4EnvelopeBuilder:
    """
    Builds a PEPPOL AS4 SOAP envelope for sending a UBL invoice.

    Usage:
        builder = AS4EnvelopeBuilder(
            sender_participant_id='0235:123456789012345',
            receiver_participant_id='0235:987654321098765',
        )
        envelope_xml, message_id = builder.build(xml_payload_bytes)
    """

    def __init__(
        self,
        sender_participant_id: str,
        receiver_participant_id: str,
        document_type_id: str = PEPPOL_DOCTYPE_PINT_AE_INVOICE,
        process_id: str       = PEPPOL_PROCESS_BIS30,
        use_pint_ae: bool     = True,
    ):
        self._sender_id    = sender_participant_id
        self._receiver_id  = receiver_participant_id
        self._doc_type     = document_type_id
        self._process_id   = process_id

    def build(self, payload_bytes: bytes) -> tuple[etree._Element, str]:
        """
        Build the SOAP envelope element.

        Args:
            payload_bytes: Raw UBL Invoice XML bytes (the MIME attachment)

        Returns:
            (envelope_element, message_id) where message_id links to the payload CID
        """
        message_id     = f'{uuid.uuid4()}@peppol.eu'
        conversation_id = str(uuid.uuid4())
        timestamp       = datetime.now(tz=timezone.utc).strftime(TS_FORMAT)

        envelope = self._build_envelope(
            message_id, conversation_id, timestamp
        )
        return envelope, message_id

    # ── Envelope structure ─────────────────────────────────────────────────────

    def _build_envelope(
        self,
        message_id: str,
        conversation_id: str,
        timestamp: str,
    ) -> etree._Element:
        envelope = etree.Element(f'{{{NS_SOAP12}}}Envelope', nsmap=NS_MAP)

        header = etree.SubElement(envelope, f'{{{NS_SOAP12}}}Header')
        self._build_messaging(header, message_id, conversation_id, timestamp)
        self._build_security_placeholder(header)

        body = etree.SubElement(envelope, f'{{{NS_SOAP12}}}Body')
        body.set(f'{{{NS_WSU}}}Id', 'body')   # so the ds:Reference URI='#body' resolves

        return envelope

    def _build_messaging(
        self,
        header: etree._Element,
        message_id: str,
        conversation_id: str,
        timestamp: str,
    ) -> etree._Element:
        messaging = etree.SubElement(header, f'{{{NS_EBMS3}}}Messaging')
        # mustUnderstand signals receivers that fail to process must fault
        messaging.set(f'{{{NS_SOAP12}}}mustUnderstand', 'true')
        messaging.set(f'{{{NS_WSU}}}Id', 'messaging')

        user_msg = etree.SubElement(messaging, f'{{{NS_EBMS3}}}UserMessage')

        self._build_message_info(user_msg, message_id, timestamp)
        self._build_party_info(user_msg)
        self._build_collaboration_info(user_msg, conversation_id)
        self._build_payload_info(user_msg, message_id)

        return messaging

    def _build_message_info(
        self,
        user_msg: etree._Element,
        message_id: str,
        timestamp: str,
    ) -> None:
        msg_info = etree.SubElement(user_msg, f'{{{NS_EBMS3}}}MessageInfo')
        ts_el = etree.SubElement(msg_info, f'{{{NS_EBMS3}}}Timestamp')
        ts_el.text = timestamp
        mid_el = etree.SubElement(msg_info, f'{{{NS_EBMS3}}}MessageId')
        mid_el.text = message_id

    def _build_party_info(self, user_msg: etree._Element) -> None:
        party_info = etree.SubElement(user_msg, f'{{{NS_EBMS3}}}PartyInfo')

        # From (sender)
        from_el = etree.SubElement(party_info, f'{{{NS_EBMS3}}}From')
        sender_party_id = etree.SubElement(from_el, f'{{{NS_EBMS3}}}PartyId')
        sender_party_id.set('type', UAE_PEPPOL_PARTY_TYPE)
        # PartyId value is the identifier part (after the scheme prefix)
        sender_party_id.text = self._sender_id.split(':', 1)[-1]
        from_role = etree.SubElement(from_el, f'{{{NS_EBMS3}}}Role')
        from_role.text = ROLE_INITIATOR

        # To (receiver)
        to_el = etree.SubElement(party_info, f'{{{NS_EBMS3}}}To')
        recv_party_id = etree.SubElement(to_el, f'{{{NS_EBMS3}}}PartyId')
        recv_party_id.set('type', UAE_PEPPOL_PARTY_TYPE)
        recv_party_id.text = self._receiver_id.split(':', 1)[-1]
        to_role = etree.SubElement(to_el, f'{{{NS_EBMS3}}}Role')
        to_role.text = ROLE_RESPONDER

    def _build_collaboration_info(
        self, user_msg: etree._Element, conversation_id: str
    ) -> None:
        collab = etree.SubElement(user_msg, f'{{{NS_EBMS3}}}CollaborationInfo')

        service_el = etree.SubElement(collab, f'{{{NS_EBMS3}}}Service')
        service_el.set('type', SERVICE_TYPE_CENBII)
        service_el.text = self._process_id

        action_el = etree.SubElement(collab, f'{{{NS_EBMS3}}}Action')
        action_el.text = self._doc_type

        conv_el = etree.SubElement(collab, f'{{{NS_EBMS3}}}ConversationId')
        conv_el.text = conversation_id

    def _build_payload_info(
        self, user_msg: etree._Element, message_id: str
    ) -> None:
        payload_info = etree.SubElement(user_msg, f'{{{NS_EBMS3}}}PayloadInfo')
        part_info = etree.SubElement(payload_info, f'{{{NS_EBMS3}}}PartInfo')
        part_info.set('href', PAYLOAD_PART_HREF_TEMPLATE.format(
            message_id=message_id.replace('@', '_').replace('.', '_')
        ))

        part_props = etree.SubElement(part_info, f'{{{NS_EBMS3}}}PartProperties')
        for name, value in [
            ('MimeType',    'application/xml'),
            ('CharacterSet', 'UTF-8'),
        ]:
            prop = etree.SubElement(part_props, f'{{{NS_EBMS3}}}Property')
            prop.set('name', name)
            prop.text = value

    def _build_security_placeholder(self, header: etree._Element) -> None:
        """Add empty wsse:Security element — filled in by AS4Signer."""
        security = etree.SubElement(header, f'{{{NS_WSSE}}}Security')
        security.set(f'{{{NS_SOAP12}}}mustUnderstand', 'true')


def build_receipt_signal(
    original_message_id: str,
    received_references: list,
) -> etree._Element:
    """
    Build an ebMS 3.0 AS4 Receipt SignalMessage.

    Called by the inbound AS4 endpoint after validating a received message.
    The receipt echoes back the FULL ds:Reference elements (URI + DigestMethod
    + DigestValue) from the original UserMessage's signature, wrapped in
    ebbp:NonRepudiationInformation — the sender (phase4) verifies these against
    what it signed, so URIs alone are not sufficient.

    Args:
        original_message_id: MessageId from the UserMessage being acknowledged
        received_references: List of deep-copied ds:Reference lxml elements
            from the original signature's SignedInfo.

    Returns:
        lxml Element: <S12:Envelope> containing the receipt signal
    """
    import copy
    receipt_message_id = f'{uuid.uuid4()}@peppol.eu'
    timestamp = datetime.now(tz=timezone.utc).strftime(TS_FORMAT)

    envelope = etree.Element(f'{{{NS_SOAP12}}}Envelope', nsmap=NS_MAP)
    header = etree.SubElement(envelope, f'{{{NS_SOAP12}}}Header')

    messaging = etree.SubElement(header, f'{{{NS_EBMS3}}}Messaging')
    messaging.set(f'{{{NS_SOAP12}}}mustUnderstand', 'true')
    messaging.set(f'{{{NS_WSU}}}Id', 'messaging')   # signed reference target

    signal_msg = etree.SubElement(messaging, f'{{{NS_EBMS3}}}SignalMessage')

    msg_info = etree.SubElement(signal_msg, f'{{{NS_EBMS3}}}MessageInfo')
    ts_el = etree.SubElement(msg_info, f'{{{NS_EBMS3}}}Timestamp')
    ts_el.text = timestamp
    mid_el = etree.SubElement(msg_info, f'{{{NS_EBMS3}}}MessageId')
    mid_el.text = receipt_message_id
    ref_el = etree.SubElement(msg_info, f'{{{NS_EBMS3}}}RefToMessageId')
    ref_el.text = original_message_id

    receipt = etree.SubElement(signal_msg, f'{{{NS_EBMS3}}}Receipt')

    # NonRepudiationInformation — echo the full ds:Reference elements (with
    # digests) from the original message's signature.
    nri = etree.SubElement(
        receipt,
        '{http://docs.oasis-open.org/ebxml-bp/ebbp-signals-2.0}NonRepudiationInformation',
    )
    for ref in received_references:
        msg_part_nri = etree.SubElement(
            nri,
            '{http://docs.oasis-open.org/ebxml-bp/ebbp-signals-2.0}MessagePartNRInformation',
        )
        if isinstance(ref, str):
            # Backwards-compat: bare URI string.
            r = etree.SubElement(msg_part_nri, f'{{{NS_DS}}}Reference')
            r.set('URI', ref)
        else:
            # Deep-copied ds:Reference element from the original SignedInfo.
            msg_part_nri.append(copy.deepcopy(ref))

    # WS-Security placeholder so the receipt can be signed by our AP (PEPPOL
    # requires the AS4 Receipt SignalMessage to be signed for non-repudiation).
    security = etree.SubElement(header, f'{{{NS_WSSE}}}Security')
    security.set(f'{{{NS_SOAP12}}}mustUnderstand', 'true')

    body = etree.SubElement(envelope, f'{{{NS_SOAP12}}}Body')
    body.set(f'{{{NS_WSU}}}Id', 'body')

    return envelope


def envelope_to_bytes(envelope: etree._Element) -> bytes:
    return etree.tostring(
        envelope,
        pretty_print=False,
        xml_declaration=True,
        encoding='UTF-8',
    )
