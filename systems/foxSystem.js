/**
 * /systems/foxSystem.js
 * СИСТЕМА ПОМОЩНИКА — ЛИСЁНОК
 *
 * Оценивает намерение игрока по голосовой команде.
 * Перехватывает слишком неточные/неполные команды до их выполнения.
 *
 * Уровни:
 *   1 (≥100% нужных параметров)  — разрешить выполнение, молчать
 *   2 (частичное совпадение)      — заблокировать, дать подсказку
 *   3 (ничего не распознано)      — общий ответ "Не понял"
 */

class FoxSystem {
  constructor() {
    // Активное сообщение: { text, until }
    this._message = null;
    console.log('✓ FoxSystem инициализирован');
  }

  /**
   * Вызывается из actionSystem.processCommand ДО executeAction.
   * Проверяет, что параметры действия полны.
   * @returns {boolean} true = разрешить, false = заблокировать
   */
  evaluate(command, actionId, params) {
    // Действия без обязательных объектов — всегда разрешаем
    const noObjectActions = [
      'move_left', 'move_right', 'move_up', 'move_down',
      'check_inventory', 'help', 'look', 'talk_npc'
    ];
    if (noObjectActions.includes(actionId)) return true;

    // === Действия требующие предмет ===
    if (['take_item', 'use_item'].includes(actionId)) {
      if (!params.itemId) {
        this._hintItem(command, actionId);
        return false;
      }
    }

    if (actionId === 'drop_item') {
      // drop без предмета — берём первый из инвентаря (UX: "joga fora" = "выброси что-нибудь")
      // Не блокируем, но предупреждаем только если инвентарь пуст
      if (!params.itemId) {
        const gs = window.getGameState?.();
        if (!gs?.player?.inventory?.length) {
          this._say(window.getText?.('voice.nothing_to_drop', 'pt'));
          return false;
        }
      }
    }

    if (actionId === 'put_on_surface') {
      if (!params.itemId) {
        this._hintItem(command, 'put_on_surface');
        return false;
      }
      if (!params.surfaceId) {
        this._say(window.getText?.('fox.say_surface_name', 'pt'));
        return false;
      }
    }

    // === Действия с дверью ===
    if (['open_door', 'close_door'].includes(actionId) && !params.doorId) {
      this._say(window.getText?.('fox.no_door', 'pt'));
      return false;
    }

    // === Действия с контейнером ===
    if (actionId === 'open_container' && !params.containerId) {
      this._say(window.getText?.('fox.no_container', 'pt'));
      return false;
    }

    return true;
  }

  /**
   * Уровень 3: действие вообще не найдено в команде.
   */
  onNoAction(command) {
    this._say(window.getText?.('fox.not_understood', 'pt'));
  }

  /**
   * Построить подсказку про предмет.
   * Пытаемся угадать какой предмет имел в виду игрок по символьному сходству.
   */
  _hintItem(command, actionId) {
    const guessed = this._guessBestItem(command);

    const templateKey = actionId === 'put_on_surface' ? 'fox.hint_put'
      : actionId === 'drop_item' ? 'fox.hint_drop'
      : 'fox.hint_take';

    let template = window.getText?.(templateKey, 'pt');
    if (!template || template === templateKey) {
      template = window.getText?.('fox.say_item_name', 'pt');
    }

    if (guessed && template && template.includes('{item}')) {
      this._say(template.replace('{item}', guessed.name));
    } else {
      this._say(template || window.getText?.('fox.say_item_name', 'pt'));
    }
  }

  /**
   * Нечёткий поиск предмета по символьному пересечению с командой.
   * Возвращает { id, name } или null если нет уверенного совпадения.
   */
  _guessBestItem(command) {
    const items = window.itemsData?.items || [];
    const cmd = command.toLowerCase();
    let best = null;
    let bestScore = 0;

    for (const item of items) {
      const key = `items.${item.name}`;
      const name = window.getText?.(key, 'pt');
      if (!name || name === key) continue;

      const score = this._charOverlap(cmd, name.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        best = { id: item.id, name };
      }
    }

    // Порог 35% — достаточно для «чавеи» → «chave»
    return bestScore >= 0.35 ? best : null;
  }

  /**
   * Доля символов (без пробелов) из более короткой строки,
   * встречающихся в более длинной.
   */
  _charOverlap(a, b) {
    const shorter = a.length <= b.length ? a.replace(/\s/g, '') : b.replace(/\s/g, '');
    const longer  = a.length <= b.length ? b : a;
    if (!shorter.length) return 0;
    const hits = shorter.split('').filter(ch => longer.includes(ch)).length;
    return hits / shorter.length;
  }

  /**
   * Отобразить сообщение лисёнка (4 секунды).
   */
  _say(text) {
    if (!text) return;
    console.log(`🦊 Лисёнок: "${text}"`);
    this._message = { text, until: Date.now() + 4000 };
    window.eventSystem?.emit('fox:say', { text });
  }

  /**
   * Получить текущее активное сообщение для рендера.
   * Возвращает строку или null если время истекло.
   */
  getMessage() {
    if (!this._message) return null;
    if (Date.now() > this._message.until) {
      this._message = null;
      return null;
    }
    return this._message.text;
  }
}

// Создаём и прикрепляем к window
const foxSystem = new FoxSystem();
window.foxSystem = foxSystem;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = foxSystem;
}
