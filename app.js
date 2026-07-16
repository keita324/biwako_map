/* =========================================================
   混雑マップ生成ツール 本体
   ========================================================= */

const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "biwako-crowd-map-v1";

/* 状態：ブロックID → レベル(0〜5) */
const state = {
  levels: {},
  title: "びわ湖大花火大会 混雑マップ",
  time: "",
};

/* ---------- 保存・復元 ---------- */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* プライベートモード等では保存しない */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.levels) state.levels = data.levels;
    if (typeof data.title === "string") state.title = data.title;
    if (typeof data.time === "string") state.time = data.time;
  } catch (e) { /* 壊れたデータは無視 */ }
}

function levelOf(id) {
  return state.levels[id] || 0;
}

/* ---------- 地図上のブロック描画 ---------- */
function buildBlocks() {
  const layer = document.getElementById("blocks-layer");
  layer.textContent = "";

  BLOCKS.forEach((b) => {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "block");
    g.dataset.id = b.id;
    if (b.rot) {
      g.setAttribute("transform", `rotate(${b.rot} ${b.x + b.w / 2} ${b.y + b.h / 2})`);
    }

    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", b.x);
    rect.setAttribute("y", b.y);
    rect.setAttribute("width", b.w);
    rect.setAttribute("height", b.h);
    rect.setAttribute("rx", 8);
    rect.setAttribute("stroke", "#ffffff");
    rect.setAttribute("stroke-width", 3);
    rect.setAttribute("fill-opacity", 0.88);

    const idText = document.createElementNS(SVG_NS, "text");
    idText.setAttribute("x", b.x + 7);
    idText.setAttribute("y", b.y + 18);
    idText.setAttribute("font-size", 14);
    idText.setAttribute("font-weight", 800);
    idText.classList.add("block-id-text");

    const lvText = document.createElementNS(SVG_NS, "text");
    lvText.setAttribute("x", b.x + b.w / 2 + 6);
    lvText.setAttribute("y", b.y + b.h / 2 + (b.h >= 56 ? 14 : 11));
    lvText.setAttribute("text-anchor", "middle");
    lvText.setAttribute("font-size", b.h >= 56 ? 28 : 24);
    lvText.setAttribute("font-weight", 800);
    lvText.classList.add("block-level-text");

    g.appendChild(rect);
    g.appendChild(idText);
    g.appendChild(lvText);
    g.addEventListener("click", () => {
      setLevel(b.id, (levelOf(b.id) + 1) % LEVELS.length);
    });
    layer.appendChild(g);
  });
}

function paintBlocks() {
  document.querySelectorAll("#blocks-layer .block").forEach((g) => {
    const id = g.dataset.id;
    const lv = LEVELS[levelOf(id)];
    const rect = g.querySelector("rect");
    const idText = g.querySelector(".block-id-text");
    const lvText = g.querySelector(".block-level-text");
    rect.setAttribute("fill", lv.fill);
    idText.setAttribute("fill", lv.text);
    idText.textContent = id;
    lvText.setAttribute("fill", lv.text);
    lvText.textContent = lv.value === 0 ? "" : String(lv.value);
  });
}

/* ---------- 凡例（SVG内＝書き出し画像に含まれる） ---------- */
function buildLegend() {
  const layer = document.getElementById("legend-layer");
  layer.textContent = "";

  const x0 = 16, y0 = 630, h = 76;
  const card = document.createElementNS(SVG_NS, "rect");
  card.setAttribute("x", x0);
  card.setAttribute("y", y0);
  card.setAttribute("width", 866);
  card.setAttribute("height", h);
  card.setAttribute("rx", 10);
  card.setAttribute("fill", "#ffffff");
  card.setAttribute("opacity", 0.95);
  card.setAttribute("stroke", "#c3c2b7");
  card.setAttribute("stroke-width", 1.5);
  layer.appendChild(card);

  const caption = document.createElementNS(SVG_NS, "text");
  caption.setAttribute("x", x0 + 18);
  caption.setAttribute("y", y0 + 30);
  caption.setAttribute("font-size", 17);
  caption.setAttribute("font-weight", 800);
  caption.setAttribute("fill", "#0b0b0b");
  caption.textContent = "混雑度";
  layer.appendChild(caption);

  let cx = x0 + 92;
  LEVELS.forEach((lv) => {
    const chip = document.createElementNS(SVG_NS, "rect");
    chip.setAttribute("x", cx);
    chip.setAttribute("y", y0 + 14);
    chip.setAttribute("width", 30);
    chip.setAttribute("height", 26);
    chip.setAttribute("rx", 5);
    chip.setAttribute("fill", lv.fill);
    chip.setAttribute("stroke", "#ffffff");
    chip.setAttribute("stroke-width", 2);
    layer.appendChild(chip);

    if (lv.value > 0) {
      const num = document.createElementNS(SVG_NS, "text");
      num.setAttribute("x", cx + 15);
      num.setAttribute("y", y0 + 33);
      num.setAttribute("text-anchor", "middle");
      num.setAttribute("font-size", 15);
      num.setAttribute("font-weight", 800);
      num.setAttribute("fill", lv.text);
      num.textContent = String(lv.value);
      layer.appendChild(num);
    }

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", cx + 15);
    label.setAttribute("y", y0 + 62);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", 12.5);
    label.setAttribute("fill", "#52514e");
    label.textContent = lv.label;
    layer.appendChild(label);

    cx += lv.value === 0 ? 118 : 128;
  });
}

/* ---------- 入力パネル ---------- */
function buildPanel() {
  const list = document.getElementById("block-list");
  list.textContent = "";

  BLOCKS.forEach((b) => {
    const row = document.createElement("div");
    row.className = "block-row";
    row.dataset.id = b.id;

    const idEl = document.createElement("span");
    idEl.className = "block-id";
    idEl.textContent = b.id;

    const areaEl = document.createElement("span");
    areaEl.className = "block-area";
    areaEl.textContent = b.area;

    const btns = document.createElement("span");
    btns.className = "level-buttons";
    LEVELS.forEach((lv) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = lv.value === 0 ? "−" : String(lv.value);
      btn.title = lv.label;
      btn.dataset.level = lv.value;
      btn.addEventListener("click", () => setLevel(b.id, lv.value));
      btns.appendChild(btn);
    });

    row.appendChild(idEl);
    row.appendChild(areaEl);
    row.appendChild(btns);
    list.appendChild(row);
  });
}

function paintPanel() {
  document.querySelectorAll(".block-row").forEach((row) => {
    const lv = levelOf(row.dataset.id);
    row.querySelectorAll(".level-buttons button").forEach((btn) => {
      const isActive = Number(btn.dataset.level) === lv;
      btn.className = isActive ? `active level-${lv}` : "";
    });
  });
}

/* ---------- タイトル・時刻 ---------- */
function paintHeaderTexts() {
  document.getElementById("svg-title").textContent = state.title || "混雑マップ";
  document.getElementById("svg-time").textContent = state.time || "";
}

/* ---------- 更新の入口 ---------- */
function setLevel(id, level) {
  state.levels[id] = level;
  paintBlocks();
  paintPanel();
  saveState();
}

/* ---------- PNG書き出し ---------- */
function exportPNG() {
  const svg = document.getElementById("map");
  const xml = new XMLSerializer().serializeToString(svg);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

  const img = new Image();
  img.onload = () => {
    const scale = 2; // 2560×1440で書き出し
    const canvas = document.createElement("canvas");
    canvas.width = 1280 * scale;
    canvas.height = 720 * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      const stamp = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      a.download = `konzatsu-map_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.png`;
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  };
  img.onerror = () => alert("画像の生成に失敗しました。ページを再読み込みしてお試しください。");
  img.src = url;
}

/* ---------- 初期化 ---------- */
function init() {
  // OpenStreetMap由来のベースマップを挿入
  document.getElementById("basemap-container").innerHTML = BASEMAP_SVG;
  loadState();
  buildBlocks();
  buildLegend();
  buildPanel();
  paintBlocks();
  paintPanel();
  paintHeaderTexts();

  const titleInput = document.getElementById("input-title");
  const timeInput = document.getElementById("input-time");
  titleInput.value = state.title;
  timeInput.value = state.time;

  titleInput.addEventListener("input", () => {
    state.title = titleInput.value;
    paintHeaderTexts();
    saveState();
  });
  timeInput.addEventListener("input", () => {
    state.time = timeInput.value;
    paintHeaderTexts();
    saveState();
  });

  document.getElementById("btn-now").addEventListener("click", () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    timeInput.value = `${pad(now.getHours())}:${pad(now.getMinutes())} 現在`;
    state.time = timeInput.value;
    paintHeaderTexts();
    saveState();
  });

  document.getElementById("btn-export").addEventListener("click", exportPNG);

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (!confirm("すべてのブロックを未入力に戻します。よろしいですか？")) return;
    state.levels = {};
    paintBlocks();
    paintPanel();
    saveState();
  });
}

init();
