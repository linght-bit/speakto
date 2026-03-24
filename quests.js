// ════════════════════════════════════════════════════
// QUESTS.JS — Quest system, dialogs, command parser
// [LANG:PTBR] Brazilian Portuguese phrases, synonyms
// [LANG:RUS]  Russian hints, dialog text
// Future: each [LANG:*] extracted to its own file
// ════════════════════════════════════════════════════

// ══════════════════════ [LANG:PTBR] ══════════════════════

const PTBR_ITEM_NAMES = {
  axe:'machado', apple:'maçã', mushroom:'cogumelo', flower:'flor',
  bucket:'balde', hay:'feno', rock:'pedra', stick:'graveto',
};
const PTBR_DEST_NAMES = {
  well:'poço', trough:'cocho', horse:'cavalo', gate:'portão', inside:'dentro',
};

const PTBR_VERBS = {
  stop:       /\b(pare|parar|stop)\b/,
  return:     /\b(volta|voltar|volte|retorna)\b/,
  up:         /\b(cima|sobe|subir|norte)\b/,
  down:       /\b(baixo|desce|descer|sul)\b/,
  left:       /\b(esquerda|oeste)\b/,
  right:      /\b(direita|leste)\b/,
  flee:       /\b(foge|fugir|fuja|fugi|fogi|foji)\b/,
  take:       /\b(pega|pegar|pegue|pego|pegu|toma|tomar|levanta|levante|leve|leva|agarra|apanha|apanhar)\b/,
  cut:        /\b(corta|cortar|corte|korta|quota|corba|colt[aа])\b/,
  break:      /\b(quebra|quebrar|quebre|quebro|kebra|kwebra|bate|bater|bata|parte|partir)\b/,
  fight:      /\b(ataca|atacar|ataque|ataka|luta|lutar|lute|briga|brigar)\b/,
  eat:        /\b(come|comer|coma|comi|kome|ingere|ingerir)\b/,
  run:        /\b(corre|correr|corra|korre|cori|curu|vai correndo)\b/,
  open:       /\b(abre|abrir|abra|habri|abril|obri|abriu|abr[еe])\b/,
  close:      /\b(fecha|fechar|feche|fesha|fasha|fetcha|fechou|tranca|trancar)\b/,
  go:         /\b(vai|va|ir|vou|vem|anda|ande|caminha|caminhar)\b/,
  throwFar:   /\b(joga|jogar|jogue|jogo|arremessa|lanca|lancar)\b/,
  throwFarLa: /\b(la|ali|fora|pra la|para la|pra fora)\b/,
  drop:       /\b(larga|largar|largue|solta|soltar|solte|joga|jogar|jogue|deita|jogar fora)\b/,
  give:       /\b(da|dar|de|deu|dei|doe|entrega|entregar|oferece|passa)\b/,
  decorate:   /\b(enfeita|enfeitar|enfeit|decora|decorar|decore|orna|adornar)\b/,
  fill:       /\b(enche|encher|encha|enchi|enshi|pega agua|pegar agua|busca agua|buscar agua|colhe agua|pega a agua)\b/,
  water:      /\b(napoi|dar agua|da agua|agua para|beber|molhar|molha)\b/,
};

const PTBR_OBJECTS = {
  // optional article "a" — handles "vai para arvore" AND "vai para a arvore"
  tree:    /\b(a\s+)?(arvore|arvores|arvori|arvor|harvor|arvoре)\b/,
  monster: /\bmonstro\b/,
  inside:  /\b(dentro|chiqueiro|cercado)\b/,
  // poço — "посу": распознавалка слышит poco/poso/posso/bosso/bosу/posу/pasu/paço
  well:    /\b(poco|poca|poco|poso|posu|posso|bosso|paco|pasu|posu|posso)\b/,
  // cocho — "кошу": распознавалка слышит cocho/cosho/coxo/kosho/kocho
  trough:  /\b(cocho|cosho|coxo|kosho|kocho|trough|bebedouro|coche)\b/,
  horse:   /\b(cavalo|horse|cavallo|kavalo)\b/,
  // portão — "пуртау": porto/porta/portao/purtau/portow
  gate:    /\b(portao|portoes|portau|portaw|porto|porta|purtau|portow|portan)\b/,
  // aldeia / village / деревня
  aldeia:  /\b(aldeia|aldea|vila|village|aldaya|curral|corral)\b/,
};

// All recognized PT tokens — for word-level colorization in setLogWords()
const PTBR_KNOWN_WORDS = new Set([
  'vai','vou','para','pega','pegar','corta','foge','abre','fecha','corre',
  'da','dar','enche','joga','larga','solta','come','comer','feno','pedra',
  'arvore','machado','balde','cavalo','portao','poco','agua','cocho',
  'monstro','graveto','flor','cogumelo','maca','dentro','cima','baixo',
  'esquerda','direita','ataca','enfeitar','decorar','volta','pare','leva',
  'toma','deu','dei','passa','embeleza','o','a','ao','os','as','um','uma',
  'ate','e','de','do','no','na','pro','pra','la','ali','fora','cortar',
  'quebrar','sobe','desce','norte','sul','oeste','leste','ate','cocho',
  'anda','caminha','vai','vem','ir','toma','oferece','entrega','dar',
  'aldeia','vila','curral','corral','aldea',
]);

// Words for the CURRENT quest step — updated by setQuestWords()
let PTBR_QUEST_WORDS = new Set();

function setQuestWords(phraseStr) {
  const tokens = norm(phraseStr).split(/\s+/);
  PTBR_QUEST_WORDS = new Set(tokens.filter(t => t.length > 1));
}

// ══════════════════════ [LANG:RUS] ══════════════════════
// Quest step format: { ctx, phrase, translation, synonyms[] }
//   ctx         — Russian context above the phrase
//   phrase      — canonical PT phrase (shown as ▶ "phrase")
//   translation — Russian meaning shown below phrase
//   synonyms    — [{pt, ru}] for the 💡 hint button

const RUS = {
  greeting:   'Привет! Я Лисёнок Руа! 🦊\nПомогу тебе учить португальский!\nДля игры нужен микрофон.\nНажми 🎤 чтобы включить его!',
  micConfirm: 'Отлично! Микрофон работает! 🎤\nГовори по-португальски — я тебя слышу!',
  micRemind:  'Нажми кнопку 🎤 внизу чтобы включить микрофон.\nЕсли браузер спросит разрешение — разреши!',
  micCheck:   'Скажи что-нибудь — проверяю микрофон...',
  micDenied:  'Доступ к микрофону запрещён! 😕\nРазреши доступ в настройках браузера.\nИли попробуй Safari (iOS) / Chrome (Android).',
  micBrowser: 'Usa Safari no iOS ou Chrome no Android!',

  quest: {
    walk_up:    { ctx:'Шаг 1: Учимся ходить!', phrase:'vai para cima', translation:'иди вверх · [вай пара сима]',
      synonyms:[{pt:'sobe',ru:'поднимись'},{pt:'vai para norte',ru:'иди на север'}] },
    walk_down:  { ctx:'Отлично! Теперь вниз.', phrase:'vai para baixo', translation:'иди вниз · [вай пара байшу]',
      synonyms:[{pt:'desce',ru:'спускайся'},{pt:'vai para sul',ru:'иди на юг'}] },
    walk_right: { ctx:'Теперь вправо.', phrase:'vai para a direita', translation:'иди вправо · [вай пара а дирейта]',
      synonyms:[{pt:'vai para leste',ru:'иди на восток'}] },
    walk_left:  { ctx:'И влево!', phrase:'vai para a esquerda', translation:'иди влево · [вай пара а эскерда]',
      synonyms:[{pt:'vai para oeste',ru:'иди на запад'}] },

    pick_hay:   { ctx:'Шаг 2: Учимся брать предметы!\nСено (жёлтый прямоугольник) лежит в загоне.',
      phrase:'pega o feno', translation:'возьми сено · [пэга у фэну]',
      synonyms:[{pt:'leva o feno',ru:'бери сено'},{pt:'toma o feno',ru:'возьми сено'}] },

    feed_approach: { ctx:'Шаг 3: Отдай сено лошадке!\nСначала подойди к ней.',
      phrase:'vai para o cavalo', translation:'иди к лошади · [вай пара у кавалу]',
      synonyms:[{pt:'vai até o cavalo',ru:'подойди к лошади'},{pt:'anda para o cavalo',ru:'иди к лошади'}] },
    feed_do:    { ctx:'Шаг 3: Ты рядом с лошадкой!\nТеперь дай ей сено.',
      phrase:'dê ao cavalo', translation:'дай лошади · [дэ ау кавалу]',
      synonyms:[{pt:'da ao cavalo',ru:'дай лошади'},{pt:'oferece ao cavalo',ru:'предложи лошади'}] },

    throw_pick: { ctx:'Шаг 4: Учимся бросать!\nВозьми камень (серый) с земли.',
      phrase:'pega a pedra', translation:'возьми камень · [пэга а пэдра]',
      synonyms:[{pt:'leva a pedra',ru:'бери камень'},{pt:'toma a pedra',ru:'возьми камень'}] },
    throw_do:   { ctx:'Шаг 4: Камень в руках!\nБрось его за забор.',
      phrase:'joga a pedra lá', translation:'брось камень туда · [жога а пэдра ла]',
      synonyms:[{pt:'arremessa a pedra',ru:'брось камень'},{pt:'lança a pedra fora',ru:'выбрось камень'}] },

    decor_pick: { ctx:'Шаг 5: Укрась лошадку! 🌸\nЦветок (розовый) растёт в загоне.',
      phrase:'pega a flor', translation:'возьми цветок · [пэга а флор]',
      synonyms:[{pt:'leva a flor',ru:'бери цветок'},{pt:'toma a flor',ru:'возьми цветок'}] },
    decor_go:   { ctx:'Шаг 5: Цветок в руках!\nПодойди к лошадке.',
      phrase:'vai para o cavalo', translation:'иди к лошади · [вай пара у кавалу]',
      synonyms:[{pt:'vai até o cavalo',ru:'подойди к лошади'}] },
    decor_do:   { ctx:'Шаг 5: Ты у лошадки с цветком!\nУкрась её!',
      phrase:'enfeitar o cavalo', translation:'украсить лошадь · [энфейтар у кавалу]',
      synonyms:[{pt:'decora o cavalo',ru:'укрась лошадь'},{pt:'orna o cavalo',ru:'укрась лошадь'}] },

    open_gate:  { ctx:'Шаг 6: Напоим лошадку! 💧\nВедро снаружи — сначала открой ворота.',
      phrase:'abre o portão', translation:'открой ворота · [абри у пуртау]',
      synonyms:[{pt:'abra o portão',ru:'открой ворота'},{pt:'abrir o portão',ru:'открыть ворота'}] },
    pick_bucket:{ ctx:'Шаг 7: Ворота открыты!\nВедро снаружи загона справа.',
      phrase:'pega o balde', translation:'возьми ведро · [пэга у балди]',
      synonyms:[{pt:'leva o balde',ru:'бери ведро'},{pt:'toma o balde',ru:'возьми ведро'}] },
    go_well:    { ctx:'Шаг 8: Ведро в руках!\nИди к колодцу (справа внизу).',
      phrase:'vai até o poço', translation:'иди к колодцу · [вай атэ у посу]',
      synonyms:[{pt:'vai para o poço',ru:'иди к колодцу'},{pt:'anda para o poço',ru:'иди к колодцу'}] },
    fill_bucket:{ ctx:'Шаг 9: Ты у колодца!\nНабери воды.',
      phrase:'enche o balde', translation:'наполни ведро · [энши у балди]',
      synonyms:[{pt:'pega água',ru:'набери воды'},{pt:'busca água',ru:'найди воду'}] },
    enter_pen:  { ctx:'Шаг 10: Ведро полное! 💧\nВойди в загон через ворота.',
      phrase:'vai para dentro', translation:'войди внутрь · [вай пара дентру]',
      synonyms:[{pt:'entra no cercado',ru:'войди в загон'},{pt:'vai para o cercado',ru:'иди в загон'}] },
    go_trough:  { ctx:'Шаг 10: Зайди к корыту у лошади!',
      phrase:'vai para o cocho', translation:'иди к корыту · [вай пара у кошу]',
      synonyms:[{pt:'vai até o cocho',ru:'подойди к корыту'}] },
    water_do:   { ctx:'Шаг 10: Налей воду в корыто!',
      phrase:'dá água para o cavalo', translation:'дай воды лошади · [да агуа пара у кавалу]',
      synonyms:[{pt:'dar água ao cavalo',ru:'дать воды лошади'},{pt:'molha o cavalo',ru:'напои лошадь'}] },

    congrats_water: 'Отлично! Лошадка напоена! 🎉\nТеперь займёмся порядком в загоне.',

    get_axe:    { ctx:'Шаг 11: В загоне выросли лишние деревья!\nТопор лежит снаружи у колодца.',
      phrase:'pega o machado', translation:'возьми топор · [пэга у машаду]',
      synonyms:[{pt:'leva o machado',ru:'бери топор'},{pt:'toma o machado',ru:'возьми топор'}] },
    cut_go:     { ctx:'Шаг 12: Топор в руках! Руби деревья!\nПодойди к дереву (зелёный треугольник).',
      phrase:'vai para a árvore', translation:'иди к дереву · [вай пара а арвори]',
      synonyms:[{pt:'vai até a árvore',ru:'подойди к дереву'},{pt:'anda para a árvore',ru:'иди к дереву'}] },
    cut_do:     { ctx:'Шаг 12: Ты у дерева!\nРуби его!',
      phrase:'corta a árvore', translation:'срубить дерево · [корта а арвори]',
      synonyms:[{pt:'cortar a árvore',ru:'срубить дерево'},{pt:'corte a árvore',ru:'срубить дерево'}] },

    monster_get_axe: { ctx:'⚠️ МОНСТР! Нужен топор — он у колодца снаружи!\nСначала открой ворота.',
      phrase:'abre o portão', translation:'открой ворота · [абри у пуртау]',
      synonyms:[{pt:'abra o portão',ru:'открой ворота'}] },
    monster_get_axe_out: { ctx:'⚠️ Выйди и возьми топор у колодца!',
      phrase:'pega o machado', translation:'возьми топор · [пэга у машаду]',
      synonyms:[{pt:'leva o machado',ru:'бери топор'}] },
    monster_attack: { ctx:'⚠️ Топор в руках — атакуй монстра!',
      phrase:'ataca o monstro', translation:'атакуй монстра · [атака у монстру]',
      synonyms:[{pt:'luta com o monstro',ru:'сразись с монстром'}] },
    monster_chase: { ctx:'Монстр снаружи! Загони его обратно и закрой ворота.',
      phrase:'fecha o portão', translation:'закрой ворота · [фэша у пуртау]',
      synonyms:[{pt:'fechar o portão',ru:'закрыть ворота'},{pt:'tranca o portão',ru:'запри ворота'}] },
    monster_close: { ctx:'Монстр внутри, ты снаружи!\nСрочно закрой ворота!',
      phrase:'fecha o portão', translation:'закрой ворота · [фэша у пуртау]',
      synonyms:[{pt:'tranca o portão',ru:'запри ворота'}] },
    monster_locked: 'Монстр заперт! Он стал деревом. 🌳',
    final: '🏆 Все квесты выполнены!\nТы научился говорить по-португальски!\nМолодец! 🦊',
  },

  fail: {
    syllables: {
      up:    '(вай па-ра си-ма)',
      down:  '(вай па-ра бай-шу)',
      right: '(вай па-ра а ди-рей-та)',
      left:  '(вай па-ра а эс-кер-да)',
    },
    pick_hay:     { text:'Подойди к жёлтому сену и скажи:',        syl:'(пэ-га у фэ-ну)' },
    feed_far:     { text:'Сначала подойди к лошади:',               syl:'' },
    feed_near:    { text:'Ты рядом! Принимает da или dê:',          syl:'(да ау ка-ва-лу)' },
    throw_pick:   { text:'Возьми серый камень:',                    syl:'(пэ-га а пэ-дра)' },
    throw_do:     { text:'Камень в руках — брось его!',             syl:'(жо-га а пэ-дра ла)' },
    decor_pick:   { text:'Возьми розовый цветок:',                  syl:'(пэ-га а флор)' },
    decor_go:     { text:'Цветок в руках! Подойди к лошади:',       syl:'' },
    decor_do:     { text:'Ты у лошади с цветком!',                  syl:'(эн-фей-тар у ка-ва-лу)' },
    open_gate:    { text:'Ворота справа. Скажи:',                   syl:'(аб-ри у пур-тау)' },
    pick_bucket:  { text:'Возьми ведро снаружи загона:',            syl:'(пэ-га у бал-ди)' },
    go_well:      { text:'Сначала подойди к колодцу:',              syl:'' },
    fill_bucket:  { text:'Ты у колодца! Набери воды:',              syl:'(эн-ши у бал-ди)' },
    go_trough:    { text:'Подойди к корыту у лошади:',              syl:'' },
    water_do:     { text:'Ты у корыта! Налей воды:',                syl:'(да агуа па-ра у ка-ва-лу)' },
    get_axe:      { text:'Топор у колодца снаружи. Скажи:',         syl:'(пэ-га у ма-ша-ду)' },
    cut_go:       { text:'Подойди к зелёному дереву:',              syl:'' },
    cut_do:       { text:'Ты у дерева! Руби:',                      syl:'(кор-та а ар-во-ри)' },
    monster:      { text:'Беги к воротам!',                        syl:'(вай па-ра у пур-тау)' },
    monster_attack:{ text:'Топор в руках — атакуй монстра!',        syl:'(ата-ка у мон-стру)' },
    monster_close: { text:'Монстр внутри — закрой ворота!',         syl:'(фэ-ша у пур-тау)' },
    explore:      { text:'Исследуй мир! Подойти к предмету:',       syl:'' },
    bucket_water: { text:'Ведро полное! Иди к корыту:',             syl:'' },
    bucket_empty: { text:'Иди к колодцу и набери воды:',            syl:'' },
  },
};

// ════════════════════════════════════════════════════
// COMMAND PARSER
// ════════════════════════════════════════════════════

function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}

function matchItem(s) {
  if(playerHeld){
    const h=items.find(i=>i.id===playerHeld&&!i.gone);
    if(h){
      const m={axe:'machado',apple:'maca',mushroom:'cogumelo',flower:'flor',
               bucket:'balde',hay:'feno',rock:'pedra',stick:'graveto'};
      for(const[t,w]of Object.entries(m))
        if(new RegExp('\\b'+w+'\\b').test(s)&&h.type===t) return playerHeld;
    }
  }
  if(/\bmachado\b/.test(s)) return 'machado';
  if(/\bmaca\b/.test(s))    return 'maca';
  if(/\bcogumelo\b/.test(s))return 'cogumelo';
  if(/\bflor\b/.test(s))    return 'flor';
  if(/\bbalde\b/.test(s))   return 'balde';
  if(/\bfeno\b/.test(s))    return 'feno';
  if(/\bpedra\b/.test(s)){
    const av=items.filter(i=>i.type==='rock'&&!i.gone&&i.id!==playerHeld);
    if(!av.length)return null;
    av.sort((a,b)=>dist(P,a)-dist(P,b)); return av[0].id;
  }
  if(/\bgraveto\b/.test(s)){
    const av=items.filter(i=>i.type==='stick'&&!i.gone&&i.id!==playerHeld);
    if(!av.length)return null;
    av.sort((a,b)=>dist(P,a)-dist(P,b)); return av[0].id;
  }
  return null;
}

function matchDest(s){
  if(PTBR_OBJECTS.well.test(s))   return '__well';
  if(PTBR_OBJECTS.trough.test(s)) return '__trough';
  if(PTBR_OBJECTS.horse.test(s))  return '__horse';
  if(PTBR_OBJECTS.gate.test(s))   return '__gate';
  if(PTBR_OBJECTS.inside.test(s)) return '__inside';
  if(PTBR_OBJECTS.aldeia.test(s)) return '__aldeia';
  return null;
}

function parseCmd(raw){
  const s=norm(raw);
  const V=PTBR_VERBS,O=PTBR_OBJECTS;
  const hasMove=/\b(cima|baixo|esquerda|direita|sobe|desce|norte|sul|oeste|leste)\b/.test(s);
  if(!hasMove&&V.stop.test(s)) return{a:'pare'};
  if(V.return.test(s))         return{a:'volta'};
  if(V.up.test(s))             return{a:'dir',p:'up'};
  if(V.down.test(s))           return{a:'dir',p:'down'};
  if(V.left.test(s))           return{a:'dir',p:'left'};
  if(V.right.test(s))          return{a:'dir',p:'right'};
  const isFoge=V.flee.test(s)||(/\b(sai|saio|sair)\b/.test(s)&&hasDentro)||
               (/\b(vai|corre)\b/.test(s)&&/\b(portao|portão|porta|purtau)\b/.test(s)&&monster.alive),
               isPegar=V.take.test(s), isCortar=V.cut.test(s);
  const isQuebra=V.break.test(s), isLuta=V.fight.test(s), isComer=V.eat.test(s);
  const isCorrer=V.run.test(s), isAbre=V.open.test(s), isFecha=V.close.test(s);
  const isVai=V.go.test(s);
  const isJogaLa=V.throwFar.test(s)&&V.throwFarLa.test(s);
  const isLarga=V.drop.test(s)&&!V.throwFarLa.test(s);
  const isDa=V.give.test(s), isEnfeitar=V.decorate.test(s);
  const isEnche=V.fill.test(s), isNapoi=V.water.test(s);
  const hasArvore=O.tree.test(s), hasMonstro=O.monster.test(s), hasDentro=O.inside.test(s);
  const item=matchItem(s), dest=matchDest(s);

  if(isFoge)                                      return{a:'foge'};
  if((isLuta||isQuebra||isCortar)&&hasMonstro)    return{a:'atacar'};
  if(isCortar&&hasArvore)                          return{a:'cortar_arvore'};
  if((isVai||isCorrer)&&hasArvore)                 return{a:'ir_arvore'};
  if(isQuebra&&item)                               return{a:'quebrar',p:item};
  if(isEnche)                                      return{a:'encher_balde'};
  if(isNapoi)                                      return{a:'napoi_cavalo'};
  if(isPegar&&item)                                return{a:'pegar',p:item};
  if(isComer&&item)                                return{a:'comer',p:item};
  if(isAbre)                                       return{a:'abrir_portao'};
  if(isFecha)                                      return{a:'fechar_portao'};
  if((isCorrer||isVai)&&hasDentro)                 return{a:'ir_dest',p:'__inside'};
  if((isVai||isCorrer)&&dest)                      return{a:'ir_dest',p:dest};
  if((isVai||isCorrer)&&item)                      return{a:'ir_item',p:item};
  if(isDa)                                         return{a:'dar',p:item};
  if(isEnfeitar)                                   return{a:'enfeitar'};
  if(isJogaLa)                                     return{a:'jogar_la',p:item||playerHeld};
  if(isLarga)                                      return{a:'largar',p:item||playerHeld};
  return{a:null};
}

// ════════════════════════════════════════════════════
// QUEST STATE
// ════════════════════════════════════════════════════

let Q={}, failCount=0;
let walkDone={up:false,down:false,right:false,left:false};
let walkTutDone=false;

function questAdvance(event){
  switch(event){
    case 'walk_up':    walkDone.up=true;    break;
    case 'walk_down':  walkDone.down=true;  break;
    case 'walk_left':  walkDone.left=true;  break;
    case 'walk_right': walkDone.right=true; break;
    case 'picked_hay':      Q.picked_hay=true;      break;
    case 'fed_horse':       Q.fed_horse=true;        break;
    case 'threw_rock':      Q.threw_rock=true;       break;
    case 'horse_decorated': Q.horse_decorated=true;  break;
    case 'picked_bucket':   Q.picked_bucket=true;    break;
    case 'gate_opened':     Q.gate_opened=true;      break;
    case 'bucket_filled':   Q.bucket_filled=true;    break;
    case 'horse_watered':   Q.horse_watered=true;    break;
    case 'picked_axe':      Q.picked_axe=true;       break;
    case 'tree_cut':        Q.tree_cut=true;          break;
    case 'fled_monster':    Q.fled_monster=true;      break;
    case 'gate_closed_monster_inside': Q.gate_closed=true; break;
  }
  const skip=['picked_hay','fed_horse','threw_rock','horse_decorated','picked_bucket',
    'gate_opened','bucket_filled','horse_watered','picked_axe','tree_cut',
    'fled_monster','gate_closed_monster_inside'];
  if(skip.includes(event)) walkDone.up=walkDone.down=walkDone.left=walkDone.right=true;
  failCount=0;
  setTimeout(foxStep,150);
}

// ════════════════════════════════════════════════════
// FOX STEP RENDERING
// sayStep({ctx,phrase,translation,synonyms}) → foxSay with new structured format
// ════════════════════════════════════════════════════

function sayStep(step, autoHelp){
  if(typeof step==='string'){foxSay(step,'');return;}
  const{ctx,phrase,translation,synonyms}=step;
  foxSay(ctx,null,phrase,translation,synonyms||[],autoHelp);
  setQuestWords(phrase);
}

function foxStep(){
  updStep(); failCount=0;
  const q=RUS.quest;

  // ── Экстренные ситуации — всегда первые ──
  if(monster.alive){
    const mi=inPen(monster), pi=inPen(P);
    const hasAxe = playerHeld && items.find(i=>i.id===playerHeld&&i.type==='axe');
    if(pi){
      // Игрок внутри загона
      if(hasAxe){
        // Топор есть — атакуй
        sayStep(q.monster_attack); return;
      }
      // Нет топора — нужно выйти и взять
      if(!gate.open){ sayStep(q.monster_get_axe); return; }
      sayStep(q.monster_get_axe_out); return;
    } else {
      // Игрок снаружи
      if(hasAxe && mi){
        // Топор есть, монстр внутри — атакуй
        sayStep(q.monster_attack); return;
      }
      if(!mi)          { sayStep(q.monster_chase); return; }
      if(gate.open)    { sayStep(q.monster_close); return; }
      foxSay(q.monster_locked,''); return;
    }
  }

  // ── Финал ──
  if(Q.gate_closed && !Q.final_done){
    Q.final_done=true;
    foxSay(q.final,'');
    // После поздравления — указываем на указатель справа
    setTimeout(()=>{
      foxSay('Отлично! Теперь иди к указателю справа 👉\nТам тебя ждёт деревня!',
        null, 'vai para a aldeia', 'иди в деревню · [вай пара а алдэйа]', []);
    }, 3000);
    return;
  }

  // ── Определяем что сейчас в руках и где стоим ──
  const heldItem = playerHeld ? items.find(i=>i.id===playerHeld&&!i.gone) : null;
  const heldType = heldItem ? heldItem.type : null;
  const nearHorse = dist(P,{x:horse.x+horse.w/2,y:horse.y+horse.h/2}) < CELL*2.5;
  const nearWell  = dist(P,well) < CELL*3;
  const nearTrough= dist(P,{x:trough.x,y:trough.y}) < CELL*2.5;
  const insidePen = inPen(P);

  // ── Контекстные подсказки по тому что СЕЙЧАС в руках ──

  // Топор в руках → подсказка рубить деревья
  if(heldType==='axe'){
    const at=trees.filter(t=>t.alive&&!t.isMonster);
    if(at.length>0){
      sayStep(at.some(t=>dist(P,t)<CELL*2.5)?q.cut_do:q.cut_go); return;
    }
  }

  // Цветок в руках → подсказка украсить лошадь
  if(heldType==='flower'&&!Q.horse_decorated){
    sayStep(nearHorse ? q.decor_do : q.decor_go); return;
  }

  // Полное ведро в руках → подсказка напоить лошадь
  if(heldType==='bucket' && heldItem && heldItem.filled && !Q.horse_watered){
    if(!insidePen && !gate.open){ sayStep(q.open_gate); return; }
    if(!insidePen)               { sayStep(q.enter_pen); return; }
    sayStep(nearTrough ? q.water_do : q.go_trough); return;
  }

  // Пустое ведро в руках → подсказка набрать воды
  if(heldType==='bucket' && heldItem && !heldItem.filled && !Q.horse_watered){
    sayStep(nearWell ? q.fill_bucket : q.go_well); return;
  }

  // Сено / гриб / яблоко в руках → подсказка покормить лошадь
  if(['hay','mushroom','apple'].includes(heldType) && !Q.fed_horse){
    sayStep(nearHorse ? q.feed_do : q.feed_approach); return;
  }

  // Камень или палка в руках → подсказка бросить
  if(['rock','stick'].includes(heldType) && !Q.threw_rock){
    sayStep(q.throw_do); return;
  }

  // ── Линейный прогресс по невыполненным шагам ──

  if(!walkDone.up||!walkDone.down||!walkDone.left||!walkDone.right){
    if(!walkDone.up)         sayStep(q.walk_up);
    else if(!walkDone.down)  sayStep(q.walk_down);
    else if(!walkDone.right) sayStep(q.walk_right);
    else                     sayStep(q.walk_left);
    return;
  }
  if(!Q.picked_hay)      { sayStep(q.pick_hay);     return; }
  if(!Q.fed_horse)       { sayStep(nearHorse?q.feed_do:q.feed_approach); return; }
  if(!Q.threw_rock)      { sayStep(q.throw_pick);    return; }
  if(!Q.horse_decorated) { sayStep(q.decor_pick);    return; }

  if(!Q.horse_watered){
    if(!Q.gate_opened)   { sayStep(q.open_gate);   return; }
    if(!Q.picked_bucket) { sayStep(q.pick_bucket); return; }
    if(!Q.bucket_filled) { sayStep(nearWell?q.fill_bucket:q.go_well); return; }
    if(!insidePen)       { sayStep(q.enter_pen);   return; }
    sayStep(nearTrough?q.water_do:q.go_trough); return;
  }

  if(!Q.congrats_water){
    Q.congrats_water=true; foxSay(q.congrats_water,'');
    setTimeout(foxStep,3000); return;
  }

  if(!Q.picked_axe){ sayStep(q.get_axe); return; }

  const at=trees.filter(t=>t.alive&&!t.isMonster);
  if(at.length>0){
    sayStep(at.some(t=>dist(P,t)<CELL*2.5)?q.cut_do:q.cut_go); return;
  }

  fox_context();
}

// Suggest skipping to a different quest step after too many fails
function _foxSuggestAlternative(){
  failCount = 0; // reset so suggestion doesn't loop
  const q = RUS.quest;
  // Find next incomplete step that's different from current
  // Priority: something the player CAN do right now
  const heldIt = playerHeld ? items.find(i=>i.id===playerHeld&&!i.gone) : null;
  const heldType = heldIt ? heldIt.type : null;

  // Build list of available alternative steps
  const alts = [];
  if(!Q.picked_hay && heldType !== 'hay')        alts.push({msg:'Давай сначала возьмём сено!', step:q.pick_hay});
  if(!Q.threw_rock && !Q.fed_horse)              alts.push({msg:'Попробуй сначала бросить камень!', step:q.throw_pick});
  if(!Q.gate_opened && Q.fed_horse)              alts.push({msg:'Открой сначала ворота!', step:q.open_gate});
  if(!Q.horse_decorated && Q.fed_horse && !Q.threw_rock) alts.push({msg:'Укрась лошадку цветком!', step:q.decor_pick});

  if(alts.length === 0){
    foxSay('Не страшно, продолжай пробовать! 💪\nПовтори фразу медленнее.',
      null, null, null, null);
    return;
  }
  const alt = alts[Math.floor(Math.random() * alts.length)];
  foxSay('Ок, это пока не получается 😅\n' + alt.msg,
    null, alt.step.phrase, alt.step.translation, alt.step.synonyms || []);
  setQuestWords(alt.step.phrase);
}

function fox_fail(raw){
  failCount++;

  // failCount 1: first fail — silent or mic confirm
  if(failCount===1){
    if(!window._micWelcomeDone){
      window._micWelcomeDone = true;
      foxSay(RUS.micConfirm,'');
      setTimeout(foxStep, 1800);
    }
    return;
  }

  // failCount 2: show current step hint (normal foxStep)
  if(failCount===2){ foxStep(); return; }

  // failCount 3-4: show step WITH auto-open help panel
  // failCount 5+: suggest alternative task
  const autoHelp = failCount >= 3 && failCount <= 4;
  const suggestAlt = failCount >= 5;

  const F=RUS.fail;
  function hint(k,phrase){
    const f=F[k]; if(!f)return;
    // On failCount 3-4 auto-open help, on 5+ suggest alternative
    if(suggestAlt){
      _foxSuggestAlternative();
      return;
    }
    foxSay(f.text+(f.syl?' '+f.syl:''),phrase,undefined,undefined,undefined,autoHelp);
  }
  if(!walkDone.up||!walkDone.down||!walkDone.left||!walkDone.right){
    const syl=F.syllables;
    const d=!walkDone.up?['cima',syl.up]:!walkDone.down?['baixo',syl.down]
           :!walkDone.right?['direita',syl.right]:['esquerda',syl.left];
    if(suggestAlt){ _foxSuggestAlternative(); return; }
    foxSay('"vai para '+d[0]+'" '+d[1],'vai para '+d[0]); return;
  }
  if(!Q.picked_hay)  {hint('pick_hay','pega o feno');return;}
  if(!Q.fed_horse){
    const n=dist(P,{x:horse.x+horse.w/2,y:horse.y+horse.h/2})<CELL*2.5;
    hint(n?'feed_near':'feed_far',n?'da ao cavalo':'vai para o cavalo'); return;
  }
  if(!Q.threw_rock){
    const hr=playerHeld&&items.find(i=>i.id===playerHeld&&i.type==='rock');
    hint(hr?'throw_do':'throw_pick',hr?'joga a pedra lá':'pega a pedra'); return;
  }
  if(!Q.horse_decorated){
    const hf=playerHeld&&items.find(i=>i.id===playerHeld&&i.type==='flower');
    const n=dist(P,{x:horse.x+horse.w/2,y:horse.y+horse.h/2})<CELL*2.5;
    if(!hf) hint('decor_pick','pega a flor');
    else if(!n) hint('decor_go','vai para o cavalo');
    else hint('decor_do','enfeitar o cavalo');
    return;
  }
  if(!Q.gate_opened)  {hint('open_gate','abre o portão');return;}
  if(!Q.picked_bucket){hint('pick_bucket','pega o balde');return;}
  if(!Q.bucket_filled){
    const nw=dist(P,well)<CELL*3;
    hint(nw?'fill_bucket':'go_well',nw?'enche o balde':'vai até o poço'); return;
  }
  if(!Q.horse_watered){
    const n=dist(P,trough)<CELL*2.5;
    hint(n?'water_do':'go_trough',n?'dá água para o cavalo':'vai para o cocho'); return;
  }
  if(!Q.picked_axe){hint('get_axe','pega o machado');return;}
  if(trees.filter(t=>t.alive&&!t.isMonster).length>0){
    const n=trees.filter(t=>t.alive&&!t.isMonster).some(t=>dist(P,t)<CELL*2.5);
    hint(n?'cut_do':'cut_go',n?'corta a árvore':'vai para a árvore'); return;
  }
  if(monster.alive){
    if(inPen(P)){
      const hasAxe2=playerHeld&&items.find(i=>i.id===playerHeld&&i.type==='axe');
      if(hasAxe2){hint('monster_attack','ataca o monstro');return;}
      if(!gate.open){hint('open_gate','abre o portão');return;}
      hint('monster','vai para o portão');return;
    }
    hint('monster_close','fecha o portão');return;
  }
  foxStep();
}

function fox_success(){
  failCount = 0;
  updStep();
  // If player does any real action, walk tutorial is implicitly done
  walkDone.up = walkDone.down = walkDone.left = walkDone.right = true;
  // Re-evaluate quest state after any successful action
  setTimeout(foxStep, 300);
}

function fox_context(){
  const heldIt=playerHeld?items.find(i=>i.id===playerHeld&&!i.gone):null;
  const held=heldIt?heldIt.type:null;
  const F=RUS.fail;
  if(monster.alive&&inPen(P)){
    if(held==='axe'){
      foxSay('⚠️ Монстр! У тебя топор — атакуй!',null,'ataca o monstro','атакуй монстра · [ата-ка у мон-стру]',[{pt:'luta com o monstro',ru:'сразись'}]);
    } else {
      const axeItem=items.find(i=>i.type==='axe'&&!i.gone);
      if(axeItem&&!inPen(axeItem)){
        foxSay('⚠️ Монстр! Беги за топором — он снаружи!',null,'abre o portão','открой ворота · [аб-ри у пур-тау]',[]);
      } else {
        foxSay('⚠️ Монстр! Беги из загона!',null,'abre o portão','открой ворота · [аб-ри у пур-тау]',[]);
      }
    }
    return;
  }
  if(held==='bucket'){
    const b=items.find(i=>i.id==='balde');
    foxSay(b&&!b.filled?F.bucket_empty.text:F.bucket_water.text,
           b&&!b.filled?'vai até o poço':'vai para o cocho');
    return;
  }
  foxSay(F.explore.text,'vai para o [предмет]');
}

function updStep(){
  const h=playerHeld?items.find(i=>i.id===playerHeld):null;
  document.getElementById('si').textContent='Tem:\n'+(h?h.label:'—');
}

function checkCleanup(){
  const ri=items.filter(i=>i.type==='rock'&&!i.gone&&inPen(i));
  const si=items.filter(i=>i.type==='stick'&&!i.gone&&inPen(i));
  if(ri.length===0&&si.length===0) fox_context();
}

// foxStep is unified — village handled in foxStep_L2 called from level2.js when near NPC