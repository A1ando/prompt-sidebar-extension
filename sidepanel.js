const STORAGE_KEY = "promptCards";
const THEME_KEY = "theme";

/* ========== 图标（Lucide 风格 SVG） ========== */
const ICONS = {
  pin: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
  pinFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497Z"/><path d="m15 5 4 4"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  send: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  alert: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  spinner: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
};

/* ========== 状态 ========== */
let cards = [];
let editingId = null;
let activeTag = "__all__";
let searchQuery = "";
let toastTimer = null;
let isInjectingGlobal = false; // 防注入重入锁

const $ = (sel) => document.querySelector(sel);
const cardList = $("#cardList");
const tagFilter = $("#tagFilter");
const searchInput = $("#searchInput");
const modalOverlay = $("#modalOverlay");
const modalTitle = $("#modalTitle");
const titleInput = $("#titleInput");
const contentInput = $("#contentInput");
const tagsInput = $("#tagsInput");
const tagPreview = $("#tagPreview");
const saveBtn = $("#saveBtn");
const cancelBtn = $("#cancelBtn");
const newCardBtn = $("#newCardBtn");
const themeToggle = $("#themeToggle");
const importBtn = $("#importBtn"); // 补充缺失元素
const exportBtn = $("#exportBtn"); // 补充缺失元素
const fileInput = $("#fileInput"); // 补充缺失元素

/* ========== 工具函数 ========== */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function parseTags(str) {
  return [...new Set(
    (str || "").split(/[,，]/).map(t => t.trim()).filter(Boolean)
  )];
}

function normalizeCard(c) {
  return {
    id: c.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: c.title || "",
    content: c.content || "",
    tags: Array.isArray(c.tags) ? c.tags : [],
    pinned: c.pinned === true,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
  };
}

/* ========== 主题 ========== */
async function initTheme() {
  const { [THEME_KEY]: saved } = await chrome.storage.local.get(THEME_KEY);
  const resolved = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = resolved;
}

themeToggle.addEventListener("click", async () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  await chrome.storage.local.set({ [THEME_KEY]: next });
});

/* ========== 数据加载 ========== */
async function loadCards() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  cards = raw.map(normalizeCard);
  renderAll();
}

async function saveCards() {
  await chrome.storage.local.set({ [STORAGE_KEY]: cards });
}

/* ========== 渲染 ========== */
function renderAll() {
  renderTagFilter();
  renderCardList();
}

function getAllTagsWithCount() {
  const map = {};
  cards.forEach(c => c.tags.forEach(t => {
    map[t] = (map[t] || 0) + 1;
  }));
  return Object.entries(map).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "zh-CN");
  });
}

function renderTagFilter() {
  const allTags = getAllTagsWithCount();
  if (activeTag !== "__all__" && !allTags.some(([t]) => t === activeTag)) {
    activeTag = "__all__";
  }

  const totalCount = cards.length;
  const pills = [
    { tag: "__all__", label: "全部", count: totalCount },
    ...allTags.map(([tag, count]) => ({ tag, label: tag, count })),
  ];

  tagFilter.innerHTML = pills.map(p => `
    <button class="tag-pill ${p.tag === activeTag ? "active" : ""}" data-tag="${escapeHtml(p.tag)}">
      <span>${escapeHtml(p.label)}</span>
      <span class="badge">${p.count}</span>
    </button>
  `).join("");
}

tagFilter.addEventListener("click", (e) => {
  const pill = e.target.closest(".tag-pill");
  if (!pill) return;
  activeTag = pill.dataset.tag;
  renderAll();
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim();
  renderCardList();
});

function getFilteredCards() {
  const q = searchQuery.toLowerCase();
  return cards
    .filter(card => {
      if (activeTag !== "__all__" && !card.tags.includes(activeTag)) return false;
      if (q) {
        const haystack = (card.title + " " + card.content + " " + card.tags.join(" ")).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

function renderCardList() {
  const list = getFilteredCards();

  if (list.length === 0) {
    cardList.innerHTML = `<div class="empty-tip">${
      cards.length === 0
        ? "暂无卡片<br>点击右上角 ＋ 新建"
        : "没有符合条件的卡片"
    }</div>`;
    return;
  }

  cardList.innerHTML = list.map(card => `
    <div class="card ${card.pinned ? "pinned" : ""}" data-id="${card.id}">
      <div class="card-top">
        <div class="card-title">${escapeHtml(card.title)}</div>
        <div class="card-icons">
          <button class="copy-btn" title="复制" aria-label="复制">${ICONS.copy}</button>
          <button class="edit-btn" title="编辑" aria-label="编辑">${ICONS.edit}</button>
          <button class="pin-btn ${card.pinned ? "active" : ""}" title="${card.pinned ? "取消置顶" : "置顶"}" aria-label="置顶">
            ${card.pinned ? ICONS.pinFilled : ICONS.pin}
          </button>
          <button class="delete-btn" title="删除" aria-label="删除">${ICONS.trash}</button>
        </div>
      </div>
      <div class="card-content">${escapeHtml(card.content)}</div>
      
      <div class="card-footer">
        <button class="btn-inject" data-id="${card.id}">
          ${ICONS.send}<span>注入</span>
        </button>
        ${card.tags.length ? `
          <div class="card-tags">
            ${card.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join("")}
          </div>
        ` : ""}
      </div>
    </div>
  `).join("");
}

/* ========== 卡片事件委托 ========== */
cardList.addEventListener("click", async (e) => {
  const cardEl = e.target.closest(".card");
  if (!cardEl) return;
  const id = cardEl.dataset.id;
  const card = cards.find(c => c.id === id);
  if (!card) return;

  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.classList.contains("copy-btn")) {
    try {
      await navigator.clipboard.writeText(card.content);
      showToast("已复制到剪贴板");
    } catch {
      showToast("复制失败");
    }
  }

  if (btn.classList.contains("edit-btn")) {
    openModal(true, card);
  }

  if (btn.classList.contains("pin-btn")) {
    card.pinned = !card.pinned;
    await saveCards();
    renderCardList();
  }

  if (btn.classList.contains("delete-btn")) {
    if (confirm(`确定删除「${card.title}」吗？`)) {
      cards = cards.filter(c => c.id !== id);
      await saveCards();
      renderAll();
    }
  }

  if (btn.classList.contains("btn-inject")) {
    handleInject(btn, card.content);
  }
});
/* ========== 注入（回归 sendMessage 架构 + 错误拦截） ========== */
async function handleInject(btn, text) {
  if (isInjectingGlobal || btn.disabled) return;
  isInjectingGlobal = true;
  btn.disabled = true;
  btn.classList.add("loading");

  const originalHTML = btn.innerHTML;
  btn.innerHTML = `${ICONS.spinner}<span>注入中</span>`;

  let ok = false;
  let errMsg = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no tab");

    let resp;
    try {
      // 恢复原来的消息发送方式，严格限制主窗口
      resp = await chrome.tabs.sendMessage(
        tab.id, 
        { action: "injectText", text }, 
        { frameId: 0 }
      );
    } catch (sendErr) {
      // 【核心修复】：拦截网页重绘导致的消息通道关闭假报错
      // 只要报错里包含了 port closed，说明网页已经接收并执行了，直接视为成功
      if (sendErr.message && sendErr.message.includes("The message port closed")) {
        resp = { success: true };
      } else {
        // 如果页面确实没加载 content.js，动态注入后重试一次
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: [0] },
          files: ["content.js"]
        });
        resp = await chrome.tabs.sendMessage(
          tab.id, 
          { action: "injectText", text }, 
          { frameId: 0 }
        );
      }
    }

    ok = !!(resp && resp.success);
    if (!ok) errMsg = (resp && resp.error) || "未找到输入框";

  } catch (e) {
    errMsg = "此页面受浏览器保护，无法注入";
  }

  if (ok) {
    btn.classList.add("success");
    btn.innerHTML = `${ICONS.check}<span>已注入</span>`;
    showToast("成功注入到光标处");
  } else {
    btn.classList.add("error");
    btn.innerHTML = `${ICONS.alert}<span>${errMsg}</span>`;
    showToast(errMsg);
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.classList.remove("loading", "success", "error");
    btn.innerHTML = originalHTML;
    isInjectingGlobal = false; 
  }, 1100);
}

/* ========== 导入导出功能（原代码缺失部分） ========== */
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prompt_sidebar_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("已导出 JSON 备份");
});

importBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!Array.isArray(data)) throw new Error("格式错误");

      // 合并现有数据（按 ID 去重，导入覆盖同名 ID）
      const importedCards = data.map(normalizeCard);
      const existingMap = new Map(cards.map(c => [c.id, c]));
      
      importedCards.forEach(c => {
        existingMap.set(c.id, c);
      });

      cards = Array.from(existingMap.values());
      await saveCards();
      renderAll();
      showToast(`成功导入并合并 ${importedCards.length} 条数据`);
    } catch (err) {
      showToast("导入失败：文件格式不正确");
    }
    fileInput.value = ""; // 重置 input
  };
  reader.readAsText(file);
});

/* ========== 模态框 ========== */
function openModal(isEdit = false, card = null) {
  editingId = isEdit ? card.id : null;
  modalTitle.textContent = isEdit ? "编辑提示词" : "新建提示词";
  titleInput.value = isEdit ? card.title : "";
  contentInput.value = isEdit ? card.content : "";
  tagsInput.value = isEdit ? card.tags.join(", ") : "";
  renderTagPreview(tagsInput.value);
  modalOverlay.classList.add("active");
  setTimeout(() => titleInput.focus(), 50);
}

function closeModal() {
  modalOverlay.classList.remove("active");
  editingId = null;
}

function renderTagPreview(value) {
  const tags = parseTags(value);
  tagPreview.innerHTML = tags
    .map(t => `<span class="tag-preview-pill">${escapeHtml(t)}</span>`)
    .join("");
}

tagsInput.addEventListener("input", () => {
  renderTagPreview(tagsInput.value);
});

newCardBtn.addEventListener("click", () => openModal(false));
cancelBtn.addEventListener("click", closeModal);
$("#modalClose").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

/* ========== 保存 ========== */
saveBtn.addEventListener("click", async () => {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const tags = parseTags(tagsInput.value);

  if (!title || !content) {
    showToast("标题和内容不能为空");
    return;
  }

  if (editingId) {
    const idx = cards.findIndex(c => c.id === editingId);
    if (idx !== -1) {
      cards[idx].title = title;
      cards[idx].content = content;
      cards[idx].tags = tags;
    }
  } else {
    cards.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      content,
      tags,
      pinned: false,
      createdAt: Date.now(),
    });
  }

  await saveCards();
  renderAll();
  closeModal();
});

/* ========== Toast ========== */
function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

/* ========== 初始化 ========== */
(async () => {
  await initTheme();
  await loadCards();
})();