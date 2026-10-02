import json
from pathlib import Path

from pipeline import build, classify, scoring, sentiment, sources

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "pipeline" / "fixtures"


def test_wilson_examples_match_requirements_doc():
    # 기능요구사항 FR-03 표의 예시값
    assert scoring.wilson_lower_bound(80, 100) == 0.7112
    assert scoring.wilson_lower_bound(9, 10) == 0.5958
    assert scoring.wilson_lower_bound(3, 3) == 0.4385
    assert scoring.wilson_lower_bound(0, 0) == 0.0


def test_preschool_filter():
    assert classify.preschool_level("예능(대)", "해님유아미술학원", "유아미술") == "전문"
    assert classify.preschool_level("예능(대)", "도레미피아노", "피아노") == "가능"
    assert classify.preschool_level("입시.검정 및 보습", "수능완성학원", "고등수학") is None
    assert classify.preschool_level("입시.검정 및 보습", "한글쑥쑥", "유아한글") == "전문"
    assert classify.preschool_level("입시.검정 및 보습", "바른수학", "초등수학") is None
    assert classify.preschool_level("직업기술", "성인요리학원", "조리") is None


def test_fields_multi():
    assert classify.classify_fields("점프음악줄넘기학원", "음악줄넘기") == ["음악", "체육"]
    assert classify.classify_fields("스마일어학원", "", "국제화") == ["영어"]
    assert classify.classify_fields("무지개학원", "종합") == ["기타"]


def test_fee_parse():
    assert classify.parse_fees("초등수학:180000, 중등수학:230000") == [
        {"name": "초등수학", "won": 180000}, {"name": "중등수학", "won": 230000}]
    assert classify.parse_fees("") == []


def test_sentiment_basic_and_negation():
    assert sentiment.sentence_polarity("선생님이 정말 친절해요") == 1
    assert sentiment.sentence_polarity("선생님이 친절하지 않아요") == -1
    assert sentiment.sentence_polarity("셔틀 시간이 자주 바뀌어서 불편했어요") == -1
    r = sentiment.analyze_review("선생님이 친절하고 꼼꼼해요. 셔틀 시간이 자주 바뀌어서 불편했어요.")
    assert r["aspects"]["강사"] > 0 and r["aspects"]["안전·차량"] < 0


def test_sponsored_excluded():
    rs = [sentiment.analyze_review("좋아요 추천합니다. 원고료를 받아 작성"), sentiment.analyze_review("좋아요")]
    agg = sentiment.aggregate(rs)
    assert agg["sponsored"] == 1 and agg["pos"] == 1


def test_dong_parse():
    assert build.dong_of("301-201호(단계동)", "강원특별자치도 원주시 백간길 75") == "단계동"
    assert build.dong_of(None, "강원특별자치도 원주시 무실동 100") == "무실동"


def test_dojo_csv_filter():
    rows = sources.read_dojo_csv((FIX / "sample_dojo.csv").read_text(encoding="utf-8-sig"))
    names = [r["name"] for r in rows]
    assert names == ["샘플 바른태권도장", "샘플 용감한키즈태권도"]  # 폐업·타 지역 제외


def test_build_on_fixture(tmp_path):
    out = tmp_path / "a.json"
    assert build.main(["--fixture", str(FIX / "sample_sources.json"), "--dojo", str(FIX / "sample_dojo.csv"),
                       "--overrides", str(FIX / "sample_overrides.csv"), "--out", str(out)]) == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    names = [a["name"] for a in data["academies"]]
    assert not any(n in names for n in ["샘플 수능완성입시학원", "샘플 성인요리학원", "샘플 폐원미술학원"])
    dojo = next(a for a in data["academies"] if a["name"] == "샘플 용감한키즈태권도")
    assert dojo["fields"] == ["체육"] and dojo["preschool"] == "전문" and dojo["dong"] == "단계동"
    art = next(a for a in data["academies"] if a["name"] == "샘플 햇살유아미술학원")
    assert art["tel"] and art["consult"]["kakao"] and art["consult"]["hours"]
    assert data["meta"]["sample"] is True and data["sampleReviews"]
    assert "naver" not in json.dumps(data["meta"], ensure_ascii=False).lower()
