/**
 * /systems/dialogueSystem.js
 * СИСТЕМА ДИАЛОГОВ
 * 
 * Обрабатывает диалоги с NPC, лисёнком и другими персонажами.
 */

class DialogueSystem {
  constructor() {
    this.currentDialogue = null;
    this.setupListeners();
  }

  /**
   * Начать диалог
   */
  startDialogue(data) {
    try {
      this.currentDialogue = {
        character: data.character,  // 'fox', 'npc', etc.
        lines: data.lines || [],
        currentLine: 0,
        onComplete: data.onComplete || null,
      };

      const state = window.getGameState?.();
      if (state) {
        window.updateGameState?.({ dialogue: { active: true, step: 0 } });
      }

      window.eventSystem?.emit('dialogue:started', this.currentDialogue);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Перейти к следующей строке диалога
   */
  nextLine() {
    if (!this.currentDialogue) return;

    this.currentDialogue.currentLine++;

    if (this.currentDialogue.currentLine >= this.currentDialogue.lines.length) {
      this.endDialogue();
    } else {
      window.eventSystem?.emit('dialogue:next-line', this.currentDialogue);
    }
  }

  /**
   * Завершить диалог
   */
  endDialogue() {
    if (this.currentDialogue?.onComplete) {
      this.currentDialogue.onComplete();
    }

    const state = window.getGameState?.();
    if (state) {
      window.updateGameState?.({ dialogue: { active: false } });
    }

    window.eventSystem?.emit('dialogue:ended', null);
    this.currentDialogue = null;
  }

  setupListeners() {
    window.eventSystem?.on('game:state-reset', () => {
      this.currentDialogue = null;
    });
  }
}

// Создаём и прикрепляем к window
const dialogueSystem = new DialogueSystem();
window.dialogueSystem = dialogueSystem;

// Для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = dialogueSystem;
}
