"""v1 감성분석: 사전·규칙 기반 속성별(ABSA) 분석.

v2에서 KcELECTRA 등 파인튜닝 모델로 교체할 수 있도록 `analyze_review()` 인터페이스만 유지한다.
블로그 검색 API가 주는 요약 스니펫(약 1–3문장)에서도 동작하도록 짧은 텍스트 기준으로 설계했다.
"""
from __future__ import annotations

import html
import re

from . import config

_TAG_RE = re.compile(r"<[^>]+>")
_SENT_SPLIT = re.compile(r"(?<=[.!?。…~])\s+|(?<=[다요죠네음함])[.!?]?\s+|\n+")


def clean(text: str) -> str:
    return html.unescape(_TAG_RE.sub("", text or "")).strip()


def split_sentences(text: str) -> list[str]:
    cleaned = clean(text)
    parts = [p.strip() for p in _SENT_SPLIT.split(cleaned) if p and p.strip()]
    kept = [p for p in parts if len(p) >= 4]
    # 아주 짧은 후기('좋아요')도 버리지 않는다
    return kept or ([cleaned] if cleaned else [])


def is_sponsored(text: str) -> bool:
    t = clean(text)
    return any(m in t for m in config.SPONSORED_MARKERS)


def _negated(sentence: str, idx: int, word_len: int) -> bool:
    """단어 바로 뒤 6글자 안에 부정어가 오면 극성 반전 (예: '친절하지 않아요')."""
    tail = sentence[idx + word_len: idx + word_len + 6]
    return any(n in tail for n in config.NEGATORS)


def sentence_polarity(sentence: str) -> int:
    """+1 긍정 / -1 부정 / 0 중립."""
    score = 0
    for w in config.POSITIVE_WORDS:
        i = sentence.find(w)
        if i >= 0:
            score += -1 if _negated(sentence, i, len(w)) else 1
    for w in config.NEGATIVE_WORDS:
        i = sentence.find(w)
        if i >= 0:
            # '걱정 없이' 같은 부정의 부정은 긍정
            score += 1 if _negated(sentence, i, len(w)) else -1
    return (score > 0) - (score < 0)


def sentence_aspects(sentence: str) -> list[str]:
    return [a for a, kws in config.ASPECTS.items() if any(k in sentence for k in kws)]


def analyze_review(text: str) -> dict:
    """후기 1건 분석 결과.

    {'polarity': +1/0/-1, 'aspects': {속성: +1/-1 합계}, 'sponsored': bool}
    """
    sentences = split_sentences(text)
    total = 0
    aspects: dict[str, int] = {}
    for s in sentences:
        p = sentence_polarity(s)
        total += p
        if p == 0:
            continue
        for a in sentence_aspects(s):
            aspects[a] = aspects.get(a, 0) + p
    return {
        "polarity": (total > 0) - (total < 0),
        "aspects": aspects,
        "sponsored": is_sponsored(text),
    }


def aggregate(reviews: list[dict]) -> dict:
    """후기 목록(analyze_review 결과 + 메타) → 학원 단위 집계. 광고·협찬은 n에서 제외."""
    pos = neg = neu = sponsored = 0
    aspect_counts: dict[str, dict[str, int]] = {}
    for r in reviews:
        if r["sponsored"]:
            sponsored += 1
            continue
        if r["polarity"] > 0:
            pos += 1
        elif r["polarity"] < 0:
            neg += 1
        else:
            neu += 1
        for a, v in r["aspects"].items():
            c = aspect_counts.setdefault(a, {"pos": 0, "neg": 0})
            if v > 0:
                c["pos"] += 1
            elif v < 0:
                c["neg"] += 1
    return {"pos": pos, "neg": neg, "neu": neu, "sponsored": sponsored, "aspects": aspect_counts}
