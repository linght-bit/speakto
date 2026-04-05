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
    this.undoBtn = null;
    this.redoBtn = null;
    this.compactUndoBtn = null;
    this.compactRedoBtn = null;
    this.scrollWrap = null;
    this.actionsWrap = null;
    this.hintWrap = null;
    this.compactWrap = null;
    this.bound = false;
    this.collapsed = false;
    this.dragState = null;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 80;
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
        id: 'home',
        titleKey: 'ui.creative_group_home',
        tools: [
          'bed_single', 'chair', 'table', 'toilet', 'shower', 'bathtub',
        ],
      },
      {
        id: 'plants',
        titleKey: 'ui.creative_group_plants',
        tools: [
          'plant_pot',
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
      bed_single: 'BD',
      chair: 'CH',
      table: 'TA',
      toilet: 'WC',
      shower: 'SH',
      bathtub: 'BT',
      plant_pot: 'PL',
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

    this.toolTitleKeys = {
      wall: 'ui.creative_wall',
      window_v: 'ui.creative_window_v',
      window_h: 'ui.creative_window_h',
      door_v: 'ui.creative_door_v',
      door_h: 'ui.creative_door_h',
      tech_block: 'ui.creative_tech',
      plant_pot: 'ui.creative_tool_plant_pot',
      chest_red: 'ui.creative_tool_chest_red',
      chest_blue: 'ui.creative_tool_chest_blue',
      chest_green: 'ui.creative_tool_chest_green',
      chest_yellow: 'ui.creative_tool_chest_yellow',
      chest_white: 'ui.creative_tool_chest_white',
      door_red: 'ui.creative_tool_door_red',
      door_blue: 'ui.creative_tool_door_blue',
      door_green: 'ui.creative_tool_door_green',
      door_yellow: 'ui.creative_tool_door_yellow',
      door_white: 'ui.creative_tool_door_white',
      table: 'objects.object_table',
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
        this._drawCreativeObject(renderer.ctx, obj.objectId, left, top, w, h, obj);
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
      'bed_single', 'chair', 'table', 'toilet', 'shower', 'bathtub',
      'plant_pot',
      'plant_flower_red', 'plant_flower_blue', 'plant_flower_white', 'plant_fern', 'plant_aloe',
      'plant_palm_small', 'plant_palm_large', 'plant_glow_bulb', 'plant_crystal_reed', 'plant_spiral_vine',
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
      red: { a: '#8d98a8', b: '#69788c', border: '#ebf2f8', accent: '#ff6b78' },
      blue: { a: '#8ca2ba', b: '#6a809a', border: '#e6f2fb', accent: '#73ddff' },
      green: { a: '#91aa9b', b: '#6d8778', border: '#e8f7ef', accent: '#7ff0b4' },
      yellow: { a: '#aca27f', b: '#887c5c', border: '#fcf2d6', accent: '#ffd86a' },
      white: { a: '#98a5b5', b: '#727f92', border: '#f4f7fb', accent: '#8eefff' },
    };
    const tone = palette && palettes[palette]
      ? palettes[palette]
      : heavy
        ? { a: '#8b99ab', b: '#65758a', border: '#eef4f9', accent: '#b8d7ef' }
        : { a: '#8998ab', b: '#64748a', border: '#e7eff8', accent: '#78e9ff' };

    const band = 6;
    const leafLength = 6;
    const drawLeaf = (x, y, w, h) => {
      const grad = ctx.createLinearGradient(x, y, x + (axis === 'horizontal' ? w : 0), y + (axis === 'vertical' ? h : 0));
      grad.addColorStop(0, tone.a);
      grad.addColorStop(1, tone.b);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = tone.border;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    };

    const drawLockDots = () => {
      if (!palette) return;
      const dots = axis === 'vertical'
        ? [[left + 3.5, top + 10], [left + 16.5, top + 10]]
        : [[left + 10, top + 3.5], [left + 10, top + 16.5]];
      ctx.fillStyle = tone.accent;
      ctx.strokeStyle = 'rgba(10, 16, 24, 0.88)';
      for (const [dx, dy] of dots) {
        ctx.beginPath();
        ctx.arc(dx, dy, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    };

    ctx.save();
    ctx.fillStyle = 'rgba(96, 110, 126, 0.34)';
    ctx.fillRect(left + 1, top + 1, 18, 18);
    ctx.strokeStyle = 'rgba(210, 224, 236, 0.18)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(left + 1.5, top + 1.5, 17, 17);

    ctx.fillStyle = heavy ? 'rgba(54, 68, 82, 0.72)' : 'rgba(42, 56, 70, 0.62)';
    if (axis === 'vertical') {
      const centerX = left + 10 - Math.floor(band / 2);
      ctx.fillRect(centerX, top + 1, band, 4);
      ctx.fillRect(centerX, top + 15, band, 4);
      if (isOpen) {
        drawLeaf(centerX, top + 2, band, 1);
        drawLeaf(centerX, top + 17, band, 1);
      } else {
        drawLeaf(centerX, top + 5, band, 4);
        drawLeaf(centerX, top + 11, band, 4);
      }
    } else {
      const centerY = top + 10 - Math.floor(band / 2);
      ctx.fillRect(left + 1, centerY, 4, band);
      ctx.fillRect(left + 15, centerY, 4, band);
      if (isOpen) {
        drawLeaf(left + 2, centerY, 1, band);
        drawLeaf(left + 17, centerY, 1, band);
      } else {
        drawLeaf(left + 5, centerY, 4, band);
        drawLeaf(left + 11, centerY, 4, band);
      }
    }

    drawLockDots();
    ctx.restore();
  }

  _drawCreativeObject(ctx, id, left, top, w, h, obj = null) {
    const roundedRectPath = (x, y, width, height, radius = 4) => {
      const r = Math.max(1, Math.min(radius, Math.floor(width / 2), Math.floor(height / 2)));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const draw = (fill, stroke = null, options = {}) => {
      const grad = ctx.createLinearGradient(left, top, left, top + h);
      const topShade = options.topShade || fill;
      const bottomShade = options.bottomShade || 'rgba(0, 0, 0, 0.20)';
      grad.addColorStop(0, topShade);
      grad.addColorStop(1, bottomShade === 'rgba(0, 0, 0, 0.20)' ? fill : bottomShade);
      ctx.save();
      roundedRectPath(left + 1, top + 1, Math.max(2, w - 2), Math.max(2, h - 2), options.radius || 4);
      ctx.fillStyle = grad;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(225, 242, 255, 0.08)';
      ctx.fillRect(left + 3, top + 3, Math.max(0, w - 6), Math.min(3, h - 4));
      ctx.restore();
    };

    const drawGlow = (color, x = left + w / 2, y = top + h / 2, radius = Math.min(w, h) * 0.24, alpha = 0.22) => {
      ctx.save();
      ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawScreen = (x, y, width, height, color = '#64f4ff') => {
      draw('#101825', '#6d87a2', { radius: 3, topShade: '#172335', bottomShade: '#0e1622' });
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      roundedRectPath(x, y, width, height, 2);
      ctx.globalAlpha = 0.88;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(220, 250, 255, 0.20)';
      ctx.fillRect(x + 1, y + 1, Math.max(0, width - 2), Math.min(2, height - 1));
    };

    const drawPotBase = (body = '#4c5668', rim = '#a8c6d8') => {
      ctx.save();
      const potGrad = ctx.createLinearGradient(left, top + h - 8, left, top + h - 1);
      potGrad.addColorStop(0, '#708095');
      potGrad.addColorStop(1, body);
      roundedRectPath(left + 4, top + h - 8, 12, 7, 2);
      ctx.fillStyle = potGrad;
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(238, 248, 255, 0.14)';
      ctx.fillRect(left + 6, top + h - 7, 8, 1);
      ctx.restore();
    };

    const drawStem = (x0, y0, x1, y1, color, glow = null, width = 1.6, bend = 0) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6;
      }
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2 - 3, x1, y1);
      ctx.stroke();
      ctx.restore();
    };

    const drawLeaf = (cx, cy, rx, ry, angle, fill, glow = null) => {
      ctx.save();
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 7;
      }
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const leafGrad = ctx.createLinearGradient(0, -ry, 0, ry);
      leafGrad.addColorStop(0, fill);
      leafGrad.addColorStop(1, 'rgba(18, 28, 30, 0.30)');
      ctx.fillStyle = leafGrad;
      ctx.beginPath();
      ctx.moveTo(0, -ry);
      ctx.quadraticCurveTo(rx, -ry * 0.15, 0, ry);
      ctx.quadraticCurveTo(-rx, -ry * 0.15, 0, -ry);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(230, 250, 255, 0.12)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -ry + 1);
      ctx.lineTo(0, ry - 1);
      ctx.stroke();
      ctx.restore();
    };

    const drawBulb = (cx, cy, r, fill, glow) => {
      ctx.save();
      ctx.shadowColor = glow || fill;
      ctx.shadowBlur = 10;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    switch (id) {
      case 'tech_block':
        draw('#2a3447', '#7a8faa', { topShade: '#35445b', bottomShade: '#1a2431' });
        ctx.fillStyle = 'rgba(118, 242, 255, 0.16)';
        ctx.fillRect(left + 3, top + 4, w - 6, 3);
        ctx.fillStyle = 'rgba(255, 214, 110, 0.22)';
        ctx.fillRect(left + 4, top + h - 6, Math.max(4, w - 8), 2);
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
        draw('#243144', '#7086a0', { topShade: '#314157', bottomShade: '#18222f' });
        ctx.save();
        ctx.shadowColor = 'rgba(99, 228, 255, 0.35)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#63e4ff';
        ctx.fillRect(left + 4, top + 5, w - 8, 6);
        ctx.restore();
        ctx.fillStyle = 'rgba(230, 252, 255, 0.20)';
        ctx.fillRect(left + 5, top + 6, w - 10, 1.5);
        break;
      case 'terminal':
        draw('#25303f', '#6c86a2', { topShade: '#324256', bottomShade: '#18212e' });
        ctx.save();
        ctx.shadowColor = 'rgba(126, 255, 212, 0.35)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#7effd4';
        ctx.fillRect(left + 5, top + 4, 10, 8);
        ctx.restore();
        break;
      case 'reactor_core':
        draw('#20293a', '#89a2be', { topShade: '#2d3b50', bottomShade: '#131a24' });
        ctx.save();
        ctx.shadowColor = 'rgba(99, 228, 255, 0.42)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#7be8ff';
        ctx.beginPath();
        ctx.arc(left + 10, top + 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      case 'battery_rack':
        draw('#263041', '#7489a3', { topShade: '#314157', bottomShade: '#182330' });
        ctx.save();
        ctx.shadowColor = 'rgba(255, 214, 110, 0.25)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#dfff89';
        ctx.fillRect(left + 4, top + 4, 12, 3);
        ctx.fillRect(left + 4, top + 9, 12, 3);
        ctx.restore();
        break;
      case 'engine_nozzle':
        draw('#263244', '#7b8ca5', { topShade: '#334155', bottomShade: '#182230' });
        ctx.save();
        ctx.shadowColor = 'rgba(99, 228, 255, 0.30)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#8edcff';
        ctx.fillRect(left + 7, top + 3, 6, 14);
        ctx.restore();
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
      case 'crate_large': {
        ctx.save();
        const topGrad = ctx.createLinearGradient(left + 2, top + 3, left + 2, top + 9);
        topGrad.addColorStop(0, '#c8d6e2');
        topGrad.addColorStop(1, '#98adbf');
        ctx.beginPath();
        ctx.moveTo(left + 3, top + 3);
        ctx.lineTo(left + 17, top + 3);
        ctx.lineTo(left + 14, top + 9);
        ctx.lineTo(left + 2, top + 9);
        ctx.closePath();
        ctx.fillStyle = topGrad;
        ctx.fill();
        ctx.fillStyle = '#6a7b8f';
        ctx.fillRect(left + 2, top + 9, 12, 7);
        ctx.fillStyle = '#55677b';
        ctx.beginPath();
        ctx.moveTo(left + 14, top + 9);
        ctx.lineTo(left + 17, top + 3);
        ctx.lineTo(left + 17, top + 10);
        ctx.lineTo(left + 14, top + 16);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ebf2f8';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#7cf1ff';
        ctx.fillRect(left + 5, top + 11, 2, 2);
        ctx.fillRect(left + 10, top + 11, 2, 2);
        ctx.fillStyle = '#ffd672';
        ctx.fillRect(left + 4, top + 8, 8, 1.5);
        ctx.restore();
        break;
      }
      case 'medical_pod':
        draw('#314154', '#93b2c8', { topShade: '#40566d', bottomShade: '#1c2633' });
        ctx.save();
        ctx.shadowColor = 'rgba(118, 242, 255, 0.26)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(176, 245, 255, 0.72)';
        ctx.fillRect(left + 4, top + 4, 12, 8);
        ctx.restore();
        break;
      case 'sleep_pod':
        draw('#354254', '#8ea7c2', { topShade: '#46586f', bottomShade: '#202938' });
        ctx.fillStyle = 'rgba(160, 200, 228, 0.72)';
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
      case 'bed_single': {
        ctx.save();
        const frame = ctx.createLinearGradient(left, top + 2, left, top + h - 2);
        frame.addColorStop(0, '#718298');
        frame.addColorStop(1, '#3d4b5d');
        roundedRectPath(left + 2, top + 2, w - 4, h - 4, 3);
        ctx.fillStyle = frame;
        ctx.fill();
        ctx.strokeStyle = '#c1d5e3';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(235, 242, 248, 0.95)';
        roundedRectPath(left + 4, top + 4, w - 8, 12, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(110, 236, 255, 0.55)';
        ctx.fillRect(left + 5, top + 6, w - 10, 2);
        ctx.fillStyle = '#93a8bb';
        roundedRectPath(left + 4, top + 18, w - 8, Math.max(6, h - 22), 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'chair': {
        ctx.save();
        ctx.fillStyle = '#9db4c7';
        ctx.fillRect(left + 5, top + 7, 2, 9);
        ctx.fillRect(left + 13, top + 7, 2, 9);
        roundedRectPath(left + 5, top + 3, 10, 4, 2);
        ctx.fillStyle = '#90a7bb';
        ctx.fill();
        ctx.strokeStyle = '#edf4fa';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        roundedRectPath(left + 4, top + 8, 12, 5, 2);
        ctx.fillStyle = '#7897af';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#6d879c';
        ctx.fillRect(left + 5, top + 7, 2, 2);
        ctx.fillRect(left + 13, top + 7, 2, 2);
        ctx.fillStyle = '#77efff';
        ctx.fillRect(left + 7, top + 9, 6, 1.5);
        ctx.restore();
        break;
      }
      case 'table': {
        ctx.save();
        const topInset = 4;
        const topHeight = Math.min(h - 8, Math.max(24, Math.round(h * 0.72)));
        const legTop = top + topInset + topHeight - 1;
        const legHeight = Math.max(2, Math.round((h - topHeight - topInset - 3) / 3));
        ctx.fillStyle = '#9eb4c7';
        ctx.fillRect(left + 4, legTop, 2, legHeight);
        ctx.fillRect(left + w - 6, legTop, 2, legHeight);
        ctx.fillStyle = '#7f97ab';
        ctx.fillRect(left + 3, legTop + legHeight, w - 6, 1.5);
        roundedRectPath(left + 2, top + topInset, w - 4, topHeight, 2);
        const deskGrad = ctx.createLinearGradient(left + 2, top + topInset, left + 2, top + topInset + topHeight);
        deskGrad.addColorStop(0, '#dce7ef');
        deskGrad.addColorStop(1, '#9fb3c3');
        ctx.fillStyle = deskGrad;
        ctx.fill();
        ctx.strokeStyle = '#eef5fa';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.fillStyle = '#6f889d';
        ctx.fillRect(left + 4, top + topInset + 2, w - 8, 1.5);
        ctx.fillStyle = '#77efff';
        ctx.fillRect(left + 5, top + topInset + 5, w - 10, 1.5);
        ctx.restore();
        break;
      }
      case 'toilet': {
        ctx.save();
        ctx.fillStyle = '#eff6fb';
        roundedRectPath(left + 5, top + 3, 10, 5, 2);
        ctx.fill();
        ctx.fillStyle = '#dce7f1';
        roundedRectPath(left + 4, top + 9, 12, 7, 3);
        ctx.fill();
        ctx.fillStyle = '#97a9b8';
        ctx.fillRect(left + 7, top + 2, 6, 2);
        ctx.restore();
        break;
      }
      case 'shower': {
        ctx.save();
        ctx.strokeStyle = 'rgba(220, 244, 255, 0.86)';
        ctx.lineWidth = 1;
        roundedRectPath(left + 3, top + 3, w - 6, h - 6, 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(172, 232, 255, 0.20)';
        roundedRectPath(left + 4, top + 4, w - 8, h - 8, 2);
        ctx.fill();
        ctx.fillStyle = '#91e8ff';
        ctx.fillRect(left + w - 6, top + 4, 2, 5);
        ctx.restore();
        break;
      }
      case 'bathtub': {
        ctx.save();
        const tub = ctx.createLinearGradient(left + 2, top + 4, left + 2, top + h - 4);
        tub.addColorStop(0, '#edf4f9');
        tub.addColorStop(1, '#c9d9e6');
        roundedRectPath(left + 2, top + 4, w - 4, h - 8, 4);
        ctx.fillStyle = tub;
        ctx.fill();
        ctx.strokeStyle = '#9db0c0';
        ctx.stroke();
        ctx.fillStyle = '#8bc6d9';
        ctx.fillRect(left + w - 8, top + 6, 3, 3);
        ctx.restore();
        break;
      }
      case 'plant_pot':
      case 'plant_flower_red':
      case 'plant_flower_blue':
      case 'plant_flower_white':
      case 'plant_fern':
      case 'plant_aloe':
      case 'plant_palm_small':
      case 'plant_palm_large':
      case 'plant_glow_bulb':
      case 'plant_crystal_reed':
      case 'plant_spiral_vine': {
        const variant = this._resolvePlantVariantId(id, obj);
        drawPotBase('#4b5567', '#b6cede');

        switch (variant) {
          case 'plant_flower_red':
            drawStem(left + 10, top + h - 8, left + 10, top + 10, '#78b48e', 'rgba(120, 255, 210, 0.16)', 1.4);
            [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3].forEach((ang, idx) => {
              drawLeaf(left + 10 + Math.cos(ang) * 2.2, top + 10 + Math.sin(ang) * 1.7, 2.3, 4.4, ang, idx % 2 === 0 ? '#5ef0b5' : '#79ffcb', 'rgba(110, 255, 208, 0.22)');
            });
            drawBulb(left + 10, top + 7, 2.2, '#ff7da8', 'rgba(255, 125, 168, 0.42)');
            break;
          case 'plant_flower_blue':
            [0, 1.1, 2.2, 3.2, 4.3].forEach((ang) => {
              drawLeaf(left + 10, top + 10, 2.4, 4.8, ang, '#7bdcff', 'rgba(123, 220, 255, 0.25)');
            });
            drawBulb(left + 10, top + 8, 2.4, '#b7ecff', 'rgba(123, 220, 255, 0.42)');
            break;
          case 'plant_flower_white':
            drawStem(left + 10, top + h - 8, left + 9, top + 10, '#89b493', null, 1.5, -1);
            drawStem(left + 10, top + 12, left + 6.5, top + 7, '#89b493', null, 1.2, -1.5);
            drawStem(left + 10, top + 12, left + 13.5, top + 7, '#89b493', null, 1.2, 1.5);
            [[9,8],[6.5,7],[13.5,7]].forEach(([px, py]) => drawBulb(left + px, top + py, 2.0, '#f6fbff', 'rgba(220, 248, 255, 0.40)'));
            break;
          case 'plant_fern':
            drawStem(left + 10, top + h - 8, left + 10, top + 5, '#6bc08a', 'rgba(107, 192, 138, 0.18)', 1.6);
            [[7.5,7,-0.7],[8.3,9,-0.4],[11.7,8,0.55],[12.5,10,0.8],[9.2,6,-0.15],[10.8,6,0.15]].forEach(([px, py, ang]) => {
              drawLeaf(left + px, top + py, 1.8, 4.8, ang, '#73f7a8', 'rgba(115, 247, 168, 0.20)');
            });
            break;
          case 'plant_aloe':
            [
              [8.2, 9.8, -0.55, '#8cff9a'],
              [10, 8.0, 0, '#6cf6b8'],
              [11.8, 9.6, 0.55, '#90ffcf'],
              [9, 10.8, -0.2, '#7af2c0'],
              [11, 10.8, 0.2, '#8cff9a'],
            ].forEach(([px, py, ang, col]) => drawLeaf(left + px, top + py, 2.2, 5.4, ang, col, 'rgba(120, 255, 200, 0.18)'));
            break;
          case 'plant_palm_small':
            drawStem(left + 10, top + h - 8, left + 10, top + 9, '#79a47f', null, 1.5);
            [-1.0, -0.4, 0.2, 0.8].forEach((ang, idx) => drawLeaf(left + 10, top + 8.5, 2.2, 5.2, ang, idx % 2 === 0 ? '#8effc4' : '#65f0b4', 'rgba(120, 255, 210, 0.18)'));
            break;
          case 'plant_palm_large':
            drawStem(left + 10, top + h - 8, left + 10, top + 8, '#6f9d82', null, 1.8);
            [-1.15, -0.6, -0.15, 0.35, 0.9].forEach((ang, idx) => drawLeaf(left + 10, top + 7.5, 2.6, 6.8, ang, idx % 2 === 0 ? '#99ffd6' : '#72f0c0', 'rgba(123, 255, 219, 0.22)'));
            break;
          case 'plant_glow_bulb':
            [[8, 8, -1.8], [10, 6.5, 0], [12, 8, 1.8]].forEach(([px, py, bend]) => {
              drawStem(left + 10, top + h - 8, left + px, top + py, '#73c89e', 'rgba(120, 255, 216, 0.14)', 1.3, bend);
              drawBulb(left + px, top + py, 2.0, '#8ff7ff', 'rgba(143, 247, 255, 0.45)');
            });
            break;
          case 'plant_crystal_reed':
            [[7, 12], [10, 10], [13, 11]].forEach(([px, ph]) => {
              ctx.save();
              ctx.shadowColor = 'rgba(128, 240, 255, 0.35)';
              ctx.shadowBlur = 8;
              ctx.fillStyle = 'rgba(164, 232, 255, 0.78)';
              ctx.beginPath();
              ctx.moveTo(left + px, top + h - 8);
              ctx.lineTo(left + px + 1.6, top + h - ph);
              ctx.lineTo(left + px + 3.2, top + h - 8);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            });
            break;
          case 'plant_spiral_vine':
            drawStem(left + 9, top + h - 8, left + 12, top + 5, '#8ee67f', 'rgba(142, 230, 127, 0.18)', 1.6, 2.6);
            drawStem(left + 11, top + h - 9, left + 7, top + 7, '#63ddb6', 'rgba(99, 221, 182, 0.18)', 1.2, -2.4);
            [[9, 11, -0.8], [12, 9, 0.4], [8, 8, -0.2], [11, 6, 0.9]].forEach(([px, py, ang]) => {
              drawLeaf(left + px, top + py, 1.8, 4.0, ang, '#9cff87', 'rgba(156, 255, 135, 0.22)');
            });
            drawBulb(left + 12, top + 5, 1.6, '#ccff83', 'rgba(204, 255, 131, 0.38)');
            break;
        }
        break;
      }
      case 'light_panel_white':
        draw('#2a3140', '#899ab1', { topShade: '#374254', bottomShade: '#1b2230' });
        ctx.save();
        ctx.shadowColor = 'rgba(220, 248, 255, 0.45)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#f2fbff';
        ctx.fillRect(left + 5, top + 5, 10, 10);
        ctx.restore();
        break;
      case 'light_panel_red':
        draw('#2a3140', '#899ab1', { topShade: '#374254', bottomShade: '#1b2230' });
        ctx.save();
        ctx.shadowColor = 'rgba(255, 111, 125, 0.45)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ff6f7d';
        ctx.fillRect(left + 5, top + 5, 10, 10);
        ctx.restore();
        break;
      case 'beacon':
        draw('#202938', '#8e9eb5', { topShade: '#2d394d', bottomShade: '#151c27' });
        ctx.save();
        ctx.shadowColor = 'rgba(255, 111, 125, 0.45)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ff6f7d';
        ctx.beginPath();
        ctx.arc(left + 10, top + 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
      case 'crate_small':
      case 'chest_red':
      case 'chest_blue':
      case 'chest_green':
      case 'chest_yellow':
      case 'chest_white': {
        const accents = {
          crate_small: ['#7de8ff', 'rgba(125, 232, 255, 0.35)'],
          chest_red: ['#ff7f96', 'rgba(255, 127, 150, 0.35)'],
          chest_blue: ['#7de8ff', 'rgba(125, 232, 255, 0.35)'],
          chest_green: ['#8ef6c6', 'rgba(142, 246, 198, 0.32)'],
          chest_yellow: ['#ffd97a', 'rgba(255, 217, 122, 0.30)'],
          chest_white: ['#dff7ff', 'rgba(223, 247, 255, 0.28)'],
        };
        const [accent, glow] = accents[id];
        ctx.save();
        const shell = ctx.createLinearGradient(left + 2, top + 3, left + 2, top + 15);
        shell.addColorStop(0, '#eef6fb');
        shell.addColorStop(1, '#9fb2c4');
        roundedRectPath(left + 2, top + 3, 16, 12, 2);
        ctx.fillStyle = shell;
        ctx.fill();
        ctx.strokeStyle = '#f5fbff';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.fillStyle = 'rgba(214, 226, 235, 0.92)';
        roundedRectPath(left + 5, top + 6, 10, 6, 1.5);
        ctx.fill();

        ctx.fillStyle = '#dde9f2';
        ctx.beginPath();
        ctx.moveTo(left + 3, top + 4);
        ctx.lineTo(left + 9, top + 4);
        ctx.lineTo(left + 8, top + 8);
        ctx.lineTo(left + 3, top + 8);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(left + 11, top + 4);
        ctx.lineTo(left + 17, top + 4);
        ctx.lineTo(left + 17, top + 8);
        ctx.lineTo(left + 12, top + 8);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = glow;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left + 10, top + 4);
        ctx.lineTo(left + 9, top + 6);
        ctx.lineTo(left + 11, top + 8);
        ctx.lineTo(left + 9, top + 10);
        ctx.lineTo(left + 10, top + 12);
        ctx.stroke();

        ctx.fillStyle = accent;
        ctx.fillRect(left + 6, top + 9.5, 8, 1.5);
        ctx.restore();
        break;
      }
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

  _resolvePlantVariantId(id, obj) {
    const variants = [
      'plant_flower_red', 'plant_flower_blue', 'plant_flower_white', 'plant_fern', 'plant_aloe',
      'plant_palm_small', 'plant_palm_large', 'plant_glow_bulb', 'plant_crystal_reed', 'plant_spiral_vine',
    ];
    if (id !== 'plant_pot') return id;
    const raw = Number(obj?.variant || 1);
    const safe = Number.isFinite(raw) ? Math.max(1, Math.min(10, Math.floor(raw))) : 1;
    return variants[safe - 1];
  }

  _createUI() {
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.left = '12px';
    panel.style.top = '74px';
    panel.style.display = 'none';
    panel.style.padding = '8px';
    panel.style.borderRadius = '10px';
    panel.style.background = 'rgba(8, 12, 16, 0.94)';
    panel.style.border = '1px solid rgba(120, 200, 255, 0.35)';
    panel.style.boxShadow = '0 8px 22px rgba(0, 0, 0, 0.35)';
    panel.style.zIndex = '1600';
    panel.style.pointerEvents = 'auto';
    panel.style.width = '600px';
    panel.style.minWidth = '360px';
    panel.style.minHeight = '180px';
    panel.style.maxWidth = 'calc(100vw - 24px)';
    panel.style.resize = 'both';
    panel.style.overflow = 'auto';
    panel.style.fontFamily = 'Arial, sans-serif';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '6px';
    header.style.cursor = 'move';
    header.style.userSelect = 'none';

    const title = document.createElement('strong');
    title.style.color = '#d7ebff';
    title.style.fontSize = '13px';
    title.textContent = this._t('ui.creative_title');

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '4px';

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
    scroll.style.paddingRight = '2px';
    scroll.style.borderTop = '1px solid rgba(140,170,195,0.3)';
    scroll.style.borderBottom = '1px solid rgba(140,170,195,0.3)';

    const makeToolButton = (toolId, targetMap, compact = false) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.toolId = toolId;
      btn.style.border = '1px solid #53697d';
      btn.style.borderRadius = '4px';
      btn.style.width = compact ? '30px' : '34px';
      btn.style.height = compact ? '30px' : '34px';
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
      gTitle.style.margin = '8px 1px 4px';
      scroll.appendChild(gTitle);

      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(10, 1fr)';
      grid.style.gap = '4px';

      for (const toolId of group.tools) {
        const btn = makeToolButton(toolId, this.toolButtons, false);
        grid.appendChild(btn);
      }

      scroll.appendChild(grid);
    }

    const compact = document.createElement('div');
    compact.style.display = 'none';
    compact.style.padding = '4px 0 1px';
    compact.style.borderTop = '1px solid rgba(140,170,195,0.3)';
    compact.style.borderBottom = '1px solid rgba(140,170,195,0.3)';

    const compactRow = document.createElement('div');
    compactRow.style.display = 'flex';
    compactRow.style.flexWrap = 'nowrap';
    compactRow.style.gap = '4px';
    compactRow.style.overflowX = 'auto';
    compactRow.style.paddingBottom = '2px';

    const allTools = [...new Set(this.toolGroups.flatMap(group => group.tools))];
    for (const toolId of allTools) {
      compactRow.appendChild(makeToolButton(toolId, this.compactToolButtons, true));
    }

    const compactErase = document.createElement('button');
    compactErase.type = 'button';
    compactErase.textContent = this._t('ui.creative_erase');
    compactErase.style.border = '1px solid #8d4d4d';
    compactErase.style.borderRadius = '4px';
    compactErase.style.padding = '0 6px';
    compactErase.style.height = '30px';
    compactErase.style.background = '#5a2424';
    compactErase.style.color = '#fff';
    compactErase.style.cursor = 'pointer';
    compactErase.addEventListener('click', () => {
      this.selectedTool = 'erase';
      this._refreshToolButtons();
    });
    const compactUndo = document.createElement('button');
    compactUndo.type = 'button';
    compactUndo.textContent = '↶';
    compactUndo.title = this._t('ui.creative_undo');
    compactUndo.style.border = '1px solid #566f8d';
    compactUndo.style.borderRadius = '4px';
    compactUndo.style.padding = '0 8px';
    compactUndo.style.height = '30px';
    compactUndo.style.background = '#263d57';
    compactUndo.style.color = '#fff';
    compactUndo.style.cursor = 'pointer';
    compactUndo.addEventListener('click', () => this.undo());
    const compactRedo = document.createElement('button');
    compactRedo.type = 'button';
    compactRedo.textContent = '↷';
    compactRedo.title = this._t('ui.creative_redo');
    compactRedo.style.border = '1px solid #566f8d';
    compactRedo.style.borderRadius = '4px';
    compactRedo.style.padding = '0 8px';
    compactRedo.style.height = '30px';
    compactRedo.style.background = '#263d57';
    compactRedo.style.color = '#fff';
    compactRedo.style.cursor = 'pointer';
    compactRedo.addEventListener('click', () => this.redo());
    compactRow.appendChild(compactErase);
    compactRow.appendChild(compactUndo);
    compactRow.appendChild(compactRedo);

    compact.appendChild(compactRow);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';
    actions.style.marginTop = '6px';

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

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.textContent = this._t('ui.creative_undo');
    undoBtn.style.cssText = this._actionBtnCss('#2e4661');
    undoBtn.addEventListener('click', () => this.undo());

    const redoBtn = document.createElement('button');
    redoBtn.type = 'button';
    redoBtn.textContent = this._t('ui.creative_redo');
    redoBtn.style.cssText = this._actionBtnCss('#2e4661');
    redoBtn.addEventListener('click', () => this.redo());

    actions.appendChild(eraseBtn);
    actions.appendChild(undoBtn);
    actions.appendChild(redoBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);

    const hint = document.createElement('div');
    hint.style.marginTop = '6px';
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
    this.undoBtn = undoBtn;
    this.redoBtn = redoBtn;
    this.compactUndoBtn = compactUndo;
    this.compactRedoBtn = compactRedo;
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
    const keys = [
      this.toolTitleKeys?.[toolId],
      `ui.creative_tool_${toolId}`,
      `ui.creative_${toolId}`,
      `objects.object_${toolId}`,
    ].filter(Boolean);

    for (const key of keys) {
      const label = this._t(key, 'ru');
      if (label !== key) return label;
    }

    return toolId;
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
    if (toolId === 'plant_pot') return 'plant_pot';
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

    this._refreshToolButtons();
    this._refreshHistoryButtons();
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

  _refreshHistoryButtons() {
    const canUndo = this.undoStack.length > 0;
    const canRedo = this.redoStack.length > 0;
    const tune = (btn, can) => {
      if (!btn) return;
      btn.disabled = !can;
      btn.style.opacity = can ? '1' : '0.45';
      btn.style.cursor = can ? 'pointer' : 'default';
    };
    tune(this.undoBtn, canUndo);
    tune(this.redoBtn, canRedo);
    tune(this.compactUndoBtn, canUndo);
    tune(this.compactRedoBtn, canRedo);
  }

  _snapshotState() {
    const gs = window.getGameState?.();
    return {
      objects: JSON.parse(JSON.stringify(gs?.world?.mapObjects || [])),
      removedWalls: [...(gs?.world?.flags?.creative_removed_walls || [])],
    };
  }

  _recordUndo() {
    this.undoStack.push(this._snapshotState());
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this._refreshHistoryButtons();
  }

  _applySnapshot(snapshot) {
    if (!snapshot) return;
    const gs = window.getGameState?.();
    if (!gs) return;
    this._applyMapObjects(snapshot.objects || []);
    window.updateGameState?.({ world: { flags: { ...gs.world.flags, creative_removed_walls: [...(snapshot.removedWalls || [])] } } });
  }

  undo() {
    if (!this.undoStack.length) return;
    const current = this._snapshotState();
    const prev = this.undoStack.pop();
    this.redoStack.push(current);
    this._applySnapshot(prev);
    this._refreshHistoryButtons();
  }

  redo() {
    if (!this.redoStack.length) return;
    const current = this._snapshotState();
    const next = this.redoStack.pop();
    this.undoStack.push(current);
    this._applySnapshot(next);
    this._refreshHistoryButtons();
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

   
    if (this.selectedTool === 'wall' && stateType === 'wall') {
      this._recordUndo();
      const removed = new Set(gs.world?.flags?.creative_removed_walls || []);
      removed.delete(`${cell.gx},${cell.gy}`);
      window.updateGameState?.({ world: { flags: { ...gs.world.flags, creative_removed_walls: [...removed] } } });
      return;
    }

    const spec = this._toolToObjectSpec(this.selectedTool, cell.gx, cell.gy);
    if (!spec) return;

    const next = [...(gs.world.mapObjects || [])];
    const clash = this._findObjectIndexAtCell(next, cell.gx, cell.gy);
    const overlapIndexes = this._findOverlappingObjectIndexes(next, spec);
    const toRemove = new Set(overlapIndexes);
    this._recordUndo();
    if (clash >= 0) toRemove.add(clash);
    [...toRemove].sort((a, b) => b - a).forEach((idx) => next.splice(idx, 1));
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
      this._recordUndo();
      next.splice(idx, 1);
      this._applyMapObjects(next);
      return;
    }

   
    if (pf._classifyHullCell(cell.gx, cell.gy) === 'wall') {
      this._recordUndo();
      const removed = new Set(gs.world?.flags?.creative_removed_walls || []);
      removed.add(`${cell.gx},${cell.gy}`);
      window.updateGameState?.({ world: { flags: { ...gs.world.flags, creative_removed_walls: [...removed] } } });
    }
  }

  _getObjectCellBounds(obj, cellSize = 20) {
    if (typeof window.getMapObjectGridBounds === 'function') {
      return window.getMapObjectGridBounds(obj, cellSize);
    }
    const width = Math.max(1, Math.round((obj?.width || cellSize) / cellSize));
    const height = Math.max(1, Math.round((obj?.height || cellSize) / cellSize));
    const left = Math.round(((obj?.x || 0) - (width * cellSize) / 2) / cellSize);
    const top = Math.round(((obj?.y || 0) - (height * cellSize) / 2) / cellSize);
    return { left, top, right: left + width - 1, bottom: top + height - 1, width, height };
  }

  _isStackConflictObject(obj) {
    const id = String(obj?.objectId || '');
    return !(id === 'wall' ||
      id === 'window' ||
      id === 'window_v_small' ||
      id === 'window_h_small' ||
      id === 'viewport_wide' ||
      id === 'door' ||
      id === 'door_locked' ||
      id === 'door_inner_v' ||
      id === 'door_inner_h' ||
      id === 'airlock_door_v' ||
      id === 'airlock_door_h' ||
      id.startsWith('door_color_') ||
      id === 'grate_floor' ||
      id === 'warning_stripe' ||
      id === 'cable_tray' ||
      id === 'pipe_v' ||
      id === 'pipe_h' ||
      id === 'pipe_corner' ||
      id === 'light_panel_white' ||
      id === 'light_panel_red' ||
      id === 'signage');
  }

  _findOverlappingObjectIndexes(objects, targetObj) {
    if (!this._isStackConflictObject(targetObj)) return [];
    const target = this._getObjectCellBounds(targetObj);
    const indexes = [];
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (!this._isStackConflictObject(obj)) continue;
      const bounds = this._getObjectCellBounds(obj);
      const overlaps = target.left <= bounds.right && target.right >= bounds.left && target.top <= bounds.bottom && target.bottom >= bounds.top;
      if (overlaps) indexes.push(i);
    }
    return indexes;
  }

  _findObjectIndexAtCell(objects, gx, gy) {
    for (let i = objects.length - 1; i >= 0; i--) {
      const bounds = this._getObjectCellBounds(objects[i]);
      if (gx >= bounds.left && gx <= bounds.right && gy >= bounds.top && gy <= bounds.bottom) return i;
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
      crate_small: { objectId: 'crate_small', width: 20, height: 20, isContainer: true },
      crate_large: { objectId: 'crate_large', width: 20, height: 20 },
      medical_pod: { objectId: 'medical_pod', width: 20, height: 20 },
      sleep_pod: { objectId: 'sleep_pod', width: 20, height: 20 },
      grate_floor: { objectId: 'grate_floor', width: 20, height: 20 },
      warning_stripe: { objectId: 'warning_stripe', width: 20, height: 20 },
      signage: { objectId: 'signage', width: 20, height: 20 },
      bed_single: { objectId: 'bed_single', width: 20, height: 40 },
      chair: { objectId: 'chair', width: 20, height: 20 },
      table: { objectId: 'table', width: 20, height: 40, isSurface: true, isContainer: true, alwaysOpen: true },
      toilet: { objectId: 'toilet', width: 20, height: 20 },
      shower: { objectId: 'shower', width: 20, height: 20 },
      bathtub: { objectId: 'bathtub', width: 20, height: 40 },
      plant_pot: { objectId: 'plant_pot', width: 20, height: 20 },
      light_panel_white: { objectId: 'light_panel_white', width: 20, height: 20 },
      light_panel_red: { objectId: 'light_panel_red', width: 20, height: 20 },
      beacon: { objectId: 'beacon', width: 20, height: 20 },
      agg_reactor_cluster: { objectId: 'agg_reactor_cluster', width: 100, height: 100 },
      agg_engine_block: { objectId: 'agg_engine_block', width: 140, height: 100 },
      agg_life_support: { objectId: 'agg_life_support', width: 100, height: 120 },
      agg_hyperdrive: { objectId: 'agg_hyperdrive', width: 120, height: 120 },
      agg_coolant_matrix: { objectId: 'agg_coolant_matrix', width: 140, height: 120 },
      chest_red: { objectId: 'chest_red', width: 20, height: 20, isContainer: true },
      chest_blue: { objectId: 'chest_blue', width: 20, height: 20, isContainer: true },
      chest_green: { objectId: 'chest_green', width: 20, height: 20, isContainer: true },
      chest_yellow: { objectId: 'chest_yellow', width: 20, height: 20, isContainer: true },
      chest_white: { objectId: 'chest_white', width: 20, height: 20, isContainer: true },
      door_red: { objectId: 'door_color_red', width: 20, height: 20 },
      door_blue: { objectId: 'door_color_blue', width: 20, height: 20 },
      door_green: { objectId: 'door_color_green', width: 20, height: 20 },
      door_yellow: { objectId: 'door_color_yellow', width: 20, height: 20 },
      door_white: { objectId: 'door_color_white', width: 20, height: 20 },
    };

    const cfg = map[tool];
    if (!cfg) return null;
    const extra = {};
    if (tool === 'plant_pot') {
      extra.variant = Math.floor(Math.random() * 10) + 1;
    }
    return {
      id,
      objectId: cfg.objectId,
      x: center.x,
      y: center.y,
      width: cfg.width,
      height: cfg.height,
      ...extra,
      ...(cfg.isSurface ? { isSurface: true } : {}),
      ...(cfg.isContainer ? { isContainer: true } : {}),
      ...(cfg.alwaysOpen ? { alwaysOpen: true } : {}),
    };
  }

  _applyMapObjects(objects) {
    const normalized = typeof window.normalizeMapObjects === 'function'
      ? window.normalizeMapObjects(objects)
      : objects;
    const cloned = JSON.parse(JSON.stringify(normalized));
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
      this._recordUndo();
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
