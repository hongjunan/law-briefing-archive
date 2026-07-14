const app = document.querySelector("#app");
const appScroll = document.querySelector("#app-scroll");
const sidebar = document.querySelector("#sidebar");
const backdrop = document.querySelector("#backdrop");
const menuButton = document.querySelector("#menu-btn");
const themeButton = document.querySelector("#theme-btn");
const themeLabel = document.querySelector("#theme-label");
const themeColor = document.querySelector('meta[name="theme-color"]');

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

function listItemTemplate(record) {
  const tags = record.tags
    .slice(0, 4)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  const href = `#/briefing/${encodeURIComponent(record.id)}`;
  const sourceCount = record.citations.length;

  return `
    <a class="archive-item" href="${href}" aria-label="${escapeHtml(record.title)} 상세 보기">
      <div>
        <div class="item-title-row">
          <h2>${escapeHtml(record.title)}</h2>
          <time class="item-date" datetime="${escapeHtml(record.createdAt)}">${escapeHtml(formatDate(record.createdAt))}</time>
        </div>
        <p class="item-summary">${escapeHtml(record.summary)}</p>
        <div class="item-meta" aria-label="태그와 출처">
          ${tags}
          ${sourceCount ? `<span class="source-count">출처 ${sourceCount}</span>` : ""}
        </div>
      </div>
      <span class="item-arrow" aria-hidden="true">›</span>
    </a>
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
  const list = document.querySelector("#briefing-list");
  const resultCount = document.querySelector("#result-count");
  if (!list || !resultCount) return;

  const records = filteredRecords();
  resultCount.textContent = `${records.length}건`;
  list.innerHTML = records.length
    ? records.map(listItemTemplate).join("")
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

  app.innerHTML = `
    <div class="archive-inner">
      <header class="archive-head">
        <div>
          <h1 id="archive-title">아카이브</h1>
          <p>저장된 법률 브리핑을 최신순으로 확인하고, 제목·요약·태그로 검색할 수 있습니다.</p>
        </div>
        <span class="archive-count">전체 ${state.records.length}건</span>
      </header>

      <section aria-label="브리핑 목록">
        <div class="filter-panel">
          <div class="filter-row">
            <label class="search-wrap" for="archive-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
                <circle cx="11" cy="11" r="7"></circle>
                <path d="m20 20-4-4"></path>
              </svg>
              <input id="archive-search" type="search" autocomplete="off" placeholder="제목·요약·태그로 검색…" />
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
              >${tag === "전체" ? "전체" : escapeHtml(tag)}</button>
            `).join("")}
          </div>
        </div>
        <div class="briefing-list" id="briefing-list"></div>
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
  const tags = record.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

  app.innerHTML = `
    <article class="detail-inner">
      <nav class="detail-nav" aria-label="브리핑 탐색">
        <a class="back-link" href="#/"><span aria-hidden="true">←</span> 전체 브리핑</a>
        <button class="share-button" id="share-button" type="button"><span aria-hidden="true">↗</span> 링크 복사</button>
      </nav>

      <header class="detail-head">
        <div class="detail-meta">
          <span>법률 브리핑</span>
          <time datetime="${escapeHtml(record.createdAt)}">${escapeHtml(formatDate(record.createdAt, true))}</time>
        </div>
        <h1>${escapeHtml(record.title)}</h1>
        <p class="detail-summary">${escapeHtml(record.summary)}</p>
        <div class="detail-tags" aria-label="태그">${tags}</div>
      </header>

      <section class="detail-section" aria-labelledby="question-heading">
        <h2 class="section-label" id="question-heading">질문</h2>
        <p class="detail-question">${escapeHtml(record.question)}</p>
      </section>

      <section class="briefing-body" aria-label="브리핑 본문">
        ${renderMarkdown(record.answerMarkdown)}
      </section>

      ${citations ? `
        <section class="citations" aria-labelledby="citations-heading">
          <h2 id="citations-heading">출처</h2>
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

  closeSidebar();
  appScroll.scrollTo({ top: 0, behavior: "auto" });
  app.focus({ preventScroll: true });
}

function updateTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeLabel.textContent = theme === "dark" ? "라이트 모드" : "다크 모드";
  themeColor.content = theme === "dark" ? "#0d0d0d" : "#ffffff";
  try {
    localStorage.setItem("law-theme", theme);
  } catch {
    // 저장소 접근이 차단된 환경에서는 현재 화면에만 적용한다.
  }
}

function closeSidebar() {
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}

menuButton.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  backdrop.classList.toggle("show");
});
backdrop.addEventListener("click", closeSidebar);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
});
themeButton.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme || "dark";
  updateTheme(current === "dark" ? "light" : "dark");
});
updateTheme(document.documentElement.dataset.theme || "dark");

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
