"""
eSewa ePay v2 integration :- sandbox (EPAYTEST) credentials for now.
Swap ESEWA_PRODUCT_CODE / ESEWA_SECRET_KEY / the two URLs for real
merchant values later
"""
import base64
import hashlib
import hmac
import json

ESEWA_PRODUCT_CODE = "EPAYTEST"
ESEWA_SECRET_KEY = "8gBm/:&EnhH.1/q"  # eSewa's published sandbox test secret

ESEWA_FORM_URL = "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
ESEWA_STATUS_CHECK_URL = "https://rc.esewa.com.np/api/epay/transaction/status/"


def build_signature(total_amount, transaction_uuid, product_code=ESEWA_PRODUCT_CODE):
    message = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={product_code}"
    digest = hmac.new(ESEWA_SECRET_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def build_payment_form_fields(payment, success_url, failure_url):
    """Returns the exact fields the frontend auto-submits to ESEWA_FORM_URL."""
    amount = str(payment.amount)
    transaction_uuid = str(payment.transaction_uuid)
    signature = build_signature(amount, transaction_uuid)

    return {
        "amount": amount,
        "tax_amount": "0",
        "total_amount": amount,
        "transaction_uuid": transaction_uuid,
        "product_code": ESEWA_PRODUCT_CODE,
        "product_service_charge": "0",
        "product_delivery_charge": "0",
        "success_url": success_url,
        "failure_url": failure_url,
        "signed_field_names": "total_amount,transaction_uuid,product_code",
        "signature": signature,
    }


def decode_esewa_response(encoded_data):
    """eSewa redirects to success_url with ?data=<base64 JSON>."""
    decoded_bytes = base64.b64decode(encoded_data)
    return json.loads(decoded_bytes.decode("utf-8"))


def verify_esewa_signature(response_data):
    """
    Recomputes the signature over the fields eSewa says it signed and
    compares against what was sent back.
    """
    signed_fields = response_data.get("signed_field_names", "").split(",")
    message = ",".join(f"{field}={response_data.get(field, '')}" for field in signed_fields)
    expected_digest = hmac.new(ESEWA_SECRET_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    expected_signature = base64.b64encode(expected_digest).decode("utf-8")
    return hmac.compare_digest(expected_signature, response_data.get("signature", ""))