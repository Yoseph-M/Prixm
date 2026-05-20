"""
Currency normalization to USD.

Live rates from exchangerate.host (no API key required), cached in Redis under
`fx:rates` with a 12h TTL. On network failure we fall back to a small static
table so the prototype never blocks on FX.
"""
from __future__ import annotations
import httpx
from .redis_client import jget, jset

FX_CACHE_KEY = "fx:rates"
FX_CACHE_TTL = 12 * 60 * 60  # 12 hours

# Static fallback (rates per 1 USD, approximate). Used only if network fails
# AND nothing is cached. Keeps the demo functional offline.
_FALLBACK = {
    "USD": 1.0, "EUR": 1.08, "GBP": 1.27, "JPY": 0.0064,
    "INR": 0.012, "CAD": 0.73, "AUD": 0.66, "CHF": 1.10,
    "SEK": 0.094, "BRL": 0.18,
}


async def _fetch_rates() -> dict[str, float]:
    """Returns a dict mapping CURRENCY -> value of 1 unit in USD."""
    cached = await jget(FX_CACHE_KEY)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("https://api.exchangerate.host/latest", params={"base": "USD"})
            r.raise_for_status()
            data = r.json()
            # The API returns rates expressing "1 USD = X CUR". We want the
            # inverse: how many USD is 1 CUR worth.
            rates = {cur: (1.0 / rate) for cur, rate in data["rates"].items() if rate}
            rates["USD"] = 1.0
            await jset(FX_CACHE_KEY, rates, ex=FX_CACHE_TTL)
            return rates
    except Exception:
        return _FALLBACK


async def to_usd(amount: float, currency: str) -> float:
    if currency.upper() == "USD":
        return round(amount, 2)
    rates = await _fetch_rates()
    rate = rates.get(currency.upper()) or _FALLBACK.get(currency.upper(), 1.0)
    return round(amount * rate, 2)
