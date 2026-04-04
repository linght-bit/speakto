class DialogueSystem {
  constructor() {
    this.currentDialogue = null;
    this.setupListeners();
  }

  
  startDialogue(data) {
    try {
      this.currentDialogue = {
        character: data.character, 
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

  
  nextLine() {
    if (!this.currentDialogue) return;

    this.currentDialogue.currentLine++;

    if (this.currentDialogue.currentLine >= this.currentDialogue.lines.length) {
      this.endDialogue();
    } else {
      window.eventSystem?.emit('dialogue:next-line', this.currentDialogue);
    }
  }

  
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

const dialogueSystem = new DialogueSystem();
window.dialogueSystem = dialogueSystem;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = dialogueSystem;
}
