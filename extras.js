// Espaço Zero V10: condições nos tokens + console de ações da sessão
(() => {
const P = ["player", "sala"].some(k => new URLSearchParams(location.search).has(k));
const CONDS = { poison: ["☠", "Envenenado"], control: ["🌀", "Controlado por Mimidos"], corrupt: ["◼", "Corrompido"], bleed: ["🩸", "Sangrando"], mimic: ["🎭", "Imitado"], stun: ["💫", "Atordoado"], fire: ["🔥", "Em chamas"], unseen: ["👁", "Invisível"] };
const own = t => (typeof vitalOwner === "function" && vitalOwner(t)) || t;
const conds = t => { const o = own(t); return (o.conds && o.conds.length ? o.conds : t.conds) || []; };
window.zeroConds = conds;
// ---- console
let open = false;
window.logAction = (text, kind = "sala", key) => {
  const L = state.log || (state.log = []), now = Date.now(), last = L[L.length - 1];
  if (key && last && last.key === key && now - last.t < 3000) { last.text = text; last.t = now; } else L.push({ t: now, text, kind, key });
  if (L.length > 500) L.splice(0, L.length - 500); if (open) drawLog();
};
function drawLog() {
  const f = $("logFilter").value, L = (state.log || []).filter(e => !f || e.kind === f).slice(-150).reverse();
  $("logList").innerHTML = L.length ? L.map(e => `<div class="logRow k-${e.kind}"><time>${new Date(e.t).toLocaleTimeString("pt-BR")}</time> ${escapeHtml(e.text)}</div>`).join("") : "<p class='hint'>Nada registrado ainda.</p>";
}
if (!P) {
  const btn = document.createElement("button"); btn.id = "logBtn"; btn.textContent = "📜"; btn.title = "Console da sessão"; $("playerWin").before(btn);
  const pn = document.createElement("div"); pn.id = "logPanel"; pn.className = "logPanel hidden";
  pn.innerHTML = `<div class="logHead"><b>📜 Console da sessão</b><select id="logFilter"><option value="">Tudo</option>${["dados", "vida", "condição", "movimento", "sala"].map(k => `<option>${k}</option>`).join("")}</select><button id="logClear">Limpar</button><button id="logX">✕</button></div><div id="logList"></div>`;
  document.body.append(pn);
  btn.onclick = () => { open = pn.classList.toggle("hidden") === false; if (open) drawLog(); };
  $("logX").onclick = () => { pn.classList.add("hidden"); open = false; };
  $("logFilter").onchange = drawLog;
  $("logClear").onclick = () => { if (confirm("Apagar todo o histórico da sessão?")) { state.log = []; drawLog(); markDirty("Console limpo"); } };
  const _sr = showRoll; showRoll = function (a, b, c, d) { _sr(a, b, c, d); logAction(c || b, "dados"); };
  const _av = adjustVital; adjustVital = function (t, k, d) { const r = _av(t, k, d); logAction(`${t.name}: ${k === "life" ? "vida" : "cansaço"} ${d > 0 ? "+" : "−"}${Math.abs(d)}`, "vida"); return r; };
}
// ---- condições
function screenFx() { Object.keys(CONDS).forEach(k => document.body.classList.toggle("fx-" + k, P && !!document.querySelector(".token.mine.c-" + k))); }
window.zeroFx = screenFx;
function decorate() {
  scene().tokens.forEach(t => {
    const el = document.querySelector(`[data-id="${t.id}"]`); if (!el) return; const c = conds(t);
    Object.keys(CONDS).forEach(k => el.classList.toggle("c-" + k, c.includes(k)));
    el.querySelector(".condRow")?.remove();
    if (c.length) { const r = document.createElement("div"); r.className = "condRow"; r.innerHTML = c.map(k => `<span title="${CONDS[k][1]}">${CONDS[k][0]}</span>`).join(""); el.append(r); }
  }); screenFx();
}
const _rw = renderWorld; renderWorld = function () { _rw(); decorate(); };
if (!P) {
  const _ri = renderInspector;
  renderInspector = function () {
    _ri(); const t = selectedToken(); if (!t) return; const c = conds(t), d = document.createElement("div"); d.className = "atkBox";
    d.innerHTML = `<div class="controlTitle">☠ CONDIÇÕES</div><div class="condGrid">${Object.entries(CONDS).map(([k, [i, n]]) => `<label class="condChip"><input type="checkbox" data-k="${k}" ${c.includes(k) ? "checked" : ""}> ${i} ${n}</label>`).join("")}</div>`;
    $("inspectorContent").append(d);
    d.querySelectorAll("input").forEach(i => i.onchange = () => {
      const o = own(t), s = new Set(o.conds || []); i.checked ? s.add(i.dataset.k) : s.delete(i.dataset.k); o.conds = [...s];
      logAction(`${t.name}: ${i.checked ? "ganhou" : "perdeu"} ${CONDS[i.dataset.k][1]}`, "condição"); renderWorld(); markDirty("Condição alterada");
    });
  };
}
})();
