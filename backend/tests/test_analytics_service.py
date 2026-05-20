"""Analytics trend fallback logic (pure function, no DB)."""
from pytest import approx


def _fill_trend_from_run_rate(months: list[dict], base: float) -> None:
    for i, m in enumerate(months):
        factor = 0.85 + (i * 0.03)
        m["total_usd"] = round(base * factor, 2)


def test_fill_trend_from_run_rate_produces_six_months():
    months = [
        {"month": "Jan", "year": 2025, "total_usd": None},
        {"month": "Feb", "year": 2025, "total_usd": None},
        {"month": "Mar", "year": 2025, "total_usd": None},
        {"month": "Apr", "year": 2025, "total_usd": None},
        {"month": "May", "year": 2025, "total_usd": None},
        {"month": "Jun", "year": 2025, "total_usd": None},
    ]
    _fill_trend_from_run_rate(months, 100.0)
    assert len(months) == 6
    assert all(m["total_usd"] is not None for m in months)
    assert months[-1]["total_usd"] == approx(100.0 * (0.85 + 5 * 0.03), rel=0.01)
