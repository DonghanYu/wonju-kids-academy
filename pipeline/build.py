"""원주 유아 학원 데이터 빌드 (v1.1 — 공공데이터만 사용).

사용법:
    # 실데이터: NEIS 인증키 + 체육도장업 CSV(data/raw/dojo/*.csv)
    NEIS_API_KEY=... python -m pipeline.build

    # 오프라인 개발용 가상 샘플
    python -m pipeline.build --fixture pipeline/fixtures/sample_sources.json \
        --dojo pipeline/fixtures/sample_dojo.csv --overrides pipeline/fixtures/sample_overrides.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from . import classify, config, sources

KST = timezone(timedelta(hours=9))
ROOT = Path(__file__).resolve().parent.parent
OVERRIDES = ROOT / "pipeline" / "overrides.csv"
DOJO_DIR = ROOT / "data" / "raw" / "dojo"


def norm(name: str) -> str:
    n = (name or "").lower()
    n = re.sub(r"\(.*?\)|\[.*?\]", "", n)
    return re.sub(r"[\s·.\-_]", "", n)


def dong_of(detail: str | None, address: str | None) -> str:
    m = re.search(r"\(([^()]*?(동|읍|면))[,)]", (detail or "") + ")")
    if m:
        return m.group(1).split(",")[0].strip()
    m = re.search(r"원주시\s+(\S+(읍|면|동))", address or "")
    return m.group(1) if m else ""


# ── 1. NEIS 행 → 기관 레코드 ─────────────────────────────────────
def academies_from_neis(rows: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in rows:
        if (r.get("REG_STTUS_NM") or "").strip() != "개원":
            continue
        name = (r.get("ACA_NM") or "").strip()
        courses = " ".join(filter(None, [r.get("LE_ORD_NM"), r.get("LE_CRSE_LIST_NM"), r.get("LE_CRSE_NM")]))
        realm = r.get("REALM_SC_NM") or ""
        level = classify.preschool_level(realm, name, courses)
        if level is None:
            continue
        aid = f"n-{r.get('ACA_ASNUM')}"
        fees = classify.parse_fees(r.get("PSNBY_THCC_CNTNT")) if r.get("THCC_OTHBC_YN") == "Y" else []
        rec = out.get(aid)
        if rec:  # 같은 학원의 추가 과정 행 병합
            rec["courses"] = sorted(set(rec["courses"]) | {c for c in [r.get("LE_CRSE_LIST_NM")] if c})
            rec["fee"]["items"].extend(fees)
            rec["fields"] = sorted(set(rec["fields"]) | set(classify.classify_fields(name, courses, realm)), key=config.FIELDS.index)
            if level == "전문":
                rec["preschool"] = "전문"
            continue
        out[aid] = {
            "id": aid,
            "name": name,
            "kind": (r.get("ACA_INSTI_SC_NM") or "학원").strip(),
            "realm": realm,
            "courses": [c for c in [r.get("LE_CRSE_LIST_NM")] if c],
            "fields": classify.classify_fields(name, courses, realm),
            "preschool": level,
            "address": " ".join(filter(None, [r.get("FA_RDNMA"), (r.get("FA_RDNDA") or "").strip()])),
            "dong": dong_of(r.get("FA_RDNDA"), r.get("FA_RDNMA")),
            "tel": (r.get("FA_TELNO") or "").strip(),
            "capacity": r.get("TOFOR_SMTOT"),
            "fee": {"public": r.get("THCC_OTHBC_YN") == "Y", "items": fees},
            "source": "교육청 학원교습소정보",
        }
    return out


# ── 2. 체육도장업 → 기관 레코드 ───────────────────────────────────
def records_from_dojo(rows: list[dict], known: set[str]) -> dict[str, dict]:
    out = {}
    for d in rows:
        if norm(d["name"]) in known:
            continue
        known.add(norm(d["name"]))
        blob = f"{d['name']} {d['category']}"
        fields = classify.classify_fields(d["name"], d["category"])
        if "체육" not in fields:
            fields = ["체육", *[f for f in fields if f != "기타"]]
        out[f"d-{d['id']}"] = {
            "id": f"d-{d['id']}",
            "name": d["name"],
            "kind": "체육도장",
            "realm": d["category"],
            "courses": [],
            "fields": sorted(set(fields), key=config.FIELDS.index),
            "preschool": "전문" if any(k in blob.lower() for k in config.PRESCHOOL_STRONG) else "가능",
            "address": d["address"],
            "dong": dong_of(None, d.get("jibun") or d["address"]),
            "tel": d["tel"],
            "capacity": None,
            "fee": {"public": False, "items": []},
            "source": "행정안전부 체육도장업 인허가",
        }
    return out


# ── 3. 수동 보완 (상담 시간·채널) ──────────────────────────────────
def load_overrides(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        return {row["id"]: row for row in csv.DictReader(f) if row.get("id")}


def apply_overrides(rec: dict, ov: dict | None) -> None:
    consult = {"hours": "", "kakao": "", "naverTalk": "", "homepage": "", "checked": ""}
    if ov:
        for k_csv, k in [("hours", "hours"), ("kakao", "kakao"), ("naver_talk", "naverTalk"),
                         ("homepage", "homepage"), ("checked", "checked")]:
            if ov.get(k_csv):
                consult[k] = ov[k_csv].strip()
        if ov.get("tel"):
            rec["tel"] = ov["tel"].strip()
    rec["consult"] = consult


def build(neis_rows: list[dict], dojo_rows: list[dict], overrides_path: Path = OVERRIDES) -> dict:
    recs = academies_from_neis(neis_rows)
    recs.update(records_from_dojo(dojo_rows, {norm(r["name"]) for r in recs.values()}))
    ovs = load_overrides(Path(overrides_path))
    for rec in recs.values():
        apply_overrides(rec, ovs.get(rec["id"]))
    items = sorted(recs.values(), key=lambda r: (r["preschool"] != "전문", r["name"]))
    return {
        "meta": {
            "generatedAt": datetime.now(KST).isoformat(timespec="minutes"),
            "region": "강원특별자치도 원주시",
            "count": len(items),
            "counts": {
                "academy": sum(1 for r in items if r["source"].startswith("교육청")),
                "dojo": sum(1 for r in items if r["kind"] == "체육도장"),
            },
            "sources": ["교육청 학원교습소정보(NEIS)", "행정안전부 생활_체육도장업"],
            "sentiment": "v1 사전·규칙 기반 속성별 감성분석 (앱에서 작성한 후기 기준)",
        },
        "academies": items,
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "web" / "data" / "academies.json"))
    ap.add_argument("--fixture", help="NEIS 대신 사용할 fixture JSON")
    ap.add_argument("--dojo", nargs="*", help="체육도장업 CSV 경로 (기본: data/raw/dojo/*.csv)")
    ap.add_argument("--overrides", default=str(OVERRIDES))
    args = ap.parse_args(argv)

    if args.fixture:
        neis_rows = json.loads(Path(args.fixture).read_text(encoding="utf-8"))["neis"]
    else:
        key = os.environ.get("NEIS_API_KEY", "")
        if not key:
            print("환경변수 NEIS_API_KEY가 없습니다.", file=sys.stderr)
            return 2
        neis_rows = sources.fetch_neis_academies(key)

    dojo_paths = [Path(p) for p in args.dojo] if args.dojo is not None else sorted(DOJO_DIR.glob("*.csv"))
    dojo_rows = sources.load_dojo(dojo_paths, os.environ.get("DOJO_CSV_URL", ""))
    if not dojo_rows:
        print("경고: 체육도장업 데이터가 없어 태권도장 등이 빠집니다 (data/raw/dojo/*.csv).", file=sys.stderr)

    data = build(neis_rows, dojo_rows, Path(args.overrides))
    if args.fixture:
        data["meta"]["sample"] = True
        rv = Path(args.fixture).with_name("sample_reviews.json")
        if rv.exists():  # 데모 화면용 가상 후기 (실데이터 빌드에는 포함되지 않음)
            data["sampleReviews"] = json.loads(rv.read_text(encoding="utf-8"))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    c = data["meta"]["counts"]
    print(f"{data['meta']['count']}곳 (학원·교습소 {c['academy']}, 체육도장 {c['dojo']}) → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
