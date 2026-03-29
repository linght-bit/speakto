/**
 * /core/events.js
 * СИСТЕМА СОБЫТИЙ
 * 
 * Позволяет модулям обмениваться сообщениями без прямых зависимостей.
 * Паттерн: Pauwer-Observer
 */

class EventSystem {
  constructor() {
    this.listeners = {};
  }

  /**
   * Подписаться на событие
   * @param {string} eventName - название события
   * @param {function} callback - функция-обработчик
   */
  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  /**
   * Отписаться от события
   * @param {string} eventName
   * @param {function} callback
   */
  off(eventName, callback) {
    if (!this.listeners[eventName]) return;
    
    this.listeners[eventName] = this.listeners[eventName].filter(
      cb => cb !== callback
    );
  }

  /**
   * Выслать событие всем слушателям
   * @param {string} eventName
   * @param {*} data - данные события
   */
  emit(eventName, data = null) {
    if (!this.listeners[eventName]) return;
    
    for (const callback of this.listeners[eventName]) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event ${eventName}:`, error);
      }
    }
  }

  /**
   * Очистить все слушатели события
   * @param {string} eventName
   */
  clear(eventName) {
    if (eventName) {
      delete this.listeners[eventName];
    } else {
      this.listeners = {};
    }
  }
}

// Создаём глобальную экземпляр
const eventSystem = new EventSystem();

// Делаем доступным для browser
window.eventSystem = eventSystem;

// Для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = eventSystem;
}
