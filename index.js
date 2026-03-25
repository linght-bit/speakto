// index.js — language manager (UI-language / target-language split)

const LANG_UI = {
  ru: RU,
  // future: en: EN, es: ES
};

const LANG_TARGET = {
  'pt-br': PTBR,
  // future: en: EN, es: ES
};

let CURRENT_UI_LANG = 'ru';
let CURRENT_TARGET_LANG = 'pt-br';

function setUILang(lang) {
  if (LANG_UI[lang]) CURRENT_UI_LANG = lang;
  else console.warn('Unknown UI lang', lang);
}

function setTargetLang(lang) {
  if (LANG_TARGET[lang]) CURRENT_TARGET_LANG = lang;
  else console.warn('Unknown target lang', lang);
}

function getUILang() { return CURRENT_UI_LANG; }
function getTargetLang() { return CURRENT_TARGET_LANG; }

function getUI(lang = CURRENT_UI_LANG) {
  return LANG_UI[lang] || LANG_UI['ru'];
}

function getTarget(lang = CURRENT_TARGET_LANG) {
  return LANG_TARGET[lang] || LANG_TARGET['pt-br'];
}

function getInterfaceText(key, lang = CURRENT_UI_LANG) {
  return getUI(lang)?.interface?.[key] || '';
}

function getVerbs(lang = CURRENT_TARGET_LANG) {
  return getTarget(lang)?.verbs || {};
}

function getObjects(lang = CURRENT_TARGET_LANG) {
  return getTarget(lang)?.objects || {};
}

function getKnownWords(lang = CURRENT_TARGET_LANG) {
  const known = new Set(getTarget(lang)?.knownWords || []);
  // add item names from catalog
  for (const itemId of Object.keys(ITEM_CATALOG || {})) {
    const name = getItemName(itemId, lang);
    if (name) known.add(name);
    const aliasList = ITEM_CATALOG[itemId].aliases || [];
    aliasList.forEach(a => known.add(a));
  }
  return Array.from(known);
}

function getQuests(lang = CURRENT_TARGET_LANG) {
  return getTarget(lang)?.quests || {};
}

function getFail(lang = CURRENT_UI_LANG) {
  return getUI(lang)?.fail || {};
}

function getReactions(lang = CURRENT_UI_LANG) {
  return getUI(lang)?.reactions || {};
}

function getItemName(itemId, lang = CURRENT_TARGET_LANG) {
  return getTarget(lang)?.items?.[itemId] || itemId;
}

function getItemLabel(itemId, lang = CURRENT_UI_LANG) {
  return getUI(lang)?.items?.[itemId] || getItemName(itemId, CURRENT_TARGET_LANG) || itemId;
}

function getItemWords(itemId) {
  const words = new Set();
  const pt = getItemName(itemId, 'pt-br');
  if (pt) words.add(pt);
  const ru = getItemLabel(itemId, 'ru');
  if (ru) words.add(ru);
  const meta = ITEM_CATALOG[itemId] || {};
  if (Array.isArray(meta.aliases)) {
    meta.aliases.forEach(a => words.add(a));
  }
  return Array.from(words);
}

function getL2Ptbr() {
  return PTBR?.L2_PTBR || L2_PTBR;
}

function getL2Rus() {
  return RU?.L2_RUS || L2_RUS;
}

function getL2NpcLines(lang = CURRENT_TARGET_LANG) {
  return getL2Ptbr()?.npc_lines || {};
}

function getL2PlayerIntro() {
  return { ru: getL2Rus()?.player_intro || [], pt: getL2Ptbr()?.player_intro || [] };
}

function getL2PastVerbs() {
  return { ru: getL2Rus()?.past_verbs || {}, pt: getL2Ptbr()?.past_verbs || {} };
}

function getL2FoxIntro(lang = CURRENT_UI_LANG) {
  return getL2Rus()?.fox_intro || '';
}

function getL2FoxIntroPhrase(lang = CURRENT_UI_LANG) {
  return getL2Rus()?.fox_intro_phrase || {};
}

function getL2FoxSpy(lang = CURRENT_UI_LANG) {
  return getL2Rus()?.fox_spy || '';
}

function getL2FoxSayThis(lang = CURRENT_UI_LANG) {
  return getL2Rus()?.fox_say_this || '';
}

function getL2FoxAxeHint(lang = CURRENT_UI_LANG) {
  return getL2Rus()?.fox_axe_hint || '';
}

function getL2FoxReturn(lang = CURRENT_UI_LANG) {
  return getL2Rus()?.fox_return || '';
}

function getL2Tasks(lang = CURRENT_UI_LANG) {
  return getL2Rus()?.tasks || {};
}

function getL2Hints(lang = CURRENT_UI_LANG) {
  return getL2Rus()?.hints || {};
}
