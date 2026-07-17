/* =========================================================
   混雑マップ生成ツール 本体
   ========================================================= */

const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "biwako-crowd-map-v1";

/* 状態：ブロックID → レベル(0〜5) */
const state = {
  levels: {},
  title: "なぎさ公園エリア内自由（西側）- 混雑マップ",
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
    // 旧デザインの既定タイトルは新しい既定値に置き換える
    if (state.title === "びわ湖大花火大会 混雑マップ" || state.title === "混雑マップ") {
      state.title = "なぎさ公園エリア内自由（西側）- 混雑マップ";
    }
  } catch (e) { /* 壊れたデータは無視 */ }
}

function levelOf(id) {
  return state.levels[id] || 0;
}

/* ---------- 地図上のブロック描画（ヒートマップ風） ---------- */
function buildBlocks() {
  const layer = document.getElementById("blocks-layer");
  layer.textContent = "";

  // レベル別のグラデーション（中心が濃く、外側へ溶けていく）
  const defs = document.querySelector("#map defs");
  LEVELS.forEach((lv) => {
    if (lv.value === 0) return;
    const grad = document.createElementNS(SVG_NS, "radialGradient");
    grad.setAttribute("id", `heat-grad-${lv.value}`);
    [[0, 0.9], [0.55, 0.6], [1, 0]].forEach(([offset, opacity]) => {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", lv.fill);
      stop.setAttribute("stop-opacity", opacity);
      grad.appendChild(stop);
    });
    defs.appendChild(grad);
  });

  const heat = document.createElementNS(SVG_NS, "g");
  heat.setAttribute("id", "heat-layer");
  heat.setAttribute("filter", "url(#heat-blur)");
  const outlines = document.createElementNS(SVG_NS, "g");
  outlines.setAttribute("id", "outline-layer");
  const pills = document.createElementNS(SVG_NS, "g");
  pills.setAttribute("id", "pill-layer");
  const hits = document.createElementNS(SVG_NS, "g");
  hits.setAttribute("id", "hit-layer");
  layer.appendChild(heat);
  layer.appendChild(outlines);
  layer.appendChild(pills);
  layer.appendChild(hits);

  BLOCKS.forEach((b) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const rotAttr = b.rot ? `rotate(${b.rot} ${cx} ${cy})` : null;

    // ヒートマップの楕円
    const ell = document.createElementNS(SVG_NS, "ellipse");
    ell.setAttribute("cx", cx);
    ell.setAttribute("cy", cy);
    // ブロック間が途切れず溶け合うよう、ブロックより一回り大きくする
    ell.setAttribute("rx", b.w * 1.0);
    ell.setAttribute("ry", b.h * 0.95);
    if (rotAttr) ell.setAttribute("transform", rotAttr);
    ell.dataset.id = b.id;
    heat.appendChild(ell);

    // 未入力時のガイド枠
    const outline = document.createElementNS(SVG_NS, "rect");
    outline.setAttribute("x", b.x);
    outline.setAttribute("y", b.y);
    outline.setAttribute("width", b.w);
    outline.setAttribute("height", b.h);
    outline.setAttribute("rx", 10);
    outline.setAttribute("fill", "#ffffff");
    outline.setAttribute("fill-opacity", 0.25);
    outline.setAttribute("stroke", "#8b8880");
    outline.setAttribute("stroke-width", 1.5);
    outline.setAttribute("stroke-dasharray", "6 5");
    if (rotAttr) outline.setAttribute("transform", rotAttr);
    outline.dataset.id = b.id;
    outlines.appendChild(outline);

    // ブロック名＋数字のカプセル（混雑度の色で塗る）
    const pill = document.createElementNS(SVG_NS, "g");
    pill.dataset.id = b.id;
    const pr = document.createElementNS(SVG_NS, "rect");
    pr.setAttribute("x", cx - 31);
    pr.setAttribute("y", cy - 14);
    pr.setAttribute("width", 62);
    pr.setAttribute("height", 28);
    pr.setAttribute("rx", 14);
    const pt = document.createElementNS(SVG_NS, "text");
    pt.setAttribute("x", cx);
    pt.setAttribute("y", cy + 6);
    pt.setAttribute("text-anchor", "middle");
    pt.classList.add("pill-text");
    pill.appendChild(pr);
    pill.appendChild(pt);
    pills.appendChild(pill);

    // タップ判定
    const hit = document.createElementNS(SVG_NS, "rect");
    hit.setAttribute("x", b.x);
    hit.setAttribute("y", b.y);
    hit.setAttribute("width", b.w);
    hit.setAttribute("height", b.h);
    hit.setAttribute("fill", "transparent");
    hit.setAttribute("pointer-events", "all");
    hit.setAttribute("cursor", "pointer");
    if (rotAttr) hit.setAttribute("transform", rotAttr);
    hit.addEventListener("click", () => {
      setLevel(b.id, (levelOf(b.id) + 1) % LEVELS.length);
    });
    hits.appendChild(hit);
  });
}

function paintBlocks() {
  BLOCKS.forEach((b) => {
    const lv = LEVELS[levelOf(b.id)];
    const ell = document.querySelector(`#heat-layer ellipse[data-id="${b.id}"]`);
    const outline = document.querySelector(`#outline-layer rect[data-id="${b.id}"]`);
    const pill = document.querySelector(`#pill-layer g[data-id="${b.id}"]`);
    const pr = pill.querySelector("rect");
    const pt = pill.querySelector(".pill-text");
    pt.innerHTML = "";

    if (lv.value === 0) {
      ell.setAttribute("display", "none");
      outline.setAttribute("display", "inline");
      // 未入力：白の半透明カプセル＋破線
      pr.setAttribute("fill", "#ffffff");
      pr.setAttribute("fill-opacity", 0.6);
      pr.setAttribute("stroke", "#8b8880");
      pr.setAttribute("stroke-width", 1.2);
      pr.setAttribute("stroke-dasharray", "4 3");
      const t1 = document.createElementNS(SVG_NS, "tspan");
      t1.setAttribute("font-size", 13);
      t1.setAttribute("font-weight", 700);
      t1.setAttribute("fill", "#6d6b64");
      t1.textContent = b.id + " −";
      pt.appendChild(t1);
    } else {
      ell.setAttribute("fill", `url(#heat-grad-${lv.value})`);
      ell.setAttribute("display", "inline");
      outline.setAttribute("display", "none");
      // 入力済み：混雑度の色で塗った半透明カプセル（色＝混雑度が直感的に伝わる）
      pr.setAttribute("fill", lv.fill);
      pr.setAttribute("fill-opacity", 0.85);
      pr.setAttribute("stroke", "#ffffff");
      pr.setAttribute("stroke-width", 1.6);
      pr.removeAttribute("stroke-dasharray");
      const t1 = document.createElementNS(SVG_NS, "tspan");
      t1.setAttribute("font-size", 12);
      t1.setAttribute("font-weight", 700);
      t1.setAttribute("fill", lv.text);
      t1.setAttribute("opacity", 0.9);
      t1.textContent = b.id + " ";
      const t2 = document.createElementNS(SVG_NS, "tspan");
      t2.setAttribute("font-size", 17);
      t2.setAttribute("font-weight", 800);
      t2.setAttribute("fill", lv.text);
      t2.textContent = String(lv.value);
      pt.appendChild(t1);
      pt.appendChild(t2);
    }
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
  // OpenStreetMap由来のベースマップと公式ロゴを挿入
  document.getElementById("basemap-container").innerHTML = BASEMAP_SVG;
  document.getElementById("logo-img").setAttribute("href", LOGO_DATA);
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
