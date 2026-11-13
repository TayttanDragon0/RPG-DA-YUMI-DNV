// Espaço Zero V11: paredes + luz, bestiário descoberto, itens e equipamento
(() => {
const P = ["player", "sala"].some(k => new URLSearchParams(location.search).has(k));
const CELL = 16, GW = Math.ceil(WORLD_W / CELL), GH = Math.ceil(WORLD_H / CELL), uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => escapeHtml(String(s ?? ""));
// ================= PAREDES E LUZ =================
let grid = new Uint8Array(GW * GH), gridSrc = null, wallMode = false, erase = false, brush = 2, show = false, wallRevision = 0;
const eyeCache = new Map();
const gridFor = () => { const w = scene().walls; if (gridSrc !== w) { grid = new Uint8Array(GW * GH); (w || []).forEach(i => grid[i] = 1); gridSrc = w; wallRevision++; eyeCache.clear(); window.zeroWallRevision = wallRevision; } return grid; };
const cv = document.createElement("canvas"); cv.id = "wallLayer"; cv.width = GW; cv.height = GH; cv.style.cssText = `position:absolute;left:0;top:0;width:${WORLD_W}px;height:${WORLD_H}px;image-rendering:pixelated;pointer-events:none;z-index:700`;
function drawWalls() {
  if (P) return; if (!cv.isConnected) $("world").append(cv); const g = gridFor(), x = cv.getContext("2d");
  x.clearRect(0, 0, GW, GH); x.fillStyle = "rgba(255,70,120,.6)"; for (let i = 0; i < g.length; i++) if (g[i]) x.fillRect(i % GW, (i / GW) | 0, 1, 1);
  cv.style.display = wallMode || show ? "block" : "none";
}
window.zeroEye = (t, R) => {
  const cx = t.x + t.w / 2, cy = t.y + t.h / 2, rad = R + t.w / 2;
  const walls = scene().walls || [];
  if (walls.length) gridFor();
  const cacheKey = `${Math.round(cx/4)}:${Math.round(cy/4)}:${Math.round(rad)}:${walls.length}:${wallRevision}`;
  if (eyeCache.has(cacheKey)) return eyeCache.get(cacheKey);
  if (!walls.length) {
    const circle = `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="#000"/>`;
    eyeCache.set(cacheKey, circle); if (eyeCache.size > 700) eyeCache.delete(eyeCache.keys().next().value); return circle;
  }
  const g = gridFor(), pts = [];
  for (let k = 0; k < 120; k++) {
    const a = k / 120 * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a); let d = 0;
    for (; d < rad; d += 6) { if (d > CELL * 1.5 && g[Math.floor((cy + dy * d) / CELL) * GW + Math.floor((cx + dx * d) / CELL)]) break; }
    d = Math.min(rad, d + CELL * .5); pts.push(`${(cx + dx * d).toFixed(0)},${(cy + dy * d).toFixed(0)}`);
  }
  const polygon = `<polygon points="${pts.join(" ")}" fill="#000"/>`;
  eyeCache.set(cacheKey, polygon); if (eyeCache.size > 700) eyeCache.delete(eyeCache.keys().next().value); return polygon;
};
if (!P) {
  const bar = document.createElement("div"); bar.id = "wallBar"; bar.className = "wallBar";
  bar.innerHTML = `<button id="wbToggle">🧱 Pincel de paredes</button><span id="wbOpts" class="hidden"><button id="wbMode" class="primary">Pintar</button> Tamanho <input id="wbSize" type="range" min="1" max="8" value="2"> <label><input id="wbShow" type="checkbox"> mostrar</label> <button id="wbClear">Limpar</button></span>`;
  document.body.append(bar);
  $("wbToggle").onclick = () => { wallMode = !wallMode; $("wbOpts").classList.toggle("hidden", !wallMode); $("wbToggle").classList.toggle("active", wallMode); drawWalls(); };
  $("wbMode").onclick = () => { erase = !erase; $("wbMode").textContent = erase ? "Apagar" : "Pintar"; };
  $("wbSize").oninput = e => brush = +e.target.value; $("wbShow").onchange = e => { show = e.target.checked; drawWalls(); };
  $("wbClear").onclick = () => { if (confirm("Apagar todas as paredes desta cena?")) { scene().walls = []; drawWalls(); drawFog(); markDirty("Paredes limpas"); } };
  $("viewport").addEventListener("pointerdown", e => {
    if (!wallMode || e.button > 0) return; e.stopPropagation(); e.preventDefault();
    const paint = ev => { const p = worldPoint(ev), cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), g = gridFor();
      for (let y = -brush; y <= brush; y++) for (let x = -brush; x <= brush; x++) { const gx = cx + x, gy = cy + y; if (x * x + y * y > brush * brush + 1 || gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; g[gy * GW + gx] = erase ? 0 : 1; } drawWalls(); };
    const up = () => { removeEventListener("pointermove", paint); removeEventListener("pointerup", up); const a = []; grid.forEach((v, i) => v && a.push(i)); scene().walls = a; gridSrc = a; wallRevision++; window.zeroWallRevision = wallRevision; eyeCache.clear(); drawFog(); markDirty("Paredes alteradas"); };
    paint(e); addEventListener("pointermove", paint); addEventListener("pointerup", up);
  }, true);
}
// ================= BESTIÁRIO DESCOBERTO =================
const STAGES = [["fisicas", "Aparência"], ["comportamento", "Comportamento"], ["onde", "Onde vive"], ["poderes", "Poderes"], ["necessidades", "Necessidades"], ["utilidades", "Utilidades"], ["curiosidade", "Curiosidade"]];
window.zeroBest = (charId = null) => state.bestiary.map(c => {
  const n = charId ? Math.max(0, Math.min(STAGES.length, Number(c.knowledge?.[charId] ?? c.revealed ?? 0))) : Number(c.revealed || 0);
  return { c, n };
}).filter(x => x.n > 0).map(({c,n}) => ({ id: c.id, name: c.name, color: c.color, n, fields: STAGES.slice(0, n).map(([k, label]) => [label, c[k] || "—"]) }));
// ================= ITENS =================
const itemById = id => (state.items || []).find(i => i.id === id);
window.zeroItemsView = () => Object.fromEntries((state.items || []).map(i => [i.id, { name: i.name, src: i.src, kind: i.kind, lightRadius: Number(i.lightRadius) || (i.id === "builtin-torch" ? 440 : 0) }]));
const computeHeld = t => { const ch = t.characterId && state.characters.find(c => c.id === t.characterId); return (ch?.bag || []).filter(b => b.hand && itemById(b.itemId)).map(b => { const item = itemById(b.itemId); return { itemId: item.id, name: item.name, hand: b.hand, src: item.src, lightRadius: Number(item.lightRadius) || (item.id === "builtin-torch" ? 440 : 0) }; }); };
window.zeroHeld = t => computeHeld(t);
let lightLayerKey = "";
// Raio de luz de um token solto no mapa. lightRadius explícito (inclusive 0) manda; a tocha embutida tem padrão.
const tokenLightRadius = t => {
  if (!t || t.lit === false) return 0;
  if (t.lightRadius != null && Number.isFinite(Number(t.lightRadius))) return Math.max(0, Number(t.lightRadius));
  return t.assetId === "builtin-torch" ? 440 : 0;
};
// Todas as fontes de luz da cena: objetos acesos no mapa + itens de luz equipados na mão.
window.zeroLightSources = () => {
  const out = [];
  scene().tokens.forEach(t => {
    const r = tokenLightRadius(t);
    if (r > 0) out.push({ x: t.x + t.w / 2, y: t.y + t.h * .3, r, tokenId: t.id, kind: "ground" });
    (t.held || computeHeld(t)).forEach(h => { const hr = Number(h.lightRadius) || 0; if (hr > 0) out.push({ x: t.x + (h.hand === "L" ? t.w * .22 : t.w * .78), y: t.y + t.h * .38, r: hr, tokenId: t.id, kind: "held", hand: h.hand, itemId: h.itemId }); });
  });
  return out;
};
window.zeroDrawLights = () => {
  const world = $("world"); if (!world) return;
  const sources = window.zeroLightSources();
  gridFor();
  const key = sources.map(l => `${l.tokenId}:${Math.round(l.x / 4)},${Math.round(l.y / 4)}:${l.r}`).join("|") + `#${wallRevision}`;
  const old = $("torchLightLayer");
  if (old?.isConnected && old.parentNode === world && key === lightLayerKey) return;
  old?.remove(); lightLayerKey = key;
  if (!sources.length) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "torchLightLayer"; svg.setAttribute("width", WORLD_W); svg.setAttribute("height", WORLD_H);
  svg.style.cssText = "position:absolute;left:0;top:0;width:5000px;height:3200px;pointer-events:none;z-index:3";
  const defs = [], shapes = [];
  sources.forEach((l, index) => {
    const id = `torchGlow${index}`;
    defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${l.x}" cy="${l.y}" r="${l.r}"><stop offset="0" stop-color="#ffe9a3" stop-opacity=".38"/><stop offset=".38" stop-color="#ffb347" stop-opacity=".22"/><stop offset=".76" stop-color="#e87928" stop-opacity=".08"/><stop offset="1" stop-color="#e87928" stop-opacity="0"/></radialGradient>`);
    const shape = window.zeroEye?.({ x: l.x - 4, y: l.y - 4, w: 8, h: 8 }, l.r) || `<circle cx="${l.x}" cy="${l.y}" r="${l.r}" fill="#000"/>`;
    shapes.push(shape.replace(/fill="#000"/g, `fill="url(#${id})"`));
  });
  svg.innerHTML = `<defs>${defs.join("")}</defs>${shapes.join("")}`; world.append(svg);
};
const _rw = renderWorld;
renderWorld = function () {
  _rw(); drawWalls(); window.zeroDrawLights?.();
  scene().tokens.forEach(t => { const el = document.querySelector(`[data-id="${t.id}"]`); if (!el) return; el.querySelectorAll(".heldItem").forEach(x => x.remove());
    (t.held || computeHeld(t)).forEach(h => { const i = document.createElement("img"); i.className = "heldItem hand-" + h.hand + (h.itemId === "builtin-torch" ? " torchHeld" : ""); i.src = h.src; i.alt = h.name || "Equipamento"; i.dataset.itemId = h.itemId || ""; el.append(i); }); });
};

// ================= ENTREGA DE OBJETOS AO JOGADOR =================
function ensureItemFromAsset(a) {
  const id = a.id === "builtin-torch" ? "builtin-torch" : "asset-" + a.id;
  state.items = state.items || [];
  let it = itemById(id);
  if (!it) {
    it = { id, name: a.name, src: a.src || objectIconSvg(a.icon || "📦"), kind: a.kind || "equip", lightRadius: Number(a.lightRadius) || 0, description: a.description || "", props: normalizeObjectProps(a.props), fromAsset: a.id };
    state.items.push(it);
  }
  return it;
}
function ensureItemFromToken(t) {
  const a = t.assetId && state.assets.find(x => x.id === t.assetId);
  if (a) return ensureItemFromAsset(a);
  const id = "tok-" + (t.assetId || t.id);
  state.items = state.items || [];
  let it = itemById(id);
  if (!it) { it = { id, name: t.name || "Objeto", src: t.src || objectIconSvg(t.icon || "📦"), kind: "equip", lightRadius: tokenLightRadius(t), description: t.objectDescription || "", props: normalizeObjectProps(t.objectProps) }; state.items.push(it); }
  return it;
}
function giveItem(ch, itemId) {
  if (!ch) return; const it = itemById(itemId); if (!it) return;
  (ch.bag = ch.bag || []).push({ uid: uid(), itemId, hand: "" });
  logAction(`Mestre deu ${it.name} a ${ch.name}`, "itens");
  markDirty("Item entregue"); renderWorld(); window.zeroRefreshItems?.();
  status(`🎒 ${it.name} entregue a ${ch.name}`);
}
function chooseCharacter(title, cb) {
  if (!state.characters.length) return status("Crie um personagem primeiro");
  const m = document.createElement("div"); m.className = "pickModal";
  m.innerHTML = `<div class="pickCard"><h2>${esc(title)}</h2>${state.characters.map(c => `<button data-id="${esc(c.id)}">${esc(c.name)}</button>`).join("")}<button data-x="1">Cancelar</button></div>`;
  m.onclick = e => { const b = e.target.closest("button"); if (e.target === m || (b && b.dataset.x)) return m.remove(); if (b) { m.remove(); cb(state.characters.find(c => c.id === b.dataset.id)); } };
  document.body.append(m);
}
window.zeroGiveAsset = assetId => { const a = state.assets.find(x => x.id === assetId); if (a) chooseCharacter(`Dar “${a.name}” para…`, ch => giveItem(ch, ensureItemFromAsset(a).id)); };
window.zeroBagMsg = (ch, m) => {
  const b = (ch.bag || []).find(x => x.uid === m.uid), it = b && itemById(b.itemId);
  if (!["equip", "unequip", "use", "drop"].includes(m.t) || !it) return false;
  if (m.t === "equip" && ["R", "L"].includes(m.hand)) { ch.bag.forEach(x => { if (x.hand === m.hand) x.hand = ""; }); b.hand = m.hand; logAction(`${ch.name} equipou ${it.name} (mão ${m.hand === "R" ? "direita" : "esquerda"})`, "itens"); }
  else if (m.t === "unequip") { b.hand = ""; logAction(`${ch.name} guardou ${it.name}`, "itens"); }
  else if (m.t === "use" && it.kind === "consume") { ch.bag = ch.bag.filter(x => x !== b); logAction(`${ch.name} usou ${it.name}`, "itens"); showRoll("✔", `${ch.name} usou ${it.name}`, `${ch.name} usou ${it.name}`); }
  else if (m.t === "drop") { ch.bag = ch.bag.filter(x => x !== b); logAction(`${ch.name} descartou ${it.name}`, "itens"); }
  else return true;
  renderWorld(); markDirty("Item alterado"); return true;
};
window.zeroBagUI = (el, bag, items, send, best) => {
  const entries = Array.isArray(bag) ? bag : [];
  const catalog = items && typeof items === "object" ? items : {};
  el.innerHTML = `<div class="mpBagTitle"><div><b>🎒 Sua bolsa</b><small>${entries.length} item${entries.length === 1 ? "" : "s"}</small></div><span>Itens entregues pelo mestre aparecem aqui.</span></div><div class="bagGrid">${entries.map(b => {
    const i = catalog[b.itemId];
    const name = i?.name || "Item indisponível";
    const src = i?.src || "";
    return `<article class="bagTile ${b.hand ? "equipped" : ""}"><div class="bagTileArt">${src ? `<img src="${src}" alt="${esc(name)}">` : `<span>📦</span>`}</div><b>${esc(name)}</b>${b.hand ? `<small class="bagEquipped">Equipado · mão ${b.hand === "R" ? "direita" : "esquerda"}</small>` : `<small>Não equipado</small>`}<div class="bagActions"><button data-a="equip" data-h="R" data-u="${esc(b.uid)}" ${!i ? "disabled" : ""}>Mão D</button><button data-a="equip" data-h="L" data-u="${esc(b.uid)}" ${!i ? "disabled" : ""}>Mão E</button>${b.hand ? `<button data-a="unequip" data-u="${esc(b.uid)}">Guardar</button>` : ""}${i?.kind === "consume" ? `<button data-a="use" data-u="${esc(b.uid)}">Usar</button>` : ""}<button data-a="drop" data-u="${esc(b.uid)}">Descartar</button></div></article>`;
  }).join("") || `<div class="mpBagEmpty"><span>🎒</span><b>Sua bolsa está vazia</b><p>Quando o mestre entregar um item, ele aparecerá automaticamente aqui.</p></div>`}</div>`;
  el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => send({ t: b.dataset.a, uid: b.dataset.u, hand: b.dataset.h }));
};
if (!P) {
  const btn = document.createElement("button"); btn.id = "itemBtn"; btn.textContent = "🎁"; btn.title = "Itens"; $("playerWin").before(btn);
  const pn = document.createElement("div"); pn.id = "itemPanel"; pn.className = "logPanel itemPanel hidden"; document.body.append(pn);
  const draw = () => {
    const its = state.items || []; state.masterBag = state.masterBag || [];
    const chars = state.characters || [];
    const charOpts = chars.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    const assetOpts = (state.assets || []).map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
    const bags = chars.map(c => `<div class="bagRow"><b>${esc(c.name)}</b><div class="bagChips">${(c.bag || []).map(b => { const i = itemById(b.itemId); return i ? `<span class="bagChip"><img src="${i.src}" alt=""> ${esc(i.name)}${b.hand ? ` · mão ${b.hand === "R" ? "D" : "E"}` : ""}<button data-rm="${esc(c.id)}|${esc(b.uid)}" title="Remover da bolsa">✕</button></span>` : ""; }).join("") || "<small class='hint'>bolsa vazia</small>"}</div></div>`).join("") || "<p class='hint'>Crie um personagem para ele ter bolsa.</p>";
    pn.innerHTML = `<div class="logHead"><b>🎁 Itens e bolsas</b><label class="fileButton">+ PNG<input id="itemFile" type="file" accept="image/*" multiple hidden></label><button id="itemX">✕</button></div><div class="itemBody">
      <h3>➕ Dar objeto da biblioteca</h3>
      <div class="giveRow"><select id="gaAsset">${assetOpts}</select><select id="gaChar">${charOpts}</select><button id="gaGo" class="primary">🎒 Dar</button></div>
      <p class="hint">Qualquer objeto da aba Objetos pode ir para a bolsa. Também há o botão 🎒 em cada objeto da biblioteca e, no Inspetor, em objetos já colocados na mesa.</p>
      <h3>🎒 Bolsas dos jogadores</h3>${bags}
      <h3>📦 Itens cadastrados</h3>${its.map(i => `<div class="itemRow"><img src="${i.src}" alt=""><div><input data-n="${i.id}" value="${esc(i.name)}"><label><input type="checkbox" data-k="${i.id}" ${i.kind === "consume" ? "checked" : ""}> consumível</label></div><div><select data-g="${i.id}">${charOpts}</select><button data-master="${i.id}">+ Mestre</button><button data-give="${i.id}">Dar ao jogador</button><button data-del="${i.id}">🗑</button></div></div>`).join("") || "<p class='hint'>Nenhum item ainda.</p>"}
      <h3>🧰 Inventário do mestre</h3><div class="masterBagGrid">${state.masterBag.map((b, idx) => { const i = itemById(b.itemId); return i ? `<div class="bagTile"><img src="${i.src}" alt=""><small>${esc(i.name)}</small><div><button data-mgive="${idx}">Dar</button><button data-mdel="${idx}">✕</button></div></div>` : ""; }).join("") || "<p class='hint'>Vazio. Use + Mestre nos itens.</p>"}</div></div>`;
    $("itemX").onclick = () => pn.classList.add("hidden");
    $("gaGo").onclick = () => { const a = state.assets.find(x => x.id === $("gaAsset").value), ch = chars.find(c => c.id === $("gaChar").value); if (!a || !ch) return status("Escolha o objeto e o personagem"); giveItem(ch, ensureItemFromAsset(a).id); draw(); };
    $("itemFile").onchange = e => [...e.target.files].forEach(f => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 256 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.max(1, im.width * k); c.height = Math.max(1, im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); (state.items = state.items || []).push({ id: uid(), name: f.name.replace(/\.[^.]+$/, ""), src: c.toDataURL("image/png"), kind: "equip" }); markDirty("Item importado"); draw(); }; im.src = r.result; }; r.readAsDataURL(f); });
    pn.querySelectorAll("[data-n]").forEach(i => i.onchange = () => { itemById(i.dataset.n).name = i.value; markDirty("Item renomeado"); });
    pn.querySelectorAll("[data-k]").forEach(i => i.onchange = () => { itemById(i.dataset.k).kind = i.checked ? "consume" : "equip"; markDirty("Item alterado"); });
    pn.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { state.items = state.items.filter(i => i.id !== b.dataset.del); state.characters.forEach(c => c.bag = (c.bag || []).filter(x => x.itemId !== b.dataset.del)); markDirty("Item removido"); draw(); renderWorld(); });
    pn.querySelectorAll("[data-master]").forEach(b => b.onclick = () => { state.masterBag.push({ uid: uid(), itemId: b.dataset.master }); markDirty("Item guardado no inventário do mestre"); draw(); });
    pn.querySelectorAll("[data-mdel]").forEach(b => b.onclick = () => { state.masterBag.splice(Number(b.dataset.mdel), 1); markDirty("Item removido do inventário do mestre"); draw(); });
    pn.querySelectorAll("[data-mgive]").forEach(b => b.onclick = () => { const idx = Number(b.dataset.mgive), entry = state.masterBag[idx]; if (!entry) return; chooseCharacter("Dar para…", ch => { giveItem(ch, entry.itemId); state.masterBag.splice(idx, 1); markDirty("Mestre entregou item"); draw(); }); });
    pn.querySelectorAll("[data-give]").forEach(b => b.onclick = () => { const ch = chars.find(c => c.id === pn.querySelector(`[data-g="${b.dataset.give}"]`).value); if (!ch) return; giveItem(ch, b.dataset.give); draw(); });
    pn.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const [cid, u] = b.dataset.rm.split("|"), ch = chars.find(c => c.id === cid); if (!ch) return; ch.bag = (ch.bag || []).filter(x => x.uid !== u); markDirty("Item removido da bolsa"); renderWorld(); draw(); });
  };
  window.zeroRefreshItems = () => { if (!pn.classList.contains("hidden")) draw(); };
  btn.onclick = () => { pn.classList.toggle("hidden"); draw(); };
  // Botão 🎒 em cada objeto da biblioteca
  const _rl = renderLibrary;
  renderLibrary = function () {
    _rl(); if (libraryMode !== "assets") return;
    [...$("library").querySelectorAll(".libItem")].forEach((el, i) => {
      const a = state.assets[i]; if (!a) return;
      const b = document.createElement("button"); b.className = "libGive"; b.type = "button"; b.textContent = "🎒"; b.title = "Dar a um jogador (bolsa)";
      b.draggable = false; b.addEventListener("pointerdown", e => e.stopPropagation());
      b.addEventListener("click", e => { e.stopPropagation(); window.zeroGiveAsset(a.id); });
      el.append(b);
    });
  };
  // Inspetor: objetos na mesa → bolsa e luz
  const _riObj = renderInspector;
  renderInspector = function () {
    _riObj(); const t = selectedToken(); if (!t || t.type !== "Objeto") return;
    const d = document.createElement("div"); d.className = "atkBox";
    const sq = Math.round(tokenLightRadius(t) / SNAP * 2) / 2;
    d.innerHTML = `<div class="controlTitle">🎒 BOLSA DO JOGADOR</div><p class="hint">Entregue este objeto à bolsa de um personagem.</p><div class="actionRow"><button id="objGive">Dar uma cópia</button><button id="objTake" class="primary">Pegar do mapa</button></div><div class="controlTitle" style="margin-top:10px">💡 LUZ</div><label>Raio de luz (quadrados, 0 = sem luz)<input id="objLight" type="number" min="0" max="40" step="0.5" value="${sq}"></label><label class="checkLabel"><input type="checkbox" id="objLit" ${t.lit === false ? "" : "checked"}> Acesa</label>`;
    $("inspectorContent").append(d);
    $("objGive").onclick = () => chooseCharacter(`Dar “${t.name}” para…`, ch => giveItem(ch, ensureItemFromToken(t).id));
    $("objTake").onclick = () => chooseCharacter(`Guardar “${t.name}” na bolsa de…`, ch => { giveItem(ch, ensureItemFromToken(t).id); scene().tokens = scene().tokens.filter(x => x.id !== t.id); selected = null; render(); markDirty("Objeto guardado na bolsa"); });
    $("objLight").onchange = e => { t.lightRadius = Math.max(0, Number(e.target.value) || 0) * SNAP; renderWorld(); markDirty("Luz alterada"); };
    $("objLit").onchange = e => { t.lit = e.target.checked; renderWorld(); markDirty(t.lit ? "Luz acesa" : "Luz apagada"); };
  };

  const _ri = renderInspector;
  renderInspector = function () {
    _ri(); const t = selectedToken(), c = t && t.creatureId && state.bestiary.find(x => x.id === t.creatureId); if (!c) return;
    c.knowledge = c.knowledge || {};
    const chars = state.characters || [];
    const currentId = chars[0]?.id || "";
    const nFor = id => Math.max(0, Math.min(STAGES.length, Number(c.knowledge[id] ?? 0)));
    const d = document.createElement("div"); d.className = "atkBox";
    d.innerHTML = `<div class="controlTitle">📖 CONHECIMENTO DO BESTIÁRIO</div><p class="hint">Defina exatamente o quanto cada jogador conhece sobre esta criatura.</p><label>Jogador <select id="bWho">${chars.map(ch => `<option value="${esc(ch.id)}">${esc(ch.name)}</option>`).join("")}</select></label><p id="bKnow" class="hint"></p><div class="actionRow"><button id="bRev" class="primary">+ Revelar próximo</button><button id="bHide">− Esconder último</button><button id="bAll">Revelar tudo</button></div>`;
    $("inspectorContent").append(d);
    const who = $("bWho"), info = $("bKnow");
    const refresh = () => { const n = nFor(who.value); info.textContent = `Este jogador sabe ${n}/${STAGES.length}${n < STAGES.length ? " · próxima: " + STAGES[n][1] : " · tudo revelado"}`; };
    who.value = currentId; refresh(); who.onchange = refresh;
    $("bRev").onclick = () => { const id = who.value, n = nFor(id); if (n >= STAGES.length) return; c.knowledge[id] = n + 1; logAction(`Bestiário: ${c.name} — ${STAGES[n][1]} revelada para ${chars.find(x=>x.id===id)?.name||"jogador"}`, "itens"); markDirty("Conhecimento revelado"); refresh(); };
    $("bHide").onclick = () => { const id = who.value; c.knowledge[id] = Math.max(0, nFor(id) - 1); markDirty("Conhecimento escondido"); refresh(); };
    $("bAll").onclick = () => { c.knowledge[who.value] = STAGES.length; markDirty("Bestiário totalmente revelado"); refresh(); };
  };
}
gridFor(); window.zeroDrawLights?.();
})();
