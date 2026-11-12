// Espaço Zero V9: desfazer, autosave/arquivo, janela do jogador, névoa estilizada, ataque.
(() => {
const P = ["player", "sala"].some(k => new URLSearchParams(location.search).has(k));
const fname = () => "Espaco_Zero_" + ((state.name || "Campanha").replace(/[\\/:*?"<>|\s]+/g, "_")) + ".rpg.json";
// ---- histórico (imagens grandes guardadas uma única vez)
const big = new Map(), bigArr = [];
const pack = s => JSON.stringify(s, (k, v) => typeof v === "string" && v.length > 800 ? "§" + (big.has(v) ? big.get(v) : (big.set(v, bigArr.length), bigArr.push(v), bigArr.length - 1)) : v);
const unpack = j => JSON.parse(j, (k, v) => typeof v === "string" && /^§\d+$/.test(v) ? bigArr[+v.slice(1)] : v);
let hist = [], idx = -1, applying = false, timer, pTimer, lastScene = null;
function snap() { if (applying) return; const j = pack(state); if (hist[idx] === j) return; hist = hist.slice(0, idx + 1); hist.push(j); if (hist.length > 60) hist.shift(); idx = hist.length - 1; }
function restore(i) {
  if (i < 0 || i >= hist.length) return status("Nada para " + (i < idx ? "desfazer" : "refazer"));
  idx = i; applying = true; state = normalizeState(unpack(hist[i])); selected = null; render(); hist[idx] = pack(state); applying = false;
  dirty = true; $("saveStatus").textContent = "Alterações não salvas"; autosave(); status(i < 0 ? "" : "Histórico aplicado");
}
// ---- backup no navegador + arquivo no PC
let fh = null;
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("espacoZero", 1); r.onupgradeneeded = () => r.result.createObjectStore("s"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbSet = async (k, v) => { const d = await idb(); d.transaction("s", "readwrite").objectStore("s").put(v, k); };
const idbGet = async k => { const d = await idb(); return new Promise(r => { const q = d.transaction("s").objectStore("s").get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(); }); };
let wTimer = 0, writing = false, again = false;
async function writeFile() {
  if (!fh) return; if (writing) { again = true; return; } writing = true;
  try { const w = await fh.createWritable(); await w.write(JSON.stringify(state)); await w.close(); dirty = false; idbSet("clean", true).catch(() => {}); $("saveStatus").textContent = "Salvo no arquivo ✔"; }
  catch { $("saveStatus").textContent = "Backup no navegador (arquivo indisponível)"; }
  writing = false; if (again) { again = false; writeFile(); }
}
async function autosave() {
  if (P) return;
  try { await idbSet("auto", JSON.stringify(state)); await idbSet("clean", false); } catch {}
  if (fh) { clearTimeout(wTimer); wTimer = setTimeout(writeFile, 1500); }
  else if (dirty) $("saveStatus").textContent = "Backup automático feito (salve num arquivo)";
}
$("saveCampaign").onclick = async () => {
  state.name = $("campaignName").value.trim() || "Minha Campanha";
  if (window.showSaveFilePicker) {
    try { fh = await showSaveFilePicker({ suggestedName: fname(), types: [{ description: "Campanha Espaço Zero", accept: { "application/json": [".json"] } }] }); await writeFile(); return status("Arquivo ligado: agora salva sozinho"); }
    catch (e) { if (e.name === "AbortError") return; fh = null; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: "application/json" })); a.download = fname(); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500); dirty = false; idbSet("clean", true).catch(() => {}); $("saveStatus").textContent = "Arquivo salvo"; status("Campanha salva no computador");
};
// ---- janela do jogador (postMessage, sem servidor)
let pw = null;
function pushPlayer() {
  if (!pw || pw.closed) return; const s = scene();
  // Não enviar dados privados do mestre para a janela compartilhada.
  const publicScene = { ...s }; delete publicScene.gmTools;
  pw.postMessage({ zero: 1, scene: publicScene, fresh: lastScene !== s.id,
    clues: window.zeroPublicClues?.() || [], urgency: window.zeroPublicUrgency?.() || null }, "*");
  lastScene = s.id;
}
if (P) {
  document.body.classList.add("player"); document.title = "Espaço Zero — Mesa";
  addEventListener("message", e => {
    if (!e.data?.zero) return;
    state = normalizeState({ scenes: [e.data.scene], active: e.data.scene.id }); selected = null; render();
    if (e.data.fresh || !window._got) centerView(); window._got = 1;
  });
  opener?.postMessage({ zeroReady: 1 }, "*");
} else {
  addEventListener("message", e => { if (e.data?.zeroReady) { lastScene = null; pushPlayer(); } });
  $("playerWin").onclick = () => { pw = open(location.href.split("?")[0] + "?player=1", "zeroPlayer", "width=1280,height=720"); if (!pw) alert("O navegador bloqueou a janela. Permita pop-ups para esta página."); };
}
// ---- ganchos
const _md = markDirty, _r = render;
markDirty = function (m) { _md(m); if (P) return; clearTimeout(timer); timer = setTimeout(() => { snap(); autosave(); pushPlayer(); }, 350); };
render = function () { _r(); $("fogVision").value = scene().fog.vision ?? 4; if (!P) { clearTimeout(pTimer); pTimer = setTimeout(pushPlayer, 120); } };
$("undoBtn").onclick = () => restore(idx - 1); $("redoBtn").onclick = () => restore(idx + 1);
addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); restore(idx - 1); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); restore(idx + 1); }
});
$("fogVision").onchange = e => { scene().fog.vision = clamp(+e.target.value || 0, 0, 20); drawFog(); markDirty("Visão ajustada"); };
// ---- névoa estilizada e animada + visão dos personagens
// Nuvens: tiles cinza gerados uma vez (sem emendas), em 3 camadas que deslizam em velocidades e direções diferentes.
const cloudCache = {};
function cloudTile(key, seed, rgb, alpha, clouds, rad, S) {
  if (cloudCache[key]) return cloudCache[key];
  const c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
  let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < clouds; i++) {
    const cx = rnd() * S, cy = rnd() * S, w = rad * (2 + rnd() * 2);
    for (let j = 0; j < 14; j++) {
      const t = (rnd() + rnd() - 1), x = cx + t * w, y = cy + (rnd() - .5) * rad * .7 - Math.abs(t) * rad * .25, q = rad * (.45 + rnd() * .55) * (1 - Math.abs(t) * .35);
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, q);
        gr.addColorStop(0, `rgba(${rgb},${alpha})`); gr.addColorStop(.5, `rgba(${rgb},${alpha * .8})`); gr.addColorStop(.85, `rgba(${rgb},${alpha * .25})`); gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y + dy, q, 0, 7); g.fill();
      }
    }
  }
  return cloudCache[key] = c.toDataURL();
}
const cloudLayer = (id, url, size, from, to, dur) => `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><image href="${url}" width="${size}" height="${size}"/><animateTransform attributeName="patternTransform" type="translate" from="${from}" to="${to}" dur="${dur}s" repeatCount="indefinite"/></pattern>`;
drawFog = function () {
  $("fogLayer")?.remove(); const f = scene().fog; if (!f?.on) return;
  const ops = fogDraft ? [...f.ops, fogDraft] : f.ops, solid = P || f.player;
  const rects = ops.map(o => `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${o.reveal ? "#000" : "#fff"}"/>`).join("");
  const R = (f.vision ?? 4) * SNAP;
  const eyes = R > 0 ? scene().tokens.filter(t => t.characterId && !isDead(t)).map(t => window.zeroEye ? zeroEye(t, R) : `<circle cx="${t.x + t.w / 2}" cy="${t.y + t.h / 2}" r="${R + t.w / 2}" fill="url(#fogEye)"/>`).join("") : "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "fogLayer"; svg.setAttribute("width", WORLD_W); svg.setAttribute("height", WORLD_H);
  svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:800";
  svg.innerHTML = `<defs><filter id="fogBlur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="9"/></filter>
    <radialGradient id="fogEye"><stop offset="0" stop-color="#000"/><stop offset=".6" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    ${cloudLayer("fogA", cloudTile("a", 11, "70,76,92", .9, 12, 120, 1536), 1536, "0 0", "1536 0", 170)}${cloudLayer("fogB", cloudTile("b", 29, "125,131,146", .6, 14, 90, 1024), 1024, "1024 0", "0 0", 115)}${cloudLayer("fogC", cloudTile("c", 47, "190,196,208", .32, 12, 70, 768), 768, "0 0", "768 768", 80)}
    <mask id="fogMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}"><rect width="${WORLD_W}" height="${WORLD_H}" fill="#fff"/><g filter="url(#fogBlur)">${rects}</g>${eyes}</mask></defs>
    <g mask="url(#fogMask)" opacity="${solid ? 1 : 0.6}"><rect width="${WORLD_W}" height="${WORLD_H}" fill="#2a2e39"/><rect width="${WORLD_W}" height="${WORLD_H}" fill="url(#fogA)"/><rect width="${WORLD_W}" height="${WORLD_H}" fill="url(#fogB)"/><rect width="${WORLD_W}" height="${WORLD_H}" fill="url(#fogC)"/></g>
    ${fogDraft ? `<rect x="${fogDraft.x}" y="${fogDraft.y}" width="${fogDraft.w}" height="${fogDraft.h}" fill="none" stroke="${fogDraft.reveal ? "#7ee787" : "#ff7b8a"}" stroke-width="${2 / zoom}" stroke-dasharray="${6 / zoom}"/>` : ""}`;
  $("world").append(svg);
};
// ---- ataque e dano
const stat = (t, k) => { const c = t.creatureId && state.bestiary.find(x => x.id === t.creatureId); return parseInt((c && c[k]) ?? vitalOwner(t)?.[k] ?? t[k]) || 0; };
function roll(expr) { const m = String(expr).replace(/\s/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i); if (!m) return null; const rs = Array.from({ length: Math.min(+m[1], 50) }, () => 1 + Math.floor(Math.random() * +m[2])); return { rs, tot: rs.reduce((a, b) => a + b, 0) + (+m[3] || 0) }; }
function attack(a, b, expr) {
  const r = roll(expr); if (!r || !b) return status("Fórmula inválida (ex.: 1d6+2)");
  const f = stat(a, "strength"), def = stat(b, "defenses"), dmg = Math.max(0, r.tot + f - def);
  adjustVital(b, "life", -dmg);
  showRoll(dmg, `${a.name} → ${b.name}: [${r.rs}] = ${r.tot} + Força ${f} − Defesas ${def}`, `${a.name} causou ${dmg} em ${b.name}`);
}
const _ri = renderInspector;
renderInspector = function () {
  _ri(); if (P) return; const t = selectedToken(); if (!t || !vitalOwner(t)) return;
  const foes = scene().tokens.filter(x => x.id !== t.id && vitalOwner(x) && !isDead(x)); if (!foes.length) return;
  const d = document.createElement("div"); d.className = "atkBox";
  d.innerHTML = `<div class="controlTitle">⚔ ATAQUE</div><label>Alvo<select id="atkTarget">${foes.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("")}</select></label><label>Dano base<input id="atkDice" value="1d6"></label><button id="atkGo" class="primary fullWidth">Atacar</button><p class="hint">Dano = dado + Força − Defesas do alvo (mín. 0).</p>`;
  $("inspectorContent").append(d);
  $("atkGo").onclick = () => attack(t, scene().tokens.find(x => x.id === $("atkTarget").value), $("atkDice").value);
};
// ---- início
snap();
if (!P) Promise.all([idbGet("auto"), idbGet("clean")]).then(([j, clean]) => { if (j && !clean && state.scenes.every(s => !s.tokens.length && !s.background) && confirm("Encontrei um backup automático da última sessão. Restaurar?")) { state = normalizeState(JSON.parse(j)); render(); snap(); } }).catch(() => {});
})();
