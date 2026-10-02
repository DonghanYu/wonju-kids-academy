"""학원 분류: 유아 대상 여부(FR 범위) + 앱 분야(FR-01) + 교습비 파싱(FR-04)."""
from __future__ import annotations

import re

from . import config


def _text(*parts: str | None) -> str:
    return " ".join(p for p in parts if p).lower()


def preschool_level(realm: str, name: str, courses: str) -> str | None:
    """유아 대상 판정.

    반환: "전문" (명칭·과정에 유아 키워드) / "가능" (예체능·외국어 등 유아 수강 가능 분야) / None (제외)
    """
    blob = _text(name, courses)
    if any(k.lower() in blob for k in config.EXCLUDE_KEYWORDS):
        # 유아 키워드가 명시되면 제외 단어보다 우선 (예: '유아 요리 교실')
        if not any(k.lower() in blob for k in config.PRESCHOOL_STRONG):
            return None
    strong = any(k.lower() in blob for k in config.PRESCHOOL_STRONG)
    if strong:
        return "전문"
    realm = realm or ""
    if any(r in realm for r in config.REALM_NEEDS_STRONG):
        return None
    if any(r in realm for r in config.REALM_OPEN_TO_PRESCHOOL):
        return "가능"
    # 분야 정보가 없으면 과정·명칭으로 예체능/영어 여부를 본다
    if classify_fields(name, courses, realm) != ["기타"]:
        return "가능"
    return None


def classify_fields(name: str, courses: str, realm: str = "", extra: str = "") -> list[str]:
    """FR-01: 한 기관이 여러 분야에 속할 수 있다. 매핑이 안 되면 ['기타']."""
    blob = _text(name, courses, extra)
    fields = [f for f, kws in config.FIELD_KEYWORDS.items() if any(k.lower() in blob for k in kws)]
    if not fields and realm:
        if "국제화" in realm or "외국어" in realm:
            fields = ["영어"]
    return fields or ["기타"]


_FEE_RE = re.compile(r"([^:,]+?)\s*:\s*([\d,]+)")


def parse_fees(raw: str | None) -> list[dict]:
    """NEIS PSNBY_THCC_CNTNT ('초등수학:180000, 중등수학:230000') → [{'name','won'}]."""
    if not raw:
        return []
    out = []
    for name, won in _FEE_RE.findall(raw):
        try:
            value = int(won.replace(",", ""))
        except ValueError:
            continue
        if value > 0:
            out.append({"name": name.strip().strip("."), "won": value})
    return out
