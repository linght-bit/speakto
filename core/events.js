class EventSystem {
  constructor() {
    this.listeners = {};
  }

  
  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  
  off(eventName, callback) {
    if (!this.listeners[eventName]) return;
    
    this.listeners[eventName] = this.listeners[eventName].filter(
      cb => cb !== callback
    );
  }

  
  emit(eventName, data = null) {
    if (!this.listeners[eventName]) return;
    
    for (const callback of this.listeners[eventName]) {
      try {
        callback(data);
      } catch (error) {
        console.error(error);
      }
    }
  }

  
  clear(eventName) {
    if (eventName) {
      delete this.listeners[eventName];
    } else {
      this.listeners = {};
    }
  }
}

const eventSystem = new EventSystem();

window.eventSystem = eventSystem;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = eventSystem;
}
