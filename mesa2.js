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
window.zeroDrawLights = () => {
  const world = $("world"); if (!world) return;
  const sources = scene().tokens.flatMap(t => (t.held || computeHeld(t)).filter(h => Number(h.lightRadius) > 0).map(h => ({ t, h })));
  gridFor();
  const key = sources.map(({t,h}) => `${t.id}:${Math.round(t.x/4)},${Math.round(t.y/4)}:${h.itemId}:${h.hand}:${h.lightRadius}`).join("|") + `#${wallRevision}`;
  const old = $("torchLightLayer");
  if (old?.isConnected && old.parentNode === world && key === lightLayerKey) return;
  old?.remove(); lightLayerKey = key;
  if (!sources.length) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "torchLightLayer"; svg.setAttribute("width", WORLD_W); svg.setAttribute("height", WORLD_H);
  svg.style.cssText = "position:absolute;left:0;top:0;width:5000px;height:3200px;pointer-events:none;z-index:3";
  const defs = [], shapes = [];
  sources.forEach(({t,h}, index) => {
    const x = t.x + (h.hand === "L" ? t.w * .22 : t.w * .78), y = t.y + t.h * .38, r = Number(h.lightRadius) || 440, id = `torchGlow${index}`;
    defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${x}" cy="${y}" r="${r}"><stop offset="0" stop-color="#ffe9a3" stop-opacity=".34"/><stop offset=".38" stop-color="#ffb347" stop-opacity=".20"/><stop offset=".76" stop-color="#e87928" stop-opacity=".07"/><stop offset="1" stop-color="#e87928" stop-opacity="0"/></radialGradient>`);
    const shape = window.zeroEye?.({ x: x - 4, y: y - 4, w: 8, h: 8 }, r) || `<circle cx="${x}" cy="${y}" r="${r}" fill="#000"/>`;
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
  el.innerHTML = `<details open><summary>🎒 Bolsa (${bag.length})</summary><div class="bagGrid">${bag.map(b => { const i = items[b.itemId]; return i ? `<div class="bagTile"><img src="${i.src}"><small>${esc(i.name)}${b.hand ? " · " + b.hand : ""}</small><div><button data-a="equip" data-h="R" data-u="${b.uid}" title="Equipar na mão direita">Mão D</button><button data-a="equip" data-h="L" data-u="${b.uid}" title="Equipar na mão esquerda">Mão E</button>${b.hand ? `<button data-a="unequip" data-u="${b.uid}">↩</button>` : ""}${i.kind === "consume" ? `<button data-a="use" data-u="${b.uid}">Usar</button>` : ""}<button data-a="drop" data-u="${b.uid}">✕</button></div></div>` : ""; }).join("") || "<p class='hint'>Vazia.</p>"}</div></details>` +
    `<details><summary>📖 Bestiário (${best.length})</summary>${best.map(c => `<div class="bestEntry"><b>${esc(c.name)}</b> <small>${c.n}/${STAGES.length}</small>${c.fields.map(([n, t]) => `<p><b>${n}:</b> ${esc(t)}</p>`).join("")}${c.n < STAGES.length ? "<p class='hint'>??? — ainda não descoberto</p>" : ""}</div>`).join("") || "<p class='hint'>Nada descoberto ainda.</p>"}</details>`;
  el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => send({ t: b.dataset.a, uid: b.dataset.u, hand: b.dataset.h }));
};
if (!P) {
  const btn = document.createElement("button"); btn.id = "itemBtn"; btn.textContent = "🎁"; btn.title = "Itens"; $("playerWin").before(btn);
  const pn = document.createElement("div"); pn.id = "itemPanel"; pn.className = "logPanel hidden"; document.body.append(pn);
  const draw = () => {
    const its = state.items || []; state.masterBag = state.masterBag || [];
    pn.innerHTML = `<div class="logHead"><b>🎁 Itens & Inventário do Mestre</b><label class="fileButton">+ PNG<input id="itemFile" type="file" accept="image/*" multiple hidden></label><button id="itemX">✕</button></div><div id="logList">${its.map(i => `<div class="itemRow"><img src="${i.src}"><div><input data-n="${i.id}" value="${esc(i.name)}"><label><input type="checkbox" data-k="${i.id}" ${i.kind === "consume" ? "checked" : ""}> consumível</label></div><div><select data-g="${i.id}">${state.characters.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select><button data-master="${i.id}">+ Mestre</button><button data-give="${i.id}">Dar ao jogador</button><button data-del="${i.id}">🗑</button></div></div>`).join("") || "<p class='hint'>A tocha já está disponível aqui. Escolha um personagem e clique em Dar ao jogador.</p>"}</div><div class="masterInventory"><h3>🎒 Inventário do Mestre</h3><div class="masterBagGrid">${state.masterBag.map((b,idx) => { const i=itemById(b.itemId); return i ? `<div class="bagTile"><img src="${i.src}"><small>${esc(i.name)}</small><div><button data-mgive="${idx}">Dar</button><button data-mdel="${idx}">✕</button></div></div>` : ""; }).join("") || "<p class='hint'>Vazio. Use + Mestre nos itens abaixo.</p>"}</div></div>`;
    $("itemX").onclick = () => pn.classList.add("hidden");
    $("itemFile").onchange = e => [...e.target.files].forEach(f => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 256 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.max(1, im.width * k); c.height = Math.max(1, im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); (state.items = state.items || []).push({ id: uid(), name: f.name.replace(/\.[^.]+$/, ""), src: c.toDataURL("image/png"), kind: "equip" }); markDirty("Item importado"); draw(); }; im.src = r.result; }; r.readAsDataURL(f); });
    pn.querySelectorAll("[data-n]").forEach(i => i.onchange = () => { itemById(i.dataset.n).name = i.value; markDirty("Item renomeado"); });
    pn.querySelectorAll("[data-k]").forEach(i => i.onchange = () => { itemById(i.dataset.k).kind = i.checked ? "consume" : "equip"; markDirty("Item alterado"); });
    pn.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { state.items = state.items.filter(i => i.id !== b.dataset.del); state.characters.forEach(c => c.bag = (c.bag || []).filter(x => x.itemId !== b.dataset.del)); markDirty("Item removido"); draw(); renderWorld(); });
    pn.querySelectorAll("[data-master]").forEach(b => b.onclick = () => { state.masterBag.push({ uid: uid(), itemId: b.dataset.master }); markDirty("Item guardado no inventário do mestre"); draw(); });
    pn.querySelectorAll("[data-mdel]").forEach(b => b.onclick = () => { state.masterBag.splice(Number(b.dataset.mdel), 1); markDirty("Item removido do inventário do mestre"); draw(); });
    pn.querySelectorAll("[data-mgive]").forEach(b => b.onclick = () => { const entry = state.masterBag[Number(b.dataset.mgive)]; const names = state.characters.map(c => `${c.name} (${c.id})`).join("\n"); const id = prompt("Dar para qual personagem? Digite o ID após o nome:\n" + names); const ch = state.characters.find(c => c.id === id || c.name.toLowerCase() === String(id).toLowerCase()); if (!ch) return status("Personagem não encontrado"); (ch.bag = ch.bag || []).push({ uid: uid(), itemId: entry.itemId, hand: "" }); state.masterBag.splice(Number(b.dataset.mgive),1); markDirty("Mestre entregou item"); renderWorld(); draw(); status("Item entregue a " + ch.name); });
    pn.querySelectorAll("[data-give]").forEach(b => b.onclick = () => { const ch = state.characters.find(c => c.id === pn.querySelector(`[data-g="${b.dataset.give}"]`).value); if (!ch) return; (ch.bag = ch.bag || []).push({ uid: uid(), itemId: b.dataset.give, hand: "" }); logAction(`Mestre deu ${itemById(b.dataset.give).name} a ${ch.name}`, "itens"); markDirty("Item entregue"); renderWorld(); draw(); status("Item entregue a " + ch.name); });
  };
  btn.onclick = () => { pn.classList.toggle("hidden"); draw(); };
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
