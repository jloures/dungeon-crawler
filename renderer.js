'use strict';

// ===== Canvas Renderer =====

const Renderer = {
    canvas: null,
    ctx: null,
    tileSize: 20,
    viewCols: 0,
    viewRows: 0,
    offsetX: 0,
    offsetY: 0,

    // Minimap
    miniCanvas: null,
    miniCtx: null,

    init(canvas, miniCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.miniCanvas = miniCanvas;
        this.miniCtx = miniCanvas.getContext('2d');
        this.resize();
    },

    resize() {
        const container = this.canvas.parentElement;
        const w = container.clientWidth;
        const h = container.clientHeight;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Calculate tile size to fit reasonably
        const maxCols = 44;
        this.tileSize = Math.max(14, Math.min(24, Math.floor(w / maxCols)));
        this.viewCols = Math.floor(w / this.tileSize);
        this.viewRows = Math.floor(h / this.tileSize);

        // Minimap
        const mScale = 2;
        this.miniCanvas.width = G.width * mScale;
        this.miniCanvas.height = G.height * mScale;
    },

    render() {
        if (!G.tiles) return;

        const ctx = this.ctx;
        const ts = this.tileSize;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        // Center viewport on player
        this.offsetX = Math.floor(G.player.x - this.viewCols / 2);
        this.offsetY = Math.floor(G.player.y - this.viewRows / 2);
        this.offsetX = Math.max(0, Math.min(G.width - this.viewCols, this.offsetX));
        this.offsetY = Math.max(0, Math.min(G.height - this.viewRows, this.offsetY));

        // Background
        ctx.fillStyle = '#0a0a0e';
        ctx.fillRect(0, 0, w, h);

        ctx.font = `bold ${ts - 2}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const colors = {
            wallBg: '#1a1a2e',
            wallFg: '#333355',
            floorBg: '#16161e',
            floorFg: '#3a3a4a',
            floorDot: '#2a2a3a',
            exploredWall: '#111118',
            exploredFloor: '#0f0f14',
            stairsDown: '#44dddd',
            stairsUp: '#dddd44',
        };

        for (let vy = 0; vy < this.viewRows; vy++) {
            for (let vx = 0; vx < this.viewCols; vx++) {
                const mx = vx + this.offsetX;
                const my = vy + this.offsetY;
                if (mx < 0 || mx >= G.width || my < 0 || my >= G.height) continue;

                const idx = my * G.width + mx;
                const tile = G.tiles[idx];
                const vis = G.visible[idx];
                const exp = G.explored[idx];

                if (!exp) continue;

                const px = vx * ts;
                const py = vy * ts;

                if (vis) {
                    if (tile === WALL) {
                        ctx.fillStyle = colors.wallBg;
                        ctx.fillRect(px, py, ts, ts);
                        ctx.fillStyle = colors.wallFg;
                        ctx.fillText('#', px + ts / 2, py + ts / 2);
                    } else if (tile === STAIRS_DOWN) {
                        ctx.fillStyle = colors.floorBg;
                        ctx.fillRect(px, py, ts, ts);
                        ctx.fillStyle = colors.stairsDown;
                        ctx.fillText('>', px + ts / 2, py + ts / 2);
                    } else if (tile === STAIRS_UP) {
                        ctx.fillStyle = colors.floorBg;
                        ctx.fillRect(px, py, ts, ts);
                        ctx.fillStyle = colors.stairsUp;
                        ctx.fillText('<', px + ts / 2, py + ts / 2);
                    } else {
                        ctx.fillStyle = colors.floorBg;
                        ctx.fillRect(px, py, ts, ts);
                        ctx.fillStyle = colors.floorDot;
                        ctx.fillText('\u00b7', px + ts / 2, py + ts / 2);
                    }
                } else {
                    // Explored but not visible
                    ctx.fillStyle = tile === WALL ? colors.exploredWall : colors.exploredFloor;
                    ctx.fillRect(px, py, ts, ts);
                }
            }
        }

        // Items (visible only)
        for (const item of G.items) {
            if (item.x < 0 || !G.visible[item.y * G.width + item.x]) continue;
            const sx = (item.x - this.offsetX) * ts;
            const sy = (item.y - this.offsetY) * ts;
            ctx.fillStyle = item.color;
            ctx.fillText(item.glyph, sx + ts / 2, sy + ts / 2);
        }

        // Monsters (visible only)
        for (const m of G.monsters) {
            if (m.hp <= 0 || !G.visible[m.y * G.width + m.x]) continue;
            const sx = (m.x - this.offsetX) * ts;
            const sy = (m.y - this.offsetY) * ts;
            ctx.fillStyle = '#1a0808';
            ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
            ctx.fillStyle = m.color;
            ctx.fillText(m.glyph, sx + ts / 2, sy + ts / 2);

            // HP bar for damaged monsters
            if (m.hp < m.maxHp) {
                const ratio = m.hp / m.maxHp;
                const bw = ts - 4;
                ctx.fillStyle = '#400';
                ctx.fillRect(sx + 2, sy, bw, 2);
                ctx.fillStyle = ratio > 0.5 ? '#4a4' : ratio > 0.25 ? '#aa4' : '#a44';
                ctx.fillRect(sx + 2, sy, Math.round(bw * ratio), 2);
            }
        }

        // Player
        {
            const sx = (G.player.x - this.offsetX) * ts;
            const sy = (G.player.y - this.offsetY) * ts;
            ctx.fillStyle = '#1a1a0a';
            ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
            ctx.fillStyle = G.player.color;
            ctx.fillText('@', sx + ts / 2, sy + ts / 2);
        }

        this.renderMinimap();
    },

    renderMinimap() {
        const mc = this.miniCtx;
        const s = 2;
        mc.fillStyle = '#0a0a0e';
        mc.fillRect(0, 0, G.width * s, G.height * s);

        for (let y = 0; y < G.height; y++) {
            for (let x = 0; x < G.width; x++) {
                const idx = y * G.width + x;
                if (!G.explored[idx]) continue;
                const tile = G.tiles[idx];
                if (tile === WALL) {
                    mc.fillStyle = G.visible[idx] ? '#222238' : '#15151e';
                } else if (tile === STAIRS_DOWN) {
                    mc.fillStyle = '#2aa';
                } else {
                    mc.fillStyle = G.visible[idx] ? '#2a2a35' : '#18181e';
                }
                mc.fillRect(x * s, y * s, s, s);
            }
        }

        // Monsters on minimap (visible only)
        for (const m of G.monsters) {
            if (m.hp > 0 && G.visible[m.y * G.width + m.x]) {
                mc.fillStyle = '#f44';
                mc.fillRect(m.x * s, m.y * s, s, s);
            }
        }

        // Player on minimap
        mc.fillStyle = '#fff';
        mc.fillRect(G.player.x * s, G.player.y * s, s, s);
    }
};
