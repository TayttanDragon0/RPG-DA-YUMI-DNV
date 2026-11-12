const $ = id => document.getElementById(id);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

let state = blankState();
let selected = null;
let editingCharacter = null;
let pendingPortrait = "";
let libraryMode = "assets";
let librarySearch = "";
let bestiaryCategory = "";
let zoom = 0.8;
let panX = 35;
let panY = 35;
let panTool = false;
let spaceHeld = false;
let gridVisible = true;
let dirty = false;
let audioTrackLoaded = "";
let snapOn = false;
let rulerTool = false;
let ruler = null;
let fogTool = null;
let fogDraft = null;
const SNAP = 32, WORLD_W = 5000, WORLD_H = 3200, METERS_PER_SQUARE = 1.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const snapValue = v => Math.round(v / SNAP) * SNAP;
function clampToken(t) {
  t.x = clamp(t.x, 0, WORLD_W - t.w);
  t.y = clamp(t.y, 0, WORLD_H - t.h);
}
function worldPoint(event) {
  const rect = $("viewport").getBoundingClientRect();
  return { x: (event.clientX - rect.left - panX) / zoom, y: (event.clientY - rect.top - panY) / zoom };
}
function imgTransform(t) {
  return `transform:rotate(${Number(t.rot) || 0}deg) scaleX(${t.flip ? -1 : 1})`;
}

function objectIconSvg(icon = "📦") {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="24" fill="#1b2432"/><text x="80" y="108" text-anchor="middle" font-size="82">${icon}</text></svg>`)}`;
}
const TORCH_ASSET_ID = "builtin-torch";
function builtInTorch() {
  return { id: TORCH_ASSET_ID, builtin: true, name: "Tocha", category: "Luz", description: "Uma tocha acesa que ilumina a área.", icon: "🔥", src: objectIconSvg("🔥"), props: [{ key: "Luz", value: "Ilumina uma área" }, { key: "Duração", value: "1 hora" }, { key: "Peso", value: "0,5 kg" }] };
}
function ensureBuiltInAssets(assets) {
  const list = Array.isArray(assets) ? assets : [];
  if (!list.some(a => a && a.id === TORCH_ASSET_ID)) list.unshift(builtInTorch());
  return list;
}
function normalizeObjectProps(props) {
  return Array.isArray(props) ? props.filter(p => p && String(p.key || "").trim()).map(p => ({ key: String(p.key).trim(), value: String(p.value ?? "").trim() })) : [];
}

function blankState() {
  return {
    version: 9,
    name: "Minha Campanha",
    active: "scene-1",
    assets: [builtInTorch()],
    characters: [],
    bestiary: seedBestiary(),
    musicTracks: [],
    activeMusicId: null,
    musicLoop: true,
    musicVolume: 0.65,
    scenes: [{
      id: "scene-1",
      name: "Cena Principal",
      background: null,
      bg: { x: 180, y: 120, width: 1500, height: 950, mode: "contain" },
      tokens: []
    }]
  };
}

const scene = () => state.scenes.find(s => s.id === state.active) || state.scenes[0];
const fileData = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error("Não foi possível ler o arquivo."));
  reader.readAsDataURL(file);
});
const imageSize = src => new Promise(resolve => {
  const img = new Image();
  img.onload = () => resolve({ width: img.naturalWidth || 1200, height: img.naturalHeight || 800 });
  img.onerror = () => resolve({ width: 1200, height: 800 });
  img.src = src;
});
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function markDirty(message = "Alterações não salvas") {
  dirty = true;
  $("saveStatus").textContent = message;
}
function status(message) {
  $("status").textContent = message;
  clearTimeout(window.statusTimer);
  window.statusTimer = setTimeout(() => $("status").textContent = "Pronto", 2200);
}
function normalizeScene(s) {
  s.tokens = Array.isArray(s.tokens) ? s.tokens : [];
  // Conserta tokens com posição/tamanho inválido (NaN/null), que travavam o movimento vertical.
  s.tokens.forEach((t, i) => {
    if (!Number.isFinite(t.w) || t.w < 32) t.w = 150;
    if (!Number.isFinite(t.h) || t.h < 32) t.h = 150;
    if (!Number.isFinite(t.x)) t.x = 300 + i * 40;
    if (!Number.isFinite(t.y)) t.y = 300 + i * 40;
  });
  if (!s.bg) s.bg = {};
  if (!s.fog || typeof s.fog !== "object") s.fog = { on: false, ops: [], player: false };
  if (!Array.isArray(s.fog.ops)) s.fog.ops = [];
  if (!s.turn || typeof s.turn !== "object") s.turn = { active: null, round: 1 };
  const b = s.bg;
  if (b.width == null) b.width = 1500;
  if (b.height == null) b.height = 950;
  if (b.x == null) b.x = b.left ?? 180;
  if (b.y == null) b.y = b.top ?? 120;
  if (!b.mode) b.mode = "contain";
  return s;
}
function normalizeState(loaded) {
  const base = blankState();
  const result = { ...base, ...loaded };
  result.version = 9;
  result.assets = ensureBuiltInAssets(Array.isArray(loaded.assets) ? loaded.assets : []);
  result.characters = Array.isArray(loaded.characters) ? loaded.characters : [];
  result.bestiary = Array.isArray(loaded.bestiary) ? loaded.bestiary : seedBestiary();
  result.musicTracks = Array.isArray(loaded.musicTracks) ? loaded.musicTracks : [];
  result.scenes = Array.isArray(loaded.scenes) && loaded.scenes.length ? loaded.scenes : base.scenes;
  result.scenes.forEach(normalizeScene);
  if (!result.scenes.some(s => s.id === result.active)) result.active = result.scenes[0].id;

  // Migrate old music field names if encountered.
  if (loaded.music && !result.musicTracks.length) result.musicTracks = loaded.music;
  return result;
}
function updateCamera() {
  $("world").style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  $("zoomText").textContent = `${Math.round(zoom * 100)}%`;
  $("viewport").classList.toggle("pan-mode", panTool);
}
function centerView() {
  const box = $("viewport").getBoundingClientRect();
  const s = scene();
  let cx = 2500, cy = 1600;
  if (s.background) {
    cx = s.bg.x + s.bg.width / 2;
    cy = s.bg.y + s.bg.height / 2;
  } else if (s.tokens.length) {
    const xs = s.tokens.map(t => t.x + t.w / 2);
    const ys = s.tokens.map(t => t.y + t.h / 2);
    cx = xs.reduce((a,b)=>a+b,0)/xs.length;
    cy = ys.reduce((a,b)=>a+b,0)/ys.length;
  }
  panX = box.width / 2 - cx * zoom;
  panY = box.height / 2 - cy * zoom;
  updateCamera();
}

function render() {
  normalizeScene(scene());
  $("campaignName").value = state.name || "Minha Campanha";
  $("sceneTitle").textContent = scene().name;
  renderLibrary();
  renderScenes();
  renderWorld();
  renderInspector();
  renderMusic();
  syncFogUi();
  renderInitiative();
  updateCamera();
}

function renderLibrary() {
  const box = $("library");
  box.innerHTML = "";
  const filters = $("libraryFilters");
  if (filters) filters.classList.toggle("hidden", libraryMode !== "creatures");
  let items = libraryMode === "assets" ? state.assets : libraryMode === "characters" ? state.characters : state.bestiary;

  if (libraryMode === "creatures") {
    const select = $("bestiaryCategory");
    const categories = [...new Set(state.bestiary.map(c => String(c.category || "Sem categoria").trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR"));
    if (select) {
      const previous = bestiaryCategory;
      select.innerHTML = '<option value="">Todas as categorias</option>' + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
      if (categories.includes(previous)) select.value = previous; else bestiaryCategory = "";
    }
    const q = librarySearch.trim().toLocaleLowerCase("pt-BR");
    items = items.filter(c => {
      const haystack = [c.name,c.category,c.fisicas,c.comportamento,c.onde,c.poderes,c.necessidades,c.utilidades,c.curiosidade].join(" ").toLocaleLowerCase("pt-BR");
      return (!q || haystack.includes(q)) && (!bestiaryCategory || (c.category || "Sem categoria") === bestiaryCategory);
    });
    if ($("bestiaryCount")) $("bestiaryCount").textContent = `${items.length} de ${state.bestiary.length} criaturas`;
  }

  items.forEach(item => {
    const element = document.createElement("div");
    element.className = "libItem" + (libraryMode === "creatures" ? " creatureLibItem" : "");
    element.draggable = true;
    const src = libraryMode === "assets" ? item.src : libraryMode === "characters" ? item.portrait : item.sprite;
    const subtitle = libraryMode === "creatures" ? `<small>${escapeHtml(item.category || "Sem categoria")}</small><small class="creatureStats">❤️ ${Number(item.life)||0} · 🛡 ${Number(item.defenses)||0} · ⚡ ${Number(item.speed)||0}</small>` : libraryMode === "assets" ? `<small>${escapeHtml(item.category || "Objeto")}${item.props?.length ? ` · ⚙ ${item.props.length} propriedade${item.props.length > 1 ? "s" : ""}` : ""}</small>` : "";
    element.innerHTML = `${src ? `<img src="${src}" alt="">` : "👤"}<span>${escapeHtml(item.name)}</span>${subtitle}`;
    element.addEventListener("dragstart", event => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("kind", libraryMode === "assets" ? "asset" : libraryMode === "characters" ? "character" : "creature");
      event.dataTransfer.setData("id", item.id);
    });
    if (libraryMode === "characters") {
      element.title = "Duplo clique para editar a ficha";
      element.addEventListener("dblclick", () => openCharacter(item));
    }
    if (libraryMode === "creatures") {
      element.title = "Arraste para a mesa · duplo clique abre a ficha";
      element.addEventListener("dblclick", () => openCreature(item));
    }
    element.addEventListener("click", event => {
      if (!window.matchMedia("(max-width: 680px)").matches || event.detail > 1) return;
      const kind = libraryMode === "assets" ? "asset" : libraryMode === "characters" ? "character" : "creature";
      placeLibraryItem(kind, item.id);
      document.querySelector(".sidebar").classList.remove("mobile-open");
      if ($("mobileLibraryToggle")) $("mobileLibraryToggle").setAttribute("aria-expanded", "false");
    });
    box.append(element);
  });

  if (libraryMode === "characters" || libraryMode === "creatures") {
    const button = document.createElement("button");
    button.textContent = libraryMode === "characters" ? "➕ Criar personagem" : "➕ Criar criatura";
    button.className = "primary fullWidth";
    button.onclick = () => libraryMode === "characters" ? openCharacter() : openCreature();
    box.append(button);
  }
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "hint libraryEmpty";
    empty.textContent = libraryMode === "creatures" ? "Nenhuma criatura encontrada. Tente outro termo ou categoria." : "Ainda não há itens nesta seção.";
    box.append(empty);
  }
}

if ($("librarySearch")) $("librarySearch").addEventListener("input", e => { librarySearch = e.target.value; renderLibrary(); });
if ($("bestiaryCategory")) $("bestiaryCategory").addEventListener("change", e => { bestiaryCategory = e.target.value; renderLibrary(); });

function renderScenes() {
  const box = $("sceneList");
  box.innerHTML = "";
  state.scenes.forEach(s => {
    const row = document.createElement("div");
    row.className = "sceneItem" + (s.id === state.active ? " active" : "");
    const name = document.createElement("span");
    name.className = "sceneName";
    name.textContent = "🎬 " + s.name;
    name.onclick = () => {
      state.active = s.id;
      selected = null;
      render();
      markDirty("Cena alterada");
    };
    name.ondblclick = event => {
      event.stopPropagation();
      const newName = prompt("Nome da cena:", s.name);
      if (newName && newName.trim()) {
        s.name = newName.trim();
        render();
        markDirty("Cena renomeada");
      }
    };
    row.append(name);

    if (state.scenes.length > 1) {
      const remove = document.createElement("button");
      remove.className = "sceneDelete danger";
      remove.textContent = "✕";
      remove.title = "Excluir cena";
      remove.onclick = event => {
        event.stopPropagation();
        if (confirm(`Excluir a cena "${s.name}"?`)) {
          state.scenes = state.scenes.filter(x => x.id !== s.id);
          if (state.active === s.id) state.active = state.scenes[0].id;
          selected = null;
          render();
          markDirty("Cena excluída");
        }
      };
      row.append(remove);
    }
    box.append(row);
  });
}

// Vida/Cansaço: personagens usam a ficha; criaturas guardam seus próprios valores em cada token.
function vitalOwner(token) {
  if (token.characterId) return state.characters.find(c => c.id === token.characterId) || null;
  if (token.creatureId || token.maxLife != null) return token;
  return null;
}
function ensureVitals(o) {
  o.life = Number(o.life) || 0;
  if (o.maxLife == null || !Number.isFinite(Number(o.maxLife))) o.maxLife = Math.max(o.life, 1);
  if (o.fatigueMax == null && o.maxFatigue == null) o.fatigueMax = 20;
  o.fatigueMax = Number(o.fatigueMax ?? o.maxFatigue) || 20;
  o.fatigue = Number(o.fatigue) || 0;
  return o;
}
function isDead(token) {
  const o = vitalOwner(token);
  return !!o && Number(o.life) <= 0;
}
function adjustVital(token, key, delta) {
  const o = vitalOwner(token);
  if (!o) return;
  ensureVitals(o);
  o[key] = clamp(o[key] + delta, 0, key === "life" ? o.maxLife : o.fatigueMax);
  renderWorld(); renderInspector(); markDirty(key === "life" ? "Vida atualizada" : "Cansaço atualizado");
}
function vitalsHtml(token) {
  const o = vitalOwner(token);
  if (!o) return "";
  ensureVitals(o);
  const pct = (v, m) => clamp(v / Math.max(1, m) * 100, 0, 100);
  return `<div class="controlTitle">❤ VIDA E CANSAÇO</div>
    <div class="vitalRow"><span>Vida</span><div class="vitalBar life" style="--lost:${100 - pct(o.life, o.maxLife)}"><i style="width:${pct(o.life, o.maxLife)}%"></i></div><b>${o.life}/${o.maxLife}</b></div>
    <div class="actionRow hpRow"><button data-vital="life" data-delta="-10">−10</button><button data-vital="life" data-delta="-1">−1</button><button data-vital="life" data-delta="1">+1</button><button data-vital="life" data-delta="10">+10</button></div>
    <div class="vitalRow"><span>Cansaço</span><div class="vitalBar fat"><i style="width:${pct(o.fatigue, o.fatigueMax)}%"></i></div><b>${o.fatigue}/${o.fatigueMax}</b></div>
    <div class="actionRow hpRow"><button data-vital="fatigue" data-delta="-5">−5</button><button data-vital="fatigue" data-delta="-1">−1</button><button data-vital="fatigue" data-delta="1">+1</button><button data-vital="fatigue" data-delta="5">+5</button></div>`;
}

function tokenLayerZ(token) {
  return Number.isFinite(token.z) ? token.z : 10;
}

function renderWorld() {
  normalizeScene(scene());
  const s = scene();
  const world = $("world");
  world.innerHTML = "";

  const grid = document.createElement("div");
  grid.id = "gridOverlay";
  if (!gridVisible) grid.classList.add("off");
  world.append(grid);

  if (s.background) {
    const b = s.bg;
    const background = document.createElement("div");
    background.id = "backgroundLayer";
    background.className = "backgroundLayer" + (selected === "__background__" ? " selectedBackground" : "");
    Object.assign(background.style, {
      left: `${b.x}px`,
      top: `${b.y}px`,
      width: `${b.width}px`,
      height: `${b.height}px`,
      backgroundImage: `url("${s.background}")`,
      backgroundSize: b.mode === "stretch" ? "100% 100%" : b.mode === "cover" ? "cover" : "contain"
    });
    background.title = "Clique para selecionar e arraste para mover o cenário";
    background.addEventListener("pointerdown", event => startBackgroundDrag(event, background));
    if (selected === "__background__") addResizeHandles(background, startBackgroundResize);
    world.append(background);
  }

  s.tokens.forEach(token => {
    const element = document.createElement("div");
    element.className = "token" + (selected === token.id ? " selected" : "") + (token.locked ? " locked" : "") + (token.shape === "round" ? " round" : "") + (scene().turn.active === token.id ? " turn" : "") + (isDead(token) ? " dead" : "");
    if (token.color && selected !== token.id) element.style.borderColor = token.color;
    Object.assign(element.style, {
      left: `${token.x}px`,
      top: `${token.y}px`,
      width: `${token.w}px`,
      height: `${token.h}px`,
      zIndex: String(tokenLayerZ(token))
    });
    element.dataset.id = token.id;
    const owner = vitalOwner(token);
    if (owner) ensureVitals(owner);
    const objectVisual = token.objectProps && !token.src ? `<div class="objectTokenIcon">${escapeHtml(token.icon || "📦")}</div>` : `<img src="${token.src || objectIconSvg(token.icon || "📦")}" alt="" style="${imgTransform(token)}">`;
    element.innerHTML = `${objectVisual}${owner ? `<div class="tokenHp ${Number(owner.life) <= 0 ? "dead" : ""}">❤ ${escapeHtml(owner.life)}/${escapeHtml(owner.maxLife)}${Number(owner.fatigue) > 0 ? ` · ⚡${escapeHtml(owner.fatigue)}` : ""}</div><div class="tokenBar" style="--lost:${100 - clamp(owner.life / Math.max(1, owner.maxLife) * 100, 0, 100)}"><span style="width:${clamp(owner.life / Math.max(1, owner.maxLife) * 100, 0, 100)}%"></span></div>` : ""}<div class="tokenLabel">${escapeHtml(token.name)}${Number.isFinite(token.init) ? ` <b class="initTag">⚔${token.init}</b>` : ""}</div>`;
    element.addEventListener("pointerdown", event => startTokenDrag(event, token, element));
    element.addEventListener("dblclick", () => {
      if (token.characterId) {
        const character = state.characters.find(c => c.id === token.characterId);
        if (character) openCharacter(character);
      } else if (token.creatureId) {
        const creature = state.bestiary.find(c => c.id === token.creatureId);
        if (creature) openCreature(creature);
      }
    });
    if (selected === token.id) addResizeHandles(element, startTokenResize.bind(null, token));
    world.append(element);
  });

  $("empty").style.display = (s.tokens.length || s.background) ? "none" : "block";
  drawFog();
  drawRuler();
  renderInitiative();
  updateCamera();
}

function drawFog() {
  $("fogLayer")?.remove();
  const f = scene().fog;
  if (!f?.on) return;
  const ops = fogDraft ? [...f.ops, fogDraft] : f.ops;
  const rects = ops.map(o => `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${o.reveal ? "#000" : "#fff"}"/>`).join("");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "fogLayer";
  svg.setAttribute("width", WORLD_W);
  svg.setAttribute("height", WORLD_H);
  svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:800";
  svg.innerHTML = `<defs><filter id="fogBlur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="7"/></filter>
    <mask id="fogMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}"><rect width="${WORLD_W}" height="${WORLD_H}" fill="#fff"/><g filter="url(#fogBlur)">${rects}</g></mask></defs>
    <rect width="${WORLD_W}" height="${WORLD_H}" fill="#05070b" fill-opacity="${f.player ? 1 : 0.62}" mask="url(#fogMask)"/>
    ${fogDraft ? `<rect x="${fogDraft.x}" y="${fogDraft.y}" width="${fogDraft.w}" height="${fogDraft.h}" fill="none" stroke="${fogDraft.reveal ? "#7ee787" : "#ff7b8a"}" stroke-width="${2 / zoom}" stroke-dasharray="${6 / zoom}"/>` : ""}`;
  $("world").append(svg);
}
function syncFogUi() {
  const f = scene().fog;
  $("fogOn").checked = !!f.on;
  $("fogPlayer").checked = !!f.player;
  $("fogReveal").classList.toggle("active", fogTool === "reveal");
  $("fogCover").classList.toggle("active", fogTool === "cover");
}
function setFogTool(mode) {
  fogTool = fogTool === mode ? null : mode;
  if (fogTool) {
    rulerTool = false; ruler = null;
    $("rulerToggle").classList.remove("active");
    const f = scene().fog;
    if (!f.on) { f.on = true; markDirty("Névoa ativada"); renderWorld(); }
  }
  $("viewport").classList.toggle("ruler-mode", !!fogTool || rulerTool);
  syncFogUi();
  if (fogTool) status(fogTool === "reveal" ? "Arraste na mesa para revelar uma área" : "Arraste na mesa para cobrir uma área");
}
function startFogRect(event) {
  event.preventDefault();
  event.stopPropagation();
  const snap = p => (snapOn || event.shiftKey) ? { x: snapValue(p.x), y: snapValue(p.y) } : p;
  const a = snap(worldPoint(event));
  const reveal = fogTool === "reveal";
  fogDraft = { x: a.x, y: a.y, w: 0, h: 0, reveal };
  const move = e => {
    const b = snap(worldPoint(e));
    fogDraft = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), reveal };
    drawFog();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    if (fogDraft && fogDraft.w > 8 && fogDraft.h > 8) {
      scene().fog.ops.push(fogDraft);
      markDirty(reveal ? "Área revelada" : "Área coberta");
    }
    fogDraft = null;
    drawFog();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function drawRuler() {
  $("rulerLayer")?.remove();
  if (!ruler) return;
  const dx = ruler.x2 - ruler.x1, dy = ruler.y2 - ruler.y1;
  const squares = Math.hypot(dx, dy) / SNAP;
  const label = `${squares.toFixed(1)} quadrados · ${(squares * METERS_PER_SQUARE).toFixed(1)} m`;
  const fs = 14 / zoom;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "rulerLayer";
  svg.setAttribute("width", WORLD_W);
  svg.setAttribute("height", WORLD_H);
  svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:900";
  svg.innerHTML = `<line x1="${ruler.x1}" y1="${ruler.y1}" x2="${ruler.x2}" y2="${ruler.y2}" stroke="#ffd166" stroke-width="${3 / zoom}" stroke-dasharray="${8 / zoom} ${6 / zoom}"/>
    <circle cx="${ruler.x1}" cy="${ruler.y1}" r="${5 / zoom}" fill="#ffd166"/><circle cx="${ruler.x2}" cy="${ruler.y2}" r="${5 / zoom}" fill="#ffd166"/>
    <text x="${(ruler.x1 + ruler.x2) / 2 + 10 / zoom}" y="${(ruler.y1 + ruler.y2) / 2 - 10 / zoom}" fill="#ffd166" font-size="${fs}" font-weight="700" stroke="#0b1018" stroke-width="${3 / zoom}" paint-order="stroke">${label}</text>`;
  $("world").append(svg);
}
function startRuler(event) {
  event.preventDefault();
  event.stopPropagation();
  const a = worldPoint(event);
  const start = snapOn || event.shiftKey ? { x: snapValue(a.x), y: snapValue(a.y) } : a;
  ruler = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
  const move = e => {
    const p = worldPoint(e);
    ruler.x2 = snapOn || e.shiftKey ? snapValue(p.x) : p.x;
    ruler.y2 = snapOn || e.shiftKey ? snapValue(p.y) : p.y;
    drawRuler();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  drawRuler();
}

function addResizeHandles(element, handler) {
  const corners = [
    ["nw", "top:-7px;left:-7px;cursor:nwse-resize"],
    ["ne", "top:-7px;right:-7px;cursor:nesw-resize"],
    ["sw", "bottom:-7px;left:-7px;cursor:nesw-resize"],
    ["se", "bottom:-7px;right:-7px;cursor:nwse-resize"]
  ];
  corners.forEach(([direction, css]) => {
    const handle = document.createElement("div");
    handle.className = "resizeHandle";
    handle.style.cssText = css;
    handle.addEventListener("pointerdown", event => handler(event, direction, element));
    element.append(handle);
  });
}

function shouldPan(event) {
  return panTool || spaceHeld || event.button === 1 || event.button === 2;
}
function startPan(event) {
  event.preventDefault();
  event.stopPropagation();
  const target = event.target;
  try { target.setPointerCapture(event.pointerId); } catch {}
  const startX = event.clientX, startY = event.clientY;
  const oldX = panX, oldY = panY;
  $("viewport").classList.add("is-panning");

  const move = e => {
    panX = oldX + e.clientX - startX;
    panY = oldY + e.clientY - startY;
    updateCamera();
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    $("viewport").classList.remove("is-panning");
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up, { once: true });
  target.addEventListener("pointercancel", up, { once: true });
}

// Capture phase means Space/middle/right pan works even when the pointer is over a token or map.
$("viewport").addEventListener("pointerdown", event => {
  if (shouldPan(event)) {
    startPan(event);
    return;
  }
  if (fogTool && event.button === 0) {
    startFogRect(event);
    return;
  }
  if (rulerTool && event.button === 0) {
    startRuler(event);
    return;
  }
  if (event.button === 0 && (event.target === $("viewport") || event.target === $("world") || event.target.id === "gridOverlay" || event.target.id === "empty")) {
    selected = null;
    renderInspector();
    startPan(event);
  }
}, true);

$("viewport").addEventListener("contextmenu", event => event.preventDefault());

// Arrasto robusto: ouve a janela inteira (não o elemento), então não perde o gesto
// mesmo que a mesa seja redesenhada ou o mouse saia da área.
function trackDrag(event, onMove, onEnd) {
  const id = event.pointerId;
  const move = e => { if (e.pointerId === id) { onMove(e); } };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    window.removeEventListener("blur", end);
  };
  const end = e => { if (e.pointerId !== undefined && e.pointerId !== id) return; stop(); onEnd && onEnd(e); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  window.addEventListener("blur", end);
}
function releaseTextFocus() {
  const a = document.activeElement;
  if (a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName)) a.blur();
}

function startBackgroundDrag(event, element) {
  if (shouldPan(event)) return;
  if (event.target.classList.contains("resizeHandle")) return;
  event.stopPropagation();
  event.preventDefault();
  releaseTextFocus();
  selected = "__background__";
  element.classList.add("selectedBackground");
  if (!element.querySelector(".resizeHandle")) addResizeHandles(element, startBackgroundResize);
  renderInspector();

  const b = scene().bg;
  const sx = event.clientX, sy = event.clientY, ox = b.x, oy = b.y;
  trackDrag(event, e => {
    b.x = ox + (e.clientX - sx) / zoom;
    b.y = oy + (e.clientY - sy) / zoom;
    element.style.left = `${b.x}px`;
    element.style.top = `${b.y}px`;
  }, () => markDirty("Cenário movido"));
}

function startBackgroundResize(event, direction, element) {
  if (shouldPan(event)) return;
  event.stopPropagation();
  const b = scene().bg;
  resizeRect(event, direction, element, b, () => {
    b.width = Math.max(80, b.width);
    b.height = Math.max(80, b.height);
    markDirty("Cenário redimensionado");
  });
}

function startTokenDrag(event, token, element) {
  if (shouldPan(event)) return;
  if (event.target.classList.contains("resizeHandle")) return;
  event.stopPropagation();
  event.preventDefault();
  releaseTextFocus();
  selected = token.id;
  document.querySelectorAll(".token").forEach(x => x.classList.remove("selected"));
  element.classList.add("selected");
  element.style.borderColor = "";
  if (!element.querySelector(".resizeHandle")) addResizeHandles(element, startTokenResize.bind(null, token));
  renderInspector();

  if (token.locked) { status("🔒 Objeto travado: destrave no Inspetor para mover"); return; }
  const sx = event.clientX, sy = event.clientY, ox = token.x, oy = token.y;
  let moved = false;
  trackDrag(event, e => {
    moved = true;
    token.x = ox + (e.clientX - sx) / zoom;
    token.y = oy + (e.clientY - sy) / zoom;
    if (snapOn || e.shiftKey) { token.x = snapValue(token.x); token.y = snapValue(token.y); }
    clampToken(token);
    element.style.left = `${token.x}px`;
    element.style.top = `${token.y}px`;
    syncPositionInputs(token);
  }, () => { if (moved) markDirty("Objeto movido"); });
}

function startTokenResize(token, event, direction, element) {
  if (shouldPan(event) || token.locked) return;
  event.stopPropagation();
  resizeRect(event, direction, element, token, () => {
    token.w = Math.max(32, token.w);
    token.h = Math.max(32, token.h);
    markDirty("Objeto redimensionado");
  });
}
function resizeRect(event, direction, element, rect, done) {
  event.preventDefault();
  // Tokens guardam w/h; o cenário guarda width/height. Usa as chaves certas de cada um.
  const wk = "w" in rect ? "w" : "width", hk = "h" in rect ? "h" : "height";
  const xk = "x" in rect ? "x" : "left", yk = "y" in rect ? "y" : "top";
  const sx = event.clientX, sy = event.clientY;
  const ow = Number(rect[wk]) || 150, oh = Number(rect[hk]) || 150, ox = Number(rect[xk]) || 0, oy = Number(rect[yk]) || 0;
  trackDrag(event, e => {
    const dx = (e.clientX - sx) / zoom;
    const dy = (e.clientY - sy) / zoom;
    let width = ow, height = oh, x = ox, y = oy;

    if (direction.includes("e")) width = Math.max(32, ow + dx);
    if (direction.includes("s")) height = Math.max(32, oh + dy);
    if (direction.includes("w")) { width = Math.max(32, ow - dx); x = ox + (ow - width); }
    if (direction.includes("n")) { height = Math.max(32, oh - dy); y = oy + (oh - height); }

    rect[wk] = width; rect[hk] = height; rect[xk] = x; rect[yk] = y;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }, done);
}

function renderInspector() {
  const box = $("inspectorContent");
  const token = scene().tokens.find(item => item.id === selected);

  if (token) {
    box.className = "selectedInfo";
    box.innerHTML = `
      <img src="${token.src}" alt="">
      <label>Nome<input id="inspectName" value="${escapeHtml(token.name)}"></label>
      <p class="muted">${token.type === "Personagem" ? "Personagem" : token.type === "Criatura" ? "Criatura" : "Objeto"}</p>
      ${token.type === "Objeto" && (token.objectCategory || token.objectDescription || token.objectProps?.length) ? `<div class="objectDetails"><h4>🧰 ${escapeHtml(token.objectCategory || "Objeto")}</h4>${token.objectDescription ? `<p>${escapeHtml(token.objectDescription)}</p>` : ""}${token.objectProps?.length ? `<dl>${token.objectProps.map(p => `<dt>${escapeHtml(p.key)}</dt><dd>${escapeHtml(p.value)}</dd>`).join("")}</dl>` : ""}</div>` : ""}
      <div class="twoCols"><label>X<input id="inspectX" type="number" value="${Math.round(token.x)}"></label><label>Y<input id="inspectY" type="number" value="${Math.round(token.y)}"></label></div>
      <div class="twoCols"><label>Largura<input id="inspectW" type="number" min="32" value="${Math.round(token.w)}"></label><label>Altura<input id="inspectH" type="number" min="32" value="${Math.round(token.h)}"></label></div>
      <div class="twoCols"><label>Formato<select id="inspectShape"><option value="square">Quadrado</option><option value="round">Redondo</option></select></label><label>Aro<input id="inspectColor" type="color" value="${token.color || "#81a3ff"}"></label></div>
      <div class="actionRow">
        <button id="flipToken" title="Tecla F">↔ Espelhar</button>
        <button id="rotLeft" title="Tecla Q">⟲ 15°</button>
        <button id="rotRight" title="Tecla R">⟳ 15°</button>
      </div>
      ${vitalsHtml(token)}
      <div class="twoCols"><label>Iniciativa<input id="inspectInit" type="number" value="${Number.isFinite(token.init) ? token.init : ""}" placeholder="—"></label><label>&nbsp;<button id="rollInit" class="fullWidth" title="d20 + Velocidade">🎲 d20+Vel</button></label></div>
      <div class="actionRow">
        <button id="duplicateToken">📑 Duplicar</button>
        <button id="lockToken">${token.locked ? "🔓 Destravar" : "🔒 Travar"}</button>
      </div>
      <div class="actionRow">
        <button id="frontToken">⬆ Trazer frente</button>
        <button id="backToken">⬇ Enviar trás</button>
      </div>
      ${token.characterId ? '<button id="editTokenCharacter" class="fullWidth">📋 Abrir ficha</button>' : ""}
      ${token.creatureId ? '<button id="editTokenCreature" class="fullWidth">📖 Abrir ficha da criatura</button>' : ""}
      <button id="deleteToken" class="danger fullWidth">🗑️ Remover da mesa</button>
    `;

    $("inspectName").oninput = e => { token.name = e.target.value; markDirty(); renderWorld(); };
    $("inspectW").onchange = e => { token.w = Math.max(32, Number(e.target.value) || 32); renderWorld(); markDirty(); };
    $("inspectH").onchange = e => { token.h = Math.max(32, Number(e.target.value) || 32); renderWorld(); markDirty(); };
    $("inspectX").onchange = e => { token.x = Number(e.target.value) || 0; clampToken(token); renderWorld(); syncPositionInputs(token); markDirty("Objeto movido"); };
    $("inspectY").onchange = e => { token.y = Number(e.target.value) || 0; clampToken(token); renderWorld(); syncPositionInputs(token); markDirty("Objeto movido"); };
    $("inspectShape").value = token.shape === "round" ? "round" : "square";
    $("inspectShape").onchange = e => { token.shape = e.target.value; renderWorld(); markDirty("Formato alterado"); };
    $("inspectColor").oninput = e => { token.color = e.target.value; renderWorld(); markDirty("Aro alterado"); };
    $("flipToken").onclick = () => flipSelected();
    $("rotLeft").onclick = () => rotateSelected(-15);
    $("rotRight").onclick = () => rotateSelected(15);
    box.querySelectorAll("[data-vital]").forEach(btn => btn.onclick = () => adjustVital(token, btn.dataset.vital, Number(btn.dataset.delta)));
    $("inspectInit").onchange = e => { token.init = e.target.value === "" ? undefined : Number(e.target.value); renderWorld(); markDirty("Iniciativa alterada"); };
    $("rollInit").onclick = () => { rollTokenInitiative(token); renderInspector(); renderWorld(); markDirty("Iniciativa rolada"); };
    $("duplicateToken").onclick = duplicateSelected;
    $("lockToken").onclick = () => { token.locked = !token.locked; render(); markDirty(token.locked ? "Objeto travado" : "Objeto destravado"); };
    $("frontToken").onclick = () => { token.z = Math.max(10, ...scene().tokens.map(tokenLayerZ)) + 1; renderWorld(); markDirty("Objeto à frente"); };
    $("backToken").onclick = () => { token.z = Math.min(10, ...scene().tokens.map(tokenLayerZ)) - 1; renderWorld(); markDirty("Objeto atrás"); };
    if (token.creatureId) $("editTokenCreature").onclick = () => {
      const creature = state.bestiary.find(c => c.id === token.creatureId);
      if (creature) openCreature(creature); else status("Esta criatura não está mais no bestiário");
    };
    if (token.characterId) $("editTokenCharacter").onclick = () => {
      const character = state.characters.find(c => c.id === token.characterId);
      if (character) openCharacter(character);
    };
    $("deleteToken").onclick = () => {
      scene().tokens = scene().tokens.filter(x => x.id !== token.id);
      selected = null; render(); markDirty("Objeto removido");
    };
    return;
  }

  if (selected === "__background__" && scene().background) {
    renderBackgroundInspector(box);
    return;
  }

  box.className = "muted";
  box.innerHTML = scene().background
    ? "Clique no cenário para selecioná-lo, mover ou redimensionar."
    : "Selecione um objeto, personagem ou importe um cenário.";
}
function syncPositionInputs(token) {
  if ($("inspectX")) $("inspectX").value = Math.round(token.x);
  if ($("inspectY")) $("inspectY").value = Math.round(token.y);
}
function selectedToken() { return scene().tokens.find(t => t.id === selected); }
function duplicateSelected() {
  const token = selectedToken();
  if (!token) return;
  const copy = { ...token, id: uid(), x: token.x + 35, y: token.y + 35, z: tokenLayerZ(token) + 1, name: token.name + " (cópia)" };
  clampToken(copy);
  scene().tokens.push(copy); selected = copy.id; render(); markDirty("Objeto duplicado");
}
function flipSelected() {
  const token = selectedToken();
  if (!token) return;
  token.flip = !token.flip; renderWorld(); markDirty("Objeto espelhado");
}
function rotateSelected(deg) {
  const token = selectedToken();
  if (!token) return;
  token.rot = (((Number(token.rot) || 0) + deg) % 360 + 360) % 360; renderWorld(); markDirty("Objeto girado");
}
function nudgeSelected(dx, dy) {
  if (selected === "__background__" && scene().background) {
    const b = scene().bg; b.x += dx; b.y += dy;
    const el = $("backgroundLayer"); if (el) { el.style.left = `${b.x}px`; el.style.top = `${b.y}px`; }
    markDirty("Cenário movido"); return;
  }
  const token = selectedToken();
  if (!token || token.locked) return;
  token.x += dx; token.y += dy; clampToken(token);
  const el = [...document.querySelectorAll(".token")].find(x => x.dataset.id === token.id);
  if (el) { el.style.left = `${token.x}px`; el.style.top = `${token.y}px`; }
  syncPositionInputs(token);
  markDirty("Objeto movido");
}
function renderBackgroundInspector(box) {
  const b = scene().bg;
  box.className = "";
  box.innerHTML = `
    <div class="controlTitle">🗺️ CENÁRIO SELECIONADO</div>
    <p class="hint">Arraste o cenário na mesa. Use os cantos para redimensionar.</p>
    <label>Largura<input id="bgWidth" type="number" min="80" value="${Math.round(b.width)}"></label>
    <label>Altura<input id="bgHeight" type="number" min="80" value="${Math.round(b.height)}"></label>
    <label>Modo de imagem<select id="bgMode"><option value="contain">Mostrar imagem inteira</option><option value="cover">Preencher (pode cortar)</option><option value="stretch">Esticar</option></select></label>
    <div class="actionRow"><button id="centerBg">🎯 Centralizar</button><button id="fitBg">↔ Ajustar à mesa</button></div>
    <button id="removeBg" class="danger fullWidth">🗑️ Remover cenário</button>
  `;
  $("bgMode").value = b.mode;
  $("bgWidth").onchange = () => { b.width = Math.max(80, Number($("bgWidth").value) || 80); renderWorld(); markDirty(); };
  $("bgHeight").onchange = () => { b.height = Math.max(80, Number($("bgHeight").value) || 80); renderWorld(); markDirty(); };
  $("bgMode").onchange = () => { b.mode = $("bgMode").value; renderWorld(); markDirty(); };
  $("centerBg").onclick = () => { b.x = 500; b.y = 300; renderWorld(); markDirty(); };
  $("fitBg").onclick = () => { b.x = 0; b.y = 0; b.width = 2400; b.height = 1600; b.mode = "contain"; renderWorld(); renderInspector(); markDirty(); };
  $("removeBg").onclick = () => {
    if (confirm("Remover o cenário desta cena?")) { scene().background = null; selected = null; render(); markDirty(); }
  };
}

// Navigation: blank drag pans; Space+drag, middle/right mouse, or hand tool pans anywhere.
$("panMode").onclick = () => {
  panTool = !panTool;
  $("panMode").classList.toggle("active", panTool);
  updateCamera();
  status(panTool ? "Ferramenta mão ativada" : "Ferramenta mão desativada");
};
window.addEventListener("keydown", event => {
  const tag = event.target?.tagName;
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target?.isContentEditable;
  if (event.code === "Space" && !typing) { spaceHeld = true; $("viewport").classList.add("pan-mode"); event.preventDefault(); }
  if (typing && event.key !== "Escape") return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicateSelected();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[event.key] && selected) {
    event.preventDefault();
    const step = event.shiftKey || snapOn ? SNAP : 8;
    nudgeSelected(arrows[event.key][0] * step, arrows[event.key][1] * step);
    return;
  }
  const k = event.key.toLowerCase();
  if (k === "f" && selectedToken()) flipSelected();
  if (k === "r" && selectedToken()) rotateSelected(15);
  if (k === "q" && selectedToken()) rotateSelected(-15);
  if (k === "g") $("snapToggle").click();
  if (k === "m") $("rulerToggle").click();
  if (event.key === "Delete" && selected) {
    if (selected === "__background__") { scene().background = null; selected = null; render(); markDirty(); }
    else {
      scene().tokens = scene().tokens.filter(t => t.id !== selected);
      selected = null; render(); markDirty("Objeto removido");
    }
  }
  if (event.key === "Escape") {
    if (ruler) { ruler = null; drawRuler(); }
    if (fogTool) setFogTool(fogTool);
    $("characterModal").classList.add("hidden");
    $("creatureModal").classList.add("hidden");
    $("tutorialModal").classList.add("hidden");
  }
});
window.addEventListener("keyup", event => {
  if (event.code === "Space") { spaceHeld = false; updateCamera(); }
});
window.addEventListener("blur", () => { spaceHeld = false; updateCamera(); });

$("zoomIn").onclick = () => zoomAt(1.15);
$("zoomOut").onclick = () => zoomAt(1 / 1.15);
function zoomAt(factor) {
  const rect = $("viewport").getBoundingClientRect();
  const mx = rect.width / 2, my = rect.height / 2;
  const old = zoom;
  zoom = Math.min(2.5, Math.max(0.25, zoom * factor));
  panX = mx - (mx - panX) * zoom / old;
  panY = my - (my - panY) * zoom / old;
  updateCamera();
}
$("viewport").addEventListener("wheel", event => {
  event.preventDefault();
  const rect = $("viewport").getBoundingClientRect();
  const mx = event.clientX - rect.left, my = event.clientY - rect.top;
  const old = zoom;
  zoom = Math.min(2.5, Math.max(0.25, zoom * (event.deltaY < 0 ? 1.1 : 0.9)));
  panX = mx - (mx - panX) * zoom / old;
  panY = my - (my - panY) * zoom / old;
  updateCamera();
}, { passive: false });
$("centerView").onclick = centerView;
$("snapToggle").onclick = () => {
  snapOn = !snapOn;
  $("snapToggle").classList.toggle("active", snapOn);
  status(snapOn ? "Ímã da grade ligado (arrastar encaixa na grade)" : "Ímã da grade desligado (Shift encaixa temporariamente)");
};
$("rulerToggle").onclick = () => {
  rulerTool = !rulerTool;
  if (rulerTool) fogTool = null;
  syncFogUi();
  $("rulerToggle").classList.toggle("active", rulerTool);
  $("viewport").classList.toggle("ruler-mode", rulerTool || !!fogTool);
  if (!rulerTool) { ruler = null; drawRuler(); }
  status(rulerTool ? "Régua: arraste na mesa para medir (1 quadrado = 1,5 m)" : "Régua desligada");
};

// Dice roller com animação visual temporária (o resultado é decidido antes da animação).
const diceHistory = [];
function secureDie(sides) { const a = new Uint32Array(1), limit = Math.floor(0x100000000 / sides) * sides; do { crypto.getRandomValues(a); } while (a[0] >= limit); return (a[0] % sides) + 1; }
function animateDie(sides, result) { const ov = $("diceOverlay"); if (!ov) return; ov.classList.remove("hidden"); ov.innerHTML = `<div class="diceAnim d${sides}"><span>?</span></div>`; const die = ov.firstElementChild; const span = die.querySelector("span"); let n = 0; const tick = setInterval(() => { span.textContent = secureDie(sides); if (++n >= 11) { clearInterval(tick); span.textContent = result; die.classList.add("land"); setTimeout(() => { ov.classList.add("hidden"); ov.innerHTML = ""; }, 1100); } }, 85); }
function rollDice(sides) {
  const count = clamp(Math.floor(Number($("diceCount").value)) || 1, 1, 50);
  const mod = Math.floor(Number($("diceMod").value)) || 0;
  const rolls = Array.from({ length: count }, () => secureDie(sides));
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  const text = `${count}d${sides}${mod ? (mod > 0 ? "+" : "") + mod : ""}`;
  animateDie(sides, rolls[0]);
  $("diceResult").textContent = total;
  $("diceDetail").textContent = `${text}: [${rolls.join(", ")}]${mod ? ` ${mod > 0 ? "+" : "−"} ${Math.abs(mod)}` : ""}`;
  $("diceResult").classList.toggle("crit", sides === 20 && count === 1 && rolls[0] === 20);
  $("diceResult").classList.toggle("fail", sides === 20 && count === 1 && rolls[0] === 1);
  diceHistory.unshift(`${text} → ${total}`); diceHistory.length = Math.min(diceHistory.length, 8); $("diceHistory").textContent = diceHistory.join("  ·  ");
}
function showRoll(total, detail, history, kind = "") { $("diceResult").textContent = total; $("diceDetail").textContent = detail; $("diceResult").classList.toggle("crit", kind === "crit"); $("diceResult").classList.toggle("fail", kind === "fail"); diceHistory.unshift(history); diceHistory.length = Math.min(diceHistory.length, 8); $("diceHistory").textContent = diceHistory.join("  ·  "); }
const d = sides => secureDie(sides);

// Ordem Paranormal skill test: roll d20 equal to the attribute and keep the highest;
// with attribute 0, roll 2d20 and keep the lowest. Then add skill training and other bonuses.
$("opRoll").onclick = () => {
  const attr = clamp(Math.floor(Number($("opAttr").value)) || 0, 0, 10);
  const train = Number($("opTrain").value) || 0;
  const bonus = Math.floor(Number($("opBonus").value)) || 0;
  const dtRaw = $("opDT").value.trim();
  const rolls = Array.from({ length: attr === 0 ? 2 : attr }, () => d(20));
  const kept = attr === 0 ? Math.min(...rolls) : Math.max(...rolls);
  const total = kept + train + bonus;
  let verdict = "";
  if (dtRaw !== "") verdict = total >= Number(dtRaw) ? ` · DT ${dtRaw}: ✔ SUCESSO` : ` · DT ${dtRaw}: ✘ FALHA`;
  const bonusText = train + bonus ? ` ${train + bonus > 0 ? "+" : "−"} ${Math.abs(train + bonus)}` : "";
  const kind = kept === 20 ? "crit" : kept === 1 ? "fail" : "";
  showRoll(total, `${rolls.length}d20 [${rolls.join(", ")}] pega o ${attr === 0 ? "menor" : "maior"} (${kept})${bonusText}${verdict}${kind === "crit" ? " · 20 natural!" : kind === "fail" ? " · 1 natural" : ""}`, `Teste ${attr}d20 → ${total}`, kind);
};

// Free dice expression, e.g. 2d6+3, 1d8+2d4-1.
function rollExpression(text) {
  const clean = text.replace(/\s+/g, "").toLowerCase();
  const terms = clean.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join("") !== clean) return null;
  let total = 0; const parts = [];
  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const m = body.match(/^(\d*)d(\d+)$/);
    if (m) {
      const n = clamp(Number(m[1] || 1), 1, 100), sides = clamp(Number(m[2]), 2, 1000);
      const rolls = Array.from({ length: n }, () => d(sides));
      total += sign * rolls.reduce((a, b) => a + b, 0);
      parts.push(`${sign < 0 ? "−" : "+"}${n}d${sides}[${rolls.join(",")}]`);
    } else if (/^\d+$/.test(body)) {
      total += sign * Number(body);
      parts.push(`${sign < 0 ? "−" : "+"}${body}`);
    } else return null;
  }
  return { total, detail: parts.join(" ").replace(/^\+/, "") };
}
function runExpression() {
  const text = $("exprInput").value.trim();
  const r = text && rollExpression(text);
  if (!r) { status("Fórmula inválida. Exemplo: 2d6+3"); return; }
  showRoll(r.total, `${text}: ${r.detail}`, `${text} → ${r.total}`);
}
$("exprRoll").onclick = runExpression;
$("exprInput").addEventListener("keydown", e => { if (e.key === "Enter") runExpression(); });

// Fog of war controls.
$("fogOn").onchange = e => { scene().fog.on = e.target.checked; if (!e.target.checked && fogTool) fogTool = null; renderWorld(); syncFogUi(); markDirty("Névoa alterada"); };
$("fogPlayer").onchange = e => { scene().fog.player = e.target.checked; renderWorld(); markDirty("Modo da névoa alterado"); };
$("fogReveal").onclick = () => setFogTool("reveal");
$("fogCover").onclick = () => setFogTool("cover");
$("fogRevealAll").onclick = () => { const f = scene().fog; f.on = true; f.ops = [{ x: 0, y: 0, w: WORLD_W, h: WORLD_H, reveal: true }]; renderWorld(); syncFogUi(); markDirty("Tudo revelado"); };
$("fogCoverAll").onclick = () => { const f = scene().fog; f.on = true; f.ops = []; renderWorld(); syncFogUi(); markDirty("Tudo coberto"); };

document.querySelectorAll("[data-die]").forEach(btn => btn.onclick = () => rollDice(Number(btn.dataset.die)));
$("gridToggle").onclick = () => {
  gridVisible = !gridVisible;
  $("gridToggle").classList.toggle("active", gridVisible);
  $("gridOverlay")?.classList.toggle("off", !gridVisible);
};


// Criador de objetos com propriedades livres.
let pendingObjectImage = "";
function addObjectPropRow(key = "", value = "") {
  const row = document.createElement("div"); row.className = "objectPropRow";
  row.innerHTML = `<input class="objectPropKey" placeholder="Propriedade" value="${escapeHtml(key)}"><input class="objectPropValue" placeholder="Valor" value="${escapeHtml(value)}"><button type="button" title="Remover">✕</button>`;
  row.querySelector("button").onclick = () => row.remove();
  $("objectProps").append(row);
}
function openObjectModal() {
  pendingObjectImage = ""; $("o_name").value = ""; $("o_category").value = ""; $("o_description").value = ""; $("o_image").value = "";
  $("objectProps").innerHTML = ""; addObjectPropRow("Peso", ""); addObjectPropRow("Efeito", "");
  $("objectPreview").removeAttribute("src"); $("objectPlaceholder").style.display = ""; $("objectImageStatus").textContent = "A imagem é opcional. Sem imagem, o objeto usa um ícone.";
  $("objectModal").classList.remove("hidden");
}
function closeObjectModal() { $("objectModal").classList.add("hidden"); }
$("createObject").onclick = openObjectModal;
$("closeObject").onclick = closeObjectModal; $("cancelObject").onclick = closeObjectModal;
$("addObjectProp").onclick = () => addObjectPropRow();
$("o_image").onchange = async e => {
  const file = e.target.files?.[0]; if (!file) return;
  pendingObjectImage = await fileData(file); $("objectPreview").src = pendingObjectImage; $("objectPlaceholder").style.display = "none"; $("objectImageStatus").textContent = "Imagem definida para este objeto.";
};
$("saveObject").onclick = () => {
  const name = $("o_name").value.trim(); if (!name) { alert("Dê um nome ao objeto."); return; }
  const props = [...document.querySelectorAll("#objectProps .objectPropRow")].map(row => ({ key: row.querySelector(".objectPropKey").value.trim(), value: row.querySelector(".objectPropValue").value.trim() })).filter(p => p.key);
  state.assets.push({ id: uid(), name, category: $("o_category").value.trim() || "Objeto", description: $("o_description").value.trim(), src: pendingObjectImage, icon: "📦", props: normalizeObjectProps(props) });
  libraryMode = "assets"; document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.lib === "assets"));
  closeObjectModal(); render(); markDirty("Objeto criado"); status("🧰 Objeto salvo na biblioteca");
};

// Import ordinary object images.
$("importImages").onclick = () => $("imageFiles").click();
$("imageFiles").onchange = async event => {
  try {
    for (const file of [...event.target.files]) {
      if (!file.type.startsWith("image/")) continue;
      state.assets.push({ id: uid(), name: file.name.replace(/\.[^.]+$/, ""), category: "Objeto", src: await fileData(file), props: [] });
    }
    render();
    markDirty("Imagens importadas");
  } catch (error) {
    alert("Não consegui importar a imagem: " + error.message);
  } finally {
    event.target.value = "";
  }
};

document.querySelectorAll(".tab").forEach(button => button.onclick = () => {
  libraryMode = button.dataset.lib;
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
  if (libraryMode !== "creatures") { librarySearch = ""; bestiaryCategory = ""; }
  renderLibrary();
});

const mobileLibraryToggle = $("mobileLibraryToggle");
const mobileInspectorToggle = $("mobileInspectorToggle");
if (mobileLibraryToggle) mobileLibraryToggle.onclick = () => {
  const open = $("mobileLibraryToggle").getAttribute("aria-expanded") !== "true";
  document.querySelector(".sidebar").classList.toggle("mobile-open", open);
  mobileLibraryToggle.setAttribute("aria-expanded", String(open));
  if (open) { document.querySelector(".inspector").classList.remove("mobile-open"); mobileInspectorToggle.setAttribute("aria-expanded", "false"); }
};
if (mobileInspectorToggle) mobileInspectorToggle.onclick = () => {
  const open = mobileInspectorToggle.getAttribute("aria-expanded") !== "true";
  document.querySelector(".inspector").classList.toggle("mobile-open", open);
  mobileInspectorToggle.setAttribute("aria-expanded", String(open));
  if (open) { document.querySelector(".sidebar").classList.remove("mobile-open"); mobileLibraryToggle.setAttribute("aria-expanded", "false"); }
};

function placeLibraryItem(kind, id, x = null, y = null) {
  const rect = $("viewport").getBoundingClientRect();
  const px = x == null ? (rect.width / 2 - panX) / zoom : x;
  const py = y == null ? (rect.height / 2 - panY) / zoom : y;
  if (kind === "asset") {
    const asset = state.assets.find(item => item.id === id);
    if (asset) { const token = { id: uid(), assetId: asset.id, name: asset.name, src: asset.src || "", icon: asset.icon || "📦", type: "Objeto", objectCategory: asset.category || "Objeto", objectDescription: asset.description || "", objectProps: normalizeObjectProps(asset.props), x: px - 75, y: py - 75, w: 150, h: 150, z: 20, locked: false }; scene().tokens.push(token); selected = token.id; }
  } else if (kind === "creature") {
    const creature = state.bestiary.find(item => item.id === id);
    if (creature) { const token = makeCreatureToken(creature, px - 75, py - 75); scene().tokens.push(token); selected = token.id; }
  } else if (kind === "character") {
    const character = state.characters.find(item => item.id === id);
    if (character) { const token = { id: uid(), name: character.name, src: character.portrait, type: "Personagem", characterId: character.id, x: px - 85, y: py - 85, w: 170, h: 170, z: 30, locked: false }; scene().tokens.push(token); selected = token.id; }
  }
  render(); markDirty("Adicionado à mesa");
}

$("viewport").addEventListener("dragover", event => event.preventDefault());
$("viewport").addEventListener("drop", event => {
  event.preventDefault();
  const kind = event.dataTransfer.getData("kind");
  const id = event.dataTransfer.getData("id");
  if (!kind || !id) return;

  const rect = $("viewport").getBoundingClientRect();
  const x = (event.clientX - rect.left - panX) / zoom;
  const y = (event.clientY - rect.top - panY) / zoom;
  placeLibraryItem(kind, id, x, y);
});

// Scenes and background.
$("addScene").onclick = () => {
  const name = prompt("Nome da nova cena:");
  if (!name || !name.trim()) return;
  const newScene = { id: uid(), name: name.trim(), background: null, bg: { x: 180, y: 120, width: 1500, height: 950, mode: "contain" }, tokens: [] };
  state.scenes.push(newScene);
  state.active = newScene.id;
  selected = null;
  render();
  markDirty("Cena criada");
};
$("setBackground").onclick = () => $("backgroundFile").click();
$("backgroundFile").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const src = await fileData(file);
    const dimensions = await imageSize(src);
    const ratio = Math.min(1, 1800 / dimensions.width, 1250 / dimensions.height);
    const width = Math.round(dimensions.width * ratio);
    const height = Math.round(dimensions.height * ratio);
    scene().background = src;
    scene().bg = { x: 180, y: 120, width, height, mode: "contain" };
    selected = "__background__";
    render();
    markDirty("Cenário adicionado");
    status("Cenário carregado sem cortar a imagem");
  } catch (error) {
    alert("Erro ao carregar cenário: " + error.message);
  } finally {
    event.target.value = "";
  }
};

// Character sheet: sprite mandatory; new character automatically gets a token.
const characterFields = ["name","universe","appearance","weapon","personality","life","fatigue","maxLife","fatigueMax","defenses","strength","speed","intelligence","build","vigor","luck","focus","proficiencies","magics","magicPoints","powers","weaknesses","history"];
const PROFICIENCIES_PRESET = ["Mirar (arma branca)","Mirar (arma de fogo/magia)","Recuperação de dados","Flexibilidade","Reflexo","Sorte","Lábia","Sexto sentido","Preparação","Tecnologia","Carisma","Cura","Furtividade","Luta","Intimidação","Durabilidade","Determinação","Fuga"];
const MAGICS_PRESET = ["Arrombar tranca","Controle de água, terra, fogo e ar","Controle de gravidade","Fúria divina","Dança sombria","Ilusões","Criar portais","Chuva de prata","Sopro de esperança","Dívida da alma","Verdade ilusória","Luz do fim","Carcará","Construção","Consertar","Detectar ameaças","Vozes","Mira divina","Falsa impressão","Favor cobrado","Neblina","Mãos mansas","Veneno","Ácido","Bússola da saudade","Descansar","Mundo estranho","Correntes gêmeas","Vampiro","Controle único","Provocação","Cura","Regeneração","Xeque-Mate","Absorção"];
function parseProfs(v){ try{return JSON.parse(v||"{}")}catch{return {}} }
function parseMagics(v){ try{return JSON.parse(v||"[]")}catch{return []} }
function renderCharacterPresets(){
  const prof = parseProfs($("c_proficiencies").value), magic = parseMagics($("c_magics").value);
  const used = Object.values(prof).reduce((a,b)=>a+(Number(b)||0),0), remain=21-used;
  $("proficiencyBudget").textContent=`Usados: ${used}/21 • Restam: ${remain} • cada valor: 0, 3, 6...`;
  $("proficiencyPreset").innerHTML=PROFICIENCIES_PRESET.map(n=>`<label class="presetItem"><span>${n}</span><select data-prof="${n}">${[0,3,6,9,12,15,18,21].map(x=>`<option value="${x}" ${Number(prof[n]||0)===x?'selected':''}>${x||'—'}</option>`).join('')}</select></label>`).join('');
  $("proficiencyPreset").querySelectorAll('select').forEach(el=>el.onchange=()=>{ const p=parseProfs($("c_proficiencies").value); p[el.dataset.prof]=Number(el.value); const total=Object.values(p).reduce((a,b)=>a+(Number(b)||0),0); if(total>21){ alert("O total de proficiências não pode passar de 21 pontos."); p[el.dataset.prof]=0; } $("c_proficiencies").value=JSON.stringify(p); renderCharacterPresets(); });
  const limit=Math.max(0,Number($("c_magicPoints").value)||10);
  $("magicBudget").textContent=`Selecionadas: ${magic.length}/${limit} • no início você pode ter no máximo ${limit} magias/pontos.`;
  $("magicPreset").innerHTML=MAGICS_PRESET.map(n=>`<label class="presetItem"><input type="checkbox" data-magic="${n}" ${magic.includes(n)?'checked':''}> <span>${n}</span></label>`).join('');
  $("magicPreset").querySelectorAll('input').forEach(el=>el.onchange=()=>{ let m=parseMagics($("c_magics").value); if(el.checked){ if(m.length>=limit){ alert(`Limite de ${limit} magias/pontos iniciais atingido.`); el.checked=false; return; } m.push(el.dataset.magic); } else m=m.filter(x=>x!==el.dataset.magic); $("c_magics").value=JSON.stringify(m); renderCharacterPresets(); });
}
function openCharacter(character = null) {
  editingCharacter = character;
  pendingPortrait = character?.portrait || "";
  const defaults = {
    name: "", universe: "", appearance: "", weapon: "", personality: "", life: 100, fatigue: 20,
    defenses: "", strength: 0, speed: 0, intelligence: 0, build: 0, vigor: 0, luck: 0, focus: 0, proficiencies: "", magics: "", magicPoints: 10, powers: "",
    weaknesses: "", history: ""
  };
  const data = { ...defaults, ...(character || {}) };
  data.maxLife = character?.maxLife ?? character?.life ?? 100;
  data.fatigueMax = character?.fatigueMax ?? 20;
  characterFields.forEach(field => {
    const value = data[field] ?? "";
    $("c_" + field).value = value;
  });
  $("c_portrait").value = "";
  renderCharacterPresets();
  updatePortraitPreview();
  $("portraitStatus").textContent = pendingPortrait ? "Sprite já definido. Escolha outro para substituir." : "Selecione o sprite obrigatório deste personagem.";
  $("deleteCharacter").classList.toggle("hidden", !character);
  $("characterModal").classList.remove("hidden");
  $("c_name").focus();
}
function updatePortraitPreview() {
  const frame = document.querySelector(".portraitFrame");
  const img = $("portraitPreview");
  if (pendingPortrait) {
    img.src = pendingPortrait;
    frame.classList.add("hasImage");
  } else {
    img.removeAttribute("src");
    frame.classList.remove("hasImage");
  }
}
$("c_portrait").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Escolha um arquivo de imagem para o sprite.");
    event.target.value = "";
    return;
  }
  pendingPortrait = await fileData(file);
  updatePortraitPreview();
  $("portraitStatus").textContent = file.name;
};
$("closeCharacter").onclick = $("cancelCharacter").onclick = () => $("characterModal").classList.add("hidden");
$("saveCharacter").onclick = async () => {
  const name = $("c_name").value.trim();
  if (!name) { alert("Digite o nome do personagem."); $("c_name").focus(); return; }
  if (!pendingPortrait) { alert("Escolha o sprite do personagem antes de salvar."); $("c_portrait").focus(); return; }

  const isNew = !editingCharacter;
  const character = editingCharacter || { id: uid() };
  characterFields.forEach(field => {
    const value = $("c_" + field).value;
    character[field] = ["life","fatigue","maxLife","fatigueMax","strength","speed","intelligence","build","vigor","luck","focus"].includes(field) ? Number(value) || 0 : value;
  });
  character.portrait = pendingPortrait;
  if (!(character.maxLife >= 1)) character.maxLife = Math.max(1, character.life);
  if (!(character.fatigueMax >= 1)) character.fatigueMax = 20;
  // Cansaço sempre nasce cheio; depois o jogador controla a queda manualmente.
  if (isNew) character.fatigue = character.fatigueMax;
  const profTotal = Object.values(parseProfs(character.proficiencies)).reduce((a,b)=>a+(Number(b)||0),0);
  if (profTotal > 21 || Object.values(parseProfs(character.proficiencies)).some(v => Number(v)%3!==0)) { alert("Proficiências inválidas: máximo 21 e somente múltiplos de 3."); return; }
  if (parseMagics(character.magics).length > (Number(character.magicPoints)||10)) { alert("Você excedeu o limite de magias iniciais."); return; }

  if (isNew) state.characters.push(character);

  // Keep existing table tokens linked to this sheet updated.
  state.scenes.forEach(s => {
    s.tokens.forEach(token => {
      if (token.characterId === character.id) {
        token.name = character.name;
        token.src = character.portrait;
      }
    });
  });

  // New character always becomes a movable object on the active scene.
  if (isNew) {
    const rect = $("viewport").getBoundingClientRect();
    const x = (rect.width / 2 - panX) / zoom - 85;
    const y = (rect.height / 2 - panY) / zoom - 85;
    const token = {
      id: uid(), name: character.name, src: character.portrait, type: "Personagem",
      characterId: character.id, x, y, w: 170, h: 170, z: 30, locked: false
    };
    scene().tokens.push(token);
    selected = token.id;
  }

  $("characterModal").classList.add("hidden");
  render();
  markDirty(isNew ? "Personagem criado e colocado na mesa" : "Ficha atualizada");
};
$("deleteCharacter").onclick = () => {
  if (!editingCharacter) return;
  if (!confirm(`Excluir "${editingCharacter.name}" e seus tokens das cenas?`)) return;
  const id = editingCharacter.id;
  state.characters = state.characters.filter(c => c.id !== id);
  state.scenes.forEach(s => s.tokens = s.tokens.filter(t => t.characterId !== id));
  selected = null;
  $("characterModal").classList.add("hidden");
  render();
  markDirty("Personagem excluído");
};

// Bestiário: fichas de criaturas baseadas no documento "Criaturas do espaço zero".
const creatureTextFields = ["fisicas","comportamento","onde","poderes","necessidades","utilidades","curiosidade"];
const creatureNumFields = ["life","fatigue","defenses","strength","speed","intelligence","build"];
let editingCreature = null;
let pendingCreatureSprite = "";
function openCreature(creature = null) {
  editingCreature = creature;
  pendingCreatureSprite = creature?.sprite || "";
  const data = creature || {};
  ["name","category","color",...creatureTextFields,...creatureNumFields].forEach(f => {
    $("k_" + f).value = data[f] ?? (f === "color" ? "#c25b6b" : creatureNumFields.includes(f) ? 0 : "");
  });
  $("k_sprite").value = "";
  updateCreaturePreview();
  $("deleteCreature").classList.toggle("hidden", !creature);
  $("duplicateCreature").classList.toggle("hidden", !creature);
  $("creatureModal").classList.remove("hidden");
  $("k_name").focus();
}
function updateCreaturePreview() {
  const frame = document.querySelector("#creatureModal .portraitFrame");
  const img = $("creaturePreview");
  if (pendingCreatureSprite) { img.src = pendingCreatureSprite; frame.classList.add("hasImage"); }
  else { img.removeAttribute("src"); frame.classList.remove("hasImage"); }
}
$("k_sprite").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { alert("Escolha um arquivo de imagem."); event.target.value = ""; return; }
  pendingCreatureSprite = await fileData(file);
  updateCreaturePreview();
};
function readCreatureForm(target) {
  ["name","category","color",...creatureTextFields].forEach(f => target[f] = $("k_" + f).value);
  creatureNumFields.forEach(f => target[f] = Number($("k_" + f).value) || 0);
  target.name = target.name.trim();
}
function saveCreatureData() {
  const name = $("k_name").value.trim();
  if (!name) { alert("Digite o nome da criatura."); $("k_name").focus(); return null; }
  const isNew = !editingCreature;
  const creature = editingCreature || { id: uid() };
  readCreatureForm(creature);
  creature.sprite = pendingCreatureSprite || genericCreatureArt(creature.color);
  if (isNew) state.bestiary.push(creature);
  state.scenes.forEach(sc => sc.tokens.forEach(t => { if (t.creatureId === creature.id) t.src = creature.sprite; }));
  editingCreature = creature;
  return creature;
}
function makeCreatureToken(creature, x, y) {
  const n = scene().tokens.filter(t => t.creatureId === creature.id).length;
  const life = Math.max(1, Number(creature.life) || 1);
  return {
    id: uid(), name: n ? `${creature.name} ${n + 1}` : creature.name, src: creature.sprite, type: "Criatura",
    creatureId: creature.id, x, y, w: 150, h: 150, z: 30, locked: false, shape: "round", color: creature.color || "#c25b6b",
    life, maxLife: life, fatigue: 20, fatigueMax: Number(creature.fatigue) || 20, speed: Number(creature.speed) || 0
  };
}
$("closeCreature").onclick = $("cancelCreature").onclick = () => $("creatureModal").classList.add("hidden");
$("saveCreature").onclick = () => {
  if (!saveCreatureData()) return;
  $("creatureModal").classList.add("hidden");
  render(); markDirty("Criatura salva no bestiário");
};
$("placeCreature").onclick = () => {
  const creature = saveCreatureData();
  if (!creature) return;
  const rect = $("viewport").getBoundingClientRect();
  const token = makeCreatureToken(creature, (rect.width / 2 - panX) / zoom - 75, (rect.height / 2 - panY) / zoom - 75);
  scene().tokens.push(token);
  selected = token.id;
  $("creatureModal").classList.add("hidden");
  render(); markDirty("Criatura colocada na mesa");
};
$("duplicateCreature").onclick = () => {
  if (!editingCreature) return;
  const copy = { ...JSON.parse(JSON.stringify(editingCreature)), id: uid(), name: editingCreature.name + " (variação)" };
  state.bestiary.push(copy);
  $("creatureModal").classList.add("hidden");
  render(); markDirty("Criatura duplicada");
  openCreature(copy);
};
$("deleteCreature").onclick = () => {
  if (!editingCreature) return;
  if (!confirm(`Excluir "${editingCreature.name}" do bestiário? Os tokens já na mesa permanecem.`)) return;
  state.bestiary = state.bestiary.filter(c => c.id !== editingCreature.id);
  $("creatureModal").classList.add("hidden");
  render(); markDirty("Criatura excluída");
};

// Iniciativa: d20 + Velocidade (da ficha). A ordem vale para a cena atual.
function rollTokenInitiative(token) {
  const o = vitalOwner(token);
  const speed = Number(o?.speed ?? token.speed) || 0;
  token.init = d(20) + speed;
}
function initOrder() {
  return scene().tokens.filter(t => Number.isFinite(t.init)).sort((a, b) => b.init - a.init);
}
function renderInitiative() {
  const box = $("initList");
  if (!box) return;
  const turn = scene().turn;
  const order = initOrder();
  if (turn.active && !order.some(t => t.id === turn.active)) turn.active = null;
  $("initRound").textContent = order.length ? `Rodada ${turn.round}` : "Sem combate";
  box.innerHTML = "";
  order.forEach(t => {
    const row = document.createElement("div");
    row.className = "initRow" + (t.id === turn.active ? " active" : "") + (isDead(t) ? " dead" : "");
    row.innerHTML = `<b>${t.init}</b><span>${escapeHtml(t.name)}</span>`;
    row.onclick = () => { selected = t.id; renderWorld(); renderInspector(); };
    const x = document.createElement("button");
    x.textContent = "✕"; x.title = "Tirar da iniciativa";
    x.onclick = e => { e.stopPropagation(); delete t.init; renderWorld(); markDirty("Iniciativa removida"); };
    row.append(x);
    box.append(row);
  });
}
function nextTurn() {
  const turn = scene().turn;
  const order = initOrder().filter(t => !isDead(t));
  if (!order.length) { status("Role a iniciativa primeiro"); return; }
  const i = order.findIndex(t => t.id === turn.active);
  const next = (i + 1) % order.length;
  if (i >= 0 && next === 0) turn.round++;
  turn.active = order[next].id;
  renderWorld(); markDirty("Turno alterado");
  status(`Turno de ${order[next].name}`);
}
$("initRollAll").onclick = () => {
  scene().tokens.forEach(t => { if (vitalOwner(t)) rollTokenInitiative(t); });
  scene().turn = { active: null, round: 1 };
  renderWorld(); renderInspector(); markDirty("Iniciativa rolada");
};
$("initNext").onclick = nextTurn;
$("initClear").onclick = () => {
  scene().tokens.forEach(t => delete t.init);
  scene().turn = { active: null, round: 1 };
  renderWorld(); renderInspector(); markDirty("Combate encerrado");
};

// A mesa nunca deve rolar por conta própria (isso desalinhava o arrasto).
["viewport", "world"].forEach(id => $(id).addEventListener("scroll", e => { e.target.scrollTop = 0; e.target.scrollLeft = 0; }));
window.addEventListener("scroll", () => window.scrollTo(0, 0));

// Music library: audio files are embedded in the campaign file.
function renderMusic() {
  const box = $("musicList");
  box.innerHTML = "";
  state.musicTracks.forEach(track => {
    const row = document.createElement("div");
    row.className = "musicItem" + (track.id === state.activeMusicId ? " active" : "");
    const label = document.createElement("span");
    label.className = "trackLabel";
    label.textContent = (track.id === state.activeMusicId ? "▶ " : "♫ ") + track.name;
    label.onclick = () => selectTrack(track.id, true);
    const remove = document.createElement("button");
    remove.className = "removeTrack danger";
    remove.textContent = "✕";
    remove.title = "Remover faixa";
    remove.onclick = event => {
      event.stopPropagation();
      if (!confirm(`Remover "${track.name}" da playlist?`)) return;
      state.musicTracks = state.musicTracks.filter(t => t.id !== track.id);
      if (state.activeMusicId === track.id) state.activeMusicId = state.musicTracks[0]?.id || null;
      renderMusic();
      markDirty("Faixa removida");
    };
    row.append(label, remove);
    box.append(row);
  });
  $("loopToggle").textContent = state.musicLoop ? "🔁 Loop: ligado" : "➡ Loop: desligado";
  $("loopToggle").classList.toggle("active", state.musicLoop);
  $("musicVolume").value = Math.round((state.musicVolume ?? 0.65) * 100);
  syncAudioSource();
}
function syncAudioSource() {
  const track = state.musicTracks.find(t => t.id === state.activeMusicId);
  const player = $("audioPlayer");
  player.loop = !!state.musicLoop;
  player.volume = Math.max(0, Math.min(1, Number(state.musicVolume ?? 0.65)));
  if (!track) {
    player.pause();
    player.removeAttribute("src");
    player.load();
    audioTrackLoaded = "";
    return;
  }
  if (audioTrackLoaded !== track.id) {
    player.pause();
    player.src = track.data;
    player.load();
    audioTrackLoaded = track.id;
  }
}
function selectTrack(id, play) {
  state.activeMusicId = id;
  audioTrackLoaded = "";
  renderMusic();
  if (play) $("audioPlayer").play().catch(() => status("Clique em Play no player para iniciar o áudio"));
  markDirty("Trilha selecionada");
}
$("addMusic").onclick = () => $("musicFiles").click();
$("musicFiles").onchange = async event => {
  try {
    const files = [...event.target.files];
    for (const file of files) {
      if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) continue;
      if (file.size > 80 * 1024 * 1024 && !confirm(`${file.name} tem mais de 80 MB. Isso deixará o arquivo da campanha muito pesado. Adicionar mesmo assim?`)) continue;
      const data = await fileData(file);
      const track = { id: uid(), name: file.name, data };
      state.musicTracks.push(track);
      if (!state.activeMusicId) state.activeMusicId = track.id;
    }
    renderMusic();
    markDirty("Música adicionada");
  } catch (error) {
    alert("Não consegui importar a música: " + error.message);
  } finally {
    event.target.value = "";
  }
};
$("loopToggle").onclick = () => {
  state.musicLoop = !state.musicLoop;
  $("audioPlayer").loop = state.musicLoop;
  $("loopToggle").textContent = state.musicLoop ? "🔁 Loop: ligado" : "➡ Loop: desligado";
  $("loopToggle").classList.toggle("active", state.musicLoop);
  markDirty("Loop atualizado");
};
$("musicVolume").oninput = event => {
  state.musicVolume = Number(event.target.value) / 100;
  $("audioPlayer").volume = state.musicVolume;
  markDirty("Volume atualizado");
};
function cycleTrack(direction) {
  if (!state.musicTracks.length) return;
  let index = state.musicTracks.findIndex(t => t.id === state.activeMusicId);
  if (index < 0) index = 0;
  index = (index + direction + state.musicTracks.length) % state.musicTracks.length;
  selectTrack(state.musicTracks[index].id, true);
}
$("prevTrack").onclick = () => cycleTrack(-1);
$("nextTrack").onclick = () => cycleTrack(1);
$("audioPlayer").addEventListener("ended", () => {
  if (!state.musicLoop) cycleTrack(1);
});

// Campaign file: all images, sprites and music are embedded in this JSON.
$("campaignName").oninput = event => { state.name = event.target.value; markDirty(); };
$("newCampaign").onclick = () => {
  if (!confirm("Criar uma nova campanha? Salve a atual antes para não perder alterações.")) return;
  state = blankState();
  selected = null;
  audioTrackLoaded = "";
  panX = 35; panY = 35; zoom = 0.8;
  render();
  dirty = false;
  $("saveStatus").textContent = "Nova campanha";
};
$("saveCampaign").onclick = () => {
  state.name = $("campaignName").value.trim() || "Minha Campanha";
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (state.name.replace(/[\\/:*?"<>|]+/g, "_") || "campanha") + ".rpg.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  dirty = false;
  $("saveStatus").textContent = "Arquivo salvo";
  status("Campanha salva no computador");
};
$("loadCampaign").onclick = () => $("campaignFile").click();
$("campaignFile").onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const loaded = JSON.parse(reader.result);
      if (!Array.isArray(loaded.scenes)) throw new Error("Campanha inválida");
      state = normalizeState(loaded);
      selected = null;
      audioTrackLoaded = "";
      render();
      dirty = false;
      $("saveStatus").textContent = "Campanha carregada";
      status("Campanha carregada");
    } catch (error) {
      alert("Não consegui abrir esse arquivo. Verifique se é um arquivo de campanha RPG válido.");
      console.error(error);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
};
window.addEventListener("beforeunload", event => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

// Tutorial shown the first time; setting only remembers whether to show the tutorial again.
function openTutorial() { $("tutorialModal").classList.remove("hidden"); }
function closeTutorial() {
  if ($("skipTutorial").checked) {
    try { localStorage.setItem("rpgMesaSkipTutorial", "1"); } catch {}
  }
  $("tutorialModal").classList.add("hidden");
}
$("helpButton").onclick = openTutorial;
$("closeTutorial").onclick = closeTutorial;

render();
let skipTutorial = false;
try { skipTutorial = localStorage.getItem("rpgMesaSkipTutorial") === "1"; } catch {}
if (!skipTutorial) openTutorial();

// ===== Melhorias específicas para mobile: drawers + pinch zoom =====
(() => {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;
  const mq = window.matchMedia('(max-width: 680px)');

  // Mantém o topo dos drawers alinhado com a altura real do cabeçalho.
  const syncMobileHeader = () => {
    if (!mq.matches) return;
    document.documentElement.style.setProperty('--mobile-header-h', `${document.querySelector('.topbar').offsetHeight}px`);
  };
  syncMobileHeader();
  window.addEventListener('resize', syncMobileHeader);
  if (window.ResizeObserver) new ResizeObserver(syncMobileHeader).observe(document.querySelector('.topbar'));

  // Fundo escuro clicável para fechar os painéis.
  let backdrop = document.querySelector('.mobileBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'mobileBackdrop';
    document.body.append(backdrop);
  }
  const closePanels = () => {
    document.querySelector('.sidebar')?.classList.remove('mobile-open');
    document.querySelector('.inspector')?.classList.remove('mobile-open');
    document.getElementById('mobileLibraryToggle')?.setAttribute('aria-expanded','false');
    document.getElementById('mobileInspectorToggle')?.setAttribute('aria-expanded','false');
    backdrop.classList.remove('show');
  };
  backdrop.addEventListener('click', closePanels);
  document.getElementById('mobileLibraryToggle')?.addEventListener('click', () => {
    if (mq.matches) requestAnimationFrame(() => backdrop.classList.toggle('show', document.querySelector('.sidebar')?.classList.contains('mobile-open')));
  });
  document.getElementById('mobileInspectorToggle')?.addEventListener('click', () => {
    if (mq.matches) requestAnimationFrame(() => backdrop.classList.toggle('show', document.querySelector('.inspector')?.classList.contains('mobile-open')));
  });

  // Pinch para zoom mantendo o ponto entre os dedos no mesmo lugar.
  const touches = new Map();
  let pinch = null;
  const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  const midpoint = (a,b) => ({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const beginPinch = () => {
    if (touches.size !== 2 || !mq.matches) return;
    const [a,b] = [...touches.values()];
    const m = midpoint(a,b);
    pinch = {
      d: Math.max(1,distance(a,b)), z: zoom,
      x:m.x, y:m.y,
      wx:(m.x-panX)/zoom, wy:(m.y-panY)/zoom
    };
    viewport.classList.add('is-panning');
  };
  viewport.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !mq.matches) return;
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if (touches.size === 2) beginPinch();
  }, true);
  window.addEventListener('pointermove', e => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if (!pinch || touches.size !== 2) return;
    const [a,b] = [...touches.values()];
    const m = midpoint(a,b);
    const nz = Math.max(.2,Math.min(3,pinch.z * distance(a,b)/pinch.d));
    zoom = nz;
    panX = m.x - pinch.wx * nz;
    panY = m.y - pinch.wy * nz;
    updateCamera();
  }, true);
  const endTouch = e => {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    if (touches.size < 2) { pinch = null; viewport.classList.remove('is-panning'); }
  };
  window.addEventListener('pointerup', endTouch, true);
  window.addEventListener('pointercancel', endTouch, true);

  // Duplo toque na mesa: centraliza rapidamente.
  let lastTap = 0;
  viewport.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch' || !mq.matches || touches.size) return;
    const now = Date.now();
    if (now-lastTap < 280 && typeof centerView === 'function') centerView();
    lastTap = now;
  });
})();
