# SPEAK TO — Новая архитектура (Этап 0 ✅ ЗАВЕРШЁН)

## 📋 Состояние: БАЗОВАЯ АРХИТЕКТУРА ГОТОВА

Этап 0 завершён. Проект полностью переструктурирован с новой архитектурой.

---

## 🏗️ Структура проекта

```
speakto/
├── core/
│   ├── gameState.js       # ЕДИНОЕ СОСТОЯНИЕ ИГРЫ (source of truth)
│   └── events.js          # Система событий (Publisher-Subscriber)
│
├── data/
│   ├── quests.json        # Описание квестов
│   ├── locations.json     # Описание локаций
│   └── items.json         # Описание предметов
│
├── i18n/
│   ├── ru.json           # Русские тексты (лисёнок 🦊)
│   └── pt.json           # Португальские тексты (игрок 🧑)
│
├── systems/
│   ├── questSystem.js     # Логика квестов
│   ├── dialogueSystem.js  # Логика диалогов
│   └── inventorySystem.js # Логика инвентаря
│
├── ui/
│   └── render.js          # Отрисовка на canvas
│
├── utils/
│   └── getText.js         # Получение текстов по ключам
│
├── config/
│   └── gameConfig.js      # Конфигурация игры
│
├── bootstrap.js           # Инициализация игры
├── index.html             # Главный HTML файл
└── rules.md               # Правила архитектуры
```

---

## 🎯 Архитектурные принципы

### 1️⃣ **Один источник правды**
- **gameState.js** — всё состояние игры хранится здесь
- Любые изменения идут только через `updateGameState()`
- Спрашиваешь состояние — вызываешь `getGameState()`

### 2️⃣ **Тексты только на i18n**
- Русский (UI, лисёнок) → `/i18n/ru.json`
- Португальский (игрок) → `/i18n/pt.json`
- В коде используются только КЛЮЧИ: `getText('ui.welcome')`

### 3️⃣ **Данные только в /data**
- Квесты, локации, предметы — описаны как JSON
- Логика берёт данные из /data, никак не хардкодит

### 4️⃣ **События для связи модулей**
- Модули НЕ обращаются друг к другу напрямую
- Используется `eventSystem.emit()` и `eventSystem.on()`

### 5️⃣ **Система = поведение ≠ данные**
- `systems/*.js` — логика (что происходит)
- `data/*.json` — данные (что есть в мире)
- `i18n/*.json` — текст (что говорить)

---

## 📦 Загрузка в браузере

`index.html` загружает модули в правильном порядке:

```html
1. core/events.js          — система событий
2. config/gameConfig.js    — конфигурация
3. core/gameState.js       — состояние
4. utils/getText.js        — i18n функции
5. systems/*.js            — игровые системы
6. ui/render.js            — рендеринг
7. bootstrap.js            — инициализация ← ЗАПУСК!
8. test-loader.js          — тест загрузки (только для отладки)
```

---

## ⚙️ Как работает инициализация

1. **HTML загружает все .js модули**
2. **bootstrap.js запускается последним:**
   - Загружает JSON файлы (`fetch`)
   - Инициализирует i18n (`initI18n()`)
   - Загружает данные в системы
   - Сбрасывает gameState
   - Запускает gameRenderer (`render()`)

```javascript
// bootstrap.js → initGame()
async function initGame() {
  await fetch('./data/quests.json');
  await fetch('./i18n/ru.json');
  await fetch('./i18n/pt.json');
  
  initI18n(ruTexts, ptTexts);
  questSystem.loadQuests(data);
  resetGameState();
  gameRenderer.render(); // ← Canvas рисует!
}
```

---

## 🌍 Пример использования i18n

**ru.json:**
```json
{
  "ui": {
    "welcome": "Добро пожаловать!"
  }
}
```

**В коде:**
```javascript
const text = getText('ui.welcome', 'ru');
// → "Добро пожаловать!"
```

**Без параметра языка:**
```javascript
const text = getText('ui.welcome'); // берёт текущий язык из gameState
```

---

## 💾 Пример использования gameState

**Получить состояние:**
```javascript
const state = getGameState();                    // всё
const lang = getGameState('player.language');   // часть
```

**Обновить состояние:**
```javascript
updateGameState({
  player: {
    inventory: ['axe', 'bucket']
  }
});
// → Автоматически вызовет event 'game:state-changed'
```

**Сбросить на дефолт:**
```javascript
resetGameState();
// → Автоматически вызовет event 'game:state-reset'
```

---

## 🔔 Система событий

**Подписаться на событие:**
```javascript
eventSystem.on('quest:completed', (data) => {
  console.log('Квест выполнен:', data.questId);
});
```

**Выслать событие:**
```javascript
eventSystem.emit('quest:completed', { questId: 'npc_task_1' });
```

**Встроенные события:**
- `'game:initialized'` — игра инициализирована
- `'game:state-changed'` — состояние изменилось
- `'game:state-reset'` — состояние сброшено
- `'quest:activated'` — квест активирован
- `'quest:completed'` — квест выполнен
- `'dialogue:started'` — диалог начался
- `'dialogue:ended'` — диалог закончился

---

## 📝 Добавление нового квеста

1. **Добавить в `data/quests.json`:**
```json
{
  "id": "npc_new_task",
  "title": "new_task",
  "steps": [...]
}
```

2. **Добавить текст в `i18n/ru.json` и `i18n/pt.json`:**
```json
{
  "quests": {
    "new_task": {
      "title": "Новое задание",
      "description": "..."
    }
  }
}
```

3. **В системе:**
```javascript
questSystem.activateQuest('npc_new_task');
```

**Никакой логики в коде!** Просто данные и текст.

---

## 🧪 Тестирование загрузки

Откройте консоль браузера (F12):

```
🎮 SPEAK TO — ТЕСТ ЗАГРУЗКИ
════════════════════════════════════════════════════
📦 ПРОВЕРКА МОДУЛЕЙ
🔔 eventSystem                    ✓ ОК
⚙️ gameConfig                     ✓ ОК
💾 getGameState                   ✓ ОК
💾 updateGameState                ✓ ОК
🌍 initI18n                       ✓ ОК
📝 getText                        ✓ ОК
📋 questSystem                    ✓ ОК
💬 dialogueSystem                 ✓ ОК
🎒 inventorySystem                ✓ ОК
🎨 gameRenderer                   ✓ ОК
════════════════════════════════════════════════════
✅ ГОТОВО К ЗАПУСКУ! (10/10)
```

---

## 🚗 Следующие этапы (Placeholder)

| Этап | Название | Статус |
|------|----------|--------|
| 0 | Архитектура & структура | ✅ DONE |
| 1 | Загрузка мира из "старой версии" | ⏳ TODO |
| 2 | Система распознавания речи | ⏳ TODO |
| 3 | Квесты и NPC | ⏳ TODO |
| 4 | UI и интерфейсы | ⏳ TODO |
| 5 | Баланс и мелочи | ⏳ TODO |

---

## 🐛 Отладка

**Включить debug режим в `gameConfig.js`:**
```javascript
debug: {
  enabled: true,
  showHitboxes: true,
  showGrid: true,
  fps: true,
}
```

**Посмотреть gameState в консоли:**
```javascript
console.log(getGameState());
```

**Посмотреть события:**
```javascript
eventSystem.on('*', (data) => console.log(data));
```

---

## ⚠️ Запомните!

1. **Никогда не пишите тексты в коде** → используйте i18n
2. **Никогда не хардкодьте данные** → используйте /data
3. **Никогда не создавайте глобальные переменные** → используйте gameState
4. **Никогда не обращайтесь между модулями напрямую** → используйте события

---

## 📚 Файлы правил

- `rules.md` — главные правила архитектуры (смотри обязательно!)
- `ARCHITECTURE.md` — расширенная документация (этот файл)

---

✅ **ЭТАП 0 ЗАВЕРШЁН**. Архитектура готова. Можно переходить к Этапу 1.
