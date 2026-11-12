// Espaço Zero: sala online (WebRTC/PeerJS). Mestre = quem abre o site; jogador = link ?sala=CODIGO
(() => {
const ROOM = new URLSearchParams(location.search).get("sala"), PREFIX = "espacozero-";
const bigIds = new Map(), bigList = [];
function packBig(o) { const ids = new Set(); const obj = JSON.parse(JSON.stringify(o, (k, v) => { if (typeof v === "string" && v.length > 800) { if (!bigIds.has(v)) { bigIds.set(v, bigList.length); bigList.push(v); } ids.add(bigIds.get(v)); return "§" + bigIds.get(v); } return v; })); return { obj, ids }; }
const unpackBig = (o, assets) => JSON.parse(JSON.stringify(o), (k, v) => typeof v === "string" && /^§\d+$/.test(v) ? assets.get(+v.slice(1)) : v);
const SHEET = ["name", "universe", "appearance", "weapon", "personality", "level", "life", "fatigue", "maxLife", "fatigueMax", "defenses", "build", "strength", "speed", "intelligence", "vigor", "luck", "focus", "focusType", "focusLevel", "proficiencies", "magics", "magicPoints", "powers", "weaknesses", "history", "inventory", "notes", "bag"];
const mk = (tag, id, html, cls) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; document.body.append(e); return e; };
const hasPeer = () => typeof Peer !== "undefined";
ROOM ? playerMode() : dmMode();

// ================= MESTRE =================
function dmMode() {
  const conns = new Map(); let peer = null, timer = 0, down = false;
  const MAX_CONNECTIONS = 12;
  const messageWindow = 1000, maxMessagesPerWindow = 35;
  const code = () => (state.room && state.room.code) || (state.room = { code: Math.random().toString(36).slice(2, 8) }).code;
  const link = () => location.href.split("?")[0].split("#")[0] + "?sala=" + code();
  const btn = document.createElement("button"); btn.id = "roomBtn"; btn.textContent = "🌐 Sala"; $("playerWin").before(btn);
  const panel = mk("div", "roomPanel", "", "roomPanel hidden");
  const takenBy = (id, except) => [...conns.values()].some(q => q !== except && q.charId === id);
  function renderPanel() {
    const list = [...conns.values()].map(p => { const c = state.characters.find(x => x.id === p.charId); return `<li>${c ? "🟢 " + escapeHtml(c.name) : "⚪ escolhendo personagem…"}</li>`; }).join("");
    panel.innerHTML = `<b>🌐 Sala aberta</b><p class="hint">Mande este link aos jogadores. Ele é sempre o mesmo para esta campanha. Mantenha esta aba aberta durante o jogo.</p><input id="roomLink" readonly value="${link()}"><div class="actionRow"><button id="roomCopy" class="primary">Copiar link</button><button id="roomClose">Fechar sala</button></div><ul>${list || "<li class='hint'>Ninguém conectado ainda</li>"}</ul>`;
    $("roomCopy").onclick = () => { $("roomLink").select(); navigator.clipboard?.writeText(link()); status("Link copiado"); };
    $("roomClose").onclick = () => { peer?.destroy(); peer = null; conns.clear(); panel.classList.add("hidden"); btn.textContent = "🌐 Sala"; };
  }
  btn.onclick = () => {
    if (peer) { panel.classList.toggle("hidden"); return renderPanel(); }
    if (!hasPeer()) return alert("Não consegui carregar a biblioteca de conexão (PeerJS). Verifique sua internet.");
    peer = new Peer(PREFIX + code());
    peer.on("open", () => { btn.textContent = "🌐 Sala ●"; panel.classList.remove("hidden"); renderPanel(); });
    peer.on("error", e => { if (e.type === "unavailable-id") { alert("Essa sala já está aberta em outra aba, ou fechou há instantes. Feche a outra aba ou espere 1 minuto."); peer.destroy(); peer = null; } else status("Erro de rede: " + e.type); });
    peer.on("connection", c => {
      if (conns.size >= MAX_CONNECTIONS) { try { c.close(); } catch {} return; }
      const p = { conn: c, sent: new Set(), charId: null, messageCount: 0, messageWindowStart: Date.now() };
      c.on("open", () => { conns.set(c.peer, p); renderPanel(); });
      c.on("data", m => onMsg(p, m));
      c.on("close", () => { conns.delete(c.peer); renderPanel(); });
    });
  };
  const sendRoster = p => p.conn.send({ t: "roster", chars: state.characters.map(x => ({ id: x.id, name: x.name, taken: takenBy(x.id, p) })) });
  const lite = () => state.characters.map(c => ({ id: c.id, name: c.name, life: c.life, maxLife: c.maxLife, fatigue: c.fatigue, fatigueMax: c.fatigueMax, conds: c.conds || [] }));
  function view(charId) {
    const s = scene();
    const tokens = s.tokens.filter(t => !t.hidden && (t.characterId || !(window.zeroConds?.(t) || []).includes("unseen"))).map(t => { const c = { ...t, held: window.zeroHeld?.(t) }; if (!t.characterId) { if (!t.showHp) ["life", "maxLife", "fatigue", "fatigueMax"].forEach(k => delete c[k]); delete c.creatureId; } return c; });
    return { id: s.id, name: s.name, background: s.background, bg: s.bg, tokens, fog: { ...s.fog, player: true, explored: (s.fog?.explored?.[charId] || []).slice() }, turn: s.turn, walls: s.walls, items: window.zeroItemsView?.() };
  }
  function recordExploration(ch, token) {
    const fog = scene().fog; if (!fog?.on || !ch || !token) return [];
    fog.explored = fog.explored || {}; const list = fog.explored[ch.id] = fog.explored[ch.id] || [];
    const sources = [{ x: token.x + token.w / 2, y: token.y + token.h / 2, r: Number(token.visionRadius) || 300 }];
    (window.zeroHeld?.(token) || []).forEach(h => { if (Number(h.lightRadius) > 0) sources.push({ x: token.x + (h.hand === "L" ? token.w * .22 : token.w * .78), y: token.y + token.h * .38, r: Number(h.lightRadius) }); });
    const added = [];
    sources.forEach(src => {
      const last = [...list].reverse().find(x => Number(x.r) === src.r);
      if (last && Math.hypot(src.x - last.x, src.y - last.y) < 48) return;
      const point = { x: Math.round(src.x), y: Math.round(src.y), r: src.r };
      list.push(point); added.push(point);
    });
    if (list.length > 320) list.splice(0, list.length - 320);
    return added;
  }
  function broadcastMove(t) {
    if (!t) return;
    const packet = { t: "move", tokenId: t.id, x: t.x, y: t.y, facingSide: t.facingSide || "center", facingX: Number(t.facingX) || 0, facingY: Number(t.facingY) || 0, rot: Number(t.rot) || 0, flip: !!t.flip };
    conns.forEach(p => { if (p.conn.open && p.charId) p.conn.send(packet); });
  }
  function updateTokenOnMaster(t) {
    const el = [...document.querySelectorAll(".token")].find(x => x.dataset.id === t.id);
    if (el) {
      el.classList.add("remoteMoving"); clearTimeout(el._ezMoveTransitionTimer); el._ezMoveTransitionTimer = setTimeout(() => el.classList.remove("remoteMoving"), 130);
      el.style.left = t.x + "px"; el.style.top = t.y + "px";
      const img = el.querySelector("img");
      if (img) img.style.transform = tokenTransform(t);
    }
    drawFog();
  }
  function syncAll() {
    if (!conns.size) return;
    const chars = lite();
    conns.forEach(p => {
      if (!p.conn.open) return;
      if (!p.charId) return sendRoster(p);
      const { obj, ids } = packBig(view(p.charId));
      ids.forEach(i => { if (!p.sent.has(i)) { p.sent.add(i); p.conn.send({ t: "asset", id: i, data: bigList[i] }); } });
      const ch = state.characters.find(x => x.id === p.charId), sheet = {}; if (ch) SHEET.forEach(k => sheet[k] = ch[k]);
      p.conn.send({ t: "state", scene: obj, chars, sheet: ch ? sheet : null, you: p.charId, bestiary: window.zeroBest?.(p.charId) || [], clues: window.zeroCluesFor?.(p.charId) || [], urgency: window.zeroPublicUrgency?.() || null });
    });
  }
  const sched = ms => { if (timer || !conns.size) return; timer = setTimeout(() => { timer = 0; syncAll(); }, ms || 150); };
  function onMsg(p, m) {
    if (!m || typeof m !== "object" || Array.isArray(m)) return;
    const now = Date.now();
    if (now - p.messageWindowStart >= messageWindow) { p.messageWindowStart = now; p.messageCount = 0; }
    if (++p.messageCount > maxMessagesPerWindow) { try { p.conn.close(); } catch {} conns.delete(p.conn.peer); renderPanel(); return; }
    if (JSON.stringify(m).length > 12000) return;
    if (m.t === "hello") {
      p.pid = String(m.pid || "").slice(0, 100);
      if (p.pid) [...conns.values()].filter(q => q !== p && q.pid === p.pid).forEach(q => { conns.delete(q.conn.peer); try { q.conn.close(); } catch {} });
      renderPanel(); return sendRoster(p);
    }
    if (m.t === "claim") {
      if (typeof m.charId !== "string" || m.charId.length > 120) return sendRoster(p);
      const ch = state.characters.find(x => x.id === m.charId);
      if (!ch || takenBy(ch.id, p)) return sendRoster(p);
      p.charId = ch.id; renderPanel(); syncAll(); logAction(ch.name + " entrou na mesa", "sala"); return status(ch.name + " entrou na mesa");
    }
    const ch = state.characters.find(x => x.id === p.charId); if (!ch) return;
    if (m.t === "edit") {
      if (["life", "fatigue"].includes(m.k)) { ensureVitals(ch); const n = m.d != null ? (Number(ch[m.k]) || 0) + Number(m.d) : Number(m.v); if (!Number.isFinite(n)) return; const old = Number(ch[m.k]) || 0; ch[m.k] = clamp(Math.round(n), 0, m.k === "life" ? ch.maxLife : ch.fatigueMax); const dd = ch[m.k] - old; if (dd) logAction(`${ch.name}: ${m.k === "life" ? "vida" : "cansaço"} ${dd > 0 ? "+" : "−"}${Math.abs(dd)} (${ch[m.k]}/${m.k === "life" ? ch.maxLife : ch.fatigueMax})`, "vida"); }
      else if (["notes", "inventory"].includes(m.k)) ch[m.k] = String(m.v ?? "").slice(0, 4000); else return;
      renderWorld(); renderInspector(); markDirty("Jogador atualizou a ficha");
    } else if (m.t === "move") {
      const t = scene().tokens.find(x => x.characterId === ch.id); if (!t || t.locked || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      const ox = t.x, oy = t.y; t.x = clamp(m.x, 0, WORLD_W - t.w); t.y = clamp(m.y, 0, WORLD_H - t.h);
      updateTokenFacing(t, t.x - ox, t.y - oy);
      const explored = recordExploration(ch, t); if (explored.length && p.conn.open) p.conn.send({ t: "explored", points: explored });
      p.acc = (Date.now() - (p.accT || 0) < 3000 ? p.acc : 0) + Math.hypot(t.x - ox, t.y - oy) / SNAP; p.accT = Date.now();
      updateTokenOnMaster(t); broadcastMove(t); logAction(`${ch.name} andou ${Math.round(p.acc)} quadrados`, "movimento", "mv" + ch.id); _md("Jogador moveu o token");
    } else if (window.zeroBagMsg?.(ch, m)) { const t = scene().tokens.find(x => x.characterId === ch.id); const explored = t ? recordExploration(ch, t) : []; if (explored.length && p.conn.open) p.conn.send({ t: "explored", points: explored }); } else if (m.t === "roll") {
      const s = clamp(Math.round(Number(m.sides)) || 20, 2, 100), r = 1 + Math.floor(Math.random() * s);
      showRoll(r, `${ch.name} rolou d${s}`, `${ch.name}: d${s} = ${r}`, s === 20 && r === 20 ? "crit" : s === 20 && r === 1 ? "fail" : "");
    }
  }
  const _sr = showRoll; showRoll = function (a, b, c, d) { _sr(a, b, c, d); conns.forEach(p => p.conn.open && p.conn.send({ t: "log", text: c })); };
  const _md = markDirty; markDirty = function (m) { _md(m); if (m !== "Jogador moveu o token") sched(); };
  const _r = render; render = function () { _r(); sched(); };
  let lastMoveBroadcast = 0, moveScanQueued = false;
  const sentPositions = new Map();
  function rememberPositions() { sentPositions.clear(); scene().tokens.forEach(t => sentPositions.set(t.id, `${t.x.toFixed(1)}:${t.y.toFixed(1)}:${t.facingX || 0}:${t.facingY || 0}`)); }
  function broadcastChangedPositions() {
    moveScanQueued = false; if (!down || !conns.size) return;
    const now = performance.now(); if (now - lastMoveBroadcast < 36) return;
    let changed = false;
    scene().tokens.forEach(t => {
      const key = `${t.x.toFixed(1)}:${t.y.toFixed(1)}:${t.facingX || 0}:${t.facingY || 0}`;
      if (sentPositions.get(t.id) !== key) { sentPositions.set(t.id, key); broadcastMove(t); changed = true; }
    });
    if (changed) lastMoveBroadcast = now;
  }
  addEventListener("pointerdown", () => { down = true; rememberPositions(); });
  addEventListener("pointerup", () => { down = false; sched(90); });
  addEventListener("pointercancel", () => { down = false; sched(90); });
  addEventListener("pointermove", () => { if (down && !moveScanQueued) { moveScanQueued = true; setTimeout(broadcastChangedPositions, 0); } });
  const _ri = renderInspector;
  renderInspector = function () {
    _ri(); const t = selectedToken(); if (!t) return;
    const d = document.createElement("div"); d.className = "atkBox";
    d.innerHTML = `<div class="controlTitle">🌐 SALA</div><label><input type="checkbox" id="tHide" ${t.hidden ? "checked" : ""}> Ocultar dos jogadores</label>${t.characterId ? "" : `<label><input type="checkbox" id="tHp" ${t.showHp ? "checked" : ""}> Mostrar vida aos jogadores</label>`}`;
    $("inspectorContent").append(d);
    $("tHide").onchange = e => { t.hidden = e.target.checked; markDirty("Visibilidade alterada"); };
    if ($("tHp")) $("tHp").onchange = e => { t.showHp = e.target.checked; markDirty("Visibilidade da vida alterada"); };
  };
}

// ================= JOGADOR =================
function playerMode() {
  document.body.classList.add("player", "online"); document.title = "Espaço Zero — Jogador";
  const assets = new Map(); let items = {}, bestiary = [], clues = [], urgency = null, my = null, sheet = null, conn = null, peer = null, got = false, dragging = false, pending = null, lastScene = null, retryT = 0, lastMove = 0, noteT = {}, fogTimer = 0;
  const pid = (() => { try { let v = localStorage.getItem("ez:pid"); if (!v) localStorage.setItem("ez:pid", v = Math.random().toString(36).slice(2) + Date.now().toString(36)); return v; } catch { return Math.random().toString(36).slice(2); } })();
  const banner = mk("div", "netBanner", "Conectando à sala…"), pick = mk("div", "pickModal", "", "pickModal hidden"), me = mk("div", "myPanel", "", "myPanel hidden");
  const say = t => { banner.textContent = t; banner.classList.toggle("hidden", !t); };
  const send = m => conn?.open && conn.send(m);
  function connect() {
    if (!hasPeer()) return say("Não consegui carregar a conexão (PeerJS). Verifique a internet e recarregue.");
    peer = new Peer();
    peer.on("open", () => { conn = peer.connect(PREFIX + ROOM, { reliable: true }); conn.on("open", () => { say(""); send({ t: "hello", pid }); }); conn.on("data", onData); conn.on("close", () => { say("O mestre desconectou. Tentando reconectar…"); retry(); }); });
    peer.on("error", e => { say(e.type === "peer-unavailable" ? "A sala não está aberta. Peça ao mestre para clicar em “Abrir sala”. Tentando de novo…" : "Erro de conexão: " + e.type); retry(); });
  }
  function retry() { if (retryT) return; retryT = setTimeout(() => { retryT = 0; try { peer.destroy(); } catch {} got = false; connect(); }, 4000); }
  const saved = () => { try { return localStorage.getItem("ez:" + ROOM); } catch {} };
  function onData(m) {
    if (!m || typeof m !== "object" || Array.isArray(m)) return;
    if (m.t === "roster" && Array.isArray(m.chars)) {
      const s = m.chars.find(c => c.id === saved() && !c.taken);
      if (s) return send({ t: "claim", charId: s.id });
      pick.classList.remove("hidden"); me.classList.add("hidden");
      pick.innerHTML = `<div class="pickCard"><h2>Quem é você?</h2>${m.chars.length ? m.chars.map(c => `<button data-id="${escapeHtml(c.id)}" ${c.taken ? "disabled" : ""}>${escapeHtml(c.name)}${c.taken ? " (em uso)" : ""}</button>`).join("") : "<p class='hint'>O mestre ainda não criou personagens.</p>"}</div>`;
      pick.querySelectorAll("button").forEach(b => b.onclick = () => { try { localStorage.setItem("ez:" + ROOM, b.dataset.id); } catch {} send({ t: "claim", charId: b.dataset.id }); });
    } else if (m.t === "asset" && Number.isInteger(m.id) && m.id >= 0 && typeof m.data === "string" && m.data.length <= 15000000) assets.set(m.id, m.data);
    else if (m.t === "state") { if (dragging) pending = m; else apply(m); }
    else if (m.t === "explored" && Array.isArray(m.points) && got) {
      const fog = scene().fog; fog.explored = Array.isArray(fog.explored) ? fog.explored : [];
      m.points.slice(0, 20).forEach(q => { if (Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.r)) fog.explored.push({ x: q.x, y: q.y, r: clamp(q.r, 40, 1200) }); });
      if (fog.explored.length > 320) fog.explored.splice(0, fog.explored.length - 320);
      drawFog();
    }
    else if (m.t === "move") applyMove(m);
    else if (m.t === "log") { const l = $("mpLog"); if (l) { l.innerHTML = `<div>${escapeHtml(m.text)}</div>` + l.innerHTML; l.childNodes[6]?.remove(); } }
  }
  function apply(m) {
    const sc = unpackBig(m.scene, assets); items = sc.items || {}; bestiary = Array.isArray(m.bestiary) ? m.bestiary : []; clues = Array.isArray(m.clues) ? m.clues : []; urgency = m.urgency || null; my = m.you; window.zeroPlayerCharacterId = my; sheet = m.sheet; pick.classList.add("hidden");
    const fresh = !got || lastScene !== sc.id; got = true; lastScene = sc.id;
    state = normalizeState({ scenes: [sc], active: sc.id, characters: m.chars, name: "Mesa" }); selected = null; render();
    const t = sc.tokens.find(x => x.characterId === my); if (t) document.querySelector(`[data-id="${t.id}"]`)?.classList.add("mine"); window.zeroFx?.();
    drawSheet(); if (fresh) { if (t) { const b = $("viewport").getBoundingClientRect(); panX = b.width / 2 - (t.x + t.w / 2) * zoom; panY = b.height / 2 - (t.y + t.h / 2) * zoom; updateCamera(); } else centerView(); }
  }
  const moveAnimations = new Map();
  function applyMove(m) {
    if (!got || !m || typeof m.tokenId !== "string" || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const t = scene().tokens.find(x => x.id === m.tokenId); if (!t) return;
    if (dragging && t.characterId === my) return;
    const el = [...document.querySelectorAll(".token")].find(x => x.dataset.id === t.id);
    if (!el) { t.x = clamp(m.x, 0, WORLD_W - t.w); t.y = clamp(m.y, 0, WORLD_H - t.h); return; }
    const active = moveAnimations.get(t.id);
    const fromX = active ? active.x : parseFloat(el.style.left) || t.x;
    const fromY = active ? active.y : parseFloat(el.style.top) || t.y;
    const toX = clamp(m.x, 0, WORLD_W - t.w), toY = clamp(m.y, 0, WORLD_H - t.h);
    t.x = toX; t.y = toY;
    if (m.facingSide === "left" || m.facingSide === "right") t.facingSide = m.facingSide;
    if (Number.isFinite(m.facingX)) t.facingX = m.facingX;
    if (Number.isFinite(m.facingY)) t.facingY = m.facingY;
    const img = el.querySelector("img"); if (img) img.style.transform = tokenTransform(t);
    const started = performance.now(), duration = 68;
    const anim = { x: fromX, y: fromY, raf: 0 };
    const frame = now => {
      const q = Math.min(1, (now - started) / duration), eased = q * q * (3 - 2 * q);
      anim.x = fromX + (toX - fromX) * eased; anim.y = fromY + (toY - fromY) * eased;
      el.style.left = anim.x + "px"; el.style.top = anim.y + "px";
      if (q < 1) anim.raf = requestAnimationFrame(frame);
      else { anim.x = toX; anim.y = toY; moveAnimations.delete(t.id); }
    };
    const previous = moveAnimations.get(t.id); if (previous?.raf) cancelAnimationFrame(previous.raf);
    moveAnimations.set(t.id, anim); anim.raf = requestAnimationFrame(frame);
    if (!fogTimer) fogTimer = setTimeout(() => { fogTimer = 0; drawFog(); }, 65);
  }
  startTokenDrag = function (ev, token, el) {
    if (token.characterId !== my || token.locked || ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation(); dragging = true; const p0 = worldPoint(ev), x0 = token.x, y0 = token.y;
    try { el.setPointerCapture(ev.pointerId); } catch {}
    const push = () => send({ t: "move", x: token.x, y: token.y, facingSide: token.facingSide || "right", facingX: token.facingX || 0, facingY: token.facingY || 0 });
    const mv = e => {
      if (e.pointerId !== ev.pointerId) return;
      const p = worldPoint(e), oldX = token.x, oldY = token.y;
      token.x = x0 + p.x - p0.x; token.y = y0 + p.y - p0.y; clampToken(token);
      updateTokenFacing(token, token.x - oldX, token.y - oldY);
      el.style.left = token.x + "px"; el.style.top = token.y + "px";
      const img = el.querySelector("img"); if (img) img.style.transform = tokenTransform(token);
      if (Date.now() - lastMove > 38) { lastMove = Date.now(); push(); if (!fogTimer) fogTimer = setTimeout(() => { fogTimer = 0; drawFog(); }, 55); }
    };
    const up = e => {
      if (e?.pointerId !== undefined && e.pointerId !== ev.pointerId) return;
      ["pointermove", "pointerup", "pointercancel"].forEach((n, i) => removeEventListener(n, i ? up : mv));
      dragging = false; push(); if (pending) { apply(pending); pending = null; }
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  };

  openCharacter = openCreature = () => {};
  function drawSheet() {
    if (!sheet) return; me.classList.remove("hidden");
    if (!$("mpBody")) {
      me.innerHTML = `<div class="mpHead"><b id="mpName"></b><button id="mpToggle">▾</button></div><div id="mpBody"><div id="mpVit"></div><details><summary>Ficha</summary><div id="mpInfo"></div></details><details id="mpClueBox"><summary>🔎 Pistas e investigação</summary><div id="mpClues"></div></details><div id="mpBag"></div><label>Inventário<textarea id="mpInventory"></textarea></label><label>Anotações<textarea id="mpNotes"></textarea></label><div class="mpDice">${[4, 6, 8, 10, 12, 20, 100].map(s => `<button data-s="${s}" ${s === 20 ? 'class="primary"' : ""}>d${s}</button>`).join("")}</div><div id="mpLog" class="hint"></div></div>`;
      if (innerWidth < 700) $("mpBody").classList.add("hidden");
      $("mpToggle").onclick = () => $("mpBody").classList.toggle("hidden");
      me.querySelectorAll("[data-s]").forEach(b => b.onclick = () => send({ t: "roll", sides: +b.dataset.s }));
      ["Inventory", "Notes"].forEach(n => $("mp" + n).oninput = e => { clearTimeout(noteT[n]); noteT[n] = setTimeout(() => send({ t: "edit", k: n.toLowerCase(), v: e.target.value }), 600); });
    }
    const pct = (v, m) => clamp(v / Math.max(1, m) * 100, 0, 100), L = Number(sheet.life) || 0, M = Number(sheet.maxLife) || 1, F = Number(sheet.fatigue) || 0, FM = Number(sheet.fatigueMax) || 1;
    $("mpName").textContent = sheet.name;
    $("mpVit").innerHTML = `<div class="vitalRow"><span>Vida</span><div class="vitalBar life" style="--lost:${100 - pct(L, M)}"><i style="width:${pct(L, M)}%"></i></div><b>${L}/${M}</b></div><div class="actionRow hpRow">${[-5, -1, 1, 5].map(d => `<button data-k="life" data-d="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)}</button>`).join("")}</div><div class="vitalRow"><span>Cansaço</span><div class="vitalBar fat"><i style="width:${pct(F, FM)}%"></i></div><b>${F}/${FM}</b></div><div class="actionRow hpRow">${[-5, -1, 1, 5].map(d => `<button data-k="fatigue" data-d="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)}</button>`).join("")}</div><div class="fatigueDirect"><label>Definir cansaço atual<input id="mpFatigueValue" type="number" min="0" max="${FM}" value="${F}"></label><button id="mpFatigueSet">Aplicar</button></div>`;
    $("mpVit").querySelectorAll("[data-k]").forEach(b => b.onclick = () => send({ t: "edit", k: b.dataset.k, d: +b.dataset.d }));
    if (document.activeElement !== $("mpFatigueValue")) $("mpFatigueValue").value = String(F);
    $("mpFatigueValue").max = String(FM);
    const applyFatigue = () => { const n = Number($("mpFatigueValue").value); if (!Number.isFinite(n)) return; send({ t: "edit", k: "fatigue", v: Math.max(0, Math.min(FM, Math.round(n))) }); };
    $("mpFatigueSet").onclick = applyFatigue;
    $("mpFatigueValue").onkeydown = e => { if (e.key === "Enter") applyFatigue(); };
    const info = [["Nível", "level"], ["Força", "strength"], ["Velocidade", "speed"], ["Inteligência", "intelligence"], ["Vigor", "vigor"], ["Sorte", "luck"], ["Foco", "focus"], ["Defesas", "defenses"], ["Porte", "build"], ["Foco de poder", "focusType"], ["Nível do foco", "focusLevel"], ["Arma", "weapon"], ["Poderes", "powers"], ["Pontos fracos", "weaknesses"]];
    $("mpInfo").innerHTML = info.filter(([, k]) => sheet[k] !== "" && sheet[k] != null).map(([n, k]) => `<p><b>${n}:</b> ${escapeHtml(k === "focusType" ? ({fisico:"Combate físico",distancia:"Combate à distância",magico:"Combate mágico"}[sheet[k]] || "Não definido") : sheet[k])}</p>`).join("") + `<p><b>Proficiências:</b> ${escapeHtml(typeof formatProficiencies === "function" ? formatProficiencies(sheet.proficiencies) : sheet.proficiencies || "Nenhuma")}</p><p><b>Magias:</b> ${escapeHtml(typeof formatMagics === "function" ? formatMagics(sheet.magics) : sheet.magics || "Nenhuma")}</p><p><b>Espaços de magia:</b> ${Number(sheet.magicPoints) || 0}</p>`;
    $("mpClues").innerHTML = `${urgency?.public ? `<div class="playerUrgency"><b>${escapeHtml(urgency.title || "Investigação")}</b><strong>Rodada ${Number(urgency.round)||0}/${Number(urgency.limit)||0}</strong></div>` : ""}${clues.map(c => `<article class="playerClue"><b>${escapeHtml(c.title)}</b>${c.test ? `<small>${escapeHtml(c.test)}${c.dt ? ` · DT ${escapeHtml(c.dt)}` : ""}</small>` : ""}<p>${escapeHtml(c.description || "")}</p></article>`).join("") || `<p class="hint">Nenhuma pista revelada para este personagem.</p>`}`;
    [["mpInventory", "inventory"], ["mpNotes", "notes"]].forEach(([id, k]) => { if (document.activeElement !== $(id)) $(id).value = sheet[k] || ""; });
    window.zeroBagUI?.($("mpBag"), sheet.bag || [], items, send, bestiary);
  }
  connect();
}
})();
