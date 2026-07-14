const app = document.querySelector("#app");

const state = {
  records: [],
  query: "",
  tag: "전체",
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeHttpUrl = (value = "") => {
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

const formatDate = (value, withTime = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};

const normalizeRecord = (record) => ({
  id: String(record?.id || ""),
  createdAt: String(record?.createdAt || ""),
  question: String(record?.question || ""),
  answerMarkdown: String(record?.answerMarkdown || ""),
  title: String(record?.title || "제목 없는 브리핑"),
  summary: String(record?.summary || "요약이 제공되지 않았습니다."),
  citations: Array.isArray(record?.citations) ? record.citations : [],
  tags: Array.isArray(record?.tags) ? record.tags.map(String) : [],
});

const renderMarkdown = (markdown) => {
  if (!window.marked || !window.DOMPurify) {
    return `<p>${escapeHtml(markdown).replaceAll("\n", "<br />")}</p>`;
  }

  const raw = window.marked.parse(markdown, { gfm: true, breaks: true });
  return window.DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["form", "input", "button", "iframe", "object", "embed", "style"],
    FORBID_ATTR: ["style"],
  });
};

const setDocumentTitle = (title) => {
  document.title = title
    ? `${title} | 법률 브리핑 아카이브`
    : "법률 브리핑 아카이브";
};

function uniqueTags(records) {
  const counts = new Map();
  records.flatMap((record) => record.tags).forEach((tag) => {
    counts.set(tag, (counts.get(tag) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([tag]) => tag);
}

function cardTemplate(record, index) {
  const tags = record.tags
    .slice(0, 4)
    .map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`)
    .join("");
  const href = `#/briefing/${encodeURIComponent(record.id)}`;

  return `
    <article class="briefing-card">
      <a class="card-link" href="${href}" aria-label="${escapeHtml(record.title)} 상세 보기"></a>
      <div class="card-meta">
        <span class="card-number">NO. ${String(index + 1).padStart(2, "0")}</span>
        <time datetime="${escapeHtml(record.createdAt)}">${escapeHtml(formatDate(record.createdAt))}</time>
      </div>
      <h2>${escapeHtml(record.title)}</h2>
      <p class="card-summary">${escapeHtml(record.summary)}</p>
      <div class="card-tags" aria-label="태그">${tags}</div>
    </article>
  `;
}

function filteredRecords() {
  const needle = state.query.trim().toLocaleLowerCase("ko");
  return state.records.filter((record) => {
    const matchesTag = state.tag === "전체" || record.tags.includes(state.tag);
    if (!matchesTag) return false;
    if (!needle) return true;
    const haystack = [record.title, record.summary, record.question, ...record.tags]
      .join(" ")
      .toLocaleLowerCase("ko");
    return haystack.includes(needle);
  });
}

function renderCards() {
  const grid = document.querySelector("#briefing-grid");
  const resultCount = document.querySelector("#result-count");
  if (!grid || !resultCount) return;

  const records = filteredRecords();
  resultCount.textContent = `${records.length}건`;
  grid.innerHTML = records.length
    ? records.map(cardTemplate).join("")
    : `
      <div class="empty-state">
        <strong>일치하는 브리핑이 없습니다.</strong>
        <p>검색어나 선택한 태그를 바꿔보세요.</p>
      </div>
    `;
}

function selectTag(tag) {
  state.tag = tag;
  document.querySelectorAll(".filter-chip").forEach((button) => {
    const active = button.dataset.tag === tag;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderCards();
}

function renderIndex() {
  setDocumentTitle();
  const tags = uniqueTags(state.records);
  const newest = state.records[0]?.createdAt;

  app.innerHTML = `
    <div class="archive-shell">
      <section class="archive-hero" aria-labelledby="archive-title">
        <div>
          <p class="eyebrow">Curated legal briefings</p>
          <h1 id="archive-title">복잡한 법률 정보를<br /><em>한눈에</em> 읽는 기록.</h1>
        </div>
        <aside class="hero-aside">
          <p>주요 질문과 법적 근거를 정리한 브리핑을 저장 시점 그대로 모았습니다. 카드를 선택하면 전체 내용을 확인할 수 있습니다.</p>
          <div class="archive-stats">
            <strong>${state.records.length}</strong>
            <span>BRIEFINGS<br />${escapeHtml(formatDate(newest))} 기준</span>
          </div>
        </aside>
      </section>

      <section aria-label="브리핑 목록">
        <div class="archive-toolbar">
          <label class="search-wrap" for="archive-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m20 20-4-4"></path>
            </svg>
            <input id="archive-search" type="search" autocomplete="off" placeholder="제목, 내용, 태그 검색" />
          </label>
          <p class="result-count" id="result-count" aria-live="polite">${state.records.length}건</p>
        </div>
        <div class="tag-filter" aria-label="태그 필터">
          ${["전체", ...tags].map((tag) => `
            <button
              class="filter-chip${tag === state.tag ? " active" : ""}"
              type="button"
              data-tag="${escapeHtml(tag)}"
              aria-pressed="${tag === state.tag}"
            >${tag === "전체" ? "전체" : `#${escapeHtml(tag)}`}</button>
          `).join("")}
        </div>
        <div class="briefing-grid" id="briefing-grid"></div>
      </section>
    </div>
  `;

  const search = document.querySelector("#archive-search");
  search.value = state.query;
  search.addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    renderCards();
  });
  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => selectTag(button.dataset.tag));
  });
  renderCards();
}

function citationTemplate(citation) {
  const url = safeHttpUrl(citation?.url);
  if (!url) return "";
  const name = String(citation?.name || "관련 근거");
  const detail = [citation?.article, citation?.caseNumber].filter(Boolean).join(" · ");
  return `
    <a class="citation" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      <span>
        <strong>${escapeHtml(name)}</strong>
        ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
      </span>
      <span aria-hidden="true">↗</span>
    </a>
  `;
}

function renderDetail(record) {
  setDocumentTitle(record.title);
  const citations = record.citations.map(citationTemplate).filter(Boolean).join("");
  const tags = record.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");

  app.innerHTML = `
    <article class="detail-shell">
      <nav class="detail-nav" aria-label="브리핑 탐색">
        <a class="back-link" href="#/"><span aria-hidden="true">←</span> 전체 브리핑</a>
        <button class="share-button" id="share-button" type="button"><span aria-hidden="true">↗</span> 링크 복사</button>
      </nav>

      <header class="detail-header">
        <div class="detail-kicker">
          <span>Legal briefing</span>
          <time datetime="${escapeHtml(record.createdAt)}">${escapeHtml(formatDate(record.createdAt, true))}</time>
        </div>
        <h1>${escapeHtml(record.title)}</h1>
        <p class="detail-summary">${escapeHtml(record.summary)}</p>
        <div class="detail-tags" aria-label="태그">${tags}</div>
      </header>

      <section class="question-box" aria-labelledby="question-heading">
        <h2 id="question-heading">Original question</h2>
        <p>${escapeHtml(record.question)}</p>
      </section>

      <section class="briefing-body" aria-label="브리핑 본문">
        ${renderMarkdown(record.answerMarkdown)}
      </section>

      ${citations ? `
        <section class="citations" aria-labelledby="citations-heading">
          <h2 id="citations-heading">Related sources</h2>
          <div class="citation-list">${citations}</div>
        </section>
      ` : ""}
    </article>
  `;

  document.querySelectorAll(".briefing-body a").forEach((link) => {
    const safeUrl = safeHttpUrl(link.getAttribute("href"));
    if (!safeUrl) {
      link.removeAttribute("href");
      return;
    }
    link.href = safeUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  document.querySelector("#share-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(window.location.href);
      button.textContent = "✓ 링크 복사됨";
      setTimeout(() => { button.textContent = "↗ 링크 복사"; }, 1600);
    } catch {
      window.prompt("아래 주소를 복사하세요.", window.location.href);
    }
  });
}

function renderError(title, message) {
  setDocumentTitle(title);
  app.innerHTML = `
    <section class="error-shell">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <a href="#/">← 브리핑 목록으로 돌아가기</a>
      </div>
    </section>
  `;
}

function route() {
  const hash = window.location.hash || "#/";
  const match = hash.match(/^#\/briefing\/([^/?#]+)$/);

  if (!match) {
    if (hash !== "#/" && hash !== "#") window.history.replaceState(null, "", "#/");
    renderIndex();
  } else {
    let id = "";
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      renderError("잘못된 주소입니다", "브리핑 주소 형식을 확인해 주세요.");
      return;
    }
    const record = state.records.find((item) => item.id === id);
    if (record) renderDetail(record);
    else renderError("브리핑을 찾을 수 없습니다", "삭제되었거나 존재하지 않는 브리핑입니다.");
  }

  window.scrollTo({ top: 0, behavior: "auto" });
  app.focus({ preventScroll: true });
}

async function boot() {
  try {
    const response = await fetch("./data/archives.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("invalid archive payload");
    state.records = payload
      .map(normalizeRecord)
      .filter((record) => record.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    route();
  } catch (error) {
    console.error(error);
    renderError("아카이브를 열지 못했습니다", "잠시 후 다시 시도해 주세요.");
  }
}

window.addEventListener("hashchange", route);
boot();
