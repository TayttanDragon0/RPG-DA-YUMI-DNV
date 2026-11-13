# ESPAÇO ZERO — V21 (tocha, luz e bolsa)

## O que mudou
- **Tocha nova:** arte própria de tocha (cabo de madeira com veios, anéis de ferro, trapo com piche e chama animada em camadas, com faíscas e brilho). Substitui a arte antiga. Campanhas antigas recebem a arte nova automaticamente, inclusive as tochas já colocadas na mesa.
- **Tocha solta no mapa ilumina:** qualquer objeto da mesa pode emitir luz. A tocha da biblioteca já vem com raio de 440 px (~14 quadrados). A luz abre a névoa (respeitando as paredes pintadas) e desenha um brilho quente com leve tremulação. No Inspetor de qualquer objeto há **Raio de luz** e **Acesa** (0 = sem luz).
- **Correção da névoa:** o `zero.js` sobrescrevia o desenho da névoa e ignorava a luz das tochas e as áreas exploradas; agora ambas abrem a névoa de verdade.
- **Qualquer objeto vai para a bolsa do jogador:**
  - botão **🎒** em cada objeto da aba Objetos da biblioteca;
  - no Inspetor de um objeto colocado na mesa: **Dar uma cópia** ou **Pegar do mapa** (move o objeto para a bolsa);
  - janela 🎁: **Dar objeto da biblioteca**, **Bolsas dos jogadores** (vê e remove o que cada um carrega) e o inventário do mestre, agora com escolha de personagem por botões (sem digitar ID).
- **Bolsa do jogador:** corrigido o bug em que a imagem do item vazava da caixa e cobria os botões.
- **Reset direção:** o botão chamava uma função inexistente (`renderScene`); corrigido.

---

# ESPAÇO ZERO — V20 (experiência do jogador expandida)

## O que foi ampliado nesta revisão
- **Feed de atividade:** o jogador recebe os acontecimentos públicos recentes da sessão e atualizações ao vivo. Registros privados do bestiário e detalhes de entrega de itens não são transmitidos indiscriminadamente; criaturas ocultas não geram avisos ao desaparecer.
- **Morte de criaturas:** o mestre envia um estado explícito de derrotado mesmo quando os pontos de vida ficam ocultos; o token do jogador muda visualmente e a derrota aparece no feed.
- **Movimento remoto com caminhada:** arrastos do mestre são capturados em fase de captura e enviados em pacotes curtos. O jogador interpola posições sem reiniciar a transição em cada pacote, aplica balanço visual de caminhada e mantém a referência do token para reduzir consultas por frame.
- **Ficha pública de criaturas:** clique em criaturas abre apenas as etapas do bestiário já reveladas para aquele personagem. Criaturas ainda não investigadas mostram um cartão sem atributos secretos.
- **Bolsa e inventário:** a bolsa do personagem é apresentada em aba própria; entregas, equipamentos e alterações são recebidos no estado do personagem.
- **Dados para todos:** rolagens feitas pelo mestre ou pelo jogador são retransmitidas aos clientes com resultado e animação.
- **Névoa otimizada:** a chave de cache deixou de serializar as listas completas de operações e exploração a cada render; usa referências, contagens e revisão explícita, recalculando somente quando os dados relevantes mudam.

## Validação realizada
- Teste de navegador Chromium com conexão simulada: painel do jogador, cinco abas, bolsa com tocha, abertura da ficha do Mimido e exibição apenas das informações liberadas, pedido de rolagem, animação do dado, interpolação de movimento remoto, estado de criatura derrotada e feed de eventos — aprovado, sem erros JavaScript no console.
- Teste de navegador Chromium do lado do mestre com conexão simulada: abertura da sala, envio de estado, preservação do ID da criatura sem expor PVs ocultos, entrega da tocha ao personagem, equipar na mão esquerda, transmissão de arrasto de criatura, retransmissão da rolagem do mestre e envio do estado de derrota — aprovado, sem erros JavaScript no console.
- Os arquivos JavaScript também passaram por `node --check`; o CSS e o HTML foram analisados estruturalmente.

**Limitação restante:** esses testes simulam o canal de conexão dentro do navegador. Uma sessão PeerJS/WebRTC real com mestre e pelo menos dois dispositivos ainda precisa ser validada com internet e a campanha publicada.

---

# ESPAÇO ZERO — V19 (player, movimento, névoa e equipamentos)

## Alterações desta revisão
- **Mesa do jogador bloqueada:** clique em áreas vazias, fundo, grade ou tokens alheios não inicia arrasto; ferramentas de pan/zoom e gestos de zoom ficam desativados no modo jogador. Somente o token vinculado ao jogador pode ser movido.
- **Movimento ao vivo mais fluido:** o jogador envia atualizações pequenas em intervalos curtos; o mestre aplica transições curtas e os demais jogadores interpolam a posição recebida. A orientação acompanha o vetor horizontal/vertical do deslocamento.
- **Orientação gradual:** o sprite usa transição 3D suave nos eixos X/Y, sem rotação Z do corpo inteiro.
- **Tocha equipável:** a tocha embutida possui arte SVG, animação de chama, posicionamento na mão direita/esquerda e raio de luz. O mestre pode entregá-la diretamente ao personagem pela janela Itens.
- **Iluminação com paredes:** a luz da tocha e a visão do personagem são recortadas pelas paredes pintadas na cena.
- **Névoa persistente por personagem:** a visão atual acompanha o personagem; áreas exploradas são guardadas individualmente para cada personagem e enviadas em pequenos pacotes, sem compartilhar automaticamente a exploração de um jogador com os demais.
- **Otimização:** a geometria de visão é armazenada em cache por posição/raio/revisão das paredes; a camada de névoa não é reconstruída quando os dados relevantes não mudam.

## Teste recomendado
1. Abra a campanha como mestre e ative a névoa na cena.
2. Abra a Sala e entre com dois navegadores/dispositivos usando personagens diferentes.
3. Tente clicar e arrastar áreas vazias, cenário e personagens alheios: nada deve mover a mesa.
4. Mova cada personagem e confira a posição e a orientação nos outros clientes.
5. Pinte uma parede entre o personagem e uma área e confira se a visão e a luz da tocha param nela.
6. No mestre, abra **Itens**, selecione um personagem na linha da Tocha e clique em **Dar ao jogador**. No jogador, equipe a tocha em **Mão D** ou **Mão E**.
7. Caminhe com a tocha e confira a iluminação, a névoa e a persistência das áreas exploradas.

**Limitação de validação desta entrega:** os arquivos JavaScript passaram pela verificação de sintaxe e o pacote foi validado. A sessão com dois ou mais clientes conectados ainda precisa ser testada no navegador real, com a campanha publicada e a conexão PeerJS disponível.

---

# ESPAÇO ZERO — V18 (revisão do jogador e sincronização ao vivo)

## Revisão desta entrega
- A tela do jogador não permite arrastar, selecionar, redimensionar ou deslocar o cenário. Somente o token do próprio jogador recebe comandos de movimento.
- A sala online transmite movimento por pacotes pequenos e frequentes, sem reenviar a cena inteira a cada passo. Mudanças estruturais continuam sendo sincronizadas como estado completo.
- O jogador atualiza a posição dos tokens no próprio DOM e recalcula a névoa em intervalos curtos, evitando reconstruir toda a mesa a cada pacote de movimento.
- A visão online revela a névoa a partir do personagem daquele jogador, respeitando as paredes da cena. A textura do nevoeiro no cliente online é mais leve para reduzir custo de renderização.
- Os sprites agora fazem uma virada lateral suave no eixo Y quando o personagem se desloca horizontalmente, em vez de girar o corpo inteiro no plano.
- A Tocha tem ilustração SVG própria e já aparece na biblioteca de itens do mestre; o mestre pode selecionar um personagem e usar **Dar ao jogador** para colocá-la na bolsa dele.

## Multiplayer
A sala usa PeerJS/WebRTC para comunicação em tempo real entre mestre e jogadores. O mestre precisa manter a aba da campanha aberta e todos precisam de conexão com a internet. O serviço PeerJS é usado para sinalização/conexão; os movimentos são enviados como atualizações leves entre os clientes.

---

# ESPAÇO ZERO (V11)
- **🧱 Pincel de paredes** (barra no rodapé do mapa): pinte sobre o PNG o que é parede (ou apague). Os personagens só liberam a névoa até onde a visão chega sem atravessar parede. Fica salvo por cena e vale também na janela do jogador e na sala.
- **📖 Bestiário descoberto:** selecione uma criatura no mapa > Inspetor > Revelar. Ordem: Aparência, Comportamento, Onde vive, Poderes, Necessidades, Utilidades, Curiosidade. O jogador vê só o liberado.
- **🎁 Itens:** importe PNGs (reduzidos a 256 px), marque consumível, entregue a um personagem. O jogador equipa na mão direita ou esquerda (o item fica grudado no token), guarda, usa ou descarta. Tudo aparece no 📜 Console.

# ESPAÇO ZERO (V10)
- **Condições nos tokens** (Inspetor > CONDIÇÕES): envenenado, controlado por Mimidos, corrompido, sangrando, imitado, atordoado, em chamas e invisível (some da tela dos jogadores). Ícone e brilho no token; no jogador, a própria condição também afeta a tela toda.
- **📜 Console da sessão** (só mestre): horário de dados, vida, condições, movimento (agrupado em quadrados) e entradas na sala. Tem filtro e fica salvo na campanha.

# ESPAÇO ZERO — Mesa (V9)

## V9 — melhorias de experiência e estabilidade
- Fichas de personagens e criaturas organizadas em seções recolhíveis.
- Bestiário com pesquisa por nome, categoria e conteúdo descritivo, filtro por grupo e resumo de atributos.
- Biblioteca utilizável em celular: abra pelo botão Biblioteca e toque em um item para colocá-lo no centro da mesa.
- Inspetor acessível em celular pelo botão Inspetor; barras e ferramentas da mesa rolam horizontalmente.
- Multiplayer com limite de conexões, limite de mensagens por segundo, tamanho máximo de mensagem e validação de movimento recebido.

## Sala online (GitHub Pages, sem servidor)
1. Suba esta pasta inteira num repositório e ative o GitHub Pages (Settings > Pages).
2. Abra o link, carregue sua campanha e clique em **🌐 Abrir sala**. Copie o link e mande aos jogadores (o link é fixo para cada campanha).
3. O jogador abre o link, escolhe o personagem e vê: mesa com névoa opaca, a própria ficha (vida, cansaço, inventário, anotações), dados compartilhados e a vida das criaturas que você liberar. Ele move só o próprio token.
4. No Inspetor de cada token: **Ocultar dos jogadores** e **Mostrar vida aos jogadores**.
Mantenha a aba do mestre aberta durante o jogo. Usa PeerJS (carregado por CDN) e o serviço público dele só para conectar. O multiplayer exige internet; a mesa offline continua disponível sem conexão.

- **Salvar direto no PC:** em Chrome/Edge, o 1º clique em Salvar escolhe o arquivo; depois ele é regravado sozinho a cada alteração. Também há backup automático no navegador e restauração ao abrir.
- **Ctrl+Z / Ctrl+Y** (ou ↶ ↷) desfazem e refazem.
- **Janela do jogador (sem servidor):** botão 🖥 abre a mesa em outra janela, sincronizada, sem painéis, fichas ou vida, com névoa opaca. Compartilhe essa janela no Discord e mantenha a do mestre aberta.
- **Névoa estilizada** animada; personagens liberam um raio de visão (configurável em Névoa de guerra).
- **Ataque:** selecione um token, escolha o alvo e o dano base. Dano = dado + Força − Defesas (mín. 0).
- HUD cósmico com barras de vida consumidas pela corrupção.

# RPG Mesa Offline V7

## Novidades da V7
- **Correção:** token que só andava de lado. Redimensionar pelos cantos gerava posição inválida (NaN). Corrigido, e campanhas já salvas com esse defeito são consertadas ao abrir.
- Arrasto mais robusto (não perde o gesto se a mesa for redesenhada) e aviso quando o objeto está travado.
- 📖 **Bestiário** (aba na Biblioteca) com a ficha base do documento "Criaturas do espaço zero": características físicas, comportamento, onde vivem, poderes, necessidades, utilidades, curiosidade, Vida, Cansaço, Defesas, Força, Velocidade, Inteligência e Porte. Já vem com Mimidos, Monstro da Corrupção (Irracional) e Calanguitos.
- Cada criatura na mesa tem **vida e cansaço próprios** (barra no token e botões no Inspetor). Zerou a vida, o token escurece.
- Ficha de personagem com **Vida/Cansaço atuais e máximos**.
- ⚔ **Iniciativa e turnos**: d20 + Velocidade, ordem, rodada e destaque do token da vez.
- Esc fecha as fichas mesmo com o cursor num campo.

## V6

- 🔍 Teste de perícia OP: 1d20 por ponto de atributo, fica com o maior; atributo 0 rola 2d20 e fica com o menor. Soma treino (+5/+10/+15) e bônus, compara com a DT e avisa 20 e 1 naturais.
- Calculadora de dados: digite fórmulas como `2d6+3` ou `1d8+2d4-1`.
- 🌫️ Névoa de guerra por cena: Revelar/Cobrir áreas arrastando, Revelar tudo, Cobrir tudo. Modo jogador deixa a névoa opaca para compartilhar a tela.
- Tokens redondos com aro colorido (agentes, criaturas, NPCs).

## V5

- Movimento livre dos tokens em qualquer direção, com limites da mesa (não se perdem mais fora da área).
- Setas do teclado movem o token/cenário selecionado (8 px; com Shift, 1 quadrado).
- 🧲 Ímã: encaixa na grade ao arrastar (tecla G). Segurar Shift ao arrastar encaixa temporariamente.
- Campos X/Y no Inspetor para posição exata.
- Espelhar (F) e girar 15° (Q/R) o sprite.
- Vida do personagem aparece no token, com botões de vida rápida (−10, −1, +1, +10).
- 📏 Régua (tecla M): mede em quadrados e metros (1 quadrado = 1,5 m).
- 🎲 Rolador de dados d4–d100, com quantidade, bônus e histórico.
- Ctrl+D agora duplica de verdade (estava só na lista de atalhos).
- Esc limpa a régua; barra da mesa reorganizada.


## Melhorias desta versão

### Navegação da mesa
- Arrastar o espaço vazio com o botão esquerdo move a câmera.
- Segurar `Espaço` e arrastar move a câmera mesmo por cima de imagens.
- Botão do meio ou direito do mouse também move a câmera.
- Botão `✋ Mover tela` ativa a ferramenta de mão.
- Scroll dá zoom apontado para o cursor.
- Botão Centralizar reenquadra o cenário/objetos.

### Personagens
- Sprite obrigatório ao criar personagem.
- Prévia do sprite na ficha.
- Ao salvar uma ficha nova, o token é criado automaticamente na cena atual.
- Personagens existentes continuam conectados à ficha.
- Duplo clique no token abre a ficha.

### Música
- Importar MP3/WAV/OGG/M4A.
- Playlist com seleção e remoção de faixas.
- Player com play/pause, progresso e controles nativos.
- Loop ligado/desligado.
- Volume e anterior/próxima.
- Os áudios ficam incorporados no arquivo da campanha.

### Melhorias extras
- Redimensionar tokens pelos cantos.
- Travar/destravar objetos.
- Duplicar objetos.
- Trazer para frente / enviar para trás.
- Renomear e excluir cenas.
- Tutorial inicial reabrível pelo botão Ajuda.
- Aviso ao fechar com alterações não salvas.
- Compatibilidade de leitura com arquivos de campanhas anteriores.

## Como abrir
Mantenha `index.html`, `style.css` e `app.js` juntos. Abra `index.html` em um navegador atualizado.

## Salvar
Use `💾 Salvar arquivo`. Tudo fica dentro do arquivo `.rpg.json`, incluindo imagens e faixas de áudio.

## Compartilhar com os jogadores
Compartilhe a tela pelo Discord, Meet ou outra ferramenta. A aplicação funciona offline e não sincroniza os jogadores por rede.


## V15 — Sistema de ficha ampliado
- Atributos-base: Força, Velocidade/Agilidade, Inteligência, Porte/Presença, Vigor, Sorte e Foco.
- Proficiências continuam separadas dos atributos, conforme o documento do sistema.
- Focos de poder ficam como progressão/especialização própria (físico, distância ou mágico), em vez de serem confundidos com atributo.
- O modelo foi inspirado em boas ideias de fichas de RPG investigativo, mas mantém o sistema próprio do Espaço Zero.


# ESPAÇO ZERO V17 — correções e ferramentas do mestre

## Correções de ficha
- Proficiências são presets fixos, com valores em múltiplos de 3 e orçamento de 21 no nível 1. Cada nível de personagem acima do primeiro acrescenta 6 pontos, conforme o documento do sistema.
- A seleção de proficiência agora verifica o orçamento antes de aplicar a mudança; ao exceder, mantém o valor anterior em vez de zerar a proficiência alterada.
- Magias usam espaços individuais. O documento lista custos de Cansaço em múltiplos de 3 e espaços +2/+4/+6/+8/+10/+14; a ficha relaciona os valores pela proporção 2 espaços a cada 3 de Cansaço. Assim, magias com custo 12 ocupam 8 espaços, por exemplo.
- Foco mágico começa com 10 espaços e recebe +3 por nível do foco. Focos físico e à distância ficam identificados separadamente.
- O player pode definir diretamente o Cansaço atual, além de usar os botões de gasto/recuperação. Personagem novo começa com a barra cheia; campanhas antigas sem valor atual de Cansaço são migradas para cheia.
- A ficha compartilhada agora exibe atributos, proficiências e magias em formato legível, em vez do JSON bruto.

## Ferramentas do mestre
- **Controle de cena:** classifique a cena como Investigação, Ação/Combate, Interação ou Interlúdio e mantenha anotações privadas por cena.
- **Ações de investigação:** registre uma ação por personagem em cada rodada (buscar pistas, ajudar, facilitar a investigação, usar habilidade/item ou outra abordagem). O histórico recente fica visível para o mestre.
- **Urgência:** contador de rodadas com limite configurável, presets rápidos e consequência privada. O mestre escolhe se o progresso aparece na janela dos jogadores.
- **Relógios múltiplos:** crie marcadores independentes para ritual, perseguição, alarme, corrupção, chegada de reforços ou outros eventos; cada relógio tem limite e consequência próprios.
- **Quadro de pistas:** diferencie pistas principais e complementares, associe perícia/abordagem e DT, e revele cada pista para um personagem ou para todos. O jogador recebe apenas pistas liberadas para ele.
- **Reações de combate:** marcador opcional por combatente com iniciativa. Ao passar para uma nova rodada de combate, as reações são liberadas automaticamente; também há reinício manual.
- **Interlúdio:** registre até duas ações diferentes por personagem e remova uma ação caso precise corrigir o registro.
- **Enigma/segredo da criatura:** anotações privadas do mestre no Inspetor, com solução, efeito e estado de resolução.
- **Privacidade:** notas da cena, consequências, relógios e soluções de enigmas não são enviados aos jogadores. A janela espelhada recebe só pistas públicas e contador de urgência explicitamente liberado.

## Referência de design
- O conjunto é opcional e adaptado à mesa Espaço Zero. As ideias de cenas, investigação rodada a rodada, urgência, pistas principais/complementares, ações de interlúdio e reações foram pesquisadas a partir das regras públicas de Ordem Paranormal RPG; não é uma reprodução do sistema oficial de Calamidade.
- O documento de Espaço Zero não associa explicitamente cada espaço +2/+4/+6/+8/+10/+14 a uma magia por nome. A ficha relaciona esses espaços aos custos de Cansaço por proporção (2 espaços a cada 3 de Cansaço: 3→2, 6→4, 9→6, 12→8, 15→10, 21→14). Isso é uma interpretação prática, indicada na ficha para a mesa poder ajustar se usar outra regra.
