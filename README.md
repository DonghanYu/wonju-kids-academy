# 원주 아이 학원 찾기 (v1.1)

강원특별자치도 원주시에서 만 5–7세 아이가 다닐 수 있는 학원·교습소·체육도장을 모아 보여 주고, 앱에서 쓴 후기를 감성분석해 정렬하는 모바일 웹입니다.

**v1.1 변경**: 네이버 검색 API를 쓰지 않습니다(2026-09 약관 개정으로 결과 저장·가공 제한 보도). 이용 제한이 없는 공공데이터만 씁니다.

## 데이터

| 데이터 | 출처 | 받는 방법 |
| --- | --- | --- |
| 학원·교습소 (이름, 분야·과정, 전화, 공개 교습비, 정원) | 교육청 NEIS 학원교습소정보 | Open API, 인증키 `NEIS_API_KEY` |
| 태권도장 등 체육도장 | 행정안전부 생활_체육도장업 (공공데이터포털) | CSV를 `data/raw/dojo/`에 올림 |
| 상담 시간·카카오 채널 | 사람이 확인 | `pipeline/overrides.csv` |
| 후기·별점 | 앱 사용자 | 앱에서 작성 (v1.1은 각자 브라우저에 저장) |

네이버 별점·리뷰는 상세 화면의 ‘네이버 지도’ 링크로 넘어가 직접 확인합니다(API 미사용).

## 구조

```
pipeline/   수집·분류 (Python 표준 라이브러리만 사용)
web/        정적 모바일 웹 — GitHub Pages로 배포, 감성분석은 브라우저에서 실행
data/raw/dojo/   체육도장업 CSV를 넣는 곳
tests/      pytest
.github/workflows/refresh.yml   매주 월 03:10(KST) 수집 → 배포
run_local.bat   Windows PC에서 실데이터로 바로 열어 보기
```

## GitHub에 올리기 (서비스 URL 받기)

1. github.com 가입 → 오른쪽 위 **+ → New repository**
   - 이름: `wonju-kids-academy`, **Public** 선택 (무료 Pages 조건)
2. 새 저장소 화면에서 **uploading an existing file** → 압축을 푼 폴더 안의 파일·폴더를 전부 끌어다 놓고 **Commit changes**
   - `.github` 폴더가 빠지지 않았는지 확인하세요.
3. **Settings → Secrets and variables → Actions → New repository secret**
   - Name `NEIS_API_KEY`, Secret에 나이스 인증키
4. **Settings → Pages → Build and deployment → Source: GitHub Actions**
5. 체육도장업 CSV를 `data/raw/dojo/` 폴더에 업로드 (선택, 없으면 태권도장 등이 빠짐)
6. **Actions → 데이터 갱신 및 배포 → Run workflow**
7. 끝나면 서비스 주소: `https://<GitHub 아이디>.github.io/wonju-kids-academy/`

공개 범위: GitHub Pages 주소는 저장소가 비공개여도 인터넷에 공개됩니다. 이 앱은 검색엔진 수집을 막아 두었고(`noindex`, `robots.txt`), 주소를 아는 사람만 들어올 수 있습니다. 화면에 나오는 정보는 모두 공공데이터이고, 인증키는 Secrets에만 있어 노출되지 않습니다.

## 내 PC에서만 열어 보기 (Windows)

Python 3.10 이상이 설치되어 있다면 `run_local.bat`을 더블클릭 → 인증키 입력 → 브라우저가 `http://localhost:8000`으로 열립니다.

## 개발

```bash
python -m pytest -q
python -m pipeline.build --fixture pipeline/fixtures/sample_sources.json \
  --dojo pipeline/fixtures/sample_dojo.csv --overrides pipeline/fixtures/sample_overrides.csv   # 가상 샘플
python -m http.server 8000 --directory web
```

## 확인이 남은 항목

- [ ] 첫 실데이터 빌드 후 `REALM_SC_NM`·교습과정명 고유값을 보고 `pipeline/config.py`의 분야·유아 판정 규칙 보정
- [ ] 체육도장업 CSV 실제 컬럼명 확인 (`sources.read_dojo_csv`가 후보 컬럼명을 찾음)
- [ ] 상용화 시 법률 검토 (후기 게시·명예훼손 이의제기 채널)

## 다음 단계 (v2)

- 후기를 여러 사람이 함께 보도록 저장 서버 연결 (예: Supabase) — 현재는 각자 브라우저에만 저장
- 감성 모델 파인튜닝 (KcELECTRA 등), 학원 직접 등록 화면, 지도
