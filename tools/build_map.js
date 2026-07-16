/* OSMデータ(osm.json)から地図SVGを生成する */
const fs = require("fs");
const data = require("./osm.json");

const W = 1280, H = 720;

/* ---- 投影：びわ湖ホール付近を原点に、湖岸が水平になるよう回転 ---- */
const LAT0 = 35.0074, LON0 = 135.8770;
const M_PER_LAT = 110950, M_PER_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);

// 回転角：湖岸線の方向から算出（後で決める）。まず湖岸線の点を集める
const lake = data.elements.find(e => e.type === "relation" && e.id === 63499);
const inExt = (p) => p.lat > 35.0 && p.lat < 35.02 && p.lon > 135.86 && p.lon < 135.90;

let shorePts = [];
const shoreWays = [];
for (const m of (lake.members || [])) {
  if (m.type === "way" && m.geometry && m.geometry.some(inExt)) {
    shoreWays.push(m.geometry);
    shorePts = shorePts.concat(m.geometry.filter(inExt));
  }
}

// 最小二乗で湖岸の向きを推定
function meters(p) {
  return { x: (p.lon - LON0) * M_PER_LON, y: -(p.lat - LAT0) * M_PER_LAT };
}
const mpts = shorePts.map(meters);
const mx = mpts.reduce((s, p) => s + p.x, 0) / mpts.length;
const my = mpts.reduce((s, p) => s + p.y, 0) / mpts.length;
let sxy = 0, sxx = 0;
for (const p of mpts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
const slope = sxy / sxx;
let theta = -Math.atan(slope); // 湖岸を水平にする回転
console.log("shore angle deg:", (Math.atan(slope) * 180 / Math.PI).toFixed(1));

const COS = Math.cos(theta), SIN = Math.sin(theta);

/* 表示範囲：幅 SPAN_M メートル、中心を CX_M, CY_M（回転後座標）だけずらす */
const SPAN_M = 580;                // 横方向の実距離
const SCALE = W / SPAN_M;          // px per meter
const CX_M = 48, CY_M = 40;        // 回転後の中心オフセット（調整用）

function proj(p) {
  const m = meters(p);
  const rx = m.x * COS - m.y * SIN;
  const ry = m.x * SIN + m.y * COS;
  return { x: (rx - CX_M) * SCALE + W / 2, y: (ry - CY_M) * SCALE + H / 2 };
}

const fmt = (n) => Math.round(n * 10) / 10;
function pathOf(geom, close) {
  let d = "";
  geom.forEach((p, i) => {
    const q = proj(p);
    d += (i === 0 ? "M" : "L") + fmt(q.x) + "," + fmt(q.y);
  });
  return d + (close ? "Z" : "");
}

/* 画面内判定 */
function onScreen(geom, margin = 200) {
  return geom.some(p => {
    const q = proj(p);
    return q.x > -margin && q.x < W + margin && q.y > -margin && q.y < H + margin;
  });
}

/* ---- 湖岸線をつないで水域ポリゴンを作る ---- */
// 端点が一致するwayを連結
function stitch(ways) {
  const chains = ways.map(w => [...w]);
  let merged = true;
  while (merged && chains.length > 1) {
    merged = false;
    outer:
    for (let i = 0; i < chains.length; i++) {
      for (let j = 0; j < chains.length; j++) {
        if (i === j) continue;
        const a = chains[i], b = chains[j];
        const key = (p) => p.lat.toFixed(7) + "," + p.lon.toFixed(7);
        if (key(a[a.length - 1]) === key(b[0])) { chains[i] = a.concat(b.slice(1)); chains.splice(j, 1); merged = true; break outer; }
        if (key(a[a.length - 1]) === key(b[b.length - 1])) { chains[i] = a.concat(b.slice().reverse().slice(1)); chains.splice(j, 1); merged = true; break outer; }
        if (key(a[0]) === key(b[b.length - 1])) { chains[i] = b.concat(a.slice(1)); chains.splice(j, 1); merged = true; break outer; }
        if (key(a[0]) === key(b[0])) { chains[i] = b.slice().reverse().concat(a.slice(1)); chains.splice(j, 1); merged = true; break outer; }
      }
    }
  }
  chains.sort((x, y) => y.length - x.length);
  return chains[0];
}

const shoreline = stitch(shoreWays).filter(inExt);
// 投影して左→右に並べる
let shoreProj = shoreline.map(proj);
if (shoreProj[0].x > shoreProj[shoreProj.length - 1].x) shoreProj.reverse();
// 水域ポリゴン：湖岸線＋上方向へ閉じる
let waterD = "M" + shoreProj.map(q => fmt(q.x) + "," + fmt(q.y)).join("L");
waterD += `L${W + 400},${fmt(shoreProj[shoreProj.length - 1].y)} L${W + 400},-400 L-400,-400 L-400,${fmt(shoreProj[0].y)} Z`;

/* ---- レイヤー生成 ---- */
let svg = { green: "", water: "", roadCase: "", road: "", foot: "", bldg: "", pier: "" };

/* なぎさ公園（マルチポリゴン）を緑地として描画 */
const data2 = require("./osm2.json");
const nagisa = data2.elements.find(e => e.type === "relation" && e.id === 9503807);
if (nagisa) {
  const outers = nagisa.members.filter(m => m.role === "outer" && m.geometry);
  // 端点一致でリングに連結
  let rings = outers.map(m => [...m.geometry]);
  const key = (p) => p.lat.toFixed(7) + "," + p.lon.toFixed(7);
  let merged = true;
  while (merged) {
    merged = false;
    outer:
    for (let i = 0; i < rings.length; i++) {
      const a = rings[i];
      if (key(a[0]) === key(a[a.length - 1])) continue; // 既に閉じている
      for (let j = 0; j < rings.length; j++) {
        if (i === j) continue;
        const b = rings[j];
        if (key(a[a.length - 1]) === key(b[0])) { rings[i] = a.concat(b.slice(1)); rings.splice(j, 1); merged = true; break outer; }
        if (key(a[a.length - 1]) === key(b[b.length - 1])) { rings[i] = a.concat(b.slice().reverse().slice(1)); rings.splice(j, 1); merged = true; break outer; }
        if (key(a[0]) === key(b[b.length - 1])) { rings[i] = b.concat(a.slice(1)); rings.splice(j, 1); merged = true; break outer; }
        if (key(a[0]) === key(b[0])) { rings[i] = b.slice().reverse().concat(a.slice(1)); rings.splice(j, 1); merged = true; break outer; }
      }
    }
  }
  rings.forEach(r => {
    if (r.length > 3 && onScreen(r)) svg.green += `<path d="${pathOf(r, true)}" fill="#cde3b8"/>\n`;
  });
  console.log("nagisa park rings:", rings.length);
}

for (const e of data.elements) {
  if (!e.tags || !e.geometry || !onScreen(e.geometry)) continue;
  const t = e.tags;

  if (t.leisure && ["park", "garden", "pitch", "playground", "sports_centre"].includes(t.leisure) ||
      (t.landuse && ["grass", "recreation_ground", "forest"].includes(t.landuse)) ||
      (t.natural && ["wood", "scrub"].includes(t.natural))) {
    svg.green += `<path d="${pathOf(e.geometry, true)}" fill="#cde3b8"/>\n`;
  } else if (t.natural === "water" && e.type === "way") {
    svg.water += `<path d="${pathOf(e.geometry, true)}" fill="#aacfe6"/>\n`;
  } else if (t.man_made === "pier") {
    svg.pier += `<path d="${pathOf(e.geometry, false)}" stroke="#d8cfc0" stroke-width="6" fill="none" stroke-linecap="round"/>\n`;
  } else if (t.building) {
    const isHall = t.name && t.name.includes("びわ湖ホール");
    const fill = isHall ? "#ffffff" : "#e6e3da";
    svg.bldg += `<path d="${pathOf(e.geometry, true)}" fill="${fill}" stroke="#c5c2b8" stroke-width="1.2"/>\n`;
  } else if (t.highway) {
    const cls = t.highway;
    if (["trunk", "primary", "trunk_link", "primary_link"].includes(cls)) {
      svg.roadCase += `<path d="${pathOf(e.geometry)}" stroke="#c9c4b8" stroke-width="15" fill="none" stroke-linecap="round"/>\n`;
      svg.road += `<path d="${pathOf(e.geometry)}" stroke="#f7f3ea" stroke-width="12" fill="none" stroke-linecap="round"/>\n`;
    } else if (["secondary", "tertiary", "secondary_link", "unclassified"].includes(cls)) {
      svg.roadCase += `<path d="${pathOf(e.geometry)}" stroke="#ccc7bb" stroke-width="11" fill="none" stroke-linecap="round"/>\n`;
      svg.road += `<path d="${pathOf(e.geometry)}" stroke="#ffffff" stroke-width="8.5" fill="none" stroke-linecap="round"/>\n`;
    } else if (["residential", "service", "living_street", "pedestrian"].includes(cls)) {
      svg.road += `<path d="${pathOf(e.geometry)}" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"/>\n`;
    } else if (["footway", "path", "cycleway", "steps", "track"].includes(cls)) {
      svg.foot += `<path d="${pathOf(e.geometry)}" stroke="#dcd3bd" stroke-width="2.2" fill="none" stroke-linecap="round"/>\n`;
    }
  }
}

/* びわ湖ホールのラベル位置 */
const hall = data.elements.find(e => e.tags && e.tags.name && e.tags.name.includes("びわ湖ホール") && e.geometry);
const hc = hall.geometry.reduce((s, p) => { const q = proj(p); return { x: s.x + q.x / hall.geometry.length, y: s.y + q.y / hall.geometry.length }; }, { x: 0, y: 0 });
console.log("hall label at", fmt(hc.x), fmt(hc.y));

const out = `<g id="basemap">
<rect x="0" y="0" width="${W}" height="${H}" fill="#f2efe8"/>
<g id="green">${svg.green}</g>
<g id="water"><path d="${waterD}" fill="#aacfe6"/>${svg.water}</g>
<g id="pier">${svg.pier}</g>
<g id="roads">${svg.roadCase}${svg.road}${svg.foot}</g>
<g id="buildings">${svg.bldg}</g>
</g>`;

fs.writeFileSync("basemap.svg.fragment", out);
fs.writeFileSync("preview.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${out}</svg>`);
// サイト用：JS文字列として出力
const js = `/* このファイルは tools/build_map.js が OpenStreetMap データから自動生成したものです。
   手で編集しないでください（再生成すると消えます）。
   地図データ © OpenStreetMap contributors (ODbL) */
const BASEMAP_SVG = ${JSON.stringify(out.replace(/\n/g, ""))};
`;
fs.writeFileSync("basemap.js", js);
console.log("written. fragment bytes:", out.length);

/* ラベル用の座標を出力 */
function centroidOf(geom){const c=geom.reduce((s,p)=>{const q=proj(p);return{x:s.x+q.x/geom.length,y:s.y+q.y/geom.length}},{x:0,y:0});return c;}
for (const e of data.elements) {
  if (!e.tags || !e.geometry) continue;
  const n = e.tags.name || "";
  if (/ピアザ淡海|なぎさ通り|Ｏ’ｓｔｅ|オーパ|アヤハ|なぎさのテラス|大津港|プリンス/.test(n)) {
    const c = centroidOf(e.geometry);
    if (c.x>-100&&c.x<1400&&c.y>-100&&c.y<800) console.log("LABEL:", n, fmt(c.x), fmt(c.y), e.tags.highway||e.tags.building||"");
  }
}
