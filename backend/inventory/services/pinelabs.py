"""
Pine Labs (Plural) API client.

Handles:
  1. Token generation         – POST /api/auth/v1/token
  2. Bank EMI Offer Discovery  – POST /api/affordability/v1/offer/discovery
  3. Brand EMI Offer Discovery – POST /api/affordability/v1/offer/discovery

Tokens are cached in-memory and refreshed automatically when they expire.
"""

import logging
import time
import uuid
from datetime import datetime, timezone

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class PineLabsAPIError(Exception):
    """Raised when the Pine Labs API returns a non-success response."""

    def __init__(self, status_code: int, detail: dict | str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"PineLabs API error {status_code}: {detail}")


class PineLabsClient:
    """Thin wrapper around Pine Labs Plural REST APIs."""

    # ── class-level token cache ──────────────────────────────────────────
    _access_token: str | None = None
    _token_expires_at: float = 0  # epoch seconds

    def __init__(self):
        self.base_url: str = getattr(settings, "PINELABS_BASE_URL", "https://pluraluat.v2.pinepg.in")
        self.client_id: str = getattr(settings, "PINELABS_CLIENT_ID", "")
        self.client_secret: str = getattr(settings, "PINELABS_CLIENT_SECRET", "")

        if not self.client_id or not self.client_secret:
            raise ValueError(
                "PINELABS_CLIENT_ID and PINELABS_CLIENT_SECRET must be set in Django settings."
            )

    # ── helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _request_headers(bearer_token: str | None = None) -> dict:
        """Build the common headers required by every Pine Labs API call."""
        headers = {
            "accept": "application/json",
            "Content-Type": "application/json",
            "Request-ID": str(uuid.uuid4()),
            "Request-Timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") 
                                 + f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z",
        }
        if bearer_token:
            headers["Authorization"] = f"Bearer {bearer_token}"
        return headers

    # ── 1. Token generation ─────────────────────────────────────────────

    def _generate_token(self) -> str:
        """
        Call POST /api/auth/v1/token and return the access_token string.
        Caches the token so repeated calls don't hit the API.
        """
        # Return cached token if still valid (with a 60-second safety buffer)
        if PineLabsClient._access_token and time.time() < (PineLabsClient._token_expires_at - 60):
            return PineLabsClient._access_token

        url = f"{self.base_url}/api/auth/v1/token"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
        }

        logger.info("Requesting new Pine Labs access token …")
        response = requests.post(url, json=payload, headers=self._request_headers(), timeout=30)

        if response.status_code != 200:
            raise PineLabsAPIError(response.status_code, response.text)

        data = response.json()
        token = data.get("access_token") or data.get("token")
        expires_in = int(data.get("expires_in", 3600))  # default 1 h

        if not token:
            raise PineLabsAPIError(response.status_code, "No access_token in response")

        # Cache the token
        PineLabsClient._access_token = token
        PineLabsClient._token_expires_at = time.time() + expires_in

        logger.info("Pine Labs token acquired, expires in %s s", expires_in)
        return token

    def get_token(self) -> str:
        """Public accessor — returns a (possibly cached) bearer token."""
        return self._generate_token()

    # ── 2. Bank EMI Offer Discovery ─────────────────────────────────────

    def discover_offers(
        self,
        order_amount_value: int,
        currency: str = "INR",
        bin: str = "",
        card_number: str = "",
        customer_id: str = "",
    ) -> dict:
        """
        Bank EMI — POST /api/affordability/v1/offer/discovery.

        Does NOT send product_details; the bank determines the EMI terms
        based solely on the order amount, card BIN, and customer.

        Parameters
        ----------
        order_amount_value : int
            Amount in the smallest currency unit (e.g. paise for INR).
        currency : str
            ISO 4217 currency code (default ``"INR"``).
        bin : str
            First 6-8 digits of the card (issuer BIN).
        card_number : str
            Full card number (may be masked depending on Pine Labs config).
        customer_id : str
            Unique customer identifier.

        Returns
        -------
        dict
            The full JSON response from Pine Labs.
        """
        token = self._generate_token()
        url = f"{self.base_url}/api/affordability/v1/offer/discovery"

        payload: dict = {
            "order_amount": {
                "currency": currency,
                "value": order_amount_value,
            },
        }

        # Optional sections — only include if provided
        if bin:
            payload["issuer"] = {"bin": bin}

        if card_number:
            payload["payment_option"] = {
                "card_details": {
                    "card_number": card_number,
                }
            }

        if customer_id:
            payload["customer_details"] = {
                "customer_id": customer_id,
            }

        headers = self._request_headers(bearer_token=token)
        headers["Accept-Encoding"] = "gzip"

        logger.info("Calling Pine Labs Offer Discovery for amount=%s %s", order_amount_value, currency)
        response = requests.post(url, json=payload, headers=headers, timeout=30)

        if response.status_code != 200:
            raise PineLabsAPIError(response.status_code, response.text)

        return response.json()

    # ── 3. Brand EMI Offer Discovery ─────────────────────────────────────

    def discover_brand_offers(
        self,
        order_amount_value: int,
        product_details: list[dict],
        currency: str = "INR",
        cart_coupon_discount_value: int | None = None,
        bin: str = "",
        card_number: str = "",
        customer_id: str = "",
    ) -> dict:
        """
        Brand EMI — POST /api/affordability/v1/offer/discovery.

        Unlike bank EMI, this includes ``product_details`` (per-product
        amounts and coupon discounts) and an optional
        ``cart_coupon_discount_amount``.  The response structure also
        differs from bank EMI.

        Parameters
        ----------
        order_amount_value : int
            Total order amount in the smallest currency unit (paise).
        product_details : list[dict]
            Each dict must contain:
              - product_code : str
              - product_amount : {"currency": str, "value": int}
              - product_coupon_discount_amount : {"currency": str, "value": int}
        currency : str
            ISO 4217 currency code (default ``"INR"``).
        cart_coupon_discount_value : int | None
            Cart-level coupon discount in smallest currency unit.
        bin : str
            First 6-8 digits of the card (issuer BIN).
        card_number : str
            Full card number.
        customer_id : str
            Unique customer identifier.

        Returns
        -------
        dict
            The full JSON response from Pine Labs.
        """
        token = self._generate_token()
        url = f"{self.base_url}/api/affordability/v1/offer/discovery"

        payload: dict = {
            "order_amount": {
                "currency": currency,
                "value": order_amount_value,
            },
            "product_details": product_details,
        }

        # Cart-level coupon discount — only include if provided
        if cart_coupon_discount_value is not None:
            payload["cart_coupon_discount_amount"] = {
                "currency": currency,
                "value": cart_coupon_discount_value,
            }

        # Optional sections — same as bank EMI
        if bin:
            payload["issuer"] = {"bin": bin}

        if card_number:
            payload["payment_option"] = {
                "card_details": {
                    "card_number": card_number,
                }
            }

        if customer_id:
            payload["customer_details"] = {
                "customer_id": customer_id,
            }

        headers = self._request_headers(bearer_token=token)
        headers["Accept-Encoding"] = "gzip"

        logger.info(
            "Calling Pine Labs Brand EMI Offer Discovery for amount=%s %s, products=%s",
            order_amount_value, currency, len(product_details),
        )
        response = requests.post(url, json=payload, headers=headers, timeout=30)

        if response.status_code != 200:
            raise PineLabsAPIError(response.status_code, response.text)

        return response.json()
