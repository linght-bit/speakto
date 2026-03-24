// ════════════════════════════════════════════════════
// DIALOGUE.JS — NPC dialogue window
// Окно диалога: история реплик, ввод через микрофон
// NPC слева, игрок справа
// ════════════════════════════════════════════════════

let dialogueOpen = false;
let dialogueNPC  = null;   // текущий NPC объект
let dialogueHistory = [];  // [{side:'npc'|'player', text, pt}]

function openDialogue(npc) {
  dialogueNPC = npc;
  dialogueOpen = true;
  dialogueHistory = [];
  document.getElementById('dlg').classList.add('show');
  document.getElementById('dlg-name').textContent = npc.name;
  document.getElementById('dlg-avatar').textContent = npc.avatar || '👵';
  renderDialogueHistory();
  npc.onOpen();
}

function closeDialogue() {
  dialogueOpen = false;
  document.getElementById('dlg').classList.remove('show');
  if (dialogueNPC && dialogueNPC.onClose) dialogueNPC.onClose();
  dialogueNPC = null;
}

function npcSay(text, pt) {
  dialogueHistory.push({ side: 'npc', text, pt });
  renderDialogueHistory();
}

function playerSay(text, pt) {
  dialogueHistory.push({ side: 'player', text, pt });
  renderDialogueHistory();
}

function renderDialogueHistory() {
  const el = document.getElementById('dlg-history');
  el.innerHTML = '';
  for (const msg of dialogueHistory) {
    const div = document.createElement('div');
    div.className = 'dlg-msg dlg-' + msg.side;
    const bubble = document.createElement('div');
    bubble.className = 'dlg-bubble';
    bubble.innerHTML = msg.text.replace(/\n/g,'<br>');
    if (msg.pt) {
      const pt = document.createElement('div');
      pt.className = 'dlg-pt';
      pt.textContent = msg.pt;
      bubble.appendChild(pt);
    }
    div.appendChild(bubble);
    el.appendChild(div);
  }
  el.scrollTop = el.scrollHeight;
}

// Called from exec() when dialogue is open — routes recognised speech to NPC
function dialogueExec(raw) {
  if (!dialogueNPC) return false;
  return dialogueNPC.onSpeech(norm(raw), raw);
}

// Show an OK button at bottom of dialogue — player clicks to continue
function showDialogueOk(onOk) {
  const el = document.getElementById('dlg-ok');
  if (!el) return;
  el.style.display = 'block';
  el.onclick = () => {
    el.style.display = 'none';
    if (onOk) onOk();
  };
}