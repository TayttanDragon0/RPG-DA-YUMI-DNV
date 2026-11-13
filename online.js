// Espaço Zero: sala online (WebRTC/PeerJS). Mestre = quem abre o site; jogador = link ?sala=CODIGO
(() => {
const ROOM = new URLSearchParams(location.search).get("sala"), PREFIX = "espacozero-";
const bigIds = new Map(), bigList = [];
function packBig(o) { const ids = new Set(); const obj = JSON.parse(JSON.stringify(o, (k, v) => { if (typeof v === "string" && v.length > 800) { if (!bigIds.has(v)) { bigIds.set(v, bigList.length); bigList.push(v); } ids.add(bigIds.get(v)); return "§" + bigIds.get(v); } return v; })); return { obj, ids }; }
const unpackBig = (o, assets) => JSON.parse(JSON.stringify(o), (k, v) => typeof v === "string" && /^§\d+$/.test(v) ? assets.get(+v.slice(1)) : v);
const SHEET = ["name", "universe", "appearance", "weapon", "personality", "level", "life", "fatigue", "maxLife", "fatigueMax", "defenses", "build", "strength", "speed", "intelligence", "vigor", "luck", "focus", "focusType", "focusLevel", "proficiencies", "magics", "magicPoints", "powers", "weaknesses", "history", "inventory", "notes", "bag", "conds"];
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
  const PUBLIC_LOG_KINDS = new Set(["sala", "movimento", "vida", "condição", "dados"]);
  function publicLogs() {
    return (state.log || []).filter(e => PUBLIC_LOG_KINDS.has(String(e.kind || "sala")) && !String(e.text || "").startsWith("Bestiário:"))
      .slice(-18).map(e => ({ t: Number(e.t) || Date.now(), text: String(e.text || "").slice(0, 500), kind: String(e.kind || "sala").slice(0, 30) }));
  }
  function view(charId) {
    const s = scene();
    const tokens = s.tokens.filter(t => !t.hidden && (t.characterId || !(window.zeroConds?.(t) || []).includes("unseen"))).map(t => {
      const c = { ...t, held: window.zeroHeld?.(t), dead: !!isDead(t), conds: window.zeroConds?.(t) || t.conds || [] };
      // A ficha completa continua privada. O ID da criatura é preservado para
      // abrir uma ficha de descoberta filtrada, nunca a ficha do mestre.
      if (!t.characterId && !t.showHp) ["life", "maxLife", "fatigue", "fatigueMax"].forEach(k => delete c[k]);
      delete c.gmEnigma; delete c.secret; delete c.privateNotes;
      return c;
    });
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
    if (added.length) window.zeroFogRevision = (window.zeroFogRevision || 0) + 1;
    return added;
  }
  function broadcastMove(t) {
    if (!t) return;
    const packet = { t: "move", tokenId: t.id, x: t.x, y: t.y, facingSide: t.facingSide || "center", facingX: Number(t.facingX) || 0, facingY: Number(t.facingY) || 0, rot: Number(t.rot) || 0, flip: !!t.flip, moving: true, at: Date.now() };
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
      p.conn.send({ t: "state", scene: obj, chars, sheet: ch ? sheet : null, you: p.charId, bestiary: window.zeroBest?.(p.charId) || [], clues: window.zeroCluesFor?.(p.charId) || [], urgency: window.zeroPublicUrgency?.() || null, logs: publicLogs() });
    });
  }
  const sched = ms => { if (timer || !conns.size) return; timer = setTimeout(() => { timer = 0; syncAll(); }, ms ?? 85); };
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
      const sides = clamp(Math.round(Number(m.sides)) || 20, 2, 100);
      const count = clamp(Math.round(Number(m.count)) || 1, 1, 20);
      const mod = clamp(Math.round(Number(m.mod)) || 0, -999, 999);
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0) + mod;
      const detail = `${ch.name}: ${count}d${sides} [${rolls.join(", ")}]${mod ? ` ${mod > 0 ? "+" : "−"} ${Math.abs(mod)}` : ""} = ${total}`;
      const kind = sides === 20 && count === 1 && rolls[0] === 20 ? "crit" : sides === 20 && count === 1 && rolls[0] === 1 ? "fail" : "";
      // showRoll é retransmitido para todos os jogadores pelo relay acima;
      // assim o resultado e a animação são iguais em todos os clientes.
      showRoll(total, `${ch.name} rolou ${count}d${sides}: ${detail}`, `${ch.name} rolou ${count}d${sides}`, kind);
    }
  }
  // Encaminha para os jogadores os eventos relevantes registrados pelo mestre:
  // dano, condições, itens, pistas, turnos e resultados de dados.
  const _logAction = window.logAction;
  if (typeof _logAction === "function") window.logAction = function (text, kind, key) {
    const result = _logAction(text, kind, key);
    const k = String(kind || "sala");
    // O feed do jogador recebe apenas acontecimentos públicos. Inventário e
    // conhecimento do bestiário continuam podendo ser privados por personagem.
    if (PUBLIC_LOG_KINDS.has(k) && !String(text || "").startsWith("Bestiário:")) {
      const latest = state.log?.[state.log.length - 1];
      const packet = { t: "log", text: String(text ?? "").slice(0, 500), kind: k.slice(0, 30), at: Number(latest?.t) || Date.now() };
      conns.forEach(p => { if (p.conn.open && p.charId) p.conn.send(packet); });
    }
    return result;
  };
  function relayRoll(total, detail, kind = "") {
    const value = Number(total);
    if (!Number.isFinite(value) || !conns.size) return;
    const text = String(detail || "Rolagem realizada").slice(0, 500);
    const sm = text.match(/\b\d+\s*d\s*(\d+)\b/i);
    const sides = clamp(Math.round(Number(sm?.[1]) || 20), 2, 1000);
    const rm = text.match(/\[([0-9,\s]+)\]/);
    const rolls = rm ? rm[1].split(",").map(x => Number(x.trim())).filter(x => Number.isFinite(x) && x >= 1 && x <= sides).slice(0, 20) : [];
    if (!rolls.length) rolls.push(clamp(Math.abs(Math.round(value)) || 1, 1, sides));
    const resolvedKind = kind || (sides === 20 && rolls.length === 1 && rolls[0] === 20 ? "crit" : sides === 20 && rolls.length === 1 && rolls[0] === 1 ? "fail" : "");
    const packet = { t: "rollResult", sides, rolls, mod: 0, total: value, detail: text, kind: resolvedKind, at: Date.now() };
    conns.forEach(p => { if (p.conn.open && p.charId) p.conn.send(packet); });
  }
  const _showRoll = showRoll;
  showRoll = function (total, detail, history, kind) {
    const result = _showRoll(total, detail, history, kind);
    relayRoll(total, detail, kind);
    return result;
  };
  // O botão principal de dados não passa por showRoll; retransmite o resultado
  // depois que a rolagem foi calculada, preservando o resultado real do mestre.
  const _rollDice = rollDice;
  rollDice = function (sides) {
    const result = _rollDice(sides);
    const total = Number($("diceResult")?.textContent);
    const detail = $("diceDetail")?.textContent || `${sides}-lados`;
    const kind = $("diceResult")?.classList.contains("crit") ? "crit" : $("diceResult")?.classList.contains("fail") ? "fail" : "";
    if (Number.isFinite(total)) {
      window.logAction?.(detail, "dados");
      relayRoll(total, detail, kind);
    }
    return result;
  };
  const _md = markDirty; markDirty = function (m) { _md(m); if (m !== "Jogador moveu o token") sched(65); };
  const _r = render; render = function () { _r(); sched(90); };
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
  // Em startTokenDrag o próprio token interrompe o bubbling; capture=true é
  // essencial para detectar o início do arrasto do mestre e transmitir cada passo.
  addEventListener("pointerdown", () => { down = true; rememberPositions(); }, true);
  addEventListener("pointerup", () => { down = false; sched(65); }, true);
  addEventListener("pointercancel", () => { down = false; sched(65); }, true);
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
  const assets = new Map(); let items = {}, bestiary = [], clues = [], urgency = null, my = null, sheet = null, conn = null, peer = null, got = false, dragging = false, pending = null, lastScene = null, retryT = 0, lastMove = 0, noteT = {}, fogTimer = 0, activePlayerTab = "sheet", playerDieInterval = 0, playerDieHide = 0;
  const moveAnimations = new Map(), seenLogKeys = new Set(), remoteMoveNotices = new Map();
  let lastObservedTokens = new Map();
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
      window.zeroFogRevision = (window.zeroFogRevision || 0) + 1;
      drawFog();
    }
    else if (m.t === "move") applyMove(m);
    else if (m.t === "rollResult") showPlayerRoll(m);
    else if (m.t === "log") addPlayerLog(m.text, m.kind, m.at);
  }
  function apply(m) {
    const sc = unpackBig(m.scene, assets); items = sc.items || {}; bestiary = Array.isArray(m.bestiary) ? m.bestiary : []; clues = Array.isArray(m.clues) ? m.clues : []; urgency = m.urgency || null; my = m.you; window.zeroPlayerCharacterId = my; sheet = m.sheet; pick.classList.add("hidden");
    const fresh = !got || lastScene !== sc.id;
    if (got && lastScene === sc.id) {
      const currentIds = new Set(sc.tokens.map(t => t.id));
      sc.tokens.forEach(t => {
        const before = lastObservedTokens.get(t.id);
        if (!before && t.creatureId) addPlayerLog(`${t.name || "Uma criatura"} apareceu na cena.`, "sala", Date.now());
        if (before && !before.dead && !!t.dead) addPlayerLog(`${t.name || "Criatura"} foi derrotada.`, "vida", Date.now());
        if (before && t.creatureId) {
          const oldConds = new Set(before.conds || []), newConds = new Set(t.conds || []);
          const labels = { poison: "Envenenado", control: "Controlado", corrupt: "Corrompido", bleed: "Sangrando", mimic: "Imitado", stun: "Atordoado", fire: "Em chamas", unseen: "Invisível" };
          newConds.forEach(c => { if (!oldConds.has(c)) addPlayerLog(`${t.name}: ${labels[c] || c}.`, "condição", Date.now()); });
          oldConds.forEach(c => { if (!newConds.has(c)) addPlayerLog(`${t.name}: ${labels[c] || c} removido.`, "condição", Date.now()); });
        }
      });
    }
    lastObservedTokens = new Map(sc.tokens.map(t => [t.id, { dead: !!t.dead, name: t.name || "Criatura", creatureId: t.creatureId || "", conds: Array.isArray(t.conds) ? t.conds.slice() : [] }]));
    got = true; lastScene = sc.id;
    // Se um monstro está no meio da animação, mantém a posição visual atual e
    // atualiza somente o destino. O pacote de estado não deve fazê-lo saltar.
    sc.tokens.forEach(t => { const a = moveAnimations.get(t.id); if (a) { a.targetX = clamp(t.x, 0, WORLD_W - t.w); a.targetY = clamp(t.y, 0, WORLD_H - t.h); t.x = a.x; t.y = a.y; } });
    const known = new Map(bestiary.map(c => [c.id, c]));
    // Mantém o bestiário já descoberto mesmo se a criatura não estiver nesta cena.
    // Para criaturas visíveis mas ainda desconhecidas, cria somente um cartão vazio.
    const safeBestiary = bestiary.map(c => ({ ...c }));
    sc.tokens.filter(t => t.creatureId).forEach(t => {
      if (safeBestiary.some(c => c.id === t.creatureId)) return;
      safeBestiary.push({ id: t.creatureId, name: t.name || "Criatura desconhecida", color: t.color || "#777", n: 0, fields: [], sprite: t.src || "" });
    });
    state = normalizeState({ scenes: [sc], active: sc.id, characters: m.chars, bestiary: safeBestiary, name: "Mesa" }); selected = null; render();
    const t = sc.tokens.find(x => x.characterId === my); if (t) document.querySelector(`[data-id="${t.id}"]`)?.classList.add("mine");
    // Reanexa referências de DOM depois do snapshot. O loop de animação não
    // precisa consultar todos os tokens a cada frame.
    const renderedTokens = new Map([...document.querySelectorAll(".token")].map(el => [el.dataset.id, el]));
    moveAnimations.forEach((a, id) => { const el = renderedTokens.get(id); if (el) { a.node = el; el.classList.add("remoteWalking"); el.style.willChange = "left, top"; } });
    sc.tokens.forEach(token => {
      if (!token.creatureId) return;
      const el = renderedTokens.get(token.id); if (!el) return;
      el.title = "Clique para abrir as informações que você descobriu desta criatura";
      el.setAttribute("role", "button"); el.tabIndex = 0;
      el.addEventListener("click", () => openPlayerCreature(token.creatureId));
      el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); openPlayerCreature(token.creatureId); } });
    });
    window.zeroFx?.(); drawSheet();
    if (Array.isArray(m.logs)) m.logs.slice(-18).forEach(e => addPlayerLog(e.text, e.kind, e.t));
    if (fresh) { if (t) { const b = $("viewport").getBoundingClientRect(); panX = b.width / 2 - (t.x + t.w / 2) * zoom; panY = b.height / 2 - (t.y + t.h / 2) * zoom; updateCamera(); } else centerView(); }
  }
  function applyMove(m) {
    if (!got || !m || typeof m.tokenId !== "string" || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const t = scene().tokens.find(x => x.id === m.tokenId); if (!t) return;
    if (dragging && t.characterId === my) return;
    if (t.creatureId) {
      const now = Date.now(), lastNotice = remoteMoveNotices.get(t.id) || 0;
      if (now - lastNotice > 5000) { addPlayerLog(`${t.name || "Criatura"} está se movendo.`, "movimento", now); remoteMoveNotices.set(t.id, now); }
    }
    const toX = clamp(m.x, 0, WORLD_W - t.w), toY = clamp(m.y, 0, WORLD_H - t.h);
    t.x = toX; t.y = toY;
    if (m.facingSide === "left" || m.facingSide === "right") t.facingSide = m.facingSide;
    if (Number.isFinite(m.facingX)) t.facingX = m.facingX;
    if (Number.isFinite(m.facingY)) t.facingY = m.facingY;
    if (Number.isFinite(m.rot)) t.rot = m.rot;
    if (typeof m.flip === "boolean") t.flip = m.flip;
    let a = moveAnimations.get(t.id);
    if (!a) {
      const el = [...document.querySelectorAll(".token")].find(x => x.dataset.id === t.id);
      a = { x: el ? parseFloat(el.style.left) || 0 : toX, y: el ? parseFloat(el.style.top) || 0 : toY, targetX: toX, targetY: toY, lastPacket: performance.now(), lastFrame: 0, raf: 0, node: el };
      moveAnimations.set(t.id, a);
    }
    a.targetX = toX; a.targetY = toY; a.lastPacket = performance.now();
    let el = a.node;
    if (!el?.isConnected) { el = [...document.querySelectorAll(".token")].find(x => x.dataset.id === t.id); a.node = el; }
    if (el) { const img = el.querySelector("img:not(.heldItem)"); if (img) img.style.transform = tokenTransform(t); el.classList.add("remoteWalking"); el.style.willChange = "left, top"; }
    if (!a.raf) {
      const frame = now => {
        const dt = Math.min(50, a.lastFrame ? now - a.lastFrame : 16); a.lastFrame = now;
        // Suavização exponencial: não reinicia a transição a cada pacote e
        // absorve pequenas variações na latência do WebRTC.
        const blend = 1 - Math.exp(-dt / 78);
        a.x += (a.targetX - a.x) * blend; a.y += (a.targetY - a.y) * blend;
        let node = a.node;
        if (!node?.isConnected) { node = [...document.querySelectorAll(".token")].find(x => x.dataset.id === t.id); a.node = node; }
        if (!node || !scene().tokens.some(x => x.id === t.id)) { moveAnimations.delete(t.id); return; }
        node.style.left = a.x + "px"; node.style.top = a.y + "px";
        const settled = Math.hypot(a.targetX - a.x, a.targetY - a.y) < .5;
        if (now - a.lastPacket > 170 && settled) {
          a.x = a.targetX; a.y = a.targetY; node.style.left = a.x + "px"; node.style.top = a.y + "px";
          node.classList.remove("remoteWalking"); node.style.willChange = ""; moveAnimations.delete(t.id); return;
        }
        a.raf = requestAnimationFrame(frame);
      };
      a.raf = requestAnimationFrame(frame);
    }
    if (!fogTimer) fogTimer = setTimeout(() => { fogTimer = 0; drawFog(); }, 85);
  }
  function animatePlayerDie(sides, result) {
    let ov = $("playerDiceOverlay");
    if (!ov) { ov = document.createElement("div"); ov.id = "playerDiceOverlay"; ov.className = "playerDiceOverlay hidden"; document.body.append(ov); }
    ov.innerHTML = `<div class="playerDiceCube diceAnim d${sides}"><span>?</span><small>d${sides}</small></div>`;
    ov.classList.remove("hidden");
    const face = ov.querySelector("span"); let ticks = 0;
    clearInterval(playerDieInterval); clearTimeout(playerDieHide);
    playerDieInterval = setInterval(() => {
      if (!face?.isConnected) { clearInterval(playerDieInterval); playerDieInterval = 0; return; }
      face.textContent = String(1 + Math.floor(Math.random() * sides));
      if (++ticks >= 12) {
        clearInterval(playerDieInterval); playerDieInterval = 0; face.textContent = String(result);
        ov.firstElementChild.classList.add("land");
        playerDieHide = setTimeout(() => { ov.classList.add("hidden"); ov.innerHTML = ""; }, 1150);
      }
    }, 78);
  }
  function addPlayerLog(text, kind = "sala", at = Date.now()) {
    const l = $("mpLog"); if (!l) return;
    const message = String(text || ""); if (!message) return;
    const stamp = Number(at) || Date.now();
    const key = `${String(kind || "sala")}|${stamp}|${message}`;
    if (seenLogKeys.has(key)) return;
    seenLogKeys.add(key); if (seenLogKeys.size > 120) seenLogKeys.delete(seenLogKeys.values().next().value);
    const row = document.createElement("div"); row.className = "mpLogEntry kind-" + String(kind || "sala").replace(/[^a-z0-9_-]/gi, "");
    const time = document.createElement("time"); time.textContent = new Date(stamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const content = document.createElement("span"); content.textContent = message; row.append(time, content);
    l.prepend(row); while (l.children.length > 18) l.lastElementChild.remove();
  }
  function showPlayerRoll(m) {
    if (!m || !Array.isArray(m.rolls) || !Number.isFinite(m.total)) return;
    const total = $("mpDiceTotal"), detail = $("mpDiceDetail");
    if (total) { total.textContent = String(m.total); total.classList.toggle("crit", m.kind === "crit"); total.classList.toggle("fail", m.kind === "fail"); }
    if (detail) detail.textContent = m.detail || "Resultado recebido do mestre";
    animatePlayerDie(Number(m.sides) || 20, Number(m.rolls[0]) || 1);
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

  openCharacter = () => {};
  function openPlayerCreature(creature) {
    const id = typeof creature === "string" ? creature : creature?.id;
    const known = bestiary.find(c => c.id === id);
    const safe = state.bestiary.find(c => c.id === id);
    const token = scene().tokens.find(t => t.creatureId === id);
    if (!token && !safe) return;
    let modal = $("playerCreatureModal");
    if (!modal) { modal = document.createElement("div"); modal.id = "playerCreatureModal"; modal.className = "playerCreatureModal hidden"; document.body.append(modal); }
    const name = known?.name || safe?.name || token?.name || "Criatura desconhecida";
    const fields = Array.isArray(known?.fields) ? known.fields : Array.isArray(safe?.fields) ? safe.fields : [];
    const n = Number(known?.n ?? safe?.n) || 0;
    const art = token?.src || safe?.sprite || "";
    modal.innerHTML = `<article class="playerCreatureCard"><header><div><small>BESTIÁRIO · DESCOBERTA</small><h2>${escapeHtml(name)}</h2><span>${n ? `${n} etapa${n === 1 ? "" : "s"} descoberta${n === 1 ? "" : "s"}` : "Ainda não investigada"}</span></div><button id="playerCreatureClose" aria-label="Fechar">✕</button></header>${art ? `<img class="playerCreatureArt" src="${escapeHtml(art)}" alt="Representação de ${escapeHtml(name)}">` : ""}<div class="playerCreatureFields">${fields.map(([label, value]) => `<section><b>${escapeHtml(label)}</b><p>${escapeHtml(value)}</p></section>`).join("") || `<p class="playerUnknown">Você ainda não descobriu informações sobre esta criatura. O mestre poderá revelar detalhes conforme a investigação avançar.</p>`}${token?.dead ? `<p class="playerCreatureDead">☠ Esta criatura foi derrotada.</p>` : ""}${token?.showHp && Number.isFinite(Number(token.life)) ? `<p class="playerCreatureVitals">Vida visível: ${Number(token.life)}/${Number(token.maxLife) || 0}</p>` : ""}</div></article>`;
    modal.classList.remove("hidden");
    $("playerCreatureClose").onclick = () => modal.classList.add("hidden");
    modal.onclick = e => { if (e.target === modal) modal.classList.add("hidden"); };
  }
  openCreature = creature => openPlayerCreature(creature);
  function drawSheet() {
    if (!sheet) return; me.classList.remove("hidden");
    if (!$("mpBody")) {
      me.innerHTML = `<div class="mpHead"><div class="mpIdentity"><small>SEU PERSONAGEM</small><b id="mpName"></b></div><button id="mpToggle" title="Recolher painel">−</button></div><div id="mpBody"><div id="mpVit" class="mpVitals"></div><div id="mpTurn" class="mpTurnStatus"></div><nav class="mpTabs"><button data-mp-tab="sheet" class="active">Ficha</button><button data-mp-tab="bag">🎒 Bolsa</button><button data-mp-tab="dice">🎲 Dados</button><button data-mp-tab="known">Bestiário</button><button data-mp-tab="clues">Pistas</button></nav><section class="mpPane active" id="mpPane-sheet"><div id="mpInfo" class="mpInfoGrid"></div><label>Informações do inventário<textarea id="mpInventory" rows="3" placeholder="Anote o que carrega…"></textarea></label><label>Anotações pessoais<textarea id="mpNotes" rows="3" placeholder="Suas anotações…"></textarea></label></section><section class="mpPane" id="mpPane-bag"><div id="mpBag"></div></section><section class="mpPane" id="mpPane-dice"><div class="mpDice">${[4, 6, 8, 10, 12, 20, 100].map(s => `<button data-s="${s}" ${s === 20 ? 'class="primary"' : ""}>d${s}</button>`).join("")}</div><div class="mpDiceOptions"><label>Quantidade<input id="mpDiceCount" type="number" min="1" max="20" value="1"></label><label>Bônus<input id="mpDiceMod" type="number" value="0"></label></div><div class="mpDiceOutcome"><small>ÚLTIMA ROLAGEM</small><b id="mpDiceTotal">—</b><p id="mpDiceDetail">Escolha um dado para rolar.</p></div></section><section class="mpPane" id="mpPane-known"><p class="mpHint">Clique em uma criatura no mapa para consultar sua ficha. Aqui aparecem as descobertas que o mestre já revelou para você.</p><div id="mpKnownBeasts"></div></section><section class="mpPane" id="mpPane-clues"><div id="mpClues"></div></section><section class="mpLogPanel"><b>Atividade da mesa</b><small>Movimentos e acontecimentos compartilhados pelo mestre.</small><div id="mpLog" aria-live="polite"></div></section></div>`;
      me.querySelectorAll("[data-mp-tab]").forEach(b => b.onclick = () => {
        activePlayerTab = b.dataset.mpTab;
        me.querySelectorAll("[data-mp-tab]").forEach(x => x.classList.toggle("active", x === b));
        me.querySelectorAll(".mpPane").forEach(x => x.classList.toggle("active", x.id === "mpPane-" + activePlayerTab));
      });
      $("mpToggle").onclick = () => { const body = $("mpBody"); body.classList.toggle("collapsed"); $("mpToggle").textContent = body.classList.contains("collapsed") ? "+" : "−"; };
      me.querySelectorAll("[data-s]").forEach(b => b.onclick = () => {
        const count = clamp(Math.round(Number($("mpDiceCount")?.value) || 1), 1, 20), mod = clamp(Math.round(Number($("mpDiceMod")?.value) || 0), -999, 999);
        send({ t: "roll", sides: +b.dataset.s, count, mod });
        const total = $("mpDiceTotal"), detail = $("mpDiceDetail"); if (total) total.textContent = "…"; if (detail) detail.textContent = "O mestre está realizando a rolagem…";
      });
      ["Inventory", "Notes"].forEach(n => $("mp" + n).oninput = e => { clearTimeout(noteT[n]); noteT[n] = setTimeout(() => send({ t: "edit", k: n.toLowerCase(), v: e.target.value }), 600); });
    }
    const pct = (v, m) => clamp(v / Math.max(1, m) * 100, 0, 100), L = Number(sheet.life) || 0, M = Number(sheet.maxLife) || 1, F = Number(sheet.fatigue) || 0, FM = Number(sheet.fatigueMax) || 1;
    $("mpName").textContent = sheet.name || "Personagem";
    const turn = scene().turn || {}, activeToken = scene().tokens.find(t => t.id === turn.active);
    $("mpTurn").innerHTML = activeToken ? `<span>⚔ Rodada ${Number(turn.round) || 1}</span><b>Vez de ${escapeHtml(activeToken.name)}</b>` : `<span>⚔ Mesa em andamento</span><b>Aguardando o mestre definir os turnos</b>`;
    const conditions = Array.isArray(sheet.conds) ? sheet.conds : [];
    const conditionNames = { poison: "Envenenado", control: "Controlado", corrupt: "Corrompido", bleed: "Sangrando", mimic: "Imitado", stun: "Atordoado", fire: "Em chamas", unseen: "Invisível" };
    $("mpVit").innerHTML = `<div class="mpVital"><div class="mpVitalLabel"><span>❤️ Vida</span><b>${L}/${M}</b></div><div class="vitalBar life"><i style="width:${pct(L, M)}%"></i></div><div class="actionRow hpRow">${[-5, -1, 1, 5].map(d => `<button data-k="life" data-d="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)}</button>`).join("")}</div></div><div class="mpVital"><div class="mpVitalLabel"><span>⚡ Cansaço</span><b>${F}/${FM}</b></div><div class="vitalBar fat"><i style="width:${pct(F, FM)}%"></i></div><div class="actionRow hpRow">${[-5, -1, 1, 5].map(d => `<button data-k="fatigue" data-d="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)}</button>`).join("")}</div></div>${conditions.length ? `<div class="mpConditions">${conditions.map(c => `<span>${escapeHtml(conditionNames[c] || c)}</span>`).join("")}</div>` : ""}`;
    $("mpVit").querySelectorAll("[data-k]").forEach(b => b.onclick = () => send({ t: "edit", k: b.dataset.k, d: +b.dataset.d }));
    const info = [["Nível", "level"], ["Força", "strength"], ["Velocidade", "speed"], ["Inteligência", "intelligence"], ["Vigor", "vigor"], ["Sorte", "luck"], ["Foco", "focus"], ["Defesas", "defenses"], ["Porte", "build"], ["Foco de poder", "focusType"], ["Nível do foco", "focusLevel"], ["Arma", "weapon"], ["Poderes", "powers"], ["Pontos fracos", "weaknesses"]];
    $("mpInfo").innerHTML = info.filter(([, k]) => sheet[k] !== "" && sheet[k] != null).map(([n, k]) => `<div><small>${n}</small><b>${escapeHtml(k === "focusType" ? ({fisico:"Combate físico",distancia:"Combate à distância",magico:"Combate mágico"}[sheet[k]] || "Não definido") : sheet[k])}</b></div>`).join("") + `<div><small>Proficiências</small><b>${escapeHtml(typeof formatProficiencies === "function" ? formatProficiencies(sheet.proficiencies) : sheet.proficiencies || "Nenhuma")}</b></div><div><small>Magias</small><b>${escapeHtml(typeof formatMagics === "function" ? formatMagics(sheet.magics) : sheet.magics || "Nenhuma")}</b></div><div><small>Espaços de magia</small><b>${Number(sheet.magicPoints) || 0}</b></div>`;
    $("mpClues").innerHTML = `${urgency?.public ? `<div class="playerUrgency"><b>${escapeHtml(urgency.title || "Investigação")}</b><strong>Rodada ${Number(urgency.round)||0}/${Number(urgency.limit)||0}</strong></div>` : ""}${clues.map(c => `<article class="playerClue"><b>${escapeHtml(c.title)}</b>${c.test ? `<small>${escapeHtml(c.test)}${c.dt ? ` · DT ${escapeHtml(c.dt)}` : ""}</small>` : ""}<p>${escapeHtml(c.description || "")}</p></article>`).join("") || `<p class="hint">Nenhuma pista revelada para este personagem.</p>`}`;
    const knownBox = $("mpKnownBeasts");
    knownBox.innerHTML = bestiary.map(c => `<button class="mpKnownCreature" data-creature="${escapeHtml(c.id)}"><span>${escapeHtml(c.name)}</span><small>${Number(c.n)||0} descoberta(s)</small></button>`).join("") || `<p class="mpEmpty">Você ainda não descobriu criaturas. As informações aparecerão aqui quando o mestre as revelar.</p>`;
    knownBox.querySelectorAll("[data-creature]").forEach(b => b.onclick = () => openPlayerCreature(b.dataset.creature));
    [["mpInventory", "inventory"], ["mpNotes", "notes"]].forEach(([id, k]) => { if (document.activeElement !== $(id)) $(id).value = sheet[k] || ""; });
    window.zeroBagUI?.($("mpBag"), Array.isArray(sheet.bag) ? sheet.bag : [], items, send, bestiary);
    me.querySelectorAll("[data-mp-tab]").forEach(b => b.classList.toggle("active", b.dataset.mpTab === activePlayerTab));
    me.querySelectorAll(".mpPane").forEach(x => x.classList.toggle("active", x.id === "mpPane-" + activePlayerTab));
  }
  connect();
}
})();
