'use strict';

const $ = id => document.getElementById(id);

let touchStartX = 0, touchStartY = 0;

document.addEventListener('DOMContentLoaded', () => {
    const canvas = $('gameCanvas');
    const mini = $('minimap');

    Renderer.init(canvas, mini);

    // Seed from URL or random
    let seed = window.location.hash.slice(1);
    if (!seed) seed = String(Date.now());
    $('seedInput').value = seed;
    startGame(seed);

    window.addEventListener('resize', () => { Renderer.resize(); Renderer.render(); });
    document.addEventListener('keydown', handleKey);

    // Touch controls
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Buttons
    $('btnNewGame').addEventListener('click', () => {
        const s = String(Date.now());
        $('seedInput').value = s;
        startGame(s);
    });

    $('btnLoadSeed').addEventListener('click', () => {
        const s = $('seedInput').value.trim();
        if (s) startGame(s);
    });

    $('btnCopyLink').addEventListener('click', () => {
        const url = window.location.origin + window.location.pathname + '#' + $('seedInput').value;
        navigator.clipboard.writeText(url).then(() => {
            const btn = $('btnCopyLink');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Share Seed', 1500);
        });
    });

    // D-pad
    $('dUp').addEventListener('click', () => doMove(0, -1));
    $('dDown').addEventListener('click', () => doMove(0, 1));
    $('dLeft').addEventListener('click', () => doMove(-1, 0));
    $('dRight').addEventListener('click', () => doMove(1, 0));
    $('dWait').addEventListener('click', () => { playerWait(); refresh(); });
    $('dStairs').addEventListener('click', () => { useStairs(); refresh(); });

    // Inventory
    $('inventory').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-idx]');
        if (!btn) return;
        const idx = +btn.dataset.idx;
        const action = btn.dataset.action;
        if (action === 'use') useItem(idx);
        else if (action === 'drop') dropItem(idx);
        refresh();
    });
});

function startGame(seed) {
    window.location.hash = seed;
    initGame(seed);
    Renderer.resize();
    refresh();
}

function doMove(dx, dy) {
    if (tryMove(dx, dy)) refresh();
}

function handleKey(e) {
    if (G.gameOver || G.victory) {
        if (e.key === 'Enter' || e.key === ' ') {
            startGame(String(Date.now()));
        }
        return;
    }

    let handled = true;
    switch (e.key) {
        // Movement
        case 'ArrowUp': case 'w': case 'k': doMove(0, -1); break;
        case 'ArrowDown': case 's': case 'j': doMove(0, 1); break;
        case 'ArrowLeft': case 'a': case 'h': doMove(-1, 0); break;
        case 'ArrowRight': case 'd': case 'l': doMove(1, 0); break;
        // Diagonals (vim-style)
        case 'y': doMove(-1, -1); break;
        case 'u': doMove(1, -1); break;
        case 'b': doMove(-1, 1); break;
        case 'n': doMove(1, 1); break;
        // Actions
        case 'Enter': case '>': case '<': useStairs(); refresh(); break;
        case '.': case '5': playerWait(); refresh(); break;
        // Inventory (1-9)
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9':
            if (e.key !== '5') { useItem(+e.key - 1); refresh(); }
            break;
        default:
            handled = false;
    }
    if (handled) e.preventDefault();
}

function handleTouchStart(e) {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    e.preventDefault();
}

function handleTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) return; // tap, not swipe

    if (Math.abs(dx) > Math.abs(dy)) {
        doMove(dx > 0 ? 1 : -1, 0);
    } else {
        doMove(0, dy > 0 ? 1 : -1);
    }
    e.preventDefault();
}

function refresh() {
    Renderer.render();
    updateHUD();
    updateLog();
    updateInventory();
    updateOverlay();
}

function updateHUD() {
    const p = G.player;
    const hpPct = Math.max(0, p.hp / p.maxHp * 100);
    $('hpFill').style.width = hpPct + '%';
    $('hpFill').style.background = hpPct > 50 ? '#4a4' : hpPct > 25 ? '#aa4' : '#a44';
    $('hpText').textContent = `${Math.max(0, p.hp)} / ${p.maxHp}`;
    $('statLevel').textContent = p.level;
    $('statAtk').textContent = playerEffectiveAtk();
    $('statDef').textContent = playerEffectiveDef();
    $('statXp').textContent = `${p.xp} / ${p.xpNext}`;
    $('dungeonLevel').textContent = `Dungeon Level ${G.dungeonLevel}`;
    $('turnCount').textContent = `Turn ${G.turn}`;
}

function updateLog() {
    const el = $('messageLog');
    const recent = G.log.slice(-6);
    el.innerHTML = recent.map((m, i) => {
        const opacity = 0.4 + 0.6 * ((i + 1) / recent.length);
        return `<div style="color:${m.color};opacity:${opacity}">${m.msg}</div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
}

function updateInventory() {
    const inv = G.player.inventory;
    const el = $('inventory');
    if (inv.length === 0) {
        el.innerHTML = '<div class="inv-empty">Empty</div>';
        return;
    }

    el.innerHTML = inv.map((item, i) => {
        const equipped = (item === G.player.weapon || item === G.player.armor) ? ' [E]' : '';
        return `<div class="inv-item">
            <span class="inv-glyph" style="color:${item.color}">${item.glyph}</span>
            <span class="inv-name">${i + 1}. ${item.name}${equipped}</span>
            <button data-idx="${i}" data-action="use" class="inv-btn">Use</button>
            <button data-idx="${i}" data-action="drop" class="inv-btn inv-drop">Drop</button>
        </div>`;
    }).join('');
}

function updateOverlay() {
    const overlay = $('overlay');
    if (G.gameOver) {
        overlay.hidden = false;
        overlay.innerHTML = `
            <div class="overlay-box death">
                <h2>You Died</h2>
                <p>Dungeon Level ${G.dungeonLevel} | Player Level ${G.player.level}</p>
                <p>Turns: ${G.turn} | Kills: ${G.monstersKilled}</p>
                <button onclick="startGame(String(Date.now()))">New Game</button>
                <button onclick="startGame('${$('seedInput').value}')">Retry Seed</button>
            </div>`;
    } else if (G.victory) {
        overlay.hidden = false;
        overlay.innerHTML = `
            <div class="overlay-box victory">
                <h2>Victory!</h2>
                <p>You escaped the dungeon!</p>
                <p>Player Level ${G.player.level} | Turns: ${G.turn} | Kills: ${G.monstersKilled}</p>
                <button onclick="startGame(String(Date.now()))">New Game</button>
            </div>`;
    } else {
        overlay.hidden = true;
    }
}
