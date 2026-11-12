// Criaturas iniciais, baseadas no documento "Criaturas do espaço zero".
const BESTIARIO_ARTES = {"mimido": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><g fill=\"#15151c\"><ellipse cx=\"50\" cy=\"58\" rx=\"35\" ry=\"27\"/><ellipse cx=\"22\" cy=\"84\" rx=\"7\" ry=\"6\"/><ellipse cx=\"38\" cy=\"86\" rx=\"7\" ry=\"6\"/><ellipse cx=\"50\" cy=\"87\" rx=\"7\" ry=\"6\"/><ellipse cx=\"62\" cy=\"86\" rx=\"7\" ry=\"6\"/><ellipse cx=\"78\" cy=\"84\" rx=\"7\" ry=\"6\"/><ellipse cx=\"86\" cy=\"62\" rx=\"7\" ry=\"5\"/></g><circle cx=\"36\" cy=\"52\" r=\"11\" fill=\"#e9ecf5\"/><circle cx=\"64\" cy=\"52\" r=\"11\" fill=\"#e9ecf5\"/><circle cx=\"37\" cy=\"53\" r=\"7\" fill=\"#050507\"/><circle cx=\"63\" cy=\"53\" r=\"7\" fill=\"#050507\"/><circle cx=\"39\" cy=\"50\" r=\"2\" fill=\"#fff\"/><circle cx=\"65\" cy=\"50\" r=\"2\" fill=\"#fff\"/><path d=\"M45 66 L55 66 L50 74Z\" fill=\"#3b3b4d\"/></svg>", "monstro": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><path d=\"M50 6 58 24 76 14 74 34 94 38 80 52 92 70 72 70 74 90 56 78 50 96 44 78 26 90 28 70 8 70 20 52 6 38 26 34 24 14 42 24Z\" fill=\"#0d0d12\" stroke=\"#2a1d26\" stroke-width=\"2\"/><ellipse cx=\"38\" cy=\"46\" rx=\"7\" ry=\"5\" fill=\"#ff3b52\"/><ellipse cx=\"62\" cy=\"46\" rx=\"7\" ry=\"5\" fill=\"#ff3b52\"/><path d=\"M36 64 44 60 50 66 56 60 64 64 56 72 44 72Z\" fill=\"#3a0f18\"/></svg>", "calanguito": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><path d=\"M70 66 C92 70 96 88 78 92\" stroke=\"#16161d\" stroke-width=\"9\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M78 92\" stroke=\"#8a5cff\" stroke-width=\"5\"/><g fill=\"#16161d\"><ellipse cx=\"50\" cy=\"60\" rx=\"26\" ry=\"20\"/><ellipse cx=\"20\" cy=\"50\" rx=\"9\" ry=\"6\"/><ellipse cx=\"22\" cy=\"78\" rx=\"9\" ry=\"6\"/><ellipse cx=\"80\" cy=\"48\" rx=\"8\" ry=\"6\"/><circle cx=\"50\" cy=\"34\" r=\"17\"/></g><g fill=\"#8a5cff\"><ellipse cx=\"14\" cy=\"50\" rx=\"4\" ry=\"3\"/><ellipse cx=\"16\" cy=\"78\" rx=\"4\" ry=\"3\"/><ellipse cx=\"88\" cy=\"48\" rx=\"3\" ry=\"3\"/><ellipse cx=\"50\" cy=\"62\" rx=\"12\" ry=\"9\" opacity=\".85\"/></g><circle cx=\"42\" cy=\"31\" r=\"7\" fill=\"#e9ecf5\"/><circle cx=\"58\" cy=\"31\" r=\"7\" fill=\"#e9ecf5\"/><circle cx=\"42\" cy=\"32\" r=\"4.5\" fill=\"#050507\"/><circle cx=\"58\" cy=\"32\" r=\"4.5\" fill=\"#050507\"/></svg>"};
const svgUri = svg => "data:image/svg+xml;utf8," + encodeURIComponent(svg);
const BESTIARIO_BASE = [
 {
  "id": "bestiario-mimidos",
  "name": "Mimidos",
  "category": "Criaturas do Espaço Zero",
  "color": "#6b6f8f",
  "art": "mimido",
  "fisicas": "Pequenas criaturas de pelagem preta, 6 pernas curtas e rechonchudas como o corpo, olhos grandes com pupilas negras, bocas com o formato de bicos e uma pequena calda. Podem ser carregados em bolsos e potes por seu corpo ser maleável.",
  "comportamento": "Assustados, dóceis, “carentes” e barulhentos quando ameaçados. Não possuem um jeito de se defender, apenas fazendo barulhos de “Mi” com a esperança de sobreviver, podem chorar facilmente.",
  "onde": "Geralmente vivem em qualquer universo em que sua existência não influencie na história ou equilíbrio do próprio universo, podendo ser realocados caso não possam ficar lá.",
  "poderes": "Os mimidos são como parasitas, entrando no corpo de criaturas mortas para poder sobreviver, não entram em corpos grandes, apenas de criaturas duas vezes maior que seus próprios corpos, mas quando em grupo, podem entrar em seres-humanos e controlá-los, dependendo da quantidade, podem até se disfarçar como tais. Também podem colocar o corpo do hospedeiro de volta a vida, dependendo apenas da sua causa de morte, já que eles podem tomar o lugar de alguns de seus órgãos quando necessário (para impedir que o hospedeiro tenha controle do próprio corpo novamente eles comem seus cérebros, no caso dos humanos muitas vezes eles só comem metade ou nem fazem nada, isso em casos mais raros). Além disso, também podem fazer os seres humanos sentirem pena deles por causa de sua aparência que se assemelha a de filhotinhos e uma essência que exalam (nenhum dos dois é muito efetivo, mas ainda funcionam em humanos e saltadores).",
  "necessidades": "Por serem criaturas de sangue frio os mimidos não conseguem criar seu próprio calor, por isso entram em hospedeiros que morreram recentemente, também podem buscar abrigo no colo de outras criaturas vivas, por causa disso são comumente vistos como mais carentes do que realmente são (são carentes apenas com pessoas que conhecem, podendo ir atrás delas e até se sacrificar pelas mesmas). Para poderem sobreviver também precisam sugar parte da energia do universo em que estão podendo ser um problema se forem muitos deles (na maioria das vezes são realocados).",
  "utilidades": "Podem ser usados por novatos que não sabem lidar com a sobrecarga de energia após a chegada de um MC (Monstro da Corrupção), podem ser comidos (apenas os grandes) e animais de terapia, já que as emoções negativas dos saltadores podem ser consideradas energia de universo quando estão no Espaço Zero, servindo de alimento para as criaturinhas.",
  "curiosidade": "Sua carne é macia e agridoce, servindo de alimento para qualquer e toda criatura do espaço zero. Podem se reproduzir tanto por reprodução assexuada quanto por sexuada, fazendo assim a população desses animais ser muito grande, mesmo sendo caçado por todos. Muitas pessoas tem eles como animais de estimação.",
  "life": 9,
  "fatigue": 20,
  "defenses": 0,
  "strength": 1,
  "speed": 2,
  "intelligence": 1,
  "build": 3
 },
 {
  "id": "bestiario-mc-irracional",
  "name": "Monstro da Corrupção (Irracional)",
  "category": "Monstros da Corrupção — Irracionais",
  "color": "#c25b6b",
  "art": "monstro",
  "fisicas": "Grandes monstros podendo ter a aparência variada e sem um padrão fixo, mas, em sua grande maioria e desconsiderando aqueles que conseguem se transformar em pessoas, seu corpo é preto e seu tamanho geralmente envolve seu tipo, variando entre os racionais, semirracionais e irracionais, quanto mais inteligente a criatura, maior a chance dela ter ataques de longa distância, na maioria das vezes fazendo seu corpo não ter tantos espinhos como os irracionais, que geralmente atacam com suas garras ou caudas afiadas, a maioria é descrita como uma criatura amaldiçoada, que deveriam ter ficado presa em seu próprio inferno abaixo da árvore em vez de aparecer na vida das pessoas.",
  "comportamento": "No geral agressivo, mesmo que possa te enganar parecendo dócil, no final apenas quer seu corpo e a sua energia, os irracionais costumam atacar sem parar, mesmo que acabem morrendo, enquanto os racionais tentam ao máximo evitar confrontos em que estejam sem nenhuma vantagem.",
  "onde": "Vivem abaixo da árvore, podendo ser encontrados tentando atacar a mesma ou até em partes mais baixas dela, não necessariamente nas raízes, podem subir quando veem que está em época de evento, geralmente mais desprotegido, para conseguir atacar algum visitante, também podem ser encontrados em universos tentando causar o caos e absorver a energia do local.",
  "poderes": "Podem variar por vários fatores, o que comeram, onde passam a maior parte do tempo, que tipo de monstro são e até de que universos vieram, os mais comuns são tentáculos criados de seus próprios corpos, veneno, fogo (calor), controle mental e imitação, permitindo que copiem o corpo de outra criatura, mesmo assim a maioria não é tão convincente, tecnicamente se fossem bons o suficiente poderiam copiar até como o cérebro de um saltador trabalha, ou seja, suas memórias gostos e etc., felizmente a mente dos saltadores não é um quesito físico, sendo parte de suas almas que são protegidas.",
  "necessidades": "Precisam comer mais do que saltadores, afinal de contas, seus corpos gastam energia para tentar se manter estável enquanto existe, principalmente porque também não consegue colher estrelas e guarda-las como saltadores, fazendo essas criaturas terem que corromper e se alimentar de vários universos frequentemente.",
  "utilidades": "São muito usados para educar crianças que não se comportam bem. Sua carcaça é jogada na base da árvore como forma de adubo para a mesma.",
  "curiosidade": "Universos por onde passam podem ficar com sobrecarga de energia quando morrem lá, liberando a energia guardada em seu corpo, por isso é muito comum ver uma grande quantidade de Mimidos se movendo na direção do acidente.",
  "life": 170,
  "fatigue": 20,
  "defenses": 20,
  "strength": 3,
  "speed": 3,
  "intelligence": 1,
  "build": 1
 },
 {
  "id": "bestiario-calanguitos",
  "name": "Calanguitos",
  "category": "Criaturas do Espaço Zero",
  "color": "#8a5cff",
  "art": "calanguito",
  "fisicas": "Pequenas criaturas de sangue frio, semelhantes a lagartos, seus membros são grossos e negros, alguns detalhes roxos em suas pata e cauda. São maiores que os Mimidos, mas geralmente não passam de 45 cm na natureza. Seus olhos grandes com pupilas que se dilatam facilmente ajudam em sua sobrevivência.",
  "comportamento": "Não são vistos com frequência em grupos, mas também são sociáveis o suficiente para poder interagir entre si, muitas vezes são ariscos com saltadores, tornando assim raras as pessoas que os domesticam, porém sua lealdade é forte, podendo ser até além da morte de seu companheiro, sendo comum vê-los nos túmulos de seus parceiros.",
  "onde": "Costumam viver na parte média da árvore principal, não muito perto dos saltadores, nem muito dos monstros da corrupção, também são vistos em pontos altos das árvores secundárias.",
  "poderes": "Por meio de eletricidade podem gerar calor para aquecerem seus corpos, essa energia sendo geralmente guardada para momentos realmente necessários, sendo assim eles preferem entrar em casas e restaurantes para se esquentarem. Sua energia fica armazenada em sua barriga, que pode brilhar dependendo da intensidade da energia absorvida (eles não conseguem gerar muita energia sozinhos, por isso roubam de certos lugares). Sua falta de alto suficiência nesse quesito acaba fazendo com que essas criaturas consumam a energia do espaço zero.",
  "necessidades": "Calor e estrelas.",
  "utilidades": "Suas garras são afiadas, usadas para criar equipamentos de escalada. Podem gerar faíscas que ajudam a acender fogueiras. Podem gerar luz quando balançados, se tornando um tipo de lanterna de emergência (luz azulada). Suas peles podem ser usadas como uma forma de borracha para conter eletricidade.",
  "curiosidade": "Podem gerar apagões pela árvore em épocas mais frias pela necessidade de energia.",
  "life": 0,
  "fatigue": 0,
  "defenses": 0,
  "strength": 0,
  "speed": 0,
  "intelligence": 0,
  "build": 0
 }
];
function seedBestiary() {
  return BESTIARIO_BASE.map(c => { const { art, ...rest } = c; return { ...JSON.parse(JSON.stringify(rest)), sprite: svgUri(BESTIARIO_ARTES[art]) }; });
}
function genericCreatureArt(color = "#6b6f8f") {
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#15151c" stroke="${color}" stroke-width="5"/><circle cx="36" cy="44" r="8" fill="#e9ecf5"/><circle cx="64" cy="44" r="8" fill="#e9ecf5"/><circle cx="37" cy="45" r="4.5" fill="#050507"/><circle cx="63" cy="45" r="4.5" fill="#050507"/><path d="M38 66 Q50 74 62 66" stroke="${color}" stroke-width="4" fill="none"/></svg>`);
}
