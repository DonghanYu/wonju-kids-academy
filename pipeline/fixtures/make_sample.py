"""가상 샘플 fixture 생성기 — 실제 학원이 아닌 데모·테스트 전용 데이터.

모든 기관명에 '샘플'을 붙이고 전화번호는 033-000-XXXX(미사용 국번)로 만든다.
"""
import csv
import json
import random
from pathlib import Path

random.seed(7)
OUT = Path(__file__).with_name("sample_sources.json")
DOJO = Path(__file__).with_name("sample_dojo.csv")
REV = Path(__file__).with_name("sample_reviews.json")

DONGS = ["단계동", "무실동", "반곡관설동", "지정면", "명륜2동", "단구동", "태장2동", "우산동"]

# (이름, 분야명, 교습과정, 공개교습비, 상태)
NEIS = [
    ("샘플 햇살유아미술학원", "예능(대)", "유아미술", "유아미술:150000", "개원"),
    ("샘플 꿈틀키즈아트교습소", "예능(대)", "미술", "미술:130000", "개원"),
    ("샘플 도레미피아노학원", "예능(대)", "피아노", "피아노:140000", "개원"),
    ("샘플 리틀뮤직학원", "예능(대)", "음악", "", "개원"),
    ("샘플 키즈잉글리시어학원", "국제화", "유아영어", "유아영어:620000", "개원"),
    ("샘플 스마일영어학원", "국제화", "영어", "초등영어:280000", "개원"),
    ("샘플 한글쑥쑥교습소", "입시.검정 및 보습", "유아한글", "유아한글:120000", "개원"),
    ("샘플 생각나무사고력학원", "입시.검정 및 보습", "유아사고력 수학", "사고력수학:160000", "개원"),
    ("샘플 점프음악줄넘기학원", "예능(대)", "음악줄넘기", "줄넘기:110000", "개원"),
    ("샘플 토끼발레학원", "예능(대)", "유아발레", "발레:150000", "개원"),
    ("샘플 무지개놀이학원", "종합(대)", "유아 놀이 종합", "놀이과정:750000", "개원"),
    ("샘플 코딩키즈학원", "정보", "유아코딩", "코딩:170000", "개원"),
    # 제외되어야 할 행 (테스트용)
    ("샘플 수능완성입시학원", "입시.검정 및 보습", "고등수학", "고등수학:350000", "개원"),
    ("샘플 성인요리학원", "직업기술", "조리", "조리:300000", "개원"),
    ("샘플 폐원미술학원", "예능(대)", "미술", "미술:100000", "폐원"),
]

POS = [
    "선생님이 정말 친절하고 꼼꼼하게 봐주세요.",
    "아이가 수업을 너무 재밌어해서 매일 가고 싶어해요.",
    "시설이 깨끗하고 교실이 밝아서 좋았어요.",
    "셔틀 시간이 정확해서 안심이 됩니다.",
    "상담 때 피드백을 자세히 주셔서 만족합니다.",
    "원비가 합리적이고 가성비가 좋아요.",
    "체험수업 받아보고 바로 등록했어요 추천합니다.",
]
NEG = [
    "셔틀 시간이 자주 바뀌어서 불편했어요.",
    "원비가 좀 비싸서 부담스러워요.",
    "상담 연락이 안 돼서 답답했어요.",
    "교실이 좁고 시끄러운 편이라 아쉬웠어요.",
    "아이가 적응을 못 하고 가기 싫다고 울어요.",
]
SPONSORED = "업체로부터 원고료를 받아 작성한 체험단 후기입니다."

# 학원별 (긍정 후기 수, 부정 후기 수, 협찬 수) — 추천순 차이가 드러나도록 설계
PROFILE = {
    "샘플 햇살유아미술학원": (24, 3, 2),
    "샘플 꿈틀키즈아트교습소": (6, 0, 1),
    "샘플 도레미피아노학원": (14, 4, 0),
    "샘플 리틀뮤직학원": (2, 0, 0),
    "샘플 키즈잉글리시어학원": (30, 9, 3),
    "샘플 스마일영어학원": (5, 5, 0),
    "샘플 한글쑥쑥교습소": (9, 1, 0),
    "샘플 생각나무사고력학원": (11, 2, 1),
    "샘플 점프음악줄넘기학원": (17, 2, 0),
    "샘플 토끼발레학원": (3, 0, 0),
    "샘플 무지개놀이학원": (20, 7, 2),
    "샘플 코딩키즈학원": (0, 0, 0),
    "샘플 바른태권도장": (26, 2, 0),
    "샘플 용감한태권도": (8, 3, 0),
}


def reviews_for(name):
    """데모용 앱 후기(가상). 실제 서비스에서는 사용자가 앱에서 작성한다."""
    p, n, s_ = PROFILE.get(name, (0, 0, 0))
    out = []
    for i in range(p):
        out.append({"rating": random.choice([4, 5, 5]), "text": f"{random.choice(POS)} {random.choice(POS)}", "date": f"2026-{random.randint(1, 9):02d}-{random.randint(1, 28):02d}"})
    for i in range(n):
        out.append({"rating": random.choice([1, 2, 2, 3]), "text": random.choice(NEG), "date": f"2026-{random.randint(1, 9):02d}-{random.randint(1, 28):02d}"})
    for i in range(s_):
        out.append({"rating": 5, "text": f"{random.choice(POS)} {SPONSORED}", "date": "2026-08-01"})
    random.shuffle(out)
    return out


def main():
    neis = []
    for i, (name, realm, course, fee, status) in enumerate(NEIS):
        dong = DONGS[i % len(DONGS)]
        neis.append({
            "ATPT_OFCDC_SC_CODE": "K10", "ADMST_ZONE_NM": "원주시",
            "ACA_INSTI_SC_NM": "교습소" if "교습소" in name else "학원",
            "ACA_ASNUM": f"S{9000 + i}", "ACA_NM": name, "REG_STTUS_NM": status,
            "TOFOR_SMTOT": random.choice([20, 30, 45, 60]), "REALM_SC_NM": realm,
            "LE_ORD_NM": "", "LE_CRSE_LIST_NM": course, "LE_CRSE_NM": course,
            "PSNBY_THCC_CNTNT": fee, "THCC_OTHBC_YN": "Y" if fee else "N",
            "FA_RDNMA": f"강원특별자치도 원주시 샘플로 {10 + i}", "FA_RDNDA": f"2층({dong})",
            "FA_TELNO": f"033-000-{1000 + i}",
        })
    OUT.write_text(json.dumps({"neis": neis}, ensure_ascii=False, indent=1), encoding="utf-8")

    # 행정안전부 생활_체육도장업 CSV 형식(주요 컬럼만) — 원주 영업 2곳, 폐업 1곳, 타 지역 1곳
    rows = [
        ("D001", "샘플 바른태권도장", "영업/정상", "강원특별자치도 원주시 샘플길 1 (무실동)", "강원특별자치도 원주시 무실동 200", "033-000-2000"),
        ("D002", "샘플 용감한키즈태권도", "영업/정상", "강원특별자치도 원주시 샘플길 2 (단계동)", "강원특별자치도 원주시 단계동 201", "033-000-2010"),
        ("D003", "샘플 폐업도장", "폐업", "강원특별자치도 원주시 샘플길 3", "강원특별자치도 원주시 우산동 1", ""),
        ("D004", "샘플 춘천태권도", "영업/정상", "강원특별자치도 춘천시 샘플길 4", "강원특별자치도 춘천시 1", ""),
    ]
    with DOJO.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["관리번호", "사업장명", "영업상태명", "도로명전체주소", "소재지전체주소", "소재지전화", "업태구분명"])
        for r in rows:
            w.writerow([*r, "태권도"])

    names = [r["ACA_NM"] for r in neis] + ["샘플 바른태권도장", "샘플 용감한키즈태권도"]
    ids = [f"n-{r['ACA_ASNUM']}" for r in neis] + ["d-D001", "d-D002"]
    REV.write_text(json.dumps({i: reviews_for(n.replace("키즈", "") if "용감한" in n else n) for i, n in zip(ids, names)}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote fixtures")


if __name__ == "__main__":
    main()
