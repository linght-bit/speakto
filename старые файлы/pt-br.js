// pt-br.js — Portuguese target language content

const PTBR = {
    interface: {
      greeting: 'Olá! Eu sou a Raposa Rua! 🦊\nAjude-me a aprender português!\nPara jogar, precisa de microfone.\nClique em 🎤 para ligar!',
      micConfirm: 'Ótimo! Microfone funcionando! 🎤\nFale em português — eu te ouço!',
      micRemind: 'Clique no botão 🎤 embaixo para ligar o microfone.\nSe o navegador perguntar permissão — permita!',
      micCheck: 'Diga algo — testando o microfone...',
      micDenied: 'Acesso ao microfone negado! 😕\nPermita acesso nas configurações do navegador.\nOu tente Safari (iOS) / Chrome (Android).',
      micBrowser: 'Use Safari no iOS ou Chrome no Android!',
      version: 'v1.4.6 · iOS Safari · Android Chrome',
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
    
    // NPC имена (на португальском)
    npc_names: {
      dona_maria: 'Dona Maria',
      don_tiago: 'Don Tiago',
    },
    
    // Объекты и места на карте
    objects: {
      portao: 'portão',
      poco: 'poço',
      cocho: 'cocho',
      casa: 'casa',
      horta: 'horta',
      arvore: 'árvore',
      monstro: 'monstro',
      cavalo: 'cavalinho',
      piar: 'píer',
      oficina: 'oficina',
      milharal: 'milharal',
      lago: 'lago',
    },
    
    // Финальное сообщение
    win_message: {
      title: 'Parabéns!',
      text: 'Missão concluída! Você foi incrível! 🌟',
      button: 'Jogar de novo',
    },

    // Альтернативные решения при неправильной попытке
    suggestions: {
      pick_hay:       'Vamos primeiro pegar o feno!',
      throw_pick:     'Tenta primeiro jogar a pedra!',
      open_gate:      'Abre o portão primeiro!',
      decor_pick:     'Enfeita o cavalinho com uma flor!',
    },

    // Сообщения при неправильной попытке
    try_again: {
      fail_first:     'Sem problema, continua tentando! 💪\nRepete a frase mais devagar.',
      fail_later:     'Ok, isso ainda não está funcionando 😅',
    },

    // Контекстные подсказки для монстра
    context: {
      monster_has_axe:      '⚠️ Monstro! Você tem o machado — ataca!',
      monster_no_axe_away:  '⚠️ Monstro! Corre pegar o machado — está lá fora!',
      monster_no_axe:       '⚠️ Monstro! Sai do curral!',
      exit_to_village:      'Perfeito! Agora vai para o marcador ali à direita 👉\nA aldeia te espera lá!',
    },
  };

const L2_PTBR = {
  // Глаголы прошедшего времени (eu já...)
  past_verbs: {
    feed:    { inf:'alimentei', phrase:'eu já alimentei' },
    water:   { inf:'dei água',  phrase:'eu já dei água'  },
    clean:   { inf:'limpei',    phrase:'eu já limpei'    },
    chop:    { inf:'cortei',    phrase:'eu já cortei'    },
    water_garden: { inf:'reguei', phrase:'eu já reguei' },
    harvest: { inf:'colhi',     phrase:'eu já colhi'    },
    sweep:   { inf:'varri',     phrase:'eu já varri'    },
    brought: { inf:'trouxe',    phrase:'eu trouxe o machado' },
  },

  // Вопросы старушки
  npc_lines: {
    greeting1: 'Olá! Quem é você? De onde você vem?',
    greeting2: 'O que você está fazendo aqui?',
    ask_work:  'Você quer trabalho? Tenho muito para fazer...',
    task_cow_feed:  'Precisa dar comida para a vaca.',
    task_cow_water: 'Precisa dar água para a vaca.',
    task_clean: 'O curral está sujo. Pode limpar?',
    task_chop: 'Preciso de lenha. Você pode cortar?',
    task_axe:  'Perdi meu machado... Você sabe onde está?',
    task_garden: 'O jardim precisa de água.',
    task_harvest: 'A colheita está pronta! Pode colher?',
    task_sweep: 'A varanda está suja. Pode varrer?',
    task_dog:  'Meu cachorro está com fome.',
    thanks:    'Obrigada! Você é muito prestativo!',
    all_done:  'Você fez tudo! Muito obrigada, meu amigo!',
  },

  // Фразы игрока в диалоге
  player_intro: [
    { phrase: 'eu estava passando', text: 'eu estava passando por aqui.' },
    { phrase: 'estou procurando trabalho', text: 'Estou procurando trabalho.' },
  ],
  
  // Приветствия
  player_greetings: {
    bom_dia: 'Bom dia!',
  },
};

// ════════════════════════════════════════════════════
// [LANG:RUS] L2 — Russian UI text level 2
// ════════════════════════════════════════════════════
