# ALL DATA IS SYNTHETIC — this is a method demonstration.
from cascade import SEGMENTS, cascade_for_day, cascade_week
from database import TODAY


def test_week_covers_horizon_and_every_segment():
    week = cascade_week()
    assert len(week) == 7 and week[0]["date"] == TODAY.isoformat()
    for day in week:
        assert [s["id"] for s in day["segments"]] == list(SEGMENTS)
        for s in day["segments"]:
            assert 0 <= s["volume"] <= day["transport_total"]


def test_tourist_mix_converts_more_than_commuters():
    # every foreign nationality converts to the park at a higher rate than domestic commuters
    park = SEGMENTS["theme_park"]["rate_by_nat"]
    assert all(rate > park["IN"] for nat, rate in park.items() if nat != "IN")


def test_volume_scales_with_transport():
    day = cascade_for_day(TODAY)
    bus = next(s for s in day["segments"] if s["id"] == "loop_bus")
    assert bus["volume"] > 0 and bus["capacity_pct"] == round(bus["volume"] / bus["capacity"] * 100, 1)
