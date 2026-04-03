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

        // Larger tiles for readability — aim for ~30 visible columns
        const maxCols = 34;
        this.tileSize = Math.max(18, Math.min(28, Math.floor(w / maxCols)));
        this.viewCols = Math.floor(w / this.tileSize);
        this.viewRows = Math.floor(h / this.tileSize);

        // Minimap
        const mScale = 3;
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

        // Background (void)
        ctx.fillStyle = '#08080c';
        ctx.fillRect(0, 0, w, h);

        const gap = 1; // gap between tiles for grid effect

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
                const inner = ts - gap;

                if (vis) {
                    if (tile === WALL) {
                        // Solid bright wall blocks
                        ctx.fillStyle = '#3a3a5c';
                        ctx.fillRect(px, py, inner, inner);
                        // Subtle top/left highlight
                        ctx.fillStyle = '#50508a';
                        ctx.fillRect(px, py, inner, 2);
                        ctx.fillRect(px, py, 2, inner);
                    } else if (tile === STAIRS_DOWN) {
                        ctx.fillStyle = '#1e2a2e';
                        ctx.fillRect(px, py, inner, inner);
                        ctx.fillStyle = '#55ffee';
                        ctx.font = `bold ${ts - 4}px monospace`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('>', px + inner / 2, py + inner / 2 + 1);
                    } else if (tile === STAIRS_UP) {
                        ctx.fillStyle = '#2e2a1e';
                        ctx.fillRect(px, py, inner, inner);
                        ctx.fillStyle = '#ffee55';
                        ctx.font = `bold ${ts - 4}px monospace`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('<', px + inner / 2, py + inner / 2 + 1);
                    } else {
                        // Floor — warm sandy tone
                        ctx.fillStyle = '#28262e';
                        ctx.fillRect(px, py, inner, inner);
                        // Small center dot
                        ctx.fillStyle = '#3d3a44';
                        const dotR = Math.max(1.5, ts / 10);
                        ctx.beginPath();
                        ctx.arc(px + inner / 2, py + inner / 2, dotR, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else {
                    // Explored but not visible — dimmed versions
                    if (tile === WALL) {
                        ctx.fillStyle = '#1e1e2a';
                        ctx.fillRect(px, py, inner, inner);
                    } else {
                        ctx.fillStyle = '#161620';
                        ctx.fillRect(px, py, inner, inner);
                    }
                }
            }
        }

        // Set font for glyphs
        ctx.font = `bold ${ts - 4}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const inner = ts - gap;

        // Items (visible only)
        for (const item of G.items) {
            if (item.x < 0 || !G.visible[item.y * G.width + item.x]) continue;
            const sx = (item.x - this.offsetX) * ts;
            const sy = (item.y - this.offsetY) * ts;
            // Glowing background
            ctx.fillStyle = item.color + '22';
            ctx.fillRect(sx + 2, sy + 2, inner - 4, inner - 4);
            ctx.fillStyle = item.color;
            ctx.fillText(item.glyph, sx + inner / 2, sy + inner / 2 + 1);
        }

        // Monsters (visible only)
        for (const m of G.monsters) {
            if (m.hp <= 0 || !G.visible[m.y * G.width + m.x]) continue;
            const sx = (m.x - this.offsetX) * ts;
            const sy = (m.y - this.offsetY) * ts;
            // Dark background behind monster
            ctx.fillStyle = '#1a0a0a';
            ctx.fillRect(sx + 2, sy + 2, inner - 4, inner - 4);
            // Colored border
            ctx.strokeStyle = m.color + '88';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(sx + 2.5, sy + 2.5, inner - 5, inner - 5);
            // Glyph
            ctx.fillStyle = m.color;
            ctx.fillText(m.glyph, sx + inner / 2, sy + inner / 2 + 1);

            // HP bar for damaged monsters
            if (m.hp < m.maxHp) {
                const ratio = m.hp / m.maxHp;
                const bw = inner - 4;
                ctx.fillStyle = '#600';
                ctx.fillRect(sx + 2, sy + 1, bw, 3);
                ctx.fillStyle = ratio > 0.5 ? '#4c4' : ratio > 0.25 ? '#cc4' : '#c44';
                ctx.fillRect(sx + 2, sy + 1, Math.round(bw * ratio), 3);
            }
        }

        // Player — bright and prominent
        {
            const sx = (G.player.x - this.offsetX) * ts;
            const sy = (G.player.y - this.offsetY) * ts;
            // Glow effect
            ctx.fillStyle = '#ffdd4422';
            ctx.fillRect(sx - 2, sy - 2, inner + 4, inner + 4);
            // Background
            ctx.fillStyle = '#2a2810';
            ctx.fillRect(sx + 1, sy + 1, inner - 2, inner - 2);
            // Border
            ctx.strokeStyle = '#ffdd44';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx + 2, sy + 2, inner - 4, inner - 4);
            // Glyph
            ctx.fillStyle = '#ffee66';
            ctx.font = `bold ${ts - 2}px monospace`;
            ctx.fillText('@', sx + inner / 2, sy + inner / 2 + 1);
        }

        this.renderMinimap();
    },

    renderMinimap() {
        const mc = this.miniCtx;
        const s = 3;
        mc.fillStyle = '#08080c';
        mc.fillRect(0, 0, G.width * s, G.height * s);

        for (let y = 0; y < G.height; y++) {
            for (let x = 0; x < G.width; x++) {
                const idx = y * G.width + x;
                if (!G.explored[idx]) continue;
                const tile = G.tiles[idx];
                const vis = G.visible[idx];
                if (tile === WALL) {
                    mc.fillStyle = vis ? '#3a3a5c' : '#1e1e2a';
                } else if (tile === STAIRS_DOWN) {
                    mc.fillStyle = '#44ccbb';
                } else {
                    mc.fillStyle = vis ? '#33303a' : '#1a1a22';
                }
                mc.fillRect(x * s, y * s, s, s);
            }
        }

        // Monsters on minimap (visible only)
        for (const m of G.monsters) {
            if (m.hp > 0 && G.visible[m.y * G.width + m.x]) {
                mc.fillStyle = '#ff5555';
                mc.fillRect(m.x * s, m.y * s, s, s);
            }
        }

        // Items on minimap (visible only)
        for (const it of G.items) {
            if (it.x >= 0 && G.visible[it.y * G.width + it.x]) {
                mc.fillStyle = '#ffcc44';
                mc.fillRect(it.x * s, it.y * s, s, s);
            }
        }

        // Player on minimap — bright and large
        mc.fillStyle = '#ffee44';
        mc.fillRect(G.player.x * s - 1, G.player.y * s - 1, s + 2, s + 2);
    }
};
