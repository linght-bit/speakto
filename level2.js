// ════════════════════════════════════════════════════
// LEVEL2.JS — Village: Dona Maria, quests, dialogue
// NPC and world rendering handled by world.js
// ════════════════════════════════════════════════════

// ════════════════════════════════════════════════════
// LEVEL2.JS — Деревня: дом, огород, Дона Мария
//
// Грамматика: прошедшее время (eu já + глагол)
// Предметы перенесённые с уровня 1: machado (топор), balde (ведро)
// Новые предметы: лопата, дрова, метла, корзина, косточка
// NPC: Дона Мария — старушка-хозяйка
// ════════════════════════════════════════════════════

// ════════════════════════════════════════════════════
// LEVEL 2 STATE
// ════════════════════════════════════════════════════

const L2 = {
  // Выполненные задания (аналог Q из level 1)
  done: {},
  // Текущая стадия диалога с Доной Марией
  dialogueStage: 'intro',  // intro → work_offer → tasks → all_done
  // Задания которые Дона Мария уже попросила
  tasksGiven: new Set(),
  // Предметы перенесённые с уровня 1
  carriedFromL1: [],
};

// Порядок заданий — Дона Мария выдаёт по одному
const L2_TASK_ORDER = [
  'find_axe',      // особое — зависит от наличия топора в руках
  'cow_feed',
  'cow_water',
  'chop_wood',
  'water_garden',
  'harvest',
  'feed_dog',
  'sweep',
];

function l2_nextTask() {
  for (const tid of L2_TASK_ORDER) {
    if (!L2.tasksGiven.has(tid) && !L2.done[tid]) return tid;
    if (L2.tasksGiven.has(tid) && !L2.done[tid]) return null; // задание выдано, ждём выполнения
  }
  return 'all_done';
}

function l2_allDone() {
  return L2_TASK_ORDER.every(t => L2.done[t]);
}

// ════════════════════════════════════════════════════
// DONA MARIA NPC
// ════════════════════════════════════════════════════

const DonaMaria = {
  name: 'Дона Мария',
  avatar: '👵',
  id: 'dona_maria',

  onOpen() {
    const stage = L2.dialogueStage;
    const lines = getL2NpcLines();
    if (stage === 'intro') {
      setTimeout(() => npcSay(lines.greeting1), 400);
      setTimeout(() => npcSay(lines.greeting2), 1800);
      const playerIntro = getL2PlayerIntro();
      setTimeout(() => foxSay(getL2FoxSpy() + '\n\n' + getL2FoxSayThis(),
        null,
        playerIntro.pt[0].phrase,
        playerIntro.ru[0].phrase, []), 2600);
    } else if (stage === 'work_offer') {
      setTimeout(() => npcSay(lines.ask_work), 400);
      const playerIntro = getL2PlayerIntro();
      setTimeout(() => foxSay(getL2FoxSayThis(), null, playerIntro.pt[1].phrase, playerIntro.ru[1].phrase, []), 1200);
    } else {
      // Already talked — show current task
      const tid = l2_nextTask();
      if (tid && tid !== 'all_done') _donaMaria_giveTask(tid);
      else if (tid === 'all_done') npcSay(lines.all_done);
    }
  },

  onClose() {
    // nothing
  },

  onSpeech(s, raw) {
    // Returns true if handled
    const stage = L2.dialogueStage;
    const V = PTBR_VERBS;
    const lines = getL2NpcLines();
    const pv = getL2PastVerbs();

    // ── Intro stage — player says "eu estava passando" ──
    if (stage === 'intro') {
      if (/\b(estava|passando|passei|pasando)\b/.test(s)) {
        const playerIntro = getL2PlayerIntro();
        playerSay(playerIntro.pt[0].text, 'я проходил мимо');
        setTimeout(() => npcSay(lines.ask_work), 800);
        setTimeout(() => {
          foxSay(getL2FoxSayThis(), null, playerIntro.pt[1].phrase, playerIntro.ru[1].phrase, []);
        }, 1600);
        L2.dialogueStage = 'work_offer';
        return true;
      }
      // Try bom dia / olá
      if (/\b(bom|boa|ola|olá|dia|tarde|noite)\b/.test(s)) {
        playerSay(getL2Ptbr().player_greetings.bom_dia, 'Добрый день!');
        setTimeout(() => npcSay(lines.greeting1), 600);
        return true;
      }
    }

    // ── Work offer stage — player says "estou procurando trabalho" ──
    if (stage === 'work_offer') {
      if (/\b(procurando|trabalho|procuro|busco|quero)\b/.test(s)) {
        const playerIntro = getL2PlayerIntro();
        playerSay(playerIntro.pt[1].text, 'Ищу работу.');
        L2.dialogueStage = 'tasks';
        setTimeout(() => _donaMaria_startTasks(), 800);
        return true;
      }
    }

    // ── Tasks stage — player reports completed tasks ──
    if (stage === 'tasks') {
      // "eu já alimentei" — fed cow
      if (/\b(aliment|dei comida|comi)\b/.test(s) && L2.done.cow_feed) {
        _playerReport(pv.pt.feed.phrase, pv.ru.feed.phrase, 'cow_feed');
        return true;
      }
      // "eu já dei água" — watered cow
      if (/\b(dei agua|dei água|agua|água)\b/.test(s) && L2.done.cow_water) {
        _playerReport(pv.pt.water.phrase, pv.ru.water.phrase, 'cow_water');
        return true;
      }
      // "eu já limpei" — cleaned pen
      if (/\b(limpei|limpe|clean)\b/.test(s) && L2.done.clean_pen) {
        _playerReport(pv.pt.clean.phrase, pv.ru.clean.phrase, 'clean_pen');
        return true;
      }
      // "eu já cortei" — chopped wood
      if (/\b(cortei|corte|lenha)\b/.test(s) && L2.done.chop_wood) {
        _playerReport(pv.pt.chop.phrase, pv.ru.chop.phrase, 'chop_wood');
        return true;
      }
      // "eu já reguei" — watered garden
      if (/\b(reguei|regue|jardim)\b/.test(s) && L2.done.water_garden) {
        _playerReport(pv.pt.water_garden.phrase, pv.ru.water_garden.phrase, 'water_garden');
        return true;
      }
      // "eu já colhi" — harvested
      if (/\b(colhi|colhe|colhei)\b/.test(s) && L2.done.harvest) {
        _playerReport(pv.pt.harvest.phrase, pv.ru.harvest.phrase, 'harvest');
        return true;
      }
      // "eu já varri" — swept
      if (/\b(varri|varre|varreu)\b/.test(s) && L2.done.sweep) {
        _playerReport(pv.pt.sweep.phrase, pv.ru.sweep.phrase, 'sweep');
        return true;
      }
      // "eu trouxe o machado" — brought axe
      if (/\b(trouxe|trago|machado)\b/.test(s) && L2.done.find_axe) {
        _playerReport(pv.pt.brought.phrase, pv.ru.brought.phrase, 'find_axe');
        return true;
      }

      // Not done yet — fox hints
      foxSay('Сначала выполни задание!\nЛисёнок подскажет что делать.', '');
      closeDialogue();
      return true;
    }

    return false;
  },
};

function _donaMaria_startTasks() {
  const hasAxe = playerHeld && items.find(i => i.id === playerHeld && i.type === 'axe');
  if (hasAxe) {
    npcSay(L2_PTBR.npc_lines.task_axe + '\n' + L2_PTBR.npc_lines.task_axe_ru);
    L2.tasksGiven.add('find_axe');
    journalAdd('find_axe', L2_RUS.tasks.find_axe, 2);
    setTimeout(() => {
      foxSay(L2_RUS.hints.find_axe.ctx, null,
        L2_RUS.hints.find_axe.phrase, L2_RUS.hints.find_axe.translation, []);
      showDialogueOk(() => closeDialogue());
    }, 1000);
    return;
  }
  _donaMaria_giveTask('cow_feed');
}

function _donaMaria_giveTask(tid) {
  const lines = getL2NpcLines();
  const taskLine = {
    cow_feed:     lines.task_cow_feed,
    cow_water:    lines.task_cow_water,
    chop_wood:    lines.task_chop,
    water_garden: lines.task_garden,
    harvest:      lines.task_harvest,
    sweep:        lines.task_sweep,
    feed_dog:     lines.task_dog,
  };
  const line = taskLine[tid];
  if (!line) return;
  npcSay(line);
  L2.tasksGiven.add(tid);
  if (!journalTasks.find(t => t.id === tid)) {
    journalAdd(tid, getL2Tasks()[tid], 2);
  }
  setTimeout(() => {
    const hint = getL2Hints()[tid];
    if (hint) foxSay(hint.ctx, null, hint.phrase, hint.translation, hint.synonyms || []);
    // Show OK button — player reads task and closes manually
    showDialogueOk(() => closeDialogue());
  }, 1200);
}

function _playerReport(phrase, ru, taskId) {
  playerSay(phrase, ru);
  setTimeout(() => {
    npcSay(getL2NpcLines().thanks);
    journalComplete(taskId);
    setTimeout(() => {
      if (l2_allDone()) {
        npcSay(getL2NpcLines().all_done);
        L2.dialogueStage = 'all_done';
        setTimeout(() => finishGame(), 2000);
      } else {
        const next = l2_nextTask();
        if (next && next !== 'all_done') _donaMaria_giveTask(next);
        else closeDialogue();
      }
    }, 1500);
  }, 600);
}

// ════════════════════════════════════════════════════
// LEVEL 2 WORLD — items, sign, house position
// Called from initLevel2() which replaces initWorld()
// ════════════════════════════════════════════════════

// L2 items (placed in world space, same coordinate system)
// villageNPCs now lives in world.js as villageNPCs


// ════════════════════════════════════════════════════
// LEVEL 2 FOXSTEP
// ════════════════════════════════════════════════════

function foxStep_L2() {
  // Если диалог открыт — не перебиваем
  if (dialogueOpen) return;

  const hasAxe = playerHeld && items.find(i => i.id === playerHeld && i.type === 'axe');
  const stage  = L2.dialogueStage;

  if (stage === 'intro' || stage === 'work_offer') {
    // Just show hint — player walks to NPC themselves
    const introPhrase = getL2FoxIntroPhrase();
    foxSay(getL2FoxIntro(), null,
      introPhrase.phrase,
      introPhrase.translation, []);
    return;
  }

  // Есть топор и задание выдано — напоминаем принести
  if (hasAxe && L2.tasksGiven.has('find_axe') && !L2.done.find_axe) {
    const pv = getL2PastVerbs();
    foxSay(getL2FoxAxeHint(), null,
      pv.pt.brought.phrase,
      pv.ru.brought.phrase, []);
    return;
  }

  // Найти текущее активное задание
  const active = L2_TASK_ORDER.find(t => L2.tasksGiven.has(t) && !L2.done[t]);
  if (active && getL2Hints()[active]) {
    sayStep(getL2Hints()[active]);
    return;
  }

  const introPhrase = getL2FoxIntroPhrase();
  foxSay(getL2Rus().fox_hints.talk_to_npc, null, introPhrase.phrase, introPhrase.translation, []);
}

// ════════════════════════════════════════════════════
// LEVEL 2 EXEC
// ════════════════════════════════════════════════════

function execLevel2(a, p, raw, s) {
  // Always handle open dialogue
  if (dialogueOpen) {
    dialogueExec(raw);
    return true;
  }

  // Village commands only active when player is in village area or using voltar
  const inVillage = P.x > PX + PEN_COLS * CELL + CELL * 0.5;
  const isVoltar = /\b(voltar|volta|retornar|curral|corral|zurral)\b/.test(s);
  if (!inVillage && !isVoltar) return false;

  // Подойди к НПС / открой диалог
  if (a === 'ir_dest' && p === '__npc') {
    const npc = villageNPCs[0];
    if (!npc) return false;
    setTarget(npc.x, npc.y + npc.r * 1.5, () => {
      charSay('Olá!');
      openDialogue(npc);
    });
    return true;
  }

  // "voltar para o curral" — move player back to pen area
  if (/\b(voltar|volta|retornar|curral|corral|zurral)\b/.test(s)) {
    charSay('Voltando!');
    const penX = PX + PEN_COLS * CELL - CELL * 1.5;
    const penY = gate.y + gate.h / 2;
    setTarget(penX, penY, () => { charSay('Cheguei!'); setTimeout(foxStep, 300); });
    return true;
  }

  // "eu trouxe o machado" — принёс топор
  if (/\b(trouxe|trago|trozo)\b/.test(s) || (/\b(machado)\b/.test(s) && playerHeld)) {
    const hasAxe = playerHeld && items.find(i=>i.id===playerHeld&&i.type==='axe');
    if (hasAxe && L2.tasksGiven.has('find_axe') && !L2.done.find_axe) {
      const npc = villageNPCs[0];
      setTarget(npc.x, npc.y + npc.r * 1.5, () => {
        L2.done.find_axe = true;
        journalComplete('find_axe');
        openDialogue(npc);
        playerSay(L2_PTBR.past_verbs.brought.phrase, L2_PTBR.past_verbs.brought.ru);
        setTimeout(() => {
          npcSay(L2_PTBR.npc_lines.thanks + '\n' + L2_PTBR.npc_lines.thanks_ru);
          // Отдаём топор
          const axe = items.find(i=>i.id===playerHeld&&i.type==='axe');
          if (axe) { axe.held=false; axe.x=npc.x+CELL; axe.y=npc.y; playerHeld=null; }
          setTimeout(() => { _donaMaria_giveTask('cow_feed'); }, 1500);
        }, 800);
      });
      return true;
    }
  }

  // Пойти к NPC
  if (/\b(dona|maria|velha|senhora|bom dia|olá|ola)\b/.test(s)) {
    const npc = villageNPCs[0];
    if (npc) setTarget(npc.x, npc.y + npc.r * 1.5, () => { charSay('Olá!'); openDialogue(npc); });
    return true;
  }

  return false; // не обработано — вернёт управление стандартному exec
}