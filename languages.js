// ════════════════════════════════════════════════════
// LANGUAGES.JS — Centralized language system
// All texts, translations, synonyms, and interface strings
// Supports multiple languages: add new language object here
// ════════════════════════════════════════════════════

const LANGUAGES = {
  'pt-br': {
    interface: {
      greeting: 'Olá! Eu sou a Raposa Rua! 🦊\nAjude-me a aprender português!\nPara jogar, precisa de microfone.\nClique em 🎤 para ligar!',
      micConfirm: 'Ótimo! Microfone funcionando! 🎤\nFale em português — eu te ouço!',
      micRemind: 'Clique no botão 🎤 embaixo para ligar o microfone.\nSe o navegador perguntar permissão — permita!',
      micCheck: 'Diga algo — testando o microfone...',
      micDenied: 'Acesso ao microfone negado! 😕\nPermita acesso nas configurações do navegador.\nOu tente Safari (iOS) / Chrome (Android).',
      micBrowser: 'Use Safari no iOS ou Chrome no Android!',
      version: 'v1.4.5 · iOS Safari · Android Chrome',
    },
    items: {
      machado: 'machado',
      maca: 'maca',
      cogumelo: 'cogumelo',
      flor: 'flor',
      balde: 'balde',
      feno: 'feno',
      pedra: 'pedra',
      graveto: 'graveto',
      repolho: 'repolho',
      cenoura: 'cenoura',
      abobora: 'abobora',
      tomate: 'tomate',
      milho: 'milho',
      cangalha: 'cangalha',
    },
    verbs: {
      stop: /\b(pare|parar|stop)\b/,
      return: /\b(volta|voltar|volte|retorna)\b/,
      up: /\b(cima|sobe|subir|norte)\b/,
      down: /\b(baixo|desce|descer|sul)\b/,
      left: /\b(esquerda|oeste)\b/,
      right: /\b(direita|leste)\b/,
      flee: /\b(foge|fugir|fuja|fugi|fogi|foji)\b/,
      take: /\b(pega|pegar|pegue|pego|pegu|toma|tomar|levanta|levante|leve|leva|agarra|apanha|apanhar)\b/,
      cut: /\b(corta|cortar|corte|korta|quota|corba|colt[aа])\b/,
      break: /\b(quebra|quebrar|quebre|quebro|kebra|kwebra|bate|bater|bata|parte|partir)\b/,
      fight: /\b(ataca|atacar|ataque|ataka|luta|lutar|lute|briga|brigar)\b/,
      eat: /\b(come|comer|coma|comi|kome|ingere|ingerir)\b/,
      run: /\b(corre|correr|corra|korre|cori|curu|vai correndo)\b/,
      open: /\b(abre|abrir|abra|habri|abril|obri|abriu|abr[еe])\b/,
      close: /\b(fecha|fechar|feche|fesha|fasha|fetcha|fechou|tranca|trancar)\b/,
      go: /\b(vai|va|ir|vou|vem|anda|ande|caminha|caminhar)\b/,
      throwFar: /\b(joga|jogar|jogue|jogo|arremessa|lanca|lancar)\b/,
      throwFarLa: /\b(la|ali|fora|pra la|para la|pra fora)\b/,
      drop: /\b(larga|largar|largue|solta|soltar|solte|joga|jogar|jogue|deita|jogar fora)\b/,
      give: /\b(da|dar|de|deu|dei|doe|entrega|entregar|oferece|passa)\b/,
      decorate: /\b(enfeita|enfeitar|enfeit|decora|decorar|decore|orna|adornar)\b/,
      fill: /\b(enche|encher|encha|enchi|enshi|pega agua|pegar agua|busca agua|buscar agua|colhe agua|pega a agua)\b/,
      water: /\b(napoi|dar agua|da agua|agua para|beber|molhar|molha)\b/,
    },
    objects: {
      tree: /\b(a\s+)?(arvore|arvores|arvori|arvor|harvor|arvoре)\b/,
      monster: /\bmonstro\b/,
      inside: /\b(dentro|chiqueiro|cercado)\b/,
      well: /\b(poco|poca|poco|poso|posu|posso|bosso|paco|pasu|posu|posso)\b/,
      trough: /\b(cocho|cosho|coxo|kosho|kocho|trough|bebedouro|coche)\b/,
      horse: /\b(cavalo|horse|cavallo|kavalo)\b/,
      gate: /\b(portao|portoes|portau|portaw|porto|porta|purtau|portow|portan)\b/,
      aldeia: /\b(aldeia|aldea|vila|village|aldaya|curral|corral)\b/,
    },
    knownWords: [
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
    ],
    quests: {
      walk_up: { ctx:'Passo 1: Aprendendo a andar!', phrase:'vai para cima', translation:'vai para cima · [vai para sima]',
        synonyms:[{pt:'sobe',ru:'suba'},{pt:'vai para norte',ru:'vai para o norte'}] },
      walk_down: { ctx:'Ótimo! Agora para baixo.', phrase:'vai para baixo', translation:'vai para baixo · [vai para baixu]',
        synonyms:[{pt:'desce',ru:'desça'},{pt:'vai para sul',ru:'vai para o sul'}] },
      walk_right: { ctx:'Agora para a direita.', phrase:'vai para a direita', translation:'vai para a direita · [vai para a direyta]',
        synonyms:[{pt:'vai para leste',ru:'vai para o leste'}] },
      walk_left: { ctx:'E para a esquerda!', phrase:'vai para a esquerda', translation:'vai para a esquerda · [vai para a eskerda]',
        synonyms:[{pt:'vai para oeste',ru:'vai para o oeste'}] },
      pick_hay: { ctx:'Passo 2: Aprendendo a pegar itens!\nO feno (retângulo amarelo) está no curral.',
        phrase:'pega o feno', translation:'pega o feno · [pega u fenu]',
        synonyms:[{pt:'leva o feno',ru:'leva o feno'},{pt:'toma o feno',ru:'toma o feno'}] },
      fed_horse: { ctx:'Agora dê o feno para o cavalo!', phrase:'da o feno', translation:'da o feno · [da u fenu]',
        synonyms:[{pt:'entrega o feno',ru:'entrega o feno'},{pt:'passa o feno',ru:'passa o feno'}] },
      throw_rock: { ctx:'Agora jogue a pedra!', phrase:'joga a pedra', translation:'joga a pedra · [joga a pedra]',
        synonyms:[{pt:'arremessa a pedra',ru:'arremessa a pedra'},{pt:'lanca a pedra',ru:'lança a pedra'}] },
      decor_flower: { ctx:'Agora pegue a flor!', phrase:'pega a flor', translation:'pega a flor · [pega a flor]',
        synonyms:[{pt:'leva a flor',ru:'leva a flor'},{pt:'toma a flor',ru:'toma a flor'}] },
      decor_horse: { ctx:'Agora dê a flor para o cavalo!', phrase:'enfeita o cavalo', translation:'enfeita o cavalo · [enfeyta u kavalu]',
        synonyms:[{pt:'decora o cavalo',ru:'decora o cavalo'},{pt:'orna o cavalo',ru:'orna o cavalo'}] },
      open_gate: { ctx:'Agora abra o portão!', phrase:'abre o portão', translation:'abre o portão · [abri u purtau]',
        synonyms:[{pt:'abre a porta',ru:'abre a porta'}] },
      pick_bucket: { ctx:'Pegue o balde fora do curral!', phrase:'pega o balde', translation:'pega o balde · [pega u baldi]',
        synonyms:[{pt:'leva o balde',ru:'leva o balde'},{pt:'toma o balde',ru:'toma o balde'}] },
      go_well: { ctx:'Agora vá para o poço!', phrase:'vai para o poço', translation:'vai para o poço · [vai para u posu]',
        synonyms:[{pt:'vai para o poco',ru:'vai para o poço'}] },
      fill_bucket: { ctx:'Você está no poço! Encha o balde!', phrase:'enche o balde', translation:'enche o balde · [enshi u baldi]',
        synonyms:[{pt:'pega agua',ru:'pega água'},{pt:'busca agua',ru:'busca água'}] },
      go_trough: { ctx:'Agora vá para o cocho do cavalo!', phrase:'vai para o cocho', translation:'vai para o cocho · [vai para u kosu]',
        synonyms:[{pt:'vai para o bebedouro',ru:'vai para o bebedouro'}] },
      water_horse: { ctx:'Você está no cocho! Dê água para o cavalo!', phrase:'da agua para o cavalo', translation:'da água para o cavalo · [da agua para u kavalu]',
        synonyms:[{pt:'napoi o cavalo',ru:'napoi o cavalo'},{pt:'molha o cavalo',ru:'molha o cavalo'}] },
      get_axe: { ctx:'O machado está no poço fora do curral. Pegue-o!', phrase:'pega o machado', translation:'pega o machado · [pega u mashadu]',
        synonyms:[{pt:'leva o machado',ru:'leva o machado'},{pt:'toma o machado',ru:'toma o machado'}] },
      cut_tree: { ctx:'Agora vá para a árvore verde!', phrase:'vai para a arvore', translation:'vai para a árvore · [vai para a arvor]',
        synonyms:[{pt:'vai para a arvores',ru:'vai para as árvores'}] },
      cut_do: { ctx:'Você está na árvore! Corte-a!', phrase:'corta a arvore', translation:'corta a árvore · [korta a arvor]',
        synonyms:[{pt:'corte a arvore',ru:'corte a árvore'}] },
      monster: { ctx:'Corra para o portão!', phrase:'vai para o portao', translation:'vai para o portão · [vai para u purtau]',
        synonyms:[{pt:'corre para o portao',ru:'corre para o portão'}] },
      monster_attack: { ctx:'O machado está na mão — ataque o monstro!', phrase:'ataca o monstro', translation:'ataca o monstro · [ataka u monstru]',
        synonyms:[{pt:'luta com o monstro',ru:'luta com o monstro'}] },
      monster_close: { ctx:'O monstro está dentro, você fora!\nFeche o portão rápido!',
        phrase:'fecha o portao', translation:'fecha o portão · [fesha u purtau]',
        synonyms:[{pt:'tranca o portao',ru:'tranca o portão'}] },
      monster_locked: 'O monstro está trancado! Ele virou árvore. 🌳',
      final: '🏆 Todas as missões completadas!\nVocê aprendeu português!\nParabéns! 🦊',
    },
    fail: {
      syllables: {
        up: '(vai pa-ra si-ma)',
        down: '(vai pa-ra bai-shu)',
        right: '(vai pa-ra a di-rei-ta)',
        left: '(vai pa-ra a es-ke-da)',
      },
      pick_hay: { text:'Aproxime-se do feno amarelo e diga:', syl:'(pe-ga u fe-nu)' },
      feed_far: { text:'Primeiro aproxime-se do cavalo:', syl:'' },
      feed_near: { text:'Você está perto! Aceita "da" ou "dê":', syl:'(da au ka-va-lu)' },
      throw_pick: { text:'Pegue a pedra cinza:', syl:'(pe-ga a pe-dra)' },
      throw_do: { text:'A pedra está na mão — jogue-a!', syl:'(jo-ga a pe-dra la)' },
      decor_pick: { text:'Pegue a flor rosa:', syl:'(pe-ga a flor)' },
      decor_go: { text:'A flor está na mão! Aproxime-se do cavalo:', syl:'' },
      decor_do: { text:'Você está no cavalo com a flor!', syl:'(en-fei-tar u ka-va-lu)' },
      open_gate: { text:'O portão está à direita. Diga:', syl:'(ab-ri u por-tao)' },
      pick_bucket: { text:'Pegue o balde fora do curral:', syl:'(pe-ga u bal-di)' },
      go_well: { text:'Primeiro vá para o poço:', syl:'' },
      fill_bucket: { text:'Você está no poço! Pegue água:', syl:'(en-shi u bal-di)' },
      go_trough: { text:'Aproxime-se do cocho do cavalo:', syl:'' },
      water_do: { text:'Você está no cocho! Dê água:', syl:'(da a-gua pa-ra u ka-va-lu)' },
      get_axe: { text:'O machado está no poço fora. Diga:', syl:'(pe-ga u ma-sha-du)' },
      cut_go: { text:'Aproxime-se da árvore verde:', syl:'' },
      cut_do: { text:'Você está na árvore! Corte:', syl:'(kor-ta a ar-vo-ri)' },
      monster: { text:'Corra para o portão!', syl:'(vai pa-ra u por-tao)' },
      monster_attack: { text:'O machado na mão — ataque o monstro!', syl:'(a-ta-ka u mon-stro)' },
      monster_close: { text:'O monstro dentro — feche o portão!', syl:'(fe-sha u por-tao)' },
      explore: { text:'Explore o mundo! Vá para um item:', syl:'' },
      bucket_water: { text:'O balde está cheio! Vá para o cocho:', syl:'' },
      bucket_empty: { text:'Vá para o poço e pegue água:', syl:'' },
    },
    reactions: {
      need_gate: [
        'O portão está fechado!', 'Preciso abrir o portão!',
        'A porta está trancada!',
      ],
      need_axe: [
        'Preciso do machado!', 'Cadê o machado?',
        'Sem o machado não dá!',
      ],
      need_bucket: [
        'Preciso do balde!', 'Cadê a água?', 'Sem balde não consigo!',
      ],
      not_found: [
        'Não vejo isso aqui!', 'Não tem isso por aqui!',
        'Onde está isso?', 'Não encontro!',
      ],
      already_held: [
        'Já tenho!', 'Já está comigo!', 'Já peguei isso!',
      ],
      already_done: [
        'Já fiz isso!', 'Já está feito!', 'Pronto, já fiz!',
      ],
      too_far: [
        'Preciso chegar mais perto!', 'Estou longe demais!',
        'Vou me aproximar primeiro!',
      ],
      confused: [
        'Não entendi!', 'O quê?', 'Repete, por favor!',
        'Não compreendi...', 'Fala de novo!', 'Hmm?',
      ],
      no_weapon: [
        'Não tenho arma!', 'Com que vou atacar?', 'Preciso do machado!',
      ],
      no_monster: [
        'Não tem monstro aqui!', 'Tá tudo bem, sem monstro!',
      ],
      cant_throw: [
        'Não posso jogar isso!', 'Esse item é importante!',
      ],
      nothing_held: [
        'Não estou carregando nada!', 'Minhas mãos estão vazias!',
      ],
    },
  },
  'rus': {
    interface: {
      greeting: 'Привет! Я Лисёнок Руа! 🦊\nПомогу тебе учить португальский!\nДля игры нужен микрофон.\nНажми 🎤 чтобы включить его!',
      micConfirm: 'Отлично! Микрофон работает! 🎤\nГовори по-португальски — я тебя слышу!',
      micRemind: 'Нажми кнопку 🎤 внизу чтобы включить микрофон.\nЕсли браузер спросит разрешение — разреши!',
      micCheck: 'Скажи что-нибудь — проверяю микрофон...',
      micDenied: 'Доступ к микрофону запрещён! 😕\nРазреши доступ в настройках браузера.\nИли попробуй Safari (iOS) / Chrome (Android).',
      micBrowser: 'Usa Safari no iOS ou Chrome no Android!',
      version: 'v1.4.5 · iOS Safari · Android Chrome',
    },
    items: {
      machado: 'топор',
      maca: 'яблоко',
      cogumelo: 'гриб',
      flor: 'цветок',
      balde: 'ведро',
      feno: 'сено',
      pedra: 'камень',
      graveto: 'палка',
      repolho: 'капуста',
      cenoura: 'морковь',
      abobora: 'тыква',
      tomate: 'помидор',
      milho: 'кукуруза',
      cangalha: 'оловянный инструмент',
    },
    verbs: {
      stop: /\b(стоп|остановись|стой)\b/,
      return: /\b(вернись|назад|обратно)\b/,
      up: /\b(вверх|наверх|север)\b/,
      down: /\b(вниз|внизу|юг)\b/,
      left: /\b(влево|лево|запад)\b/,
      right: /\b(вправо|право|восток)\b/,
      flee: /\b(беги|убегай|спасайся)\b/,
      take: /\b(возьми|бери|подними|хватай)\b/,
      cut: /\b(режь|руби|рубить)\b/,
      break: /\b(ломай|разбей|разбить)\b/,
      fight: /\b(атакуй|бей|драться)\b/,
      eat: /\b(ешь|кушай|съешь)\b/,
      run: /\b(беги|бегом|беги быстро)\b/,
      open: /\b(открой|открывай)\b/,
      close: /\b(закрой|закрывай|запри)\b/,
      go: /\b(иди|пойди|пошёл)\b/,
      throwFar: /\b(брось|кинь|бросай)\b/,
      throwFarLa: /\b(туда|прочь|вон)\b/,
      drop: /\b(положи|брось|выбрось)\b/,
      give: /\b(дай|отдай|передай)\b/,
      decorate: /\b(укрась|декорируй)\b/,
      fill: /\b(наполни|набери|заполни)\b/,
      water: /\b(напои|дай воды|полей)\b/,
    },
    objects: {
      tree: /\b(дерево|деревья)\b/,
      monster: /\b(монстр|чудовище)\b/,
      inside: /\b(внутри|загон)\b/,
      well: /\b(колодец|колодцы)\b/,
      trough: /\b(корыто|кормушка)\b/,
      horse: /\b(лошадь|конь)\b/,
      gate: /\b(ворота|калитка)\b/,
      aldeia: /\b(деревня|село)\b/,
    },
    knownWords: [
      'иди','пойди','к','возьми','бери','режь','беги','открой','закрой','беги',
      'дай','отдай','наполни','брось','положи','выбрось','ешь','кушай','сено','камень',
      'дерево','топор','ведро','лошадь','ворота','колодец','вода','корыто',
      'монстр','палка','цветок','гриб','яблоко','внутри','вверх','вниз',
      'влево','вправо','атакуй','укрась','декорируй','вернись','стой','бери',
      'возьми','отдал','отдала','передай','укрась','о','а','к','с','один','одна',
      'до','и','от','с','на','в','к','туда','здесь','прочь','режь',
      'ломай','подними','опусти','север','юг','запад','восток','до','корыто',
      'иди','пойди','иди','приходи','иди','возьми','предложи','передай','отдай',
      'деревня','село','загон','хлев','деревня',
    ],
    quests: {
      walk_up: { ctx:'Шаг 1: Учимся ходить!', phrase:'vai para cima', translation:'иди вверх · [вай пара сима]',
        synonyms:[{pt:'sobe',ru:'поднимись'},{pt:'vai para norte',ru:'иди на север'}] },
      walk_down: { ctx:'Отлично! Теперь вниз.', phrase:'vai para baixo', translation:'иди вниз · [вай пара байшу]',
        synonyms:[{pt:'desce',ru:'спускайся'},{pt:'vai para sul',ru:'иди на юг'}] },
      walk_right: { ctx:'Теперь вправо.', phrase:'vai para a direita', translation:'иди вправо · [вай пара а дирейта]',
        synonyms:[{pt:'vai para leste',ru:'иди на восток'}] },
      walk_left: { ctx:'И влево!', phrase:'vai para a esquerda', translation:'иди влево · [вай пара а эскерда]',
        synonyms:[{pt:'vai para oeste',ru:'иди на запад'}] },
      pick_hay: { ctx:'Шаг 2: Учимся брать предметы!\nСено (жёлтый прямоугольник) лежит в загоне.',
        phrase:'pega o feno', translation:'возьми сено · [пэга у фэну]',
        synonyms:[{pt:'leva o feno',ru:'бери сено'},{pt:'toma o feno',ru:'возьми сено'}] },
      fed_horse: { ctx:'Теперь дай сено лошади!', phrase:'da o feno', translation:'дай сено · [да у фэну]',
        synonyms:[{pt:'entrega o feno',ru:'отдай сено'},{pt:'passa o feno',ru:'передай сено'}] },
      throw_rock: { ctx:'Теперь брось камень!', phrase:'joga a pedra', translation:'брось камень · [жога а пэдра]',
        synonyms:[{pt:'arremessa a pedra',ru:'брось камень'},{pt:'lanca a pedra',ru:'кинь камень'}] },
      decor_flower: { ctx:'Теперь возьми цветок!', phrase:'pega a flor', translation:'возьми цветок · [пэга а флор]',
        synonyms:[{pt:'leva a flor',ru:'бери цветок'},{pt:'toma a flor',ru:'возьми цветок'}] },
      decor_horse: { ctx:'Теперь дай цветок лошади!', phrase:'enfeita o cavalo', translation:'укрась лошадь · [энфейта у кавалу]',
        synonyms:[{pt:'decora o cavalo',ru:'декорируй лошадь'},{pt:'orna o cavalo',ru:'укрась лошадь'}] },
      open_gate: { ctx:'Теперь открой ворота!', phrase:'abre o portão', translation:'открой ворота · [абри у пуртау]',
        synonyms:[{pt:'abre a porta',ru:'открой дверь'}] },
      pick_bucket: { ctx:'Возьми ведро снаружи загона!', phrase:'pega o balde', translation:'возьми ведро · [пэга у балди]',
        synonyms:[{pt:'leva o balde',ru:'бери ведро'},{pt:'toma o balde',ru:'возьми ведро'}] },
      go_well: { ctx:'Теперь иди к колодцу!', phrase:'vai para o poço', translation:'иди к колодцу · [вай пара у посу]',
        synonyms:[{pt:'vai para o poco',ru:'иди к колодцу'}] },
      fill_bucket: { ctx:'Ты у колодца! Набери воды!', phrase:'enche o balde', translation:'наполни ведро · [энши у балди]',
        synonyms:[{pt:'pega agua',ru:'набери воды'},{pt:'busca agua',ru:'найди воду'}] },
      go_trough: { ctx:'Теперь иди к корыту лошади!', phrase:'vai para o cocho', translation:'иди к корыту · [вай пара у кошю]',
        synonyms:[{pt:'vai para o bebedouro',ru:'иди к поилке'}] },
      water_horse: { ctx:'Ты у корыта! Налей воды лошади!', phrase:'da agua para o cavalo', translation:'дай воды лошади · [да агуа пара у кавалу]',
        synonyms:[{pt:'napoi o cavalo',ru:'напои лошадь'},{pt:'molha o cavalo',ru:'полей лошадь'}] },
      get_axe: { ctx:'Топор у колодца снаружи. Возьми его!', phrase:'pega o machado', translation:'возьми топор · [пэга у машаду]',
        synonyms:[{pt:'leva o machado',ru:'бери топор'},{pt:'toma o machado',ru:'возьми топор'}] },
      cut_tree: { ctx:'Теперь иди к зелёному дереву!', phrase:'vai para a arvore', translation:'иди к дереву · [вай пара а арвори]',
        synonyms:[{pt:'vai para a arvores',ru:'иди к деревьям'}] },
      cut_do: { ctx:'Ты у дерева! Руби!', phrase:'corta a arvore', translation:'руби дерево · [корта а арвори]',
        synonyms:[{pt:'corte a arvore',ru:'руби дерево'}] },
      monster: { ctx:'Беги к воротам!', phrase:'vai para o portao', translation:'иди к воротам · [вай пара у пуртау]',
        synonyms:[{pt:'corre para o portao',ru:'беги к воротам'}] },
      monster_attack: { ctx:'Топор в руках — атакуй монстра!', phrase:'ataca o monstro', translation:'атакуй монстра · [атака у монстру]',
        synonyms:[{pt:'luta com o monstro',ru:'дерусь с монстром'}] },
      monster_close: { ctx:'Монстр внутри, ты снаружи!\nСрочно закрой ворота!',
        phrase:'fecha o portão', translation:'закрой ворота · [фэша у пуртау]',
        synonyms:[{pt:'tranca o portão',ru:'запри ворота'}] },
      monster_locked: 'Монстр заперт! Он стал деревом. 🌳',
      final: '🏆 Все квесты выполнены!\nТы научился говорить по-португальски!\nМолодец! 🦊',
    },
    fail: {
      syllables: {
        up: '(вай па-ра си-ма)',
        down: '(вай па-ра бай-шу)',
        right: '(вай па-ра а ди-рей-та)',
        left: '(вай па-ра а эс-кер-да)',
      },
      pick_hay: { text:'Подойди к жёлтому сену и скажи:', syl:'(пэ-га у фэ-ну)' },
      feed_far: { text:'Сначала подойди к лошади:', syl:'' },
      feed_near: { text:'Ты рядом! Принимает da или dê:', syl:'(да ау ка-ва-лу)' },
      throw_pick: { text:'Возьми серый камень:', syl:'(пэ-га а пэ-дра)' },
      throw_do: { text:'Камень в руках — брось его!', syl:'(жо-га а пэ-дра ла)' },
      decor_pick: { text:'Возьми розовый цветок:', syl:'(пэ-га а флор)' },
      decor_go: { text:'Цветок в руках! Подойди к лошади:', syl:'' },
      decor_do: { text:'Ты у лошади с цветком!', syl:'(эн-фей-тар у ка-ва-лу)' },
      open_gate: { text:'Ворота справа. Скажи:', syl:'(аб-ри у пур-тау)' },
      pick_bucket: { text:'Возьми ведро снаружи загона:', syl:'(пэ-га у бал-ди)' },
      go_well: { text:'Сначала подойди к колодцу:', syl:'' },
      fill_bucket: { text:'Ты у колодца! Набери воды:', syl:'(эн-ши у бал-ди)' },
      go_trough: { text:'Подойди к корыту у лошади:', syl:'' },
      water_do: { text:'Ты у корыта! Налей воды:', syl:'(да а-гуа па-ра у ка-ва-лу)' },
      get_axe: { text:'Топор у колодца снаружи. Скажи:', syl:'(пэ-га у ма-ша-ду)' },
      cut_go: { text:'Подойди к зелёному дереву:', syl:'' },
      cut_do: { text:'Ты у дерева! Руби:', syl:'(кор-та а ар-во-ри)' },
      monster: { text:'Беги к воротам!', syl:'(вай па-ра у пур-тау)' },
      monster_attack: { text:'Топор в руках — атакуй монстра!', syl:'(а-та-ка у мон-стру)' },
      monster_close: { text:'Монстр внутри — закрой ворота!', syl:'(фэ-ша у пур-тау)' },
      explore: { text:'Исследуй мир! Подойти к предмету:', syl:'' },
      bucket_water: { text:'Ведро полное! Иди к корыту:', syl:'' },
      bucket_empty: { text:'Иди к колодцу и набери воды:', syl:'' },
    },
    reactions: {
      need_gate: [
        'Ворота закрыты!', 'Нужно открыть ворота!',
        'Дверь заперта!',
      ],
      need_axe: [
        'Нужен топор!', 'Где топор?',
        'Без топора не получится!',
      ],
      need_bucket: [
        'Нужно ведро!', 'Где вода?', 'Без ведра не справлюсь!',
      ],
      not_found: [
        'Не вижу этого здесь!', 'Этого нет поблизости!',
        'Где это?', 'Не нахожу!',
      ],
      already_held: [
        'Уже есть!', 'Уже со мной!', 'Уже взял!',
      ],
      already_done: [
        'Уже сделал!', 'Уже готово!', 'Готово, уже сделал!',
      ],
      too_far: [
        'Нужно подойти ближе!', 'Слишком далеко!',
        'Сначала подойду!',
      ],
      confused: [
        'Не понял!', 'Что?', 'Повтори, пожалуйста!',
        'Не разобрал...', 'Скажи ещё раз!', 'Хм?',
      ],
      no_weapon: [
        'Нет оружия!', 'Чем атаковать?', 'Нужен топор!',
      ],
      no_monster: [
        'Здесь нет монстра!', 'Всё спокойно, без монстра!',
      ],
      cant_throw: [
        'Не могу бросить!', 'Этот предмет важен!',
      ],
      nothing_held: [
        'Ничего не несу!', 'Руки пустые!',
      ],
    },
  },
};

// Augment with item-specific words
if (typeof ITEM_CATALOG === 'object' && ITEM_CATALOG) {
  for (const item of Object.values(ITEM_CATALOG)) {
    LANGUAGES['pt-br'].knownWords.push(item.pt);
    if (item.ru) LANGUAGES['rus'].knownWords.push(item.ru);
    if (item.aliases && Array.isArray(item.aliases)) {
      for (const alias of item.aliases) {
        LANGUAGES['pt-br'].knownWords.push(alias);
        LANGUAGES['rus'].knownWords.push(alias);
      }
    }
  }
}

// Current language — change this to switch language
let CURRENT_LANG = 'rus';

// Helper functions
function getText(key, lang = CURRENT_LANG) {
  const keys = key.split('.');
  let obj = LANGUAGES[lang];
  for (const k of keys) {
    if (obj && typeof obj === 'object') obj = obj[k];
    else return key; // fallback to key if not found
  }
  return obj || key;
}

function getItemName(itemId, lang = CURRENT_LANG) {
  return LANGUAGES[lang]?.items?.[itemId] || itemId;
}

function getVerbs(lang = CURRENT_LANG) {
  return LANGUAGES[lang]?.verbs || {};
}

function getObjects(lang = CURRENT_LANG) {
  return LANGUAGES[lang]?.objects || {};
}

function getKnownWords(lang = CURRENT_LANG) {
  return LANGUAGES[lang]?.knownWords || [];
}

function getQuests(lang = CURRENT_LANG) {
  return LANGUAGES[lang]?.quests || {};
}

function getFail(lang = CURRENT_LANG) {
  return LANGUAGES[lang]?.fail || {};
}

function getReactions(lang = CURRENT_LANG) {
  return LANGUAGES[lang]?.reactions || {};
}

// Augment with item-specific words
if (typeof ITEM_CATALOG === 'object' && ITEM_CATALOG) {
  for (const item of Object.values(ITEM_CATALOG)) {
    LANGUAGES['pt-br'].knownWords.push(item.pt);
    if (item.ru) LANGUAGES['rus'].knownWords.push(item.ru);
    if (item.aliases && Array.isArray(item.aliases)) {
      for (const alias of item.aliases) {
        LANGUAGES['pt-br'].knownWords.push(alias);
        LANGUAGES['rus'].knownWords.push(alias);
      }
    }
  }
}
