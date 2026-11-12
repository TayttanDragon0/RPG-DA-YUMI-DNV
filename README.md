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
