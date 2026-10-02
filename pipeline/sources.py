"""외부 데이터 소스 어댑터 — 이용 제한이 없는 공공데이터만 사용한다.

- 교육청 NEIS 학원교습소정보 (acaInsTiInfo): 인증키 필요. 키 없이 호출하면 5건만 반환된다.
- 행정안전부 생활_체육도장업 (공공데이터포털 파일데이터, CSV): 태권도장 등. 이용허락 제한 없음.

네이버 검색 API는 2026-09 약관 개정(결과 저장·캐싱·가공 제한 보도)으로 사용하지 않는다.
"""
from __future__ import annotations

import csv
import io
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

from . import config

NEIS_URL = "https://open.neis.go.kr/hub/acaInsTiInfo"
USER_AGENT = "wonju-kids-academy/1.1"


def _get(url: str, retries: int = 3) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except Exception:  # noqa: BLE001 — 네트워크 재시도
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    return b""


# ── NEIS ─────────────────────────────────────────────────────────
def fetch_neis_academies(api_key: str, page_size: int = 1000) -> list[dict]:
    """원주시 학원·교습소 전체 행을 페이지 단위로 가져온다."""
    rows: list[dict] = []
    page = 1
    while True:
        qs = urllib.parse.urlencode({
            "KEY": api_key, "Type": "json", "pIndex": page, "pSize": page_size,
            "ATPT_OFCDC_SC_CODE": config.NEIS_OFFICE_CODE, "ADMST_ZONE_NM": config.REGION_NAME,
        })
        data = json.loads(_get(f"{NEIS_URL}?{qs}").decode("utf-8"))
        body = data.get("acaInsTiInfo")
        if not body:
            result = data.get("RESULT", {})
            if result.get("CODE") not in (None, "INFO-200"):
                raise RuntimeError(f"NEIS 오류: {result}")
            break
        total = body[0]["head"][0]["list_total_count"]
        batch = body[1]["row"]
        rows.extend(batch)
        if len(rows) >= total or not batch:
            break
        page += 1
    if len(rows) <= 5:
        raise RuntimeError("NEIS가 5건 이하만 반환했습니다. 인증키(NEIS_API_KEY)를 확인하세요.")
    return rows


# ── 체육도장업 CSV ─────────────────────────────────────────────────
def _decode(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _pick(row: dict, *names: str) -> str:
    """CSV 컬럼명이 배포본마다 조금씩 달라 후보 이름을 차례로 찾는다."""
    for n in names:
        for k, v in row.items():
            if k and k.replace(" ", "").strip() == n and v:
                return v.strip()
    return ""


def read_dojo_csv(text: str) -> list[dict]:
    """행정안전부 생활_체육도장업 CSV → 원주시·영업 중 행만 표준화."""
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        addr = _pick(row, "도로명전체주소", "도로명주소", "소재지전체주소", "지번주소")
        if config.REGION_NAME not in addr:
            continue
        status = _pick(row, "영업상태명", "상세영업상태명", "영업상태")
        if status and not (status.startswith("영업") or status == "정상"):
            continue
        name = _pick(row, "사업장명", "업소명", "상호명")
        if not name:
            continue
        out.append({
            "id": _pick(row, "관리번호", "개방자치단체코드") or name,
            "name": name,
            "address": addr,
            "jibun": _pick(row, "소재지전체주소", "지번주소"),
            "tel": _pick(row, "소재지전화", "전화번호", "소재지전화번호"),
            "category": _pick(row, "업태구분명", "개방서비스명") or "체육도장업",
        })
    return out


def load_dojo(paths: list[Path], url: str = "") -> list[dict]:
    texts = [_decode(p.read_bytes()) for p in paths]
    if url:
        texts.append(_decode(_get(url)))
    rows: list[dict] = []
    for t in texts:
        rows.extend(read_dojo_csv(t))
    return rows
