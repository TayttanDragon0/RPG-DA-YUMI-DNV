// Espaço Zero V17 — ferramentas opcionais de condução da sessão.
// Inspiradas em procedimentos de RPG investigativo; não impõem as regras de Ordem Paranormal.
(() => {
  const query = new URLSearchParams(location.search);
  const playerWindow = query.has("player");
  const remotePlayer = query.has("sala");
  const isPlayerView = playerWindow || remotePlayer;
  const $ = id => document.getElementById(id);
  const paneNames = ["scene", "investigation", "clues", "combat", "interlude"];
  let activePane = "scene";

  function ensureTools() {
    const s = scene();
    if (!s.gmTools || typeof s.gmTools !== "object" || Array.isArray(s.gmTools)) s.gmTools = {};
    const tools = s.gmTools;
    if (!tools.urgency || typeof tools.urgency !== "object") tools.urgency = { title: "Investigação", limit: 4, round: 0, running: false, complete: false, consequence: "", public: false };
    const u = tools.urgency;
    u.title = String(u.title || "Investigação");
    u.limit = Math.max(1, Math.min(99, Math.floor(Number(u.limit) || 4)));
    u.round = Math.max(0, Math.min(u.limit, Math.floor(Number(u.round) || 0)));
    u.complete = u.round >= u.limit;
    u.consequence = String(u.consequence || "");
    u.public = !!u.public;

    // Migra o relógio único das versões de desenvolvimento anteriores para a lista.
    if (!Array.isArray(tools.clocks)) {
      const old = tools.threat && typeof tools.threat === "object" ? tools.threat : null;
      // Só converte se havia um relógio legado. Campanhas novas começam sem relógios fictícios.
      tools.clocks = old ? [{
        id: uid(), title: String(old.title || "Relógio de ameaça"),
        value: Number(old.value) || 0, max: Number(old.max) || 6,
        consequence: String(old.consequence || ""), complete: !!old.complete
      }] : [];
    }
    tools.clocks = tools.clocks.filter(c => c && typeof c === "object").map(c => {
      c.id = String(c.id || uid());
      c.title = String(c.title || "Relógio de ameaça");
      c.max = Math.max(1, Math.min(99, Math.floor(Number(c.max) || 6)));
      c.value = Math.max(0, Math.min(c.max, Math.floor(Number(c.value) || 0)));
      c.consequence = String(c.consequence || "");
      c.complete = c.value >= c.max;
      return c;
    });
    delete tools.threat;

    const sceneTypes = ["Investigação", "Ação / combate", "Interação", "Interlúdio"];
    if (!sceneTypes.includes(tools.sceneType)) tools.sceneType = "Investigação";
    tools.sceneNotes = String(tools.sceneNotes || "");
    tools.investigationRound = Math.max(1, Math.floor(Number(tools.investigationRound) || 1));
    if (!Array.isArray(tools.investigationActions)) tools.investigationActions = [];
    tools.investigationActions = tools.investigationActions.filter(a => a && typeof a === "object").slice(-200);
    if (!tools.investigationAssist || typeof tools.investigationAssist !== "object") tools.investigationAssist = null;
    if (tools.investigationAssist && !Array.isArray(tools.investigationAssist.remaining)) tools.investigationAssist = null;
    const combatRound = Math.max(1, Math.floor(Number(s.turn?.round) || 1));
    if (!Array.isArray(tools.reactionUsed)) tools.reactionUsed = [];
    if (Number(tools.reactionRound) !== combatRound) {
      tools.reactionRound = combatRound;
      tools.reactionUsed = [];
    }
    if (!Array.isArray(tools.clues)) tools.clues = [];
    tools.clues = tools.clues.filter(c => c && typeof c === "object").map(c => ({
      ...c, id: String(c.id || uid()), title: String(c.title || "Pista sem título"),
      description: String(c.description || ""), type: c.type === "principal" ? "principal" : "complementar",
      test: String(c.test || ""), dt: c.dt ?? "", public: !!c.public,
      knownTo: Array.isArray(c.knownTo) ? [...new Set(c.knownTo.map(String))] : []
    }));
    return tools;
  }

  const safeLog = (message, kind = "sala") => { try { window.logAction?.(message, kind); } catch {} };
  const changed = message => { markDirty(message || "Ferramenta do mestre atualizada"); drawMasterTools(); };
  const setIfIdle = (id, value) => { const el = $(id); if (el && document.activeElement !== el) el.value = value ?? ""; };
  const publicClue = c => ({ id: c.id, title: c.title, description: c.description, type: c.type, test: c.test || "", dt: c.dt ?? "" });

  // Os pacotes da mesa do jogador recebem apenas pistas já liberadas e dados públicos.
  window.zeroCluesFor = charId => ensureTools().clues
    .filter(c => c.public === true || (Array.isArray(c.knownTo) && c.knownTo.includes(String(charId))))
    .map(publicClue);
  window.zeroPublicClues = () => ensureTools().clues.filter(c => c.public === true).map(publicClue);
  window.zeroPublicUrgency = () => {
    const u = ensureTools().urgency;
    return u.public ? { public: true, title: u.title, round: u.round, limit: u.limit, complete: u.complete } : null;
  };

  function setPane(name) {
    if (!paneNames.includes(name)) return;
    activePane = name;
    document.querySelectorAll("[data-gm-pane]").forEach(el => el.classList.toggle("hidden", el.dataset.gmPane !== name));
    document.querySelectorAll("[data-gm-tab]").forEach(el => el.classList.toggle("active", el.dataset.gmTab === name));
  }

  function drawClues(tools) {
    const box = $("gmClueList");
    if (!box) return;
    const characters = state.characters || [];
    if (!tools.clues.length) { box.innerHTML = `<p class="hint">Nenhuma pista criada. As novas pistas começam secretas.</p>`; return; }
    box.innerHTML = tools.clues.map(c => {
      const seenNames = c.knownTo.map(id => characters.find(ch => ch.id === id)?.name).filter(Boolean);
      const statusText = c.public ? "Visível para todos" : seenNames.length ? "Revelada: " + seenNames.join(", ") : "Secreta";
      return `<article class="gmClueCard" data-clue-card="${escapeHtml(c.id)}">
        <div class="gmClueTitle"><b>${escapeHtml(c.title)}</b><span class="gmClueStatus ${c.public ? "public" : seenNames.length ? "shared" : "secret"}">${escapeHtml(statusText)}</span></div>
        <small class="gmClueType">${c.type === "principal" ? "Pista principal" : "Pista complementar"}</small>
        ${c.test ? `<small>${escapeHtml(c.test)}${c.dt !== "" && c.dt != null ? " · DT " + escapeHtml(c.dt) : ""}</small>` : ""}
        <p>${escapeHtml(c.description || "Sem descrição.")}</p>
        <div class="gmClueActions"><select data-clue-target><option value="">Escolher jogador…</option>${characters.map(ch => `<option value="${escapeHtml(ch.id)}">${escapeHtml(ch.name)}</option>`).join("")}</select>
        <button data-clue-reveal="${escapeHtml(c.id)}">Revelar</button><button data-clue-all="${escapeHtml(c.id)}">Todos</button><button data-clue-hide="${escapeHtml(c.id)}">Ocultar</button><button class="danger" data-clue-delete="${escapeHtml(c.id)}">✕</button></div>
      </article>`;
    }).join("");
    box.querySelectorAll("[data-clue-reveal]").forEach(btn => btn.onclick = () => {
      const card = btn.closest("[data-clue-card]"), target = card?.querySelector("[data-clue-target]")?.value;
      const clue = tools.clues.find(c => c.id === btn.dataset.clueReveal);
      if (!target || !clue) return alert("Escolha o personagem que receberá esta pista.");
      if (!clue.knownTo.includes(target)) clue.knownTo.push(target);
      safeLog(`Pista revelada para ${state.characters.find(c => c.id === target)?.name || "jogador"}: ${clue.title}`, "sala");
      changed("Pista revelada individualmente");
    });
    box.querySelectorAll("[data-clue-all]").forEach(btn => btn.onclick = () => {
      const clue = tools.clues.find(c => c.id === btn.dataset.clueAll); if (!clue) return;
      clue.public = true; safeLog(`Pista revelada para todos: ${clue.title}`, "sala"); changed("Pista revelada para todos");
    });
    box.querySelectorAll("[data-clue-hide]").forEach(btn => btn.onclick = () => {
      const clue = tools.clues.find(c => c.id === btn.dataset.clueHide); if (!clue) return;
      clue.public = false; clue.knownTo = []; changed("Pista ocultada");
    });
    box.querySelectorAll("[data-clue-delete]").forEach(btn => btn.onclick = () => {
      const clue = tools.clues.find(c => c.id === btn.dataset.clueDelete); if (!clue) return;
      if (!confirm(`Excluir a pista “${clue.title}”?`)) return;
      tools.clues = tools.clues.filter(c => c.id !== clue.id); changed("Pista excluída");
    });
  }

  function drawClocks(tools) {
    const box = $("gmClockList"); if (!box) return;
    if (!tools.clocks.length) { box.innerHTML = `<p class="hint">Nenhum relógio criado.</p>`; return; }
    box.innerHTML = tools.clocks.map(c => `<article class="gmClockCard" data-clock-card="${escapeHtml(c.id)}">
      <div class="gmClockFields"><label>Nome<input data-clock-field="title" value="${escapeHtml(c.title)}"></label><label>Etapas<input data-clock-field="max" type="number" min="1" max="99" value="${c.max}"></label></div>
      <div class="gmClock"><div class="gmClockTop"><strong>${c.value} / ${c.max}</strong><span>${c.complete ? "Concluído" : "Em andamento"}</span></div><div class="gmProgress threat"><i style="width:${Math.min(100, c.value / c.max * 100)}%"></i></div></div>
      <label>Consequência ao completar<textarea data-clock-field="consequence" placeholder="O que acontece quando encher?">${escapeHtml(c.consequence)}</textarea></label>
      <div class="actionRow"><button data-clock-op="down">− 1</button><button data-clock-op="up" class="primary">＋ 1</button><button data-clock-op="reset">Zerar</button><button data-clock-op="delete" class="danger">Excluir</button></div>
      ${c.complete ? `<p class="gmClockComplete">⚠ Relógio completo. Aplique a consequência quando fizer sentido.</p>` : ""}
    </article>`).join("");
    box.querySelectorAll("[data-clock-field]").forEach(el => el.onchange = () => {
      const card = el.closest("[data-clock-card]"), clock = tools.clocks.find(c => c.id === card?.dataset.clockCard); if (!clock) return;
      if (el.dataset.clockField === "max") {
        clock.max = Math.max(1, Math.min(99, Math.floor(Number(el.value) || 1)));
        el.value = String(clock.max); clock.value = Math.min(clock.value, clock.max);
      } else clock[el.dataset.clockField] = el.value;
      clock.complete = clock.value >= clock.max; changed("Relógio atualizado");
    });
    box.querySelectorAll("[data-clock-op]").forEach(btn => btn.onclick = () => {
      const card = btn.closest("[data-clock-card]"), clock = tools.clocks.find(c => c.id === card?.dataset.clockCard); if (!clock) return;
      const wasComplete = clock.complete;
      if (btn.dataset.clockOp === "up") clock.value = Math.min(clock.max, clock.value + 1);
      else if (btn.dataset.clockOp === "down") clock.value = Math.max(0, clock.value - 1);
      else if (btn.dataset.clockOp === "reset") clock.value = 0;
      else if (btn.dataset.clockOp === "delete") {
        if (!confirm(`Excluir o relógio “${clock.title}”?`)) return;
        tools.clocks = tools.clocks.filter(c => c.id !== clock.id); changed("Relógio excluído"); return;
      }
      clock.complete = clock.value >= clock.max;
      if (!wasComplete && clock.complete) { safeLog(`Relógio completo: ${clock.title}`, "sala"); alert(`Relógio completo: ${clock.title}\n\n${clock.consequence || "O mestre decide a consequência."}`); }
      changed("Progresso do relógio atualizado");
    });
  }

  function drawInvestigation(tools) {
    const select = $("gmInvestigationCharacter"), box = $("gmInvestigationList");
    if (!select || !box) return;
    const old = select.value;
    select.innerHTML = (state.characters || []).map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    if (state.characters.some(c => c.id === old)) select.value = old;
    const roundActions = tools.investigationActions.filter(a => a.round === tools.investigationRound);
    box.innerHTML = state.characters.map(ch => {
      const entry = roundActions.find(a => a.characterId === ch.id);
      return `<article class="gmInvestigationRow"><div><b>${escapeHtml(ch.name)}</b><small>${entry ? `Fez: ${escapeHtml(entry.action)}` : "Ação pendente nesta rodada"}</small>${entry?.succeeded ? `<small class="gmSuccessLabel">✓ Sucesso</small>` : ""}${entry?.assistApplied ? `<small class="gmSuccessLabel">+2 aplicado: investigação facilitada</small>` : ""}${entry?.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}</div><span class="gmClueStatus ${entry ? "public" : "secret"}">${entry ? "Concluída" : "Pendente"}</span></article>`;
    }).join("") || `<p class="hint">Crie personagens para acompanhar as ações da investigação.</p>`;
    const history = tools.investigationActions.slice(-8).reverse();
    const histBox = $("gmInvestigationHistory");
    if (histBox) histBox.innerHTML = history.map(a => `<small>R${a.round} · ${escapeHtml(state.characters.find(c => c.id === a.characterId)?.name || "Personagem removido")}: ${escapeHtml(a.action)}${a.assistApplied ? " · +2 aplicado" : ""}</small>`).join("");
    const assistBox = $("gmInvestigationAssist");
    if (assistBox) {
      const recipients = tools.investigationAssist?.remaining?.map(id => state.characters.find(c => c.id === id)?.name).filter(Boolean) || [];
      assistBox.textContent = recipients.length ? `Facilitação ativa: +2 no próximo teste de procurar pistas de ${recipients.join(", ")}. Não acumula.` : "Nenhum bônus de facilitação pendente.";
    }
    if ($("gmInvestigationRound")) $("gmInvestigationRound").textContent = String(tools.investigationRound);
  }

  function drawReactions(tools) {
    const box = $("gmReactionList"); if (!box) return;
    const combatants = scene().tokens.filter(t => Number.isFinite(t.init)).sort((a, b) => b.init - a.init);
    if (!combatants.length) { box.innerHTML = `<p class="hint">Role a iniciativa na barra da mesa para listar os combatentes.</p>`; return; }
    box.innerHTML = combatants.map(t => {
      const used = tools.reactionUsed.includes(t.id);
      return `<div class="gmReactionRow"><span><b>${escapeHtml(t.name)}</b><small>Iniciativa ${Number(t.init)}</small></span><button data-reaction-token="${escapeHtml(t.id)}" class="${used ? "danger" : "primary"}">${used ? "Reação usada" : "Marcar reação"}</button></div>`;
    }).join("");
    box.querySelectorAll("[data-reaction-token]").forEach(btn => btn.onclick = () => {
      const id = btn.dataset.reactionToken;
      if (tools.reactionUsed.includes(id)) tools.reactionUsed = tools.reactionUsed.filter(x => x !== id);
      else tools.reactionUsed.push(id);
      changed("Reações da rodada atualizadas");
    });
  }

  function drawInterlude(tools) {
    const select = $("gmInterludeCharacter"), box = $("gmInterludeList");
    if (!select || !box) return;
    const prior = select.value;
    select.innerHTML = (state.characters || []).map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    if (state.characters.some(c => c.id === prior)) select.value = prior;
    box.innerHTML = state.characters.map(ch => {
      ch.interludeActions = Array.isArray(ch.interludeActions) ? ch.interludeActions : [];
      const actions = ch.interludeActions.slice(0, 2);
      return `<article class="gmInterludeCard"><div class="gmClueTitle"><b>${escapeHtml(ch.name)}</b><span class="gmClueStatus ${actions.length >= 2 ? "public" : "secret"}">${actions.length}/2 ações</span></div>
        ${actions.map((a,i) => `<div class="gmActionEntry"><span><b>${escapeHtml(a.action)}</b>${a.note ? `<small>${escapeHtml(a.note)}</small>` : ""}</span><button data-interlude-remove="${escapeHtml(ch.id)}" data-action-index="${i}" title="Remover ação">✕</button></div>`).join("") || `<small class="hint">Nenhuma ação registrada.</small>`}</article>`;
    }).join("") || `<p class="hint">Crie personagens para registrar ações de interlúdio.</p>`;
    box.querySelectorAll("[data-interlude-remove]").forEach(btn => btn.onclick = () => {
      const ch = state.characters.find(c => c.id === btn.dataset.interludeRemove); if (!ch) return;
      ch.interludeActions.splice(Number(btn.dataset.actionIndex), 1); changed("Ação de interlúdio removida");
    });
  }

  function drawMasterTools() {
    if (isPlayerView || !$("masterToolsPanel")) return;
    const tools = ensureTools(), u = tools.urgency;
    setIfIdle("gmSceneType", tools.sceneType); setIfIdle("gmSceneNotes", tools.sceneNotes);
    setIfIdle("gmUrgencyTitle", u.title); setIfIdle("gmUrgencyLimit", u.limit); setIfIdle("gmUrgencyConsequence", u.consequence);
    if ($("gmUrgencyPreset")) {
      const known = [2, 3, 4, 5, 6].includes(u.limit) ? String(u.limit) : "custom";
      if (document.activeElement !== $("gmUrgencyPreset")) $("gmUrgencyPreset").value = known;
    }
    if ($("gmUrgencyPublic")) $("gmUrgencyPublic").checked = !!u.public;
    if ($("gmUrgencyCount")) $("gmUrgencyCount").textContent = `${u.round} / ${u.limit}`;
    if ($("gmUrgencyProgress")) $("gmUrgencyProgress").style.width = `${Math.min(100, u.round / u.limit * 100)}%`;
    if ($("gmUrgencyState")) $("gmUrgencyState").textContent = u.complete ? "Tempo esgotado — aplique a consequência" : u.running ? "Contagem em andamento" : "Contador parado";
    if ($("gmInvestigationRound")) $("gmInvestigationRound").textContent = String(tools.investigationRound);
    if ($("gmReactionRound")) $("gmReactionRound").textContent = String(tools.reactionRound);
    drawClocks(tools); drawInvestigation(tools); drawReactions(tools); drawClues(tools); drawInterlude(tools);
  }

  function createPlayerHud() {
    if (!playerWindow || $("playerMasterHud")) return;
    const hud = document.createElement("aside"); hud.id = "playerMasterHud"; hud.className = "playerMasterHud hidden";
    hud.innerHTML = `<div class="playerMasterHead"><b>🔎 Investigação</b><button id="playerMasterToggle">▾</button></div><div id="playerMasterBody"></div>`;
    document.body.append(hud);
    $("playerMasterToggle").onclick = () => $("playerMasterBody").classList.toggle("hidden");
  }
  function drawPlayerHud(data = {}) {
    if (!playerWindow) return;
    createPlayerHud();
    const clues = Array.isArray(data.clues) ? data.clues : [], u = data.urgency || null;
    const hud = $("playerMasterHud"), body = $("playerMasterBody"); if (!hud || !body) return;
    if (!clues.length && !u) { hud.classList.add("hidden"); return; }
    hud.classList.remove("hidden");
    body.innerHTML = `${u?.public ? `<div class="playerUrgency"><b>${escapeHtml(u.title || "Investigação")}</b><strong>Rodada ${Number(u.round)||0}/${Number(u.limit)||0}</strong></div>` : ""}${clues.map(c => `<article class="playerClue"><b>${escapeHtml(c.title)}</b>${c.type ? `<small>${c.type === "principal" ? "Pista principal" : "Pista complementar"}</small>` : ""}${c.test ? `<small>${escapeHtml(c.test)}${c.dt !== "" && c.dt != null ? ` · DT ${escapeHtml(c.dt)}` : ""}</small>` : ""}<p>${escapeHtml(c.description || "")}</p></article>`).join("")}`;
  }

  if (isPlayerView) {
    $("masterToolsToggle")?.classList.add("hidden");
    if (playerWindow) {
      createPlayerHud();
      addEventListener("message", event => { if (event.data?.zero) drawPlayerHud({ clues: event.data.clues, urgency: event.data.urgency }); });
    }
  } else {
    const panel = $("masterToolsPanel"), toggle = $("masterToolsToggle");
    toggle?.addEventListener("click", () => { panel.classList.toggle("hidden"); drawMasterTools(); });
    $("masterToolsClose")?.addEventListener("click", () => panel.classList.add("hidden"));
    document.querySelectorAll("[data-gm-tab]").forEach(b => b.addEventListener("click", () => setPane(b.dataset.gmTab)));

    $("gmSceneType").onchange = e => { ensureTools().sceneType = e.target.value; changed("Tipo de cena atualizado"); };
    $("gmSceneNotes").onchange = e => { ensureTools().sceneNotes = e.target.value.slice(0, 5000); changed("Anotações da cena atualizadas"); };

    $("gmUrgencyTitle").onchange = e => { ensureTools().urgency.title = e.target.value; changed("Investigação renomeada"); };
    $("gmUrgencyPreset").onchange = e => {
      if (e.target.value !== "custom") { $("gmUrgencyLimit").value = e.target.value; ensureTools().urgency.limit = Number(e.target.value); }
      else { $("gmUrgencyLimit").focus(); }
      changed("Urgência da investigação ajustada");
    };
    $("gmUrgencyLimit").onchange = e => { const u = ensureTools().urgency; u.limit = Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 4))); u.round = Math.min(u.round, u.limit); u.complete = u.round >= u.limit; e.target.value = String(u.limit); changed("Limite de investigação ajustado"); };
    $("gmUrgencyConsequence").onchange = e => { ensureTools().urgency.consequence = e.target.value; changed("Consequência da investigação atualizada"); };
    $("gmUrgencyPublic").onchange = e => { ensureTools().urgency.public = e.target.checked; changed("Visibilidade do contador atualizada"); };
    $("gmUrgencyStart").onclick = () => { const u = ensureTools().urgency; u.round = 0; u.running = true; u.complete = false; changed("Contagem de urgência iniciada"); };
    $("gmUrgencyNext").onclick = () => {
      const u = ensureTools().urgency;
      if (u.complete) return status("A urgência já terminou. Reinicie para uma nova contagem.");
      u.running = true; u.round = Math.min(u.limit, u.round + 1);
      if (u.round >= u.limit) { u.complete = true; u.running = false; safeLog(`Urgência esgotada: ${u.title}`, "sala"); alert(`A urgência terminou!\n\nConsequência prevista:\n${u.consequence || "O mestre decide o que acontece."}`); }
      changed("Rodada da investigação avançada");
    };
    $("gmUrgencyReset").onclick = () => { const u = ensureTools().urgency; u.round = 0; u.running = false; u.complete = false; changed("Contador de investigação zerado"); };

    $("gmClockAdd").onclick = () => {
      const title = $("gmClockNewTitle").value.trim();
      if (!title) return alert("Dê um nome ao relógio.");
      const max = Math.max(1, Math.min(99, Math.floor(Number($("gmClockNewMax").value) || 6)));
      ensureTools().clocks.push({ id: uid(), title, value: 0, max, consequence: "", complete: false });
      $("gmClockNewTitle").value = ""; $("gmClockNewMax").value = "6"; changed("Relógio criado");
    };

    $("gmInvestigationAdd").onclick = () => {
      const tools = ensureTools(), characterId = $("gmInvestigationCharacter").value;
      const ch = state.characters.find(c => c.id === characterId);
      if (!ch) return alert("Crie ou selecione um personagem primeiro.");
      if (tools.investigationActions.some(a => a.round === tools.investigationRound && a.characterId === characterId)) return alert(`${ch.name} já realizou uma ação nesta rodada de investigação.`);
      const action = $("gmInvestigationAction").value, note = $("gmInvestigationNote").value.trim();
      const succeeded = $("gmInvestigationSuccess").checked;
      const entry = { id: uid(), round: tools.investigationRound, characterId, action, note, succeeded, assistApplied: false, at: Date.now() };
      if (action === "Procurar pistas" && tools.investigationAssist?.remaining?.includes(characterId)) {
        entry.assistApplied = true;
        tools.investigationAssist.remaining = tools.investigationAssist.remaining.filter(id => id !== characterId);
        if (!tools.investigationAssist.remaining.length) tools.investigationAssist = null;
      }
      if (action === "Facilitar a investigação" && succeeded) {
        const remaining = state.characters.filter(c => c.id !== characterId).map(c => c.id);
        if (remaining.length && !tools.investigationAssist?.remaining?.length) tools.investigationAssist = { from: characterId, remaining, createdAt: Date.now() };
        else if (tools.investigationAssist?.remaining?.length) status("Já existe uma facilitação ativa; o bônus não acumula.");
      }
      tools.investigationActions.push(entry);
      $("gmInvestigationNote").value = ""; $("gmInvestigationSuccess").checked = false;
      safeLog(`${ch.name}: investigação — ${action}${succeeded ? " (sucesso)" : ""}`, "sala"); changed("Ação de investigação registrada");
    };
    $("gmInvestigationNext").onclick = () => { const t = ensureTools(); t.investigationRound = Math.min(9999, t.investigationRound + 1); changed("Nova rodada de investigação"); };
    $("gmInvestigationReset").onclick = () => {
      if (!confirm("Limpar o registro e voltar à rodada 1 da investigação?")) return;
      const t = ensureTools(); t.investigationRound = 1; t.investigationActions = []; t.investigationAssist = null; changed("Investigação reiniciada");
    };

    $("gmReactionReset").onclick = () => { const t = ensureTools(); t.reactionRound = Math.max(1, Number(scene().turn?.round) || 1); t.reactionUsed = []; changed("Reações da rodada liberadas"); };

    $("gmClueAdd").onclick = () => {
      const title = $("gmClueTitle").value.trim(), description = $("gmClueDescription").value.trim();
      if (!title || !description) return alert("Preencha o nome e a descrição da pista.");
      const type = $("gmClueType").value;
      const main = type === "principal";
      ensureTools().clues.push({ id: uid(), title, description, type, test: $("gmClueTest").value.trim(), dt: $("gmClueDT").value === "" ? "" : Number($("gmClueDT").value), public: main, knownTo: [] });
      $("gmClueTitle").value = ""; $("gmClueDescription").value = ""; $("gmClueTest").value = ""; $("gmClueDT").value = "";
      safeLog(`Pista ${main ? "principal compartilhada" : "complementar criada em segredo"}: ${title}`, "sala"); changed(main ? "Pista principal compartilhada com todos" : "Pista complementar secreta criada");
    };

    $("gmInterludeAdd").onclick = () => {
      const ch = state.characters.find(c => c.id === $("gmInterludeCharacter").value);
      if (!ch) return alert("Crie ou selecione um personagem primeiro.");
      ch.interludeActions = Array.isArray(ch.interludeActions) ? ch.interludeActions : [];
      if (ch.interludeActions.length >= 2) return alert(`${ch.name} já usou as duas ações de interlúdio.`);
      const action = $("gmInterludeAction").value, note = $("gmInterludeNote").value.trim();
      if (ch.interludeActions.some(a => a.action === action)) return alert(`${ch.name} já usou “${action}” neste interlúdio. As duas ações precisam ser diferentes.`);
      ch.interludeActions.push({ action, note, at: Date.now() }); $("gmInterludeNote").value = "";
      safeLog(`${ch.name}: interlúdio — ${action}`, "sala"); changed("Ação de interlúdio registrada");
    };
    $("gmInterludeReset").onclick = () => {
      if (!confirm("Reiniciar as ações de interlúdio de todos os personagens?")) return;
      state.characters.forEach(c => c.interludeActions = []); changed("Ações de interlúdio reiniciadas");
    };

    // Atualiza o controle de reação imediatamente quando a rodada de combate avança.
    const originalNextTurn = nextTurn;
    nextTurn = function() {
      const before = Math.max(1, Number(scene().turn?.round) || 1);
      originalNextTurn();
      const after = Math.max(1, Number(scene().turn?.round) || 1);
      const t = ensureTools();
      if (after !== before || t.reactionRound !== after) {
        t.reactionRound = after;
        t.reactionUsed = [];
        changed("Nova rodada: reações liberadas");
      } else drawMasterTools();
    };
    $("initNext").onclick = nextTurn;
    $("initRollAll")?.addEventListener("click", () => {
      const t = ensureTools(); t.reactionRound = Math.max(1, Number(scene().turn?.round) || 1); t.reactionUsed = [];
      changed("Nova iniciativa: reações liberadas");
    });
    $("initClear")?.addEventListener("click", () => {
      const t = ensureTools(); t.reactionRound = 1; t.reactionUsed = [];
      changed("Combate encerrado: reações limpas");
    });

    setPane(activePane); drawMasterTools();

    // Segredo privado por criatura: nunca faz parte dos dados enviados ao player.
    const oldInspector = renderInspector;
    renderInspector = function() {
      oldInspector();
      const token = selectedToken?.(); if (!token?.creatureId) return;
      const creature = state.bestiary.find(c => c.id === token.creatureId); if (!creature) return;
      creature.gmEnigma = creature.gmEnigma || { title: "", solution: "", effect: "", resolved: false };
      const e = creature.gmEnigma, panel = document.createElement("div"); panel.className = "atkBox gmEnigmaBox";
      panel.innerHTML = `<div class="controlTitle">🧩 ENIGMA DO MEDO / SEGREDO DA CRIATURA</div><p class="hint">Anotação privada do mestre. Não aparece na ficha do jogador.</p><label>Nome do enigma<input id="gmEnigmaTitle" placeholder="Ex.: o sino precisa ser silenciado"></label><label>Como resolver?<textarea id="gmEnigmaSolution" placeholder="Condição ou pista necessária..."></textarea></label><label>Efeito ao resolver<textarea id="gmEnigmaEffect" placeholder="Ex.: a criatura perde sua proteção especial..."></textarea></label><label class="checkLabel"><input id="gmEnigmaResolved" type="checkbox" ${e.resolved ? "checked" : ""}> Enigma resolvido</label>`;
      $("inspectorContent").append(panel);
      $("gmEnigmaTitle").value = e.title || ""; $("gmEnigmaSolution").value = e.solution || ""; $("gmEnigmaEffect").value = e.effect || "";
      $("gmEnigmaTitle").onchange = ev => { e.title = ev.target.value; markDirty("Enigma atualizado"); };
      $("gmEnigmaSolution").onchange = ev => { e.solution = ev.target.value; markDirty("Enigma atualizado"); };
      $("gmEnigmaEffect").onchange = ev => { e.effect = ev.target.value; markDirty("Efeito do enigma atualizado"); };
      $("gmEnigmaResolved").onchange = ev => { e.resolved = ev.target.checked; safeLog(`${creature.name}: enigma ${e.resolved ? "resolvido" : "reaberto"}`, "sala"); markDirty("Estado do enigma atualizado"); };
    };
  }

  const oldRender = render;
  render = function() { oldRender(); if (!isPlayerView) drawMasterTools(); };
})();
