"""FR-03 추천순 점수: 윌슨 점수 하한 (긍정 비율 + 후기 수를 함께 반영)."""
from __future__ import annotations

from math import sqrt

from . import config


def wilson_lower_bound(pos: int, n: int, z: float = config.WILSON_Z) -> float:
    if n <= 0:
        return 0.0
    p = pos / n
    denom = 1 + z * z / n
    centre = p + z * z / (2 * n)
    margin = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return round((centre - margin) / denom, 4)
