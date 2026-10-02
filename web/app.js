/* 원주 아이 학원 찾기 — v1 모바일 웹
 * FR-01 분야 지정 · FR-02 키워드 검색 · FR-03 추천순 정렬 · FR-04 상담 연결
 * 데이터: data/academies.json (교육청·체육도장업 공공데이터, 주 1회 생성). 후기는 앱에서 작성 → 브라우저에서 감성분석.
 * 번들 데모는 window.__ACADEMY_DATA__ 사용.
 */
(function () {
  "use strict";

  // ── 설정 ────────────────────────────────────────────────
  const FIELDS = ["미술", "음악", "체육", "학습", "영어", "기타"];
  const MIN_REVIEWS = 5;          // FR-03: 이 미만이면 '후기 부족', 추천순 뒤로
  const MAX_COMPARE = 3;
  const REPORT_EMAIL = "";        // FR-04 정보 수정 요청 받을 주소 (비우면 버튼 숨김)
  const SYNONYMS = {
    "영어유치원": ["유아영어", "영어", "키즈", "유치", "어학"],
    "영유": ["유아영어", "영어", "키즈", "유치"],
    "놀이학교": ["놀이", "프리스쿨"],
    "태권도": ["태권도", "체육관", "무술"],
    "줄넘기": ["줄넘기", "음악줄넘기", "키즈스포츠"],
    "피아노": ["피아노", "음악학원", "건반", "뮤직"],
    "미술": ["미술", "아트", "그림", "드로잉"],
    "발레": ["발레", "무용", "댄스"],
    "수영": ["수영", "스윔"],
    "한글": ["한글", "국어", "독서"],
    "수학": ["수학", "사고력", "연산", "주산"],
  };
  // 통칭(영어유치원·놀이학교)은 등록 명칭에 거의 없어 동의어로 넓히되, 아래 조건을 만족해야 결과에 포함
  const SYN_RULES = {
    "영어유치원": (a) => a.preschool === "전문" && a.fields.includes("영어"),
    "영유": (a) => a.preschool === "전문" && a.fields.includes("영어"),
    "놀이학교": (a) => a.preschool === "전문" && /놀이|프리스쿨/.test(a.name + " " + a.courses.join(" ")),
  };
  const SUGGEST = ["태권도", "피아노", "줄넘기", "영어유치원", "놀이학교", "미술"];
  const ASPECT_ORDER = ["강사", "수업", "시설", "안전·차량", "비용", "소통", "아이 반응"];
  const ASPECT_QUESTIONS = {
    "강사": "담당 선생님이 자주 바뀌나요? 선생님 경력은 어떻게 되나요?",
    "수업": "5–7세 수업은 어떤 방식으로 진행되나요?",
    "시설": "교실 청소·환기는 어떻게 관리하시나요?",
    "안전·차량": "셔틀에 동승 선생님이 계신가요? 시간은 고정인가요?",
    "비용": "교재비·차량비 등 원비 외 비용이 있나요?",
    "소통": "수업 후 피드백은 어떤 방식으로 주시나요?",
    "아이 반응": "처음 적응이 어려운 아이는 어떻게 도와주시나요?",
  };
  const BASE_QUESTIONS = [
    { id: "trial", label: "체험수업 가능 여부·비용·날짜", ask: "체험수업이 가능한지, 비용과 가능한 날짜를 알고 싶습니다." },
    { id: "fee", label: "월 원비와 별도 비용(교재·차량·재료)", ask: "월 원비와 교재비·차량비 등 별도 비용이 궁금합니다." },
    { id: "wait", label: "현재 대기 여부·순번·예상 입학 시기", ask: "현재 대기가 있는지, 있다면 순번과 예상 입학 시기를 알려주세요." },
    { id: "class", label: "반 구성(연령별/혼합)·반 인원", ask: "5–7세 반 구성(연령별/혼합)과 반 인원이 궁금합니다." },
    { id: "bus", label: "셔틀 운행 지역·시간", ask: "셔틀 운행 지역과 시간을 알려주세요." },
  ];

  // ── 감성분석 사전 (pipeline/config.py와 동일하게 유지) ─────────────
  const LEX = {"ASPECTS": {"강사": ["선생님", "쌤", "원장", "강사", "코치", "관장", "사범", "교사"], "수업": ["수업", "커리큘럼", "프로그램", "교재", "진도", "레슨", "교육", "체험수업"], "시설": ["시설", "교실", "청결", "깨끗", "위생", "공간", "인테리어", "환경", "놀이터"], "안전·차량": ["셔틀", "차량", "픽업", "등하원", "안전", "위험", "다쳐", "하원"], "비용": ["원비", "수강료", "교습비", "비용", "가격", "가성비", "비싸", "저렴", "교재비"], "소통": ["상담", "피드백", "알림장", "연락", "소통", "사진", "영상", "답장", "공지"], "아이 반응": ["아이가", "아이는", "우리 아이", "딸", "아들", "재밌", "재미있", "좋아해", "가기 싫", "울어", "적응"]}, "POS": ["좋", "만족", "친절", "추천", "꼼꼼", "세심", "재밌", "재미있", "즐거", "최고", "감사", "훌륭", "깨끗", "청결", "안심", "믿음", "든든", "적극", "열정", "성실", "편하", "편리", "저렴", "합리", "가성비", "잘 가르", "실력", "발전", "늘었", "향상", "성장", "좋아해", "좋아하", "행복", "따뜻", "다정", "배려", "칭찬", "잘해", "잘하", "잘 적응", "적응 잘", "빠르게 늘"], "NEG": ["별로", "불만", "불친절", "실망", "아쉽", "아쉬", "비싸", "부담", "불편", "더럽", "지저분", "위험", "다쳐", "다쳤", "늦", "지각", "무성의", "성의 없", "대충", "방치", "시끄럽", "좁", "싫어", "가기 싫", "울어", "울었", "그만", "환불", "후회", "짜증", "화가", "불안", "걱정", "연락이 안", "소통이 안", "자주 바뀌", "바뀌어", "변경이 잦"], "NEGATORS": ["않", "안 ", "못 ", "없", "아니"], "SPONSORED": ["원고료", "협찬", "제공받아", "제공 받아", "체험단", "소정의", "지원받아", "업체로부터", "광고"]};

  // ── 저장소 (실패해도 앱은 동작) ──────────────────────────────
  const store = {
    get(k, d) { try { const v = localStorage.getItem("wka:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("wka:" + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  // ── 유틸 ────────────────────────────────────────────────
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const won = (n) => (n >= 10000 ? (n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "만원" : n.toLocaleString("ko-KR") + "원");
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const chosung = (s) => Array.from(s).map((c) => { const code = c.charCodeAt(0) - 0xac00; return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : c; }).join("");
  const isChosungOnly = (s) => /^[ㄱ-ㅎ]+$/.test(s);
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
  const telHref = (t) => "tel:" + String(t).replace(/[^\d+]/g, "");
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ── 감성분석 (v1 규칙 기반, 속성별) ─────────────────────────────
  const splitSentences = (t) => { const parts = String(t).split(/(?<=[.!?…~])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length >= 2); return parts.length ? parts : [String(t).trim()].filter(Boolean); };
  const negatedAfter = (sent, i, len) => LEX.NEGATORS.some((n) => sent.slice(i + len, i + len + 6).includes(n));
  function sentencePolarity(sent) {
    let sc = 0;
    LEX.POS.forEach((w) => { const i = sent.indexOf(w); if (i >= 0) sc += negatedAfter(sent, i, w.length) ? -1 : 1; });
    LEX.NEG.forEach((w) => { const i = sent.indexOf(w); if (i >= 0) sc += negatedAfter(sent, i, w.length) ? 1 : -1; });
    return Math.sign(sc);
  }
  function analyzeReview(rv) {
    const text = rv.text || "";
    let total = 0; const aspects = {};
    splitSentences(text).forEach((sent) => {
      const pol = sentencePolarity(sent); total += pol; if (!pol) return;
      Object.entries(LEX.ASPECTS).forEach(([k, kws]) => { if (kws.some((w) => sent.includes(w))) aspects[k] = (aspects[k] || 0) + pol; });
    });
    // 별점이 있으면 전체 극성은 별점 우선(4–5 긍정, 1–2 부정, 3은 본문으로 판정), 속성은 본문으로 판정
    const r = +rv.rating || 0;
    const polarity = r >= 4 ? 1 : r && r <= 2 ? -1 : Math.sign(total);
    return { polarity, aspects, sponsored: LEX.SPONSORED.some((m) => text.includes(m)) };
  }
  function wilson(pos, n, z = 1.96) {
    if (!n) return 0;
    const p = pos / n, d = 1 + (z * z) / n;
    return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  }
  function aggregateReviews(list) {
    const out = { n: 0, pos: 0, neg: 0, neu: 0, sponsored: 0, score: 0, aspects: {}, total: list.length };
    list.forEach((rv) => {
      const a = analyzeReview(rv);
      if (a.sponsored) { out.sponsored++; return; }
      if (a.polarity > 0) out.pos++; else if (a.polarity < 0) out.neg++; else out.neu++;
      Object.entries(a.aspects).forEach(([k, v]) => { const c = (out.aspects[k] = out.aspects[k] || { pos: 0, neg: 0 }); if (v > 0) c.pos++; else if (v < 0) c.neg++; });
    });
    out.n = out.pos + out.neg; out.score = wilson(out.pos, out.n);
    return out;
  }

  // ── 상태 ────────────────────────────────────────────────
  const state = {
    data: [], meta: {},
    q: "", fields: new Set(), onlyPre: false, sort: "rec", dong: "",
    sampleReviews: {},
    compare: new Set(store.get("compare", [])),
  };

  // ── 파생 값 ──────────────────────────────────────────────
  function reviewView(a) {
    const r = a.reviews || { n: 0, pos: 0, neg: 0, score: 0, aspects: {} };
    const ratio = r.n ? r.pos / r.n : null;
    const asp = Object.entries(r.aspects || {});
    const bestPos = asp.filter(([, v]) => v.pos > v.neg).sort((x, y) => (y[1].pos - y[1].neg) - (x[1].pos - x[1].neg))[0];
    const worstNeg = asp.filter(([, v]) => v.neg >= 2 && v.neg / (v.pos + v.neg) >= 0.25).sort((x, y) => y[1].neg - x[1].neg)[0];
    const concerns = asp.filter(([, v]) => v.neg >= 2 && v.neg / (v.pos + v.neg) >= 0.25).map(([k]) => k);
    return { r, ratio, few: r.n < MIN_REVIEWS, bestPos: bestPos && bestPos[0], worstNeg: worstNeg && worstNeg[0], concerns };
  }
  const minFee = (a) => (a.fee && a.fee.public && a.fee.items.length ? Math.min(...a.fee.items.map((i) => i.won)) : null);

  // FR-02: 검색어 → 매칭 점수 (0이면 제외)
  function matchScore(a, q) {
    if (!q) return 1;
    const name = norm(a.name), nameCho = chosung(a.name.replace(/\s+/g, ""));
    const hay = norm([a.courses.join(" "), a.realm, a.fields.join(" "), a.kind].join(" "));
    const aspects = norm(Object.keys((a.reviews && a.reviews.aspects) || {}).join(" "));
    const nq = norm(q);
    if (isChosungOnly(nq)) return nameCho.includes(nq) ? 3 : 0;
    let s = 0;
    if (name.includes(nq)) s = Math.max(s, 3);
    if (hay.includes(nq)) s = Math.max(s, 2);
    const syn = SYNONYMS[nq] || Object.entries(SYNONYMS).find(([k]) => k.includes(nq) && nq.length >= 2)?.[1] || [];
    for (const w of syn) { const nw = norm(w); if (name.includes(nw)) s = Math.max(s, 2); else if (hay.includes(nw)) s = Math.max(s, 1.5); }
    if (s === 0 && aspects.includes(nq)) s = 1;
    // 통칭 검색어는 조건을 추가로 요구해 오탐을 줄인다
    const rule = SYN_RULES[nq];
    if (s > 0 && rule && !rule(a)) s = 0;
    return s;
  }

  function filtered() {
    const q = state.q.trim();
    let rows = state.data.map((a) => ({ a, m: matchScore(a, q), v: reviewView(a) })).filter((x) => x.m > 0);
    if (state.fields.size) rows = rows.filter((x) => x.a.fields.some((f) => state.fields.has(f)));
    if (state.onlyPre) rows = rows.filter((x) => x.a.preschool === "전문");
    if (state.dong) rows = rows.filter((x) => x.a.dong === state.dong);
    const byRec = (x, y) => (x.v.few - y.v.few) || (y.a.reviews.score - x.a.reviews.score) || (y.a.reviews.n - x.a.reviews.n) || x.a.name.localeCompare(y.a.name, "ko");
    const cmp = {
      rec: byRec,
      reviews: (x, y) => (y.a.reviews.n - x.a.reviews.n) || byRec(x, y),
      fee: (x, y) => ((minFee(x.a) ?? 1e12) - (minFee(y.a) ?? 1e12)) || byRec(x, y),
    }[state.sort];
    rows.sort(cmp);
    return rows;
  }

  // ── 렌더: 목록 ────────────────────────────────────────────
  function renderChips() {
    $("#field-chips").innerHTML = FIELDS.map((f) => `<button type="button" class="chip" data-field="${f}" aria-pressed="${state.fields.has(f)}">${f}</button>`).join("");
  }

  function renderRecent() {
    const rec = store.get("recent", []);
    const el = $("#recent");
    if (!rec.length || state.q) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<span>최근</span>` + rec.map((r) => `<button type="button" data-q="${esc(r)}">${esc(r)}</button>`).join("");
  }

  function card({ a, v }) {
    const r = v.r;
    const scoreHtml = v.few
      ? `<b style="font-size:14px">후기 부족</b><small>${r.n}건</small>`
      : `<b>${Math.round(v.ratio * 100)}%</b><small>긍정 · ${r.n}건</small>`;
    const bar = r.n ? `<div class="bar" aria-hidden="true"><i style="width:${Math.round(v.ratio * 100)}%"></i></div>` : `<div class="bar none" aria-hidden="true"></div>`;
    const tags = [];
    if (v.bestPos) tags.push(`<span class="tag-pos">＋ ${esc(v.bestPos)}</span>`);
    if (v.worstNeg) tags.push(`<span class="tag-neg">－ ${esc(v.worstNeg)}</span>`);
    const fee = minFee(a);
    const picked = state.compare.has(a.id);
    return `<li class="card">
      <button type="button" class="card-main" data-open="${esc(a.id)}">
        <div class="card-title">
          <h3>${esc(a.name)}</h3>
          <div class="meta">${esc(a.dong || "")}${a.dong ? " · " : ""}${esc(a.kind)}${fee ? " · " + won(fee) + "~" : ""}</div>
          <div class="badges">${a.preschool === "전문" ? '<span class="badge pre">유아 전문</span>' : ""}${a.fields.map((f) => `<span class="badge">${esc(f)}</span>`).join("")}</div>
        </div>
        <div class="score">${scoreHtml}</div>
      </button>
      ${bar}
      ${tags.length ? `<div class="aspect-line">${tags.join("")}</div>` : ""}
      <div class="card-actions">
        <label class="pick"><input type="checkbox" data-pick="${esc(a.id)}" ${picked ? "checked" : ""}> 비교</label>
        <div class="left">
          ${a.tel ? `<a class="btn sm" href="${telHref(a.tel)}" aria-label="${esc(a.name)} 전화">전화</a>` : ""}
          <button type="button" class="btn sm primary" data-open="${esc(a.id)}" data-tab="consult">상담 준비</button>
        </div>
      </div>
    </li>`;
  }

  function renderList() {
    const rows = filtered();
    $("#list").innerHTML = rows.map(card).join("");
    const parts = [];
    if (state.q) parts.push(`‘${esc(state.q)}’`);
    if (state.fields.size) parts.push([...state.fields].join("·"));
    if (state.dong) parts.push(esc(state.dong));
    $("#count").innerHTML = `${parts.length ? parts.join(" · ") + " — " : ""}<b>${rows.length}</b>곳 · ${esc({ rec: "추천순", reviews: "후기 많은순", fee: "수강료 낮은순" }[state.sort])}`;
    const empty = $("#empty");
    if (!rows.length) {
      empty.hidden = false;
      empty.innerHTML = `조건에 맞는 곳이 없습니다.<div class="suggest">${SUGGEST.filter((s) => s !== state.q).map((s) => `<button type="button" class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>`;
    } else empty.hidden = true;
    renderCompareBar();
  }

  function renderCompareBar() {
    const n = state.compare.size;
    $("#compare-bar").hidden = n === 0;
    $("#compare-count").textContent = `${n}곳 선택 (최대 ${MAX_COMPARE})`;
    $("#compare-open").setAttribute("aria-disabled", n < 2 ? "true" : "false");
  }

  // ── 상세 시트 ─────────────────────────────────────────────
  const byId = (id) => state.data.find((a) => a.id === id);
  let lastFocus = null;
  function openSheet(title, bodyHtml, barHtml) {
    lastFocus = document.activeElement;
    $("#sheet-title").textContent = title;
    $("#sheet-body").innerHTML = bodyHtml;
    $("#consult-bar").innerHTML = barHtml || "";
    $("#consult-bar").hidden = !barHtml;
    $("#sheet").hidden = false;
    document.body.style.overflow = "hidden";
    $("#sheet-body").scrollTop = 0;
    $("#sheet-close").focus();
  }
  function closeSheet() {
    $("#sheet").hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
    renderList();
  }

  function memoOf(id) { return store.get("memo:" + id, { trial: "미확인", trialDate: "", fee: "", wait: "미확인", waitNo: "", note: "", at: "" }); }
  function profile() { return store.get("profile", { age: "5", time: "" }); }
  const myReviews = (id) => store.get("rv:" + id, []);
  function reviewsOf(a) { return [...(state.sampleReviews[a.id] || []).map((r) => ({ ...r, sample: true })), ...myReviews(a.id)]; }
  function recompute(a) { a.reviews = aggregateReviews(reviewsOf(a)); }

  function consultMessage(a, qIds, extra) {
    const p = profile();
    const lines = ["안녕하세요. " + (p.age ? `만 ${p.age}세 아이` : "아이") + " 입학 상담 문의드립니다."];
    if (p.time) lines.push(`${p.time} 수업을 희망합니다.`);
    BASE_QUESTIONS.filter((q) => qIds.includes(q.id)).forEach((q) => lines.push(q.ask));
    extra.forEach((t) => lines.push(t));
    lines.push("답변 주시면 감사하겠습니다.");
    return lines.join("\n");
  }

  function openDetail(id, tab) {
    const a = byId(id); if (!a) return;
    const v = reviewView(a), r = v.r;
    const m = memoOf(id);
    const c = a.consult || {};
    const fees = a.fee && a.fee.public && a.fee.items.length
      ? a.fee.items.map((i) => `${esc(i.name)} ${won(i.won)}`).join(", ") + `<br><small class="hint">교육청 등록 교습비 기준 · 교재·차량비 등 별도 비용은 상담 확인</small>`
      : "상담 시 확인";
    const aspectRows = ASPECT_ORDER.filter((k) => r.aspects && r.aspects[k]).map((k) => {
      const x = r.aspects[k], t = x.pos + x.neg, w = t ? Math.round((x.pos / t) * 100) : 0;
      return `<div class="aspect"><span>${esc(k)}</span><div class="bar"><i style="width:${w}%"></i></div><span class="num">+${x.pos} / −${x.neg}</span></div>`;
    }).join("");
    const list = reviewsOf(a).map((x, i) => ({ ...x, i, an: analyzeReview(x) })).reverse();
    const mine = myReviews(id);
    const refs = list.slice(0, 20).map((x) => `<li><span class="dot ${x.an.sponsored ? "s" : x.an.polarity > 0 ? "p" : x.an.polarity < 0 ? "n" : "z"}"></span>${x.rating ? `<b>${"★".repeat(x.rating)}</b> ` : ""}${esc(x.text)} <small class="hint">${esc(x.date || "")}${x.sample ? " · 샘플" : ""}</small>${x.sample ? "" : ` <button type="button" class="link-btn" data-del="${x.i - (reviewsOf(a).length - mine.length)}">삭제</button>`}</li>`).join("");
    const autoQ = v.concerns.map((k) => ASPECT_QUESTIONS[k]).filter(Boolean);
    const naverMap = "https://map.naver.com/p/search/" + encodeURIComponent(a.name.replace(/^샘플\s*/, "") + " 원주");
    const chans = [c.kakao && `<a class="btn sm" href="${esc(c.kakao)}" target="_blank" rel="noopener">카카오톡 채널</a>`,
      c.naverTalk && `<a class="btn sm" href="${esc(c.naverTalk)}" target="_blank" rel="noopener">네이버 톡톡</a>`,
      c.homepage && `<a class="btn sm" href="${esc(c.homepage)}" target="_blank" rel="noopener">홈페이지</a>`].filter(Boolean);
    const p = profile();

    const body = `
      <section class="section" id="sec-info">
        <h3>기본 정보</h3>
        <dl class="info">
          <dt>구분</dt><dd>${esc(a.kind)}${a.preschool === "전문" ? " · 유아 전문" : " · 유아 수강 가능"}</dd>
          <dt>분야</dt><dd>${a.fields.map(esc).join(", ")}${a.courses.length ? ` <small class="hint">(${a.courses.map(esc).join(", ")})</small>` : ""}</dd>
          <dt>주소</dt><dd>${esc(a.address)}</dd>
          <dt>전화</dt><dd>${a.tel ? `<a href="${telHref(a.tel)}">${esc(a.tel)}</a>` : "정보 없음"}</dd>
          <dt>상담 시간</dt><dd>${c.hours ? esc(c.hours) : "등록 정보 없음 — 전화로 확인"}</dd>
          <dt>교습비</dt><dd>${fees}</dd>
          ${a.capacity ? `<dt>정원</dt><dd>${esc(a.capacity)}명 (교육청 등록)</dd>` : ""}
        </dl>
        <p class="hint">출처: ${esc(a.source)}${c.checked ? " · 상담 정보 확인일 " + esc(c.checked) : ""} · 데이터 기준 ${esc((state.meta.generatedAt || "").slice(0, 10))}</p>
      </section>

      <section class="section" id="sec-review">
        <h3>후기 분석 ${v.few ? '<span class="tag-few">후기 부족</span>' : ""}</h3>
        ${r.n ? `<p style="margin:0 0 10px">긍정 <b>${r.pos}</b> · 부정 <b>${r.neg}</b>${r.neu ? ` · 중립 ${r.neu}` : ""} → 긍정 ${Math.round(v.ratio * 100)}% · 추천 점수 ${r.score.toFixed(2)}</p>` : `<p style="margin:0">분석할 후기가 아직 없습니다.</p>`}
        ${aspectRows ? `<div class="aspects">${aspectRows}</div>` : ""}
        ${r.sponsored ? `<p class="hint">광고·협찬으로 판정된 후기 ${r.sponsored}건은 점수에서 제외했습니다.</p>` : ""}
        ${refs ? `<h3 style="margin-top:14px">후기 ${list.length}건</h3><ul class="refs">${refs}</ul>` : ""}
        <p class="hint">${esc(state.meta.sentiment || "")}. 별점이 있으면 별점으로 긍정·부정을 정하고, 항목(강사·셔틀 등)은 본문으로 판정합니다.</p>
      </section>

      <section class="section" id="sec-write">
        <h3>후기 쓰기 <small class="hint">(이 브라우저에 저장)</small></h3>
        <div class="field">별점
          <div class="seg" id="rv-stars">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rv-rating" value="${n}" ${n === 5 ? "checked" : ""}>${n}점</label>`).join("")}</div>
        </div>
        <label class="field" style="margin-top:10px">내용
          <textarea id="rv-text" rows="3" placeholder="예: 선생님이 친절하고 아이가 좋아해요. 셔틀 시간은 자주 바뀌어요."></textarea>
        </label>
        <div class="msg-actions"><button type="button" class="btn primary" id="rv-save">후기 저장</button></div>
      </section>

      <section class="section" id="sec-consult">
        <h3>상담 준비</h3>
        <div class="row2">
          <label class="field">아이 나이(만)
            <select id="pf-age">${["3", "4", "5", "6", "7"].map((x) => `<option ${p.age === x ? "selected" : ""}>${x}</option>`).join("")}</select>
          </label>
          <label class="field">희망 요일·시간
            <input id="pf-time" placeholder="예: 평일 오후 4시 이후" value="${esc(p.time)}">
          </label>
        </div>
        <div class="qs" id="qs">
          ${BASE_QUESTIONS.map((q) => `<label class="q"><input type="checkbox" data-q="${q.id}" ${["trial", "fee", "wait"].includes(q.id) ? "checked" : ""}><span>${esc(q.label)}</span></label>`).join("")}
          ${autoQ.map((t, i) => `<label class="q auto"><input type="checkbox" data-auto="${i}" checked><span>${esc(t)}</span></label>`).join("")}
        </div>
        <label class="field" style="margin-top:12px">보낼 문구 (수정 가능)
          <textarea class="msg" id="msg"></textarea>
        </label>
        <div class="msg-actions">
          <button type="button" class="btn sm" id="msg-copy">문구 복사</button>
          ${a.tel ? `<a class="btn sm primary" id="msg-sms" href="#">문자로 보내기</a>` : ""}
          ${chans.join("")}
        </div>
        <p class="hint">채팅 채널은 문구를 복사해 붙여넣으세요.</p>
      </section>

      <section class="section" id="sec-memo">
        <h3>상담 메모 <small class="hint">(이 기기에만 저장, 비공개)</small></h3>
        <div class="memo-grid">
          <div class="field">체험수업
            <div class="seg">${["가능", "불가", "미확인"].map((x) => `<label><input type="radio" name="m-trial" value="${x}" ${m.trial === x ? "checked" : ""}>${x}</label>`).join("")}</div>
          </div>
          <div class="row2" style="margin:0">
            <label class="field">체험 일정<input id="m-trialDate" value="${esc(m.trialDate)}" placeholder="예: 10/8 오후 4시"></label>
            <label class="field">월 원비(원)<input id="m-fee" inputmode="numeric" value="${esc(m.fee)}" placeholder="예: 180000"></label>
          </div>
          <div class="field">대기
            <div class="seg">${["없음", "있음", "미확인"].map((x) => `<label><input type="radio" name="m-wait" value="${x}" ${m.wait === x ? "checked" : ""}>${x}</label>`).join("")}</div>
          </div>
          <label class="field">대기 순번·입학 예상<input id="m-waitNo" value="${esc(m.waitNo)}" placeholder="예: 3번째, 12월 예상"></label>
          <label class="field">느낀 점<textarea id="m-note" rows="3">${esc(m.note)}</textarea></label>
          <div><button type="button" class="btn primary" id="m-save">메모 저장</button> <span class="saved" id="m-saved">${m.at ? "저장됨 " + esc(m.at) : ""}</span></div>
        </div>
      </section>

      <section class="section">
        <h3>바로가기</h3>
        <div class="msg-actions" style="margin:0">
          <a class="btn sm" href="${esc(naverMap)}" target="_blank" rel="noopener">네이버 지도·플레이스</a>
          ${REPORT_EMAIL ? `<a class="btn sm ghost" href="mailto:${esc(REPORT_EMAIL)}?subject=${encodeURIComponent("[정보 수정 요청] " + a.name)}">정보 수정 요청</a>` : ""}
        </div>
        <p class="hint">네이버 별점·리뷰는 네이버 지도에서 직접 확인하세요. (네이버 API는 사용하지 않습니다)</p>
      </section>`;

    const bar = `
      <a class="btn" href="${a.tel ? telHref(a.tel) : "#"}" aria-disabled="${!a.tel}"><b>☎</b>전화</a>
      <a class="btn" id="bar-sms" href="#" aria-disabled="${!a.tel}"><b>✉</b>문자</a>
      <button type="button" class="btn" id="bar-chat" aria-disabled="${!chans.length}"><b>…</b>${chans.length ? "채팅" : "채널 없음"}</button>
      <button type="button" class="btn primary" id="bar-memo"><b>✎</b>메모</button>`;

    openSheet(a.name, body, bar);

    const sheet = $("#sheet-body");
    const selectedQ = () => [...sheet.querySelectorAll("[data-q]:checked")].map((x) => x.dataset.q);
    const selectedAuto = () => [...sheet.querySelectorAll("[data-auto]:checked")].map((x) => autoQ[+x.dataset.auto]);
    const smsHref = () => `sms:${String(a.tel).replace(/[^\d+]/g, "")}?&body=${encodeURIComponent($("#msg").value)}`;
    let edited = false;
    const refreshMsg = () => { if (!edited) $("#msg").value = consultMessage(a, selectedQ(), selectedAuto()); if ($("#msg-sms")) $("#msg-sms").href = smsHref(); $("#bar-sms").href = a.tel ? smsHref() : "#"; };
    refreshMsg();
    $("#msg").addEventListener("input", () => { edited = true; if ($("#msg-sms")) $("#msg-sms").href = smsHref(); $("#bar-sms").href = a.tel ? smsHref() : "#"; });
    sheet.addEventListener("change", (e) => {
      if (e.target.matches("[data-q],[data-auto]")) { edited = false; refreshMsg(); }
      if (e.target.id === "pf-age") { store.set("profile", { ...profile(), age: e.target.value }); edited = false; refreshMsg(); }
    });
    $("#pf-time").addEventListener("input", (e) => { store.set("profile", { ...profile(), time: e.target.value.trim() }); edited = false; refreshMsg(); });
    $("#msg-copy").addEventListener("click", () => copy($("#msg").value));
    $("#m-save").addEventListener("click", () => {
      const val = (sel) => (sheet.querySelector(sel) || {}).value || "";
      const now = new Date();
      const memo = {
        trial: val('input[name="m-trial"]:checked') || "미확인", trialDate: val("#m-trialDate").trim(),
        fee: val("#m-fee").replace(/[^\d]/g, ""), wait: val('input[name="m-wait"]:checked') || "미확인",
        waitNo: val("#m-waitNo").trim(), note: val("#m-note").trim(),
        at: `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      };
      const ok = store.set("memo:" + id, memo);
      $("#m-saved").textContent = ok ? "저장됨 " + memo.at : "이 브라우저에서는 저장할 수 없습니다";
      toast(ok ? "상담 메모를 저장했습니다" : "저장 실패 — 브라우저 저장소가 막혀 있습니다");
    });
    $("#bar-memo").addEventListener("click", () => $("#sec-memo").scrollIntoView({ behavior: "smooth" }));
    $("#bar-chat").addEventListener("click", () => {
      if (!chans.length) return;
      copy($("#msg").value, "문구를 복사했습니다. 채팅창에 붙여넣으세요");
      $("#sec-consult").scrollIntoView({ behavior: "smooth" });
    });
    $("#rv-save").addEventListener("click", () => {
      const text = $("#rv-text").value.trim();
      if (text.length < 5) { toast("후기를 5자 이상 적어 주세요"); return; }
      const rating = +((sheet.querySelector('input[name="rv-rating"]:checked') || {}).value || 0);
      const d = new Date();
      const ok = store.set("rv:" + id, [...myReviews(id), { rating, text, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }]);
      if (!ok) { toast("저장 실패 — 브라우저 저장소가 막혀 있습니다"); return; }
      recompute(a); toast("후기를 저장하고 다시 분석했습니다"); openDetail(id); setTimeout(() => $("#sec-review").scrollIntoView(), 30);
    });
    sheet.addEventListener("click", (e) => {
      const del = e.target.closest("[data-del]"); if (!del) return;
      const arr = myReviews(id); arr.splice(+del.dataset.del, 1); store.set("rv:" + id, arr);
      recompute(a); toast("후기를 삭제했습니다"); openDetail(id); setTimeout(() => $("#sec-review").scrollIntoView(), 30);
    });
    if (tab === "consult") setTimeout(() => $("#sec-consult").scrollIntoView(), 30);
  }

  function copy(text, msg) {
    const done = () => toast(msg || "문구를 복사했습니다");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("복사하지 못했습니다. 길게 눌러 복사하세요"); }
      ta.remove();
    }
  }

  // ── 비교 ────────────────────────────────────────────────
  function openCompare() {
    const items = [...state.compare].map(byId).filter(Boolean);
    if (items.length < 2) return;
    const cell = (fn) => items.map((a) => `<td>${fn(a)}</td>`).join("");
    const aspectCell = (a, k) => { const x = a.reviews.aspects && a.reviews.aspects[k]; return x ? `<span class="tag-pos">+${x.pos}</span> <span class="tag-neg">−${x.neg}</span>` : "–"; };
    const rows = [
      ["추천 점수", (a) => (reviewView(a).few ? "후기 부족" : a.reviews.score.toFixed(2))],
      ["긍정 비율", (a) => (a.reviews.n ? Math.round((a.reviews.pos / a.reviews.n) * 100) + "%" : "–")],
      ["후기 수", (a) => a.reviews.n + "건"],
      ...ASPECT_ORDER.map((k) => [k, (a) => aspectCell(a, k)]),
      ["공개 교습비", (a) => (minFee(a) ? won(minFee(a)) + "~" : "상담 확인")],
      ["전화", (a) => (a.tel ? `<a href="${telHref(a.tel)}">${esc(a.tel)}</a>` : "–")],
      ["체험(메모)", (a) => esc(memoOf(a.id).trial) + (memoOf(a.id).trialDate ? `<br><small>${esc(memoOf(a.id).trialDate)}</small>` : "")],
      ["원비(메모)", (a) => (memoOf(a.id).fee ? won(+memoOf(a.id).fee) : "–")],
      ["대기(메모)", (a) => esc(memoOf(a.id).wait) + (memoOf(a.id).waitNo ? `<br><small>${esc(memoOf(a.id).waitNo)}</small>` : "")],
    ];
    const body = `<section class="section"><div class="cmp-wrap"><table class="cmp">
      <thead><tr><th scope="col"></th>${items.map((a) => `<th scope="col"><button type="button" class="link-btn" data-open="${esc(a.id)}" style="padding:0;text-align:left">${esc(a.name)}</button></th>`).join("")}</tr></thead>
      <tbody>${rows.map(([label, fn]) => `<tr><th scope="row">${esc(label)}</th>${cell(fn)}</tr>`).join("")}</tbody>
    </table></div><p class="hint">메모 항목은 각 학원 상세의 ‘상담 메모’에서 입력한 값입니다.</p></section>`;
    openSheet(`비교 (${items.length}곳)`, body, "");
  }

  function openSortHelp() {
    openSheet("추천순 기준", `<section class="section help">
      <p><b>추천순</b>은 긍정 후기 비율과 후기 수를 함께 반영한 점수(윌슨 점수 하한, 95%)로 정렬합니다.</p>
      <p>예: 후기 100건 중 80% 긍정(0.71)이 10건 중 90% 긍정(0.60)보다, 3건 모두 긍정(0.44)보다 위에 옵니다. 후기가 적을수록 불확실성을 크게 봅니다.</p>
      <p>후기 ${MIN_REVIEWS}건 미만은 ‘후기 부족’으로 표시하고 뒤에 둡니다. 광고·협찬 문구가 있는 후기는 계산에서 뺍니다.</p>
      <p>동점이면 후기 수가 많은 곳, 그다음 이름순입니다.</p>
      <p class="hint">${esc(state.meta.sentiment || "")}</p></section>`, "");
  }

  // ── 동네 필터 ─────────────────────────────────────────────
  function buildDongs() {
    const counts = {};
    state.data.forEach((a) => { if (a.dong) counts[a.dong] = (counts[a.dong] || 0) + 1; });
    const dongs = Object.keys(counts).sort((x, y) => x.localeCompare(y, "ko"));
    $("#dong").innerHTML = `<option value="">전체 동네</option>` + dongs.map((d) => `<option value="${esc(d)}">${esc(d)} (${counts[d]})</option>`).join("");
    const saved = store.get("dong", "");
    if (saved && counts[saved]) { $("#dong").value = saved; state.dong = saved; }
  }

  // ── 내 기록 백업 (후기·메모를 다른 브라우저로 옮기기) ─────────────────
  function openBackup() {
    const dump = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("wka:")) dump[k] = localStorage.getItem(k); } } catch (e) { /* 저장소 차단 */ }
    openSheet("내 기록 백업", `<section class="section">
      <p style="margin:0 0 8px">후기·상담 메모는 이 브라우저에만 저장됩니다. 아래 내용을 복사해 두었다가 다른 브라우저에서 붙여넣으면 옮길 수 있습니다.</p>
      <textarea class="msg" id="bk-text">${esc(JSON.stringify(dump))}</textarea>
      <div class="msg-actions"><button type="button" class="btn sm" id="bk-copy">복사</button><button type="button" class="btn sm primary" id="bk-load">붙여넣은 내용 불러오기</button></div>
      <p class="hint">저장된 항목 ${Object.keys(dump).length}개</p></section>`, "");
    $("#bk-copy").addEventListener("click", () => copy($("#bk-text").value, "백업 내용을 복사했습니다"));
    $("#bk-load").addEventListener("click", () => {
      try {
        const obj = JSON.parse($("#bk-text").value);
        Object.entries(obj).forEach(([k, v]) => { if (k.startsWith("wka:")) localStorage.setItem(k, v); });
        state.data.forEach(recompute); toast("불러왔습니다"); closeSheet();
      } catch (e) { toast("형식이 올바르지 않습니다. 복사한 내용을 그대로 붙여넣어 주세요"); }
    });
  }

  // ── 이벤트 ──────────────────────────────────────────────
  function bind() {
    const qEl = $("#q");
    let t;
    qEl.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = qEl.value; $("#q-clear").hidden = !qEl.value; renderRecent(); renderList(); }, 120); });
    $("#search-form").addEventListener("submit", (e) => {
      e.preventDefault(); qEl.blur();
      const v = qEl.value.trim(); if (!v) return;
      const rec = [v, ...store.get("recent", []).filter((x) => x !== v)].slice(0, 5); store.set("recent", rec);
    });
    $("#q-clear").addEventListener("click", () => { qEl.value = ""; state.q = ""; $("#q-clear").hidden = true; renderRecent(); renderList(); qEl.focus(); });
    document.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-field]");
      if (chip) { const f = chip.dataset.field; state.fields.has(f) ? state.fields.delete(f) : state.fields.add(f); renderChips(); renderList(); return; }
      const qb = e.target.closest("[data-q]");
      if (qb && !qb.matches("input")) { qEl.value = qb.dataset.q; state.q = qb.dataset.q; $("#q-clear").hidden = false; renderRecent(); renderList(); return; }
      const op = e.target.closest("[data-open]");
      if (op) { openDetail(op.dataset.open, op.dataset.tab); return; }
    });
    document.addEventListener("change", (e) => {
      const pk = e.target.closest("[data-pick]");
      if (!pk) return;
      const id = pk.dataset.pick;
      if (pk.checked) {
        if (state.compare.size >= MAX_COMPARE) { pk.checked = false; toast(`최대 ${MAX_COMPARE}곳까지 비교할 수 있습니다`); return; }
        state.compare.add(id);
      } else state.compare.delete(id);
      store.set("compare", [...state.compare]); renderCompareBar();
    });
    $("#only-pre").addEventListener("change", (e) => { state.onlyPre = e.target.checked; renderList(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderList(); });
    $("#dong").addEventListener("change", (e) => { state.dong = e.target.value; store.set("dong", state.dong); renderList(); });
    $("#backup").addEventListener("click", openBackup);
    $("#sort-help").addEventListener("click", openSortHelp);
    $("#compare-open").addEventListener("click", openCompare);
    $("#compare-clear").addEventListener("click", () => { state.compare.clear(); store.set("compare", []); renderList(); });
    $("#sheet-close").addEventListener("click", closeSheet);
    $("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
  }

  // ── 시작 ────────────────────────────────────────────────
  function start(payload) {
    state.meta = payload.meta || {};
    state.sampleReviews = (state.meta.sample && payload.sampleReviews) || {};
    state.data = (payload.academies || []).map((a) => ({ courses: [], fields: ["기타"], ...a }));
    state.data.forEach(recompute);
    state.compare = new Set([...state.compare].filter((id) => state.data.some((a) => a.id === id)));
    $("#meta-line").textContent = `5–7세 · ${state.meta.count || state.data.length}곳 · ${String(state.meta.generatedAt || "").slice(0, 10)} 기준`;
    $("#sample-banner").hidden = !state.meta.sample;
    renderChips(); renderRecent(); buildDongs(); bind(); renderList();
  }

  if (window.__ACADEMY_DATA__) start(window.__ACADEMY_DATA__);
  else fetch("data/academies.json", { cache: "no-cache" }).then((r) => r.json()).then(start)
    .catch(() => { $("#list").innerHTML = ""; const e = $("#empty"); e.hidden = false; e.textContent = "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."; });
})();
