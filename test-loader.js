/**
 * Простой тест загрузки модулей
 * Запустите в браузере с ?test=1 в URL
 */

console.clear();
console.log('%c🎮 SPEAK TO - ТЕСТ ЗАГРУЗКИ', 'font-size:18px;color:#c084fc;font-weight:bold;');
console.log('%c════════════════════════════════════════════════════', 'color:#6366f1;');

let testResults = {
  systems: {},
  modules: {},
  success: []
};

// Ждём загрузки всех модулей (2 секунды должно быть достаточно)
setTimeout(() => {
  // Проверяем системы
  console.log('\n%c📦 ПРОВЕРКА МОДУЛЕЙ', 'font-size:14px;color:#a5b4fc;font-weight:bold;');
  
  const checks = [
    { name: 'eventSystem', symbol: '🔔' },
    { name: 'gameConfig', symbol: '⚙️' },
    { name: 'getGameState', symbol: '💾' },
    { name: 'updateGameState', symbol: '💾' },
    { name: 'initI18n', symbol: '🌍' },
    { name: 'getText', symbol: '📝' },
    { name: 'questSystem', symbol: '📋' },
    { name: 'dialogueSystem', symbol: '💬' },
    { name: 'inventorySystem', symbol: '🎒' },
    { name: 'gameRenderer', symbol: '🎨' },
  ];

  for (const check of checks) {
    const exists = typeof window[check.name] !== 'undefined';
    const status = exists ? '%c✓ ОК' : '%c✗ НЕТУ';
    const color = exists ? 'color:#4ade80;font-weight:bold;' : 'color:#ff6b6b;font-weight:bold;';
    
    console.log(
      `${check.symbol} ${check.name.padEnd(25)} ${status}`,
      color
    );
    
    if (exists) {
      testResults.success.push(check.name);
    }
  }

  // Проверяем gameState
  console.log('\n%c💾 СОСТОЯНИЕ ИГРЫ', 'font-size:14px;color:#a5b4fc;font-weight:bold;');
  if (typeof window.getGameState === 'function') {
    const state = window.getGameState();
    console.log('Структура state:', state);
    console.log(`  ├─ player.language: ${state.player.language}`);
    console.log(`  ├─ ui.language: ${state.ui.language}`);
    console.log(`  ├─ quests.active: ${state.quests.active.length} активных`);
    console.log(`  └─ quests.completed: ${state.quests.completed.length} выполнено`);
  }

  // Проверяем i18n
  console.log('\n%c🌍 ИНТЕРНАЦИОНАЛИЗАЦИЯ', 'font-size:14px;color:#a5b4fc;font-weight:bold;');
  if (typeof window.getText === 'function') {
    try {
      const ruText = window.getText?.('ui.welcome', 'ru');
      const ptText = window.getText?.('ui.welcome', 'pt');
      console.log(`  ├─ Russian (ru): ${ruText || '(не загружено)'}`);
      console.log(`  └─ Portuguese (pt): ${ptText || '(не загружено)'}`);
    } catch (e) {
      console.log(`  ⚠️  i18n ещё не инициализирована`);
    }
  }

  // Проверяем события
  console.log('\n%c🔔 СОБЫТИЙНАЯ СИСТЕМА', 'font-size:14px;color:#a5b4fc;font-weight:bold;');
  if (window.eventSystem) {
    let eventsFired = 0;
    
    window.eventSystem.on('test:event', () => {
      eventsFired++;
    });
    
    window.eventSystem.emit('test:event', { test: true });
    
    console.log(`  ├─ События работают: ${eventsFired > 0 ? '✓ ДА' : '✗ НЕТ'}`);
    console.log(`  └─ Слушатели зарегистрированы`);
  }

  // Итоговый результат
  console.log('\n%c════════════════════════════════════════════════════', 'color:#6366f1;');
  const totalChecks = checks.length;
  const successCount = testResults.success.length;
  const percentage = Math.round((successCount / totalChecks) * 100);
  
  if (successCount === totalChecks) {
    console.log(`%c✅ ГОТОВО К ЗАПУСКУ! (${successCount}/${totalChecks})`, 'font-size:16px;color:#4ade80;font-weight:bold;');
  } else if (successCount > totalChecks * 0.7) {
    console.log(`%c⚠️  ЧАСТИЧНАЯ ЗАГРУЗКА (${successCount}/${totalChecks}, ${percentage}%)`, 'font-size:16px;color:#fbbf24;font-weight:bold;');
  } else {
    console.log(`%c❌ ОШИБКА ЗАГРУЗКИ (${successCount}/${totalChecks}, ${percentage}%)`, 'font-size:16px;color:#ff6b6b;font-weight:bold;');
  }

  console.log('%c════════════════════════════════════════════════════\n', 'color:#6366f1;');

}, 2000);
