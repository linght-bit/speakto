console.clear();
console.log('%c🎮 SPEAK TO - LOAD TEST', 'font-size:18px;color:#c084fc;font-weight:bold;');
console.log('%c════════════════════════════════════════════════════', 'color:#6366f1;');

let testResults = {
  systems: {},
  modules: {},
  success: []
};

setTimeout(() => {
  console.log('\n%c📦 MODULE CHECK', 'font-size:14px;color:#a5b4fc;font-weight:bold;');

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
    const status = exists ? '%c✓ OK' : '%c✗ MISSING';
    const color = exists ? 'color:#4ade80;font-weight:bold;' : 'color:#ff6b6b;font-weight:bold;';

    console.log(`${check.symbol} ${check.name.padEnd(25)} ${status}`, color);

    if (exists) {
      testResults.success.push(check.name);
    }
  }

  console.log('\n%c💾 GAME STATE', 'font-size:14px;color:#a5b4fc;font-weight:bold;');
  if (typeof window.getGameState === 'function') {
    const state = window.getGameState();
    console.log('State snapshot:', state);
    console.log(`  ├─ player.language: ${state.player.language}`);
    console.log(`  ├─ ui.language: ${state.ui.language}`);
    console.log(`  ├─ quests.active: ${state.quests.active.length}`);
    console.log(`  └─ quests.completed: ${state.quests.completed.length}`);
  }

  console.log('\n%c🌍 I18N CHECK', 'font-size:14px;color:#a5b4fc;font-weight:bold;');
  if (typeof window.getText === 'function') {
    try {
      const ruText = window.getText?.('ui.welcome', 'ru');
      const ptText = window.getText?.('ui.welcome', 'pt');
      console.log(`  ├─ Russian (ru): ${ruText || '(not loaded)'}`);
      console.log(`  └─ Portuguese (pt): ${ptText || '(not loaded)'}`);
    } catch (e) {
      console.log('  ⚠️  i18n is not initialized yet');
    }
  }

  console.log('\n%c🔔 EVENT BUS', 'font-size:14px;color:#a5b4fc;font-weight:bold;');
  if (window.eventSystem) {
    let eventsFired = 0;

    window.eventSystem.on('test:event', () => {
      eventsFired++;
    });

    window.eventSystem.emit('test:event', { test: true });

    console.log(`  ├─ Events working: ${eventsFired > 0 ? '✓ YES' : '✗ NO'}`);
    console.log('  └─ Listeners registered');
  }

  console.log('\n%c════════════════════════════════════════════════════', 'color:#6366f1;');
  const totalChecks = checks.length;
  const successCount = testResults.success.length;
  const percentage = Math.round((successCount / totalChecks) * 100);

  if (successCount === totalChecks) {
    console.log(`%c✅ READY TO RUN (${successCount}/${totalChecks})`, 'font-size:16px;color:#4ade80;font-weight:bold;');
  } else if (successCount > totalChecks * 0.7) {
    console.log(`%c⚠️  PARTIAL LOAD (${successCount}/${totalChecks}, ${percentage}%)`, 'font-size:16px;color:#fbbf24;font-weight:bold;');
  } else {
    console.log(`%c❌ LOAD ERROR (${successCount}/${totalChecks}, ${percentage}%)`, 'font-size:16px;color:#ff6b6b;font-weight:bold;');
  }

  console.log('%c════════════════════════════════════════════════════\n', 'color:#6366f1;');
}, 2000);
