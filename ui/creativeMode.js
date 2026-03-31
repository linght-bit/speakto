/**
 * /ui/creativeMode.js
 * ВРЕМЕННЫЙ ТВОРЧЕСКИЙ РЕЖИМ ДЛЯ РЕДАКТИРОВАНИЯ КАРТЫ
 * Вся логика creative-режима живет только здесь.
 */

class CreativeModeController {
  constructor() {
    this.active = false;
    this.selectedTool = 'wall';
    this.toolButtons = new Map();
    this.compactToolButtons = new Map();
    this.fileInput = null;
    this.panel = null;
    this.toggleBtn = null;
    this.collapseBtn = null;
    this.scrollWrap = null;
    this.actionsWrap = null;
    this.hintWrap = null;
    this.compactWrap = null;
    this.bound = false;
    this.collapsed = false;
    this.dragState = null;
    this.idCounter = 1;
    this._patchedRenderer = false;
    this._tickHandle = null;

    this.toolGroups = [
      {
        id: 'structure',
        titleKey: 'ui.creative_group_structure',
        tools: [
          'wall', 'window_v', 'window_h', 'viewport_wide',
          'door_v', 'door_h', 'airlock_door_v', 'airlock_door_h',
          'bulkhead_heavy_v', 'bulkhead_heavy_h',
        ],
      },
      {
        id: 'tech',
        titleKey: 'ui.creative_group_tech',
        tools: [
          'tech_block', 'pipe_v', 'pipe_h', 'pipe_corner', 'cable_tray',
          'console', 'terminal', 'reactor_core', 'battery_rack', 'engine_nozzle',
        ],
      },
      {
        id: 'props',
        titleKey: 'ui.creative_group_props',
        tools: [
          'crate_small', 'crate_large', 'medical_pod', 'sleep_pod',
          'grate_floor', 'warning_stripe', 'signage',
        ],
      },
      {
        id: 'lights',
        titleKey: 'ui.creative_group_lights',
        tools: [
          'light_panel_white', 'light_panel_red', 'beacon',
        ],
      },
      {
        id: 'aggregates',
        titleKey: 'ui.creative_group_aggregates',
        tools: [
          'agg_reactor_cluster', 'agg_engine_block', 'agg_life_support',
          'agg_hyperdrive', 'agg_coolant_matrix',
        ],
      },
      {
        id: 'chests',
        titleKey: 'ui.creative_group_chests',
        tools: [
          'chest_red', 'chest_blue', 'chest_green', 'chest_yellow', 'chest_white',
        ],
      },
      {
        id: 'doors_color',
        titleKey: 'ui.creative_group_color_doors',
        tools: [
          'door_red', 'door_blue', 'door_green', 'door_yellow', 'door_white',
        ],
      },
    ];

    this.toolLabels = {
      wall: 'W',
      window_v: 'WV',
      window_h: 'WH',
      viewport_wide: 'VP',
      door_v: 'DV',
      door_h: 'DH',
      airlock_door_v: 'AV',
      airlock_door_h: 'AH',
      bulkhead_heavy_v: 'BV',
      bulkhead_heavy_h: 'BH',
      tech_block: 'TB',
      pipe_v: 'PV',
      pipe_h: 'PH',
      pipe_corner: 'PC',
      cable_tray: 'CT',
      console: 'CS',
      terminal: 'TM',
      reactor_core: 'RC',
      battery_rack: 'BR',
      engine_nozzle: 'EN',
      crate_small: 'C1',
      crate_large: 'C2',
      medical_pod: 'MP',
      sleep_pod: 'SP',
      grate_floor: 'GF',
      warning_stripe: 'WS',
      signage: 'SG',
      light_panel_white: 'LW',
      light_panel_red: 'LR',
      beacon: 'BC',
      agg_reactor_cluster: 'AR',
      agg_engine_block: 'AE',
      agg_life_support: 'AL',
      agg_hyperdrive: 'AH',
      agg_coolant_matrix: 'AC',
      chest_red: 'CR',
      chest_blue: 'CB',
      chest_green: 'CG',
      chest_yellow: 'CY',
      chest_white: 'CW',
      door_red: 'DR',
      door_blue: 'DB',
      door_green: 'DG',
      door_yellow: 'DY',
      door_white: 'DW',
    };

    this.toolTooltipRu = {
      wall: 'Стена',
      window_v: 'Окно вертикальное',
      window_h: 'Окно горизонтальное',
      viewport_wide: 'Большой иллюминатор',
      door_v: 'Дверь вертикальная',
      door_h: 'Дверь горизонтальная',
      airlock_door_v: 'Шлюзовая дверь вертикальная',
      airlock_door_h: 'Шлюзовая дверь горизонтальная',
      bulkhead_heavy_v: 'Усиленная переборка вертикальная',
      bulkhead_heavy_h: 'Усиленная переборка горизонтальная',
      tech_block: 'Технический блок',
      pipe_v: 'Труба вертикальная',
      pipe_h: 'Труба горизонтальная',
      pipe_corner: 'Труба угловая',
      cable_tray: 'Кабельный лоток',
      console: 'Консоль',
      terminal: 'Терминал',
      reactor_core: 'Ядро реактора',
      battery_rack: 'Стеллаж батарей',
      engine_nozzle: 'Сопло двигателя',
      crate_small: 'Ящик малый',
      crate_large: 'Ящик большой',
      medical_pod: 'Медицинская капсула',
      sleep_pod: 'Спальная капсула',
      grate_floor: 'Решетчатый пол',
      warning_stripe: 'Сигнальная разметка',
      signage: 'Табличка',
      light_panel_white: 'Световая панель белая',
      light_panel_red: 'Световая панель красная',
      beacon: 'Маяк',
      agg_reactor_cluster: 'Агрегат: реакторный кластер',
      agg_engine_block: 'Агрегат: моторный блок',
      agg_life_support: 'Агрегат: система жизнеобеспечения',
      agg_hyperdrive: 'Агрегат: гиперпривод',
      agg_coolant_matrix: 'Агрегат: матрица охлаждения',
      chest_red: 'Сундук красный',
      chest_blue: 'Сундук синий',
      chest_green: 'Сундук зелёный',
      chest_yellow: 'Сундук жёлтый',
      chest_white: 'Сундук белый',
      door_red: 'Дверь красная',
      door_blue: 'Дверь синяя',
      door_green: 'Дверь зелёная',
      door_yellow: 'Дверь жёлтая',
      door_white: 'Дверь белая',
    };
  }

  _t(key, lang = null) {
    const text = window.getText?.(key, lang);
    return (text && text !== key) ? text : key;
  }

  init() {
    if (this.bound) return;
    this.bound = true;
    this._patchRenderer();
    this._createUI();
    this._bindCanvasEvents();
    this._startTick();
  }

  _patchRenderer() {
    const renderer = window.gameRenderer;
    if (!renderer || this._patchedRenderer) return;

    const originalMapObject = renderer.renderMapObject.bind(renderer);
    renderer.renderMapObject = (obj) => {
      if (!obj || !renderer.ctx) return originalMapObject(obj);

      const CELL = 20;
      const w = Math.round((obj.width || 20) / CELL) * CELL;
      const h = Math.round((obj.height || 20) / CELL) * CELL;
      const left = Math.round((obj.x - w / 2) / CELL) * CELL;
      const top = Math.round((obj.y - h / 2) / CELL) * CELL;
      const gameState = window.getGameState?.();

      if (obj.objectId === 'wall') {
        renderer._drawWallCell?.(left, top, CELL);
        return;
      }

      if (obj.objectId === 'door_inner_v' || obj.objectId === 'door_inner_h') {
        const isOpen = !!gameState?.world?.flags?.[`door_open_${obj.id}`];
        const axis = obj.objectId === 'door_inner_h' ? 'horizontal' : 'vertical';
        this._drawDoor(renderer.ctx, left, top, axis, isOpen, false, null);
        return;
      }

      if (obj.objectId === 'airlock_door_v' || obj.objectId === 'airlock_door_h') {
        const isOpen = !!gameState?.world?.flags?.[`door_open_${obj.id}`];
        const axis = obj.objectId === 'airlock_door_h' ? 'horizontal' : 'vertical';
        this._drawDoor(renderer.ctx, left, top, axis, isOpen, true, null);
        return;
      }

      if (/^door_color_/.test(obj.objectId)) {
        const isOpen = !!gameState?.world?.flags?.[`door_open_${obj.id}`];
        const palette = obj.objectId.replace('door_color_', '');
        this._drawDoor(renderer.ctx, left, top, 'vertical', isOpen, false, palette);
        return;
      }

      if (this._isCreativeCustomObject(obj.objectId)) {
        this._drawCreativeObject(renderer.ctx, obj.objectId, left, top, w, h);
        return;
      }

      return originalMapObject(obj);
    };

    const originalRenderWorld = renderer.renderWorld.bind(renderer);
    renderer.renderWorld = () => {
      originalRenderWorld();
      if (this._canEdit()) {
        this._drawCreativeGrid(renderer.ctx, renderer._visibleCellRange(), window.pathfindingSystem);
      }
    };

    this._patchedRenderer = true;
  }

  _isCreativeCustomObject(objectId) {
    return [
      'tech_block', 'pipe_v', 'pipe_h', 'pipe_corner', 'cable_tray',
      'console', 'terminal', 'reactor_core', 'battery_rack', 'engine_nozzle',
      'bulkhead_heavy_v', 'bulkhead_heavy_h', 'crate_small', 'crate_large',
      'medical_pod', 'sleep_pod', 'grate_floor', 'warning_stripe', 'signage',
      'light_panel_white', 'light_panel_red', 'beacon', 'viewport_wide',
      'window_v_small', 'window_h_small',
      'agg_reactor_cluster', 'agg_engine_block', 'agg_life_support',
      'agg_hyperdrive', 'agg_coolant_matrix',
      'chest_red', 'chest_blue', 'chest_green', 'chest_yellow', 'chest_white'
    ].includes(objectId);
  }

  _drawCreativeGrid(ctx, range, pf) {
    if (!ctx || !range || !pf) return;
    const CELL = 20;
    ctx.save();
    ctx.strokeStyle = 'rgba(173, 255, 47, 0.30)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);

    for (let gx = range.x0; gx <= range.x1 + 1; gx++) {
      ctx.beginPath();
      ctx.moveTo(gx * CELL, range.y0 * CELL);
      ctx.lineTo(gx * CELL, (range.y1 + 1) * CELL);
      ctx.stroke();
    }
    for (let gy = range.y0; gy <= range.y1 + 1; gy++) {
      ctx.beginPath();
      ctx.moveTo(range.x0 * CELL, gy * CELL);
      ctx.lineTo((range.x1 + 1) * CELL, gy * CELL);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawDoor(ctx, left, top, axis, isOpen, heavy, palette) {
    const palettes = {
      red: { base: '#8f4c4c', closed: '#4a2323', border: '#ffd0d0' },
      blue: { base: '#4a6694', closed: '#1f2f4b', border: '#cde2ff' },
      green: { base: '#4e8963', closed: '#224432', border: '#d2ffe0' },
      yellow: { base: '#9e8a4b', closed: '#4b421f', border: '#fff0c8' },
      white: { base: '#8a9099', closed: '#3f434a', border: '#eef4ff' },
    };
    const tone = palette && palettes[palette] ? palettes[palette] : null;
    ctx.fillStyle = tone ? tone.base : (heavy ? '#5f6f80' : '#4c5d70');
    ctx.fillRect(left + 2, top + 2, 16, 16);

    if (isOpen) {
      ctx.fillStyle = 'rgba(150, 220, 255, 0.35)';
      if (axis === 'vertical') ctx.fillRect(left + 8, top + 3, 4, 14);
      else ctx.fillRect(left + 3, top + 8, 14, 4);
    } else {
      ctx.fillStyle = tone ? tone.closed : (heavy ? '#273442' : '#1f2b37');
      if (axis === 'vertical') ctx.fillRect(left + 7, top + 2, 6, 16);
      else ctx.fillRect(left + 2, top + 7, 16, 6);
    }

    ctx.strokeStyle = tone ? tone.border : (heavy ? '#d9e4ef' : '#b8ccdf');
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 2.5, top + 2.5, 15, 15);
  }

  _drawCreativeObject(ctx, id, left, top, w, h) {
    const draw = (fill, stroke = null) => {
      ctx.fillStyle = fill;
      ctx.fillRect(left, top, w, h);
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
      }
    };

    switch (id) {
      case 'tech_block':
        draw('#728292', '#526273');
        ctx.fillStyle = 'rgba(180, 210, 240, 0.22)';
        ctx.fillRect(left + 3, top + 3, w - 6, 4);
        break;
      case 'pipe_v':
        draw('rgba(0,0,0,0)');
        ctx.fillStyle = '#7f92a8';
        ctx.fillRect(left + 7, top + 1, 6, h - 2);
        ctx.strokeStyle = '#b8c9db';
        ctx.strokeRect(left + 7.5, top + 1.5, 5, h - 3);
        break;
      case 'pipe_h':
        draw('rgba(0,0,0,0)');
        ctx.fillStyle = '#7f92a8';
        ctx.fillRect(left + 1, top + 7, w - 2, 6);
        ctx.strokeStyle = '#b8c9db';
        ctx.strokeRect(left + 1.5, top + 7.5, w - 3, 5);
        break;
      case 'pipe_corner':
        draw('rgba(0,0,0,0)');
        ctx.fillStyle = '#7f92a8';
        ctx.fillRect(left + 7, top + 7, 6, 12);
        ctx.fillRect(left + 7, top + 7, 12, 6);
        break;
      case 'cable_tray':
        draw('#3f4854', '#6b7a89');
        ctx.fillStyle = '#ffcc66';
        ctx.fillRect(left + 3, top + 9, w - 6, 2);
        break;
      case 'console':
        draw('#5e7488', '#9cb4c8');
        ctx.fillStyle = '#86f7ff';
        ctx.fillRect(left + 4, top + 5, w - 8, 6);
        break;
      case 'terminal':
        draw('#54687a', '#8ea7bc');
        ctx.fillStyle = '#9dff9f';
        ctx.fillRect(left + 5, top + 4, 10, 8);
        break;
      case 'reactor_core':
        draw('#3a4a5b', '#95a8bc');
        ctx.fillStyle = '#7fd8ff';
        ctx.beginPath();
        ctx.arc(left + 10, top + 10, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'battery_rack':
        draw('#596c7f', '#9cb0c4');
        ctx.fillStyle = '#d4ff8a';
        ctx.fillRect(left + 4, top + 4, 12, 3);
        ctx.fillRect(left + 4, top + 9, 12, 3);
        break;
      case 'engine_nozzle':
        draw('#455869', '#96a9bc');
        ctx.fillStyle = '#9ed6ff';
        ctx.fillRect(left + 7, top + 3, 6, 14);
        break;
      case 'bulkhead_heavy_v':
        draw('#7f909f', '#d2dbe4');
        ctx.fillStyle = '#5c6d7b';
        ctx.fillRect(left + 8, top + 2, 4, 16);
        break;
      case 'bulkhead_heavy_h':
        draw('#7f909f', '#d2dbe4');
        ctx.fillStyle = '#5c6d7b';
        ctx.fillRect(left + 2, top + 8, 16, 4);
        break;
      case 'crate_small':
        draw('#8b6a46', '#d2a67a');
        break;
      case 'crate_large':
        draw('#7b5b3d', '#c99a6a');
        ctx.fillStyle = '#a47950';
        ctx.fillRect(left + 2, top + 8, 16, 2);
        break;
      case 'medical_pod':
        draw('#7aa4bd', '#d5edff');
        ctx.fillStyle = '#c6f1ff';
        ctx.fillRect(left + 4, top + 4, 12, 8);
        break;
      case 'sleep_pod':
        draw('#6f879c', '#bfd6eb');
        ctx.fillStyle = '#9fc4df';
        ctx.fillRect(left + 3, top + 5, 14, 7);
        break;
      case 'grate_floor':
        draw('#5f6874', '#9ea8b5');
        ctx.strokeStyle = '#798491';
        for (let x = left + 3; x < left + 18; x += 4) {
          ctx.beginPath();
          ctx.moveTo(x, top + 2);
          ctx.lineTo(x, top + 18);
          ctx.stroke();
        }
        break;
      case 'warning_stripe':
        draw('#3d4045', '#8a8f95');
        ctx.fillStyle = '#ffd34d';
        for (let x = -6; x < 22; x += 6) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(left, top, 20, 20);
          ctx.clip();
          ctx.translate(left + x, top);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(0, 0, 3, 28);
          ctx.restore();
        }
        break;
      case 'signage':
        draw('#2f4f6d', '#8fc0e8');
        ctx.fillStyle = '#dff4ff';
        ctx.fillRect(left + 4, top + 8, 12, 2);
        break;
      case 'light_panel_white':
        draw('#7b8997', '#d7e0ea');
        ctx.fillStyle = '#f3fbff';
        ctx.fillRect(left + 5, top + 5, 10, 10);
        break;
      case 'light_panel_red':
        draw('#7b8997', '#d7e0ea');
        ctx.fillStyle = '#ff8f8f';
        ctx.fillRect(left + 5, top + 5, 10, 10);
        break;
      case 'beacon':
        draw('#4d5966', '#9eaab6');
        ctx.fillStyle = '#ff6060';
        ctx.beginPath();
        ctx.arc(left + 10, top + 10, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'agg_reactor_cluster':
        draw('#3f4a58', '#99adc4');
        ctx.fillStyle = '#7fd8ff';
        ctx.beginPath();
        ctx.arc(left + Math.floor(w * 0.5), top + Math.floor(h * 0.5), Math.floor(Math.min(w, h) * 0.25), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 240, 255, 0.45)';
        ctx.strokeRect(left + 4.5, top + 4.5, Math.max(0, w - 9), Math.max(0, h - 9));
        break;
      case 'agg_engine_block':
        draw('#4a5666', '#a8bccf');
        ctx.fillStyle = '#9ed6ff';
        ctx.fillRect(left + Math.floor(w * 0.4), top + 4, Math.max(6, Math.floor(w * 0.2)), Math.max(10, h - 8));
        ctx.fillStyle = '#6f8194';
        ctx.fillRect(left + 4, top + Math.floor(h * 0.25), Math.max(0, w - 8), Math.max(4, Math.floor(h * 0.2)));
        break;
      case 'agg_life_support':
        draw('#5a6e7d', '#c2d8eb');
        ctx.fillStyle = '#baffc7';
        ctx.fillRect(left + 4, top + 4, Math.max(6, w - 8), 6);
        ctx.fillStyle = '#8ec3ff';
        ctx.fillRect(left + 4, top + 12, Math.max(6, w - 8), 5);
        ctx.fillStyle = '#d7e6f3';
        ctx.fillRect(left + 4, top + 20, Math.max(6, w - 8), 4);
        break;
      case 'agg_hyperdrive':
        draw('#3f4958', '#b7cce0');
        ctx.fillStyle = '#b48dff';
        ctx.beginPath();
        ctx.moveTo(left + Math.floor(w * 0.5), top + 3);
        ctx.lineTo(left + w - 3, top + Math.floor(h * 0.5));
        ctx.lineTo(left + Math.floor(w * 0.5), top + h - 3);
        ctx.lineTo(left + 3, top + Math.floor(h * 0.5));
        ctx.closePath();
        ctx.fill();
        break;
      case 'agg_coolant_matrix':
        draw('#475768', '#adc2d6');
        ctx.strokeStyle = '#9ad6ff';
        ctx.lineWidth = 1;
        for (let y = top + 4; y < top + h - 2; y += 6) {
          ctx.beginPath();
          ctx.moveTo(left + 3, y);
          ctx.lineTo(left + w - 3, y);
          ctx.stroke();
        }
        for (let x = left + 4; x < left + w - 2; x += 6) {
          ctx.beginPath();
          ctx.moveTo(x, top + 3);
          ctx.lineTo(x, top + h - 3);
          ctx.stroke();
        }
        break;
      case 'chest_red':
        draw('#8f4343', '#ffd0d0');
        ctx.fillStyle = '#5a1f1f';
        ctx.fillRect(left + 2, top + 8, w - 4, 3);
        break;
      case 'chest_blue':
        draw('#3f5f8e', '#d6e5ff');
        ctx.fillStyle = '#1f3455';
        ctx.fillRect(left + 2, top + 8, w - 4, 3);
        break;
      case 'chest_green':
        draw('#4b805a', '#d9ffe2');
        ctx.fillStyle = '#254631';
        ctx.fillRect(left + 2, top + 8, w - 4, 3);
        break;
      case 'chest_yellow':
        draw('#98854b', '#fff0c6');
        ctx.fillStyle = '#51451e';
        ctx.fillRect(left + 2, top + 8, w - 4, 3);
        break;
      case 'chest_white':
        draw('#a5adb8', '#f1f6ff');
        ctx.fillStyle = '#5d6570';
        ctx.fillRect(left + 2, top + 8, w - 4, 3);
        break;
      case 'viewport_wide':
        draw('rgba(90,200,255,0.30)', '#55ccff');
        ctx.fillStyle = 'rgba(180,240,255,0.35)';
        ctx.fillRect(left + 2, top + 2, w - 4, 4);
        break;
      case 'window_v_small':
      case 'window_h_small':
        draw('rgba(90,200,255,0.30)', '#55ccff');
        break;
      default:
        draw('#556270', '#a6b5c3');
        break;
    }
  }

  _createUI() {
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.left = '12px';
    panel.style.top = '74px';
    panel.style.display = 'none';
    panel.style.padding = '10px';
    panel.style.borderRadius = '10px';
    panel.style.background = 'rgba(8, 12, 16, 0.94)';
    panel.style.border = '1px solid rgba(120, 200, 255, 0.35)';
    panel.style.boxShadow = '0 8px 22px rgba(0, 0, 0, 0.35)';
    panel.style.zIndex = '1600';
    panel.style.pointerEvents = 'auto';
    panel.style.width = '640px';
    panel.style.maxWidth = 'calc(100vw - 24px)';
    panel.style.fontFamily = 'Arial, sans-serif';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '8px';
    header.style.cursor = 'move';
    header.style.userSelect = 'none';

    const title = document.createElement('strong');
    title.style.color = '#d7ebff';
    title.style.fontSize = '13px';
    title.textContent = this._t('ui.creative_title');

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '6px';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.style.border = '1px solid #85d1ff';
    collapseBtn.style.borderRadius = '6px';
    collapseBtn.style.padding = '4px 8px';
    collapseBtn.style.cursor = 'pointer';
    collapseBtn.style.fontSize = '12px';
    collapseBtn.title = this._t('ui.creative_collapse_toggle', 'ru');
    collapseBtn.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this._refreshUI();
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.style.border = '1px solid #85d1ff';
    toggleBtn.style.borderRadius = '6px';
    toggleBtn.style.padding = '4px 10px';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.fontSize = '12px';
    toggleBtn.addEventListener('click', () => {
      this.active = !this.active;
      this._refreshUI();
    });

    controls.appendChild(collapseBtn);
    controls.appendChild(toggleBtn);
    header.appendChild(title);
    header.appendChild(controls);

    const scroll = document.createElement('div');
    scroll.style.maxHeight = '300px';
    scroll.style.overflowY = 'auto';
    scroll.style.paddingRight = '4px';
    scroll.style.borderTop = '1px solid rgba(140,170,195,0.3)';
    scroll.style.borderBottom = '1px solid rgba(140,170,195,0.3)';

    const makeToolButton = (toolId, targetMap, compact = false) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.toolId = toolId;
      btn.style.border = '1px solid #53697d';
      btn.style.borderRadius = '4px';
      btn.style.width = compact ? '32px' : '36px';
      btn.style.height = compact ? '32px' : '36px';
      btn.style.padding = '0';
      btn.style.cursor = 'pointer';
      btn.style.background = '#1d2731';
      btn.title = this._toolTitleRu(toolId);

      const swatch = this._makeToolSwatch(toolId);
      btn.appendChild(swatch);

      btn.addEventListener('click', () => {
        this.selectedTool = toolId;
        this._refreshToolButtons();
      });

      targetMap.set(toolId, btn);
      return btn;
    };

    for (const group of this.toolGroups) {
      const gTitle = document.createElement('div');
      gTitle.textContent = this._t(group.titleKey);
      gTitle.style.color = '#b8d7f0';
      gTitle.style.fontSize = '11px';
      gTitle.style.fontWeight = '700';
      gTitle.style.margin = '10px 2px 6px';
      scroll.appendChild(gTitle);

      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(10, 1fr)';
      grid.style.gap = '6px';

      for (const toolId of group.tools) {
        const btn = makeToolButton(toolId, this.toolButtons, false);
        grid.appendChild(btn);
      }

      scroll.appendChild(grid);
    }

    const compact = document.createElement('div');
    compact.style.display = 'none';
    compact.style.padding = '6px 0 2px';
    compact.style.borderTop = '1px solid rgba(140,170,195,0.3)';
    compact.style.borderBottom = '1px solid rgba(140,170,195,0.3)';

    const compactRow = document.createElement('div');
    compactRow.style.display = 'flex';
    compactRow.style.flexWrap = 'nowrap';
    compactRow.style.gap = '6px';
    compactRow.style.overflowX = 'auto';
    compactRow.style.paddingBottom = '4px';

    const allTools = [...new Set(this.toolGroups.flatMap(group => group.tools))];
    for (const toolId of allTools) {
      compactRow.appendChild(makeToolButton(toolId, this.compactToolButtons, true));
    }

    const compactErase = document.createElement('button');
    compactErase.type = 'button';
    compactErase.textContent = this._t('ui.creative_erase');
    compactErase.style.border = '1px solid #8d4d4d';
    compactErase.style.borderRadius = '4px';
    compactErase.style.padding = '0 8px';
    compactErase.style.height = '32px';
    compactErase.style.background = '#5a2424';
    compactErase.style.color = '#fff';
    compactErase.style.cursor = 'pointer';
    compactErase.addEventListener('click', () => {
      this.selectedTool = 'erase';
      this._refreshToolButtons();
    });
    compactRow.appendChild(compactErase);

    compact.appendChild(compactRow);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.marginTop = '8px';

    const eraseBtn = document.createElement('button');
    eraseBtn.type = 'button';
    eraseBtn.textContent = this._t('ui.creative_erase');
    eraseBtn.style.cssText = this._actionBtnCss('#6a2b2b');
    eraseBtn.addEventListener('click', () => {
      this.selectedTool = 'erase';
      this._refreshToolButtons();
    });

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = this._t('ui.creative_export');
    exportBtn.style.cssText = this._actionBtnCss('#27435c');
    exportBtn.addEventListener('click', () => this.exportMap());

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.textContent = this._t('ui.creative_import');
    importBtn.style.cssText = this._actionBtnCss('#3f355c');
    importBtn.addEventListener('click', () => this.fileInput?.click());

    actions.appendChild(eraseBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);

    const hint = document.createElement('div');
    hint.style.marginTop = '8px';
    hint.style.fontSize = '11px';
    hint.style.color = '#9bb5c8';
    hint.textContent = this._t('ui.creative_hint');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      this.importMap(text);
      fileInput.value = '';
    });

    panel.appendChild(header);
    panel.appendChild(scroll);
    panel.appendChild(compact);
    panel.appendChild(actions);
    panel.appendChild(hint);
    panel.appendChild(fileInput);
    document.body.appendChild(panel);

    this.panel = panel;
    this.toggleBtn = toggleBtn;
    this.collapseBtn = collapseBtn;
    this.scrollWrap = scroll;
    this.actionsWrap = actions;
    this.hintWrap = hint;
    this.compactWrap = compact;
    this.fileInput = fileInput;
    this._bindPanelDragging(header, panel, controls);
    this._refreshUI();
  }

  _bindPanelDragging(handle, panel, controls) {
    if (!handle || !panel) return;
    const isControlClick = (target) => controls?.contains(target);

    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (isControlClick(e.target)) return;
      const rect = panel.getBoundingClientRect();
      this.dragState = {
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
      };
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragState || !this.panel) return;
      const panelRect = this.panel.getBoundingClientRect();
      const maxX = Math.max(8, window.innerWidth - panelRect.width - 8);
      const maxY = Math.max(8, window.innerHeight - panelRect.height - 8);
      const nextLeft = Math.min(Math.max(8, e.clientX - this.dragState.dx), maxX);
      const nextTop = Math.min(Math.max(8, e.clientY - this.dragState.dy), maxY);
      this.panel.style.left = `${Math.round(nextLeft)}px`;
      this.panel.style.top = `${Math.round(nextTop)}px`;
    });

    window.addEventListener('mouseup', () => {
      this.dragState = null;
    });
  }

  _toolTitleRu(toolId) {
    const key = `ui.creative_tool_${toolId}`;
    const fromRu = this._t(key, 'ru');
    if (fromRu !== key) return fromRu;
    return this.toolTooltipRu[toolId] || toolId;
  }

  _makeToolSwatch(toolId) {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    canvas.style.width = '20px';
    canvas.style.height = '20px';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Примитивная текстура 1x1 блока
    this._drawCreativeObject(ctx, this._toolToPreviewObjectId(toolId), 0, 0, 20, 20);

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.toolLabels[toolId] || '?', 10, 18);
    ctx.textAlign = 'left';

    return canvas;
  }

  _toolToPreviewObjectId(toolId) {
    if (toolId === 'wall') return 'wall';
    if (toolId === 'window_v') return 'window_v_small';
    if (toolId === 'window_h') return 'window_h_small';
    if (toolId === 'door_v') return 'door_inner_v';
    if (toolId === 'door_h') return 'door_inner_h';
    if (toolId === 'airlock_door_v') return 'airlock_door_v';
    if (toolId === 'airlock_door_h') return 'airlock_door_h';
    if (toolId.startsWith('door_') && !toolId.startsWith('door_h') && !toolId.startsWith('door_v')) {
      return 'door_color_white';
    }
    return toolId;
  }

  _actionBtnCss(bg) {
    return [
      'border:1px solid #7aa8c8',
      'border-radius:6px',
      'padding:6px 10px',
      'cursor:pointer',
      'font-size:12px',
      `background:${bg}`,
      'color:#ffffff',
    ].join(';');
  }

  _startTick() {
    const tick = () => {
      this._syncVisibility();
      this._tickHandle = window.requestAnimationFrame(tick);
    };
    tick();
  }

  _syncVisibility() {
    const renderer = window.gameRenderer;
    const devMode = !!renderer?.devMode;
    if (!devMode && this.active) this.active = false;
    if (this.panel) this.panel.style.display = devMode ? 'block' : 'none';
    this._refreshUI();
  }

  _refreshUI() {
    if (!this.toggleBtn) return;
    this.toggleBtn.textContent = `${this._t('ui.creative_toggle')}: ${this.active ? this._t('ui.creative_on') : this._t('ui.creative_off')}`;
    this.toggleBtn.style.background = this.active ? '#ff8c42' : '#2d3946';
    this.toggleBtn.style.color = '#ffffff';

    if (this.collapseBtn) {
      this.collapseBtn.textContent = this.collapsed ? '▸' : '▾';
      this.collapseBtn.style.background = '#203344';
      this.collapseBtn.style.color = '#d9f1ff';
    }

    if (this.scrollWrap) this.scrollWrap.style.display = this.collapsed ? 'none' : 'block';
    if (this.actionsWrap) this.actionsWrap.style.display = this.collapsed ? 'none' : 'flex';
    if (this.hintWrap) this.hintWrap.style.display = this.collapsed ? 'none' : 'block';
    if (this.compactWrap) this.compactWrap.style.display = this.collapsed ? 'block' : 'none';
    if (this.panel) this.panel.style.width = this.collapsed ? '520px' : '640px';

    this._refreshToolButtons();
  }

  _refreshToolButtons() {
    const paint = (buttons) => {
      for (const [toolId, btn] of buttons.entries()) {
        const active = this.active && this.selectedTool === toolId;
        btn.style.background = active ? '#3d7ea6' : '#1d2731';
        btn.style.borderColor = active ? '#cdefff' : '#53697d';
        btn.style.opacity = this.active ? '1' : '0.5';
        btn.disabled = !this.active;
      }
    };

    paint(this.toolButtons);
    paint(this.compactToolButtons);

    if (this.collapseBtn) {
      this.collapseBtn.disabled = false;
    }
  }

  _bindCanvasEvents() {
    const canvas = window.gameRenderer?.canvas;
    if (!canvas) return;

    canvas.addEventListener('click', (e) => {
      if (!this._canEdit()) return;
      if (this._isClickOnRendererButtons(e)) return;
      if (this.selectedTool === 'erase') this._eraseAtEvent(e);
      else this._placeAtEvent(e);
    });

    canvas.addEventListener('contextmenu', (e) => {
      if (!this._canEdit()) return;
      e.preventDefault();
      if (this._isClickOnRendererButtons(e)) return;
      this._eraseAtEvent(e);
    });
  }

  _isClickOnRendererButtons(e) {
    const renderer = window.gameRenderer;
    const canvas = renderer?.canvas;
    if (!renderer || !canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * ((renderer._logW || rect.width) / rect.width);
    const sy = (e.clientY - rect.top) * ((renderer._logH || rect.height) / rect.height);
    const rects = [renderer.micButtonRect, renderer.devButtonRect].filter(Boolean);
    return rects.some(r => sx >= r.x && sx <= r.x + r.width && sy >= r.y && sy <= r.y + r.height);
  }

  _canEdit() {
    return !!(window.gameRenderer?.devMode && this.active);
  }

  _eventToWorldCell(e) {
    const renderer = window.gameRenderer;
    const canvas = renderer?.canvas;
    if (!renderer || !canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const screenX = (e.clientX - rect.left) * ((renderer._logW || rect.width) / rect.width);
    const screenY = (e.clientY - rect.top) * ((renderer._logH || rect.height) / rect.height);
    const zoom = renderer._zoom || 1;
    const worldX = (screenX - (renderer._camOffX || 0)) / zoom;
    const worldY = (screenY - (renderer._camOffY || 0)) / zoom;

    return {
      gx: Math.floor(worldX / 20),
      gy: Math.floor(worldY / 20),
    };
  }

  _placeAtEvent(e) {
    const cell = this._eventToWorldCell(e);
    if (!cell) return;

    const gs = window.getGameState?.();
    const pf = window.pathfindingSystem;
    if (!gs || !pf) return;

    const stateType = pf._classifyHullCell(cell.gx, cell.gy);
    if (stateType === 'space') return;

    // Если ставим стену на удалённую клетку внешней стены — возвращаем её.
    if (this.selectedTool === 'wall' && stateType === 'wall') {
      const removed = new Set(gs.world?.flags?.creative_removed_walls || []);
      removed.delete(`${cell.gx},${cell.gy}`);
      window.updateGameState?.({ world: { flags: { ...gs.world.flags, creative_removed_walls: [...removed] } } });
      return;
    }

    const spec = this._toolToObjectSpec(this.selectedTool, cell.gx, cell.gy);
    if (!spec) return;

    const next = [...(gs.world.mapObjects || [])];
    const clash = this._findObjectIndexAtCell(next, cell.gx, cell.gy);
    if (clash >= 0) next.splice(clash, 1);
    next.push(spec);
    this._applyMapObjects(next);
  }

  _eraseAtEvent(e) {
    const cell = this._eventToWorldCell(e);
    if (!cell) return;

    const gs = window.getGameState?.();
    const pf = window.pathfindingSystem;
    if (!gs || !pf) return;

    const next = [...(gs.world.mapObjects || [])];
    const idx = this._findObjectIndexAtCell(next, cell.gx, cell.gy);
    if (idx >= 0) {
      next.splice(idx, 1);
      this._applyMapObjects(next);
      return;
    }

    // Если удаляем клетку внешней стены корпуса — помечаем её как удалённую.
    if (pf._classifyHullCell(cell.gx, cell.gy) === 'wall') {
      const removed = new Set(gs.world?.flags?.creative_removed_walls || []);
      removed.add(`${cell.gx},${cell.gy}`);
      window.updateGameState?.({ world: { flags: { ...gs.world.flags, creative_removed_walls: [...removed] } } });
    }
  }

  _findObjectIndexAtCell(objects, gx, gy) {
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const width = Math.max(1, Math.round((obj.width || 20) / 20));
      const height = Math.max(1, Math.round((obj.height || 20) / 20));
      const cx = Math.floor((obj.x || 0) / 20);
      const cy = Math.floor((obj.y || 0) / 20);
      const minX = cx - Math.floor(width / 2);
      const minY = cy - Math.floor(height / 2);
      const maxX = minX + width - 1;
      const maxY = minY + height - 1;
      if (gx >= minX && gx <= maxX && gy >= minY && gy <= maxY) return i;
    }
    return -1;
  }

  _toolToObjectSpec(tool, gx, gy) {
    const id = `creative_${tool}_${Date.now()}_${this.idCounter++}`;
    const center = { x: gx * 20 + 10, y: gy * 20 + 10 };

    const map = {
      wall: { objectId: 'wall', width: 20, height: 20 },
      window_v: { objectId: 'window_v_small', width: 20, height: 20 },
      window_h: { objectId: 'window_h_small', width: 20, height: 20 },
      viewport_wide: { objectId: 'viewport_wide', width: 20, height: 20 },
      door_v: { objectId: 'door_inner_v', width: 20, height: 20 },
      door_h: { objectId: 'door_inner_h', width: 20, height: 20 },
      airlock_door_v: { objectId: 'airlock_door_v', width: 20, height: 20 },
      airlock_door_h: { objectId: 'airlock_door_h', width: 20, height: 20 },
      bulkhead_heavy_v: { objectId: 'bulkhead_heavy_v', width: 20, height: 20 },
      bulkhead_heavy_h: { objectId: 'bulkhead_heavy_h', width: 20, height: 20 },
      tech_block: { objectId: 'tech_block', width: 20, height: 20 },
      pipe_v: { objectId: 'pipe_v', width: 20, height: 20 },
      pipe_h: { objectId: 'pipe_h', width: 20, height: 20 },
      pipe_corner: { objectId: 'pipe_corner', width: 20, height: 20 },
      cable_tray: { objectId: 'cable_tray', width: 20, height: 20 },
      console: { objectId: 'console', width: 20, height: 20 },
      terminal: { objectId: 'terminal', width: 20, height: 20 },
      reactor_core: { objectId: 'reactor_core', width: 20, height: 20 },
      battery_rack: { objectId: 'battery_rack', width: 20, height: 20 },
      engine_nozzle: { objectId: 'engine_nozzle', width: 20, height: 20 },
      crate_small: { objectId: 'crate_small', width: 20, height: 20 },
      crate_large: { objectId: 'crate_large', width: 20, height: 20 },
      medical_pod: { objectId: 'medical_pod', width: 20, height: 20 },
      sleep_pod: { objectId: 'sleep_pod', width: 20, height: 20 },
      grate_floor: { objectId: 'grate_floor', width: 20, height: 20 },
      warning_stripe: { objectId: 'warning_stripe', width: 20, height: 20 },
      signage: { objectId: 'signage', width: 20, height: 20 },
      light_panel_white: { objectId: 'light_panel_white', width: 20, height: 20 },
      light_panel_red: { objectId: 'light_panel_red', width: 20, height: 20 },
      beacon: { objectId: 'beacon', width: 20, height: 20 },
      agg_reactor_cluster: { objectId: 'agg_reactor_cluster', width: 100, height: 100 },
      agg_engine_block: { objectId: 'agg_engine_block', width: 140, height: 100 },
      agg_life_support: { objectId: 'agg_life_support', width: 100, height: 120 },
      agg_hyperdrive: { objectId: 'agg_hyperdrive', width: 120, height: 120 },
      agg_coolant_matrix: { objectId: 'agg_coolant_matrix', width: 140, height: 120 },
      chest_red: { objectId: 'chest_red', width: 20, height: 20 },
      chest_blue: { objectId: 'chest_blue', width: 20, height: 20 },
      chest_green: { objectId: 'chest_green', width: 20, height: 20 },
      chest_yellow: { objectId: 'chest_yellow', width: 20, height: 20 },
      chest_white: { objectId: 'chest_white', width: 20, height: 20 },
      door_red: { objectId: 'door_color_red', width: 20, height: 20 },
      door_blue: { objectId: 'door_color_blue', width: 20, height: 20 },
      door_green: { objectId: 'door_color_green', width: 20, height: 20 },
      door_yellow: { objectId: 'door_color_yellow', width: 20, height: 20 },
      door_white: { objectId: 'door_color_white', width: 20, height: 20 },
    };

    const cfg = map[tool];
    if (!cfg) return null;
    return { id, objectId: cfg.objectId, x: center.x, y: center.y, width: cfg.width, height: cfg.height };
  }

  _applyMapObjects(objects) {
    const cloned = JSON.parse(JSON.stringify(objects));
    window.updateGameState?.({ world: { mapObjects: cloned } });
    if (window.mapObjectsData) {
      window.mapObjectsData.objects = JSON.parse(JSON.stringify(cloned));
    }
  }

  exportMap() {
    const gs = window.getGameState?.();
    if (!gs) return;
    const payload = {
      objects: gs.world.mapObjects || [],
      flags: {
        creative_removed_walls: gs.world?.flags?.creative_removed_walls || [],
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'creative-map-objects.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  importMap(rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (!parsed || !Array.isArray(parsed.objects)) return;
      this._applyMapObjects(parsed.objects);

      const gs = window.getGameState?.();
      if (!gs) return;
      const removed = parsed.flags?.creative_removed_walls;
      if (Array.isArray(removed)) {
        window.updateGameState?.({ world: { flags: { ...gs.world.flags, creative_removed_walls: removed } } });
      }
    } catch (error) {
      console.error(error);
    }
  }
}

function initCreativeModeWhenReady() {
  const start = () => {
    if (!window.gameRenderer || !window.getGameState || !window.updateGameState) {
      window.requestAnimationFrame(start);
      return;
    }
    if (window.creativeModeController) return;
    const controller = new CreativeModeController();
    controller.init();
    window.creativeModeController = controller;
  };
  start();
}

initCreativeModeWhenReady();
