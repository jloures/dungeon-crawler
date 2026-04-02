'use strict';

// ===== Monster Definitions =====

const BESTIARY = [
    { glyph: 'r', name: 'Rat',      color: '#a0522d', hp: 8,  atk: 2, def: 0, xp: 3,  minLvl: 1, maxLvl: 3 },
    { glyph: 'b', name: 'Bat',      color: '#8888aa', hp: 6,  atk: 3, def: 0, xp: 4,  minLvl: 1, maxLvl: 4 },
    { glyph: 'g', name: 'Goblin',   color: '#55aa55', hp: 14, atk: 4, def: 1, xp: 8,  minLvl: 2, maxLvl: 5 },
    { glyph: 'k', name: 'Kobold',   color: '#cc8844', hp: 12, atk: 5, def: 1, xp: 10, minLvl: 2, maxLvl: 6 },
    { glyph: 's', name: 'Skeleton', color: '#cccccc', hp: 20, atk: 6, def: 2, xp: 15, minLvl: 3, maxLvl: 7 },
    { glyph: 'o', name: 'Orc',      color: '#448844', hp: 28, atk: 8, def: 3, xp: 22, minLvl: 4, maxLvl: 8 },
    { glyph: 'w', name: 'Wraith',   color: '#9966cc', hp: 22, atk: 10,def: 2, xp: 28, minLvl: 5, maxLvl: 9 },
    { glyph: 'T', name: 'Troll',    color: '#886644', hp: 40, atk: 12,def: 5, xp: 40, minLvl: 6, maxLvl: 10 },
    { glyph: 'D', name: 'Dragon',   color: '#ff4444', hp: 70, atk: 16,def: 8, xp: 80, minLvl: 8, maxLvl: 12 },
];

// ===== Item Definitions =====

const ITEM_TYPES = {
    potion:     { glyph: '!', color: '#ff6688', prefix: 'Health Potion' },
    weapon:     { glyph: '/', color: '#66aaff', prefix: '' },
    armor:      { glyph: ']', color: '#ddaa55', prefix: '' },
    scroll_lit: { glyph: '?', color: '#cc88ff', prefix: 'Scroll of Lightning' },
    scroll_fire:{ glyph: '?', color: '#ff8833', prefix: 'Scroll of Fireball' },
};

const WEAPONS = [
    { name: 'Rusty Dagger',    atk: 1, minLvl: 1 },
    { name: 'Short Sword',     atk: 2, minLvl: 1 },
    { name: 'Mace',            atk: 3, minLvl: 2 },
    { name: 'Longsword',       atk: 4, minLvl: 3 },
    { name: 'Battle Axe',      atk: 6, minLvl: 4 },
    { name: 'War Hammer',      atk: 8, minLvl: 6 },
    { name: 'Flaming Sword',   atk: 10,minLvl: 7 },
    { name: 'Dragon Slayer',   atk: 14,minLvl: 9 },
];

const ARMORS = [
    { name: 'Leather Armor',   def: 1, minLvl: 1 },
    { name: 'Studded Leather', def: 2, minLvl: 2 },
    { name: 'Chain Mail',      def: 3, minLvl: 3 },
    { name: 'Scale Mail',      def: 4, minLvl: 4 },
    { name: 'Plate Armor',     def: 6, minLvl: 6 },
    { name: 'Dragon Scale',    def: 9, minLvl: 8 },
];

// ===== Game State =====

const G = {
    width: 80,
    height: 45,
    tiles: null,
    visible: null,
    explored: null,
    rooms: [],
    player: null,
    monsters: [],
    items: [],
    dungeonLevel: 1,
    maxDungeonLevel: 10,
    seed: 0,
    rng: null,
    turn: 0,
    gameOver: false,
    victory: false,
    log: [],
    monstersKilled: 0,
    itemsUsed: 0,
};

function addLog(msg, color) {
    G.log.push({ msg, color: color || '#ccc', turn: G.turn });
    if (G.log.length > 100) G.log.shift();
}

// ===== Entity Creation =====

function createPlayer(x, y) {
    return {
        x, y, hp: 30, maxHp: 30,
        atk: 4, def: 2,
        level: 1, xp: 0, xpNext: 15,
        inventory: [],
        weapon: null, armor: null,
        glyph: '@', color: '#fff', name: 'You'
    };
}

function createMonster(template, x, y, rng, dungeonLevel) {
    const scale = 1 + (dungeonLevel - template.minLvl) * 0.12;
    return {
        x, y,
        hp: Math.round(template.hp * scale),
        maxHp: Math.round(template.hp * scale),
        atk: Math.round(template.atk * scale),
        def: template.def,
        xp: template.xp,
        glyph: template.glyph, color: template.color, name: template.name,
        awake: false
    };
}

function createItem(type, x, y, rng, dungeonLevel) {
    const def = ITEM_TYPES[type];
    const item = { x, y, type, glyph: def.glyph, color: def.color, value: 0, name: '' };

    if (type === 'potion') {
        item.value = 12 + dungeonLevel * 3;
        item.name = `Health Potion (+${item.value})`;
    } else if (type === 'weapon') {
        const pool = WEAPONS.filter(w => w.minLvl <= dungeonLevel + 1);
        const w = rng.pick(pool);
        item.value = w.atk;
        item.name = w.name + ` (+${w.atk} atk)`;
    } else if (type === 'armor') {
        const pool = ARMORS.filter(a => a.minLvl <= dungeonLevel + 1);
        const a = rng.pick(pool);
        item.value = a.def;
        item.name = a.name + ` (+${a.def} def)`;
    } else if (type === 'scroll_lit') {
        item.value = 15 + dungeonLevel * 4;
        item.name = `Scroll of Lightning (${item.value} dmg)`;
    } else if (type === 'scroll_fire') {
        item.value = 10 + dungeonLevel * 3;
        item.name = `Scroll of Fireball (${item.value} dmg)`;
    }
    return item;
}

// ===== Level Generation =====

function generateLevel(dungeonLevel) {
    const levelRNG = createRNG(G.seed + dungeonLevel * 7919);
    const { tiles, rooms } = generateDungeon(G.width, G.height, levelRNG, dungeonLevel);

    G.tiles = tiles;
    G.rooms = rooms;
    G.visible = new Uint8Array(G.width * G.height);
    if (!G.explored || dungeonLevel !== G.dungeonLevel) {
        G.explored = new Uint8Array(G.width * G.height);
    }
    G.dungeonLevel = dungeonLevel;

    // Place player in first room
    const start = rooms[0];
    if (!G.player) {
        G.player = createPlayer(start.cx, start.cy);
    } else {
        G.player.x = start.cx;
        G.player.y = start.cy;
    }

    // Spawn monsters
    G.monsters = [];
    const eligible = BESTIARY.filter(b => dungeonLevel >= b.minLvl && dungeonLevel <= b.maxLvl);
    const monsterCount = 4 + dungeonLevel * 2 + levelRNG.int(0, 3);
    for (let i = 0; i < monsterCount && rooms.length > 1; i++) {
        const room = rooms[levelRNG.int(1, rooms.length - 1)]; // skip first room
        const mx = levelRNG.int(room.x + 1, room.x + room.w - 2);
        const my = levelRNG.int(room.y + 1, room.y + room.h - 2);
        if (G.monsters.some(m => m.x === mx && m.y === my)) continue;
        const template = levelRNG.pick(eligible.length ? eligible : [BESTIARY[0]]);
        G.monsters.push(createMonster(template, mx, my, levelRNG, dungeonLevel));
    }

    // Spawn items
    G.items = [];
    const itemCount = 3 + levelRNG.int(0, 2 + Math.floor(dungeonLevel / 2));
    const itemTypes = ['potion', 'potion', 'weapon', 'armor', 'scroll_lit', 'scroll_fire'];
    for (let i = 0; i < itemCount && rooms.length > 1; i++) {
        const room = rooms[levelRNG.int(1, rooms.length - 1)];
        const ix = levelRNG.int(room.x + 1, room.x + room.w - 2);
        const iy = levelRNG.int(room.y + 1, room.y + room.h - 2);
        if (G.items.some(it => it.x === ix && it.y === iy)) continue;
        G.items.push(createItem(levelRNG.pick(itemTypes), ix, iy, levelRNG, dungeonLevel));
    }

    updateFOV();
}

// ===== FOV =====

function updateFOV() {
    computeFOV(G.tiles, G.width, G.height, G.player.x, G.player.y, 8, G.visible);
    for (let i = 0; i < G.visible.length; i++) {
        if (G.visible[i]) G.explored[i] = 1;
    }
    // Wake up visible monsters
    for (const m of G.monsters) {
        if (m.hp > 0 && G.visible[m.y * G.width + m.x]) m.awake = true;
    }
}

// ===== Combat =====

function attack(attacker, defender) {
    const baseDmg = attacker.atk - defender.def;
    const dmg = Math.max(1, baseDmg + Math.floor(Math.random() * 3) - 1);
    defender.hp -= dmg;

    if (attacker === G.player) {
        addLog(`You hit ${defender.name} for ${dmg} damage.`, '#ff9');
        if (defender.hp <= 0) {
            addLog(`${defender.name} is dead!`, '#4f4');
            G.player.xp += defender.xp;
            G.monstersKilled++;
            checkLevelUp();
        }
    } else {
        addLog(`${attacker.name} hits you for ${dmg} damage.`, '#f88');
        if (G.player.hp <= 0) {
            addLog('You died!', '#f44');
            G.gameOver = true;
        }
    }
}

function checkLevelUp() {
    while (G.player.xp >= G.player.xpNext) {
        G.player.xp -= G.player.xpNext;
        G.player.level++;
        G.player.xpNext = Math.round(G.player.xpNext * 1.5);
        const hpGain = 5 + G.player.level;
        G.player.maxHp += hpGain;
        G.player.hp = Math.min(G.player.hp + hpGain, G.player.maxHp);
        G.player.atk += 1;
        G.player.def += 1;
        addLog(`Level up! You are now level ${G.player.level}.`, '#ff0');
    }
}

// ===== Player Actions =====

function playerEffectiveAtk() { return G.player.atk + (G.player.weapon ? G.player.weapon.value : 0); }
function playerEffectiveDef() { return G.player.def + (G.player.armor ? G.player.armor.value : 0); }

function tryMove(dx, dy) {
    if (G.gameOver || G.victory) return false;

    const nx = G.player.x + dx, ny = G.player.y + dy;
    if (nx < 0 || nx >= G.width || ny < 0 || ny >= G.height) return false;

    // Attack monster?
    const target = G.monsters.find(m => m.x === nx && m.y === ny && m.hp > 0);
    if (target) {
        const p = G.player;
        attack({ atk: playerEffectiveAtk(), name: p.name }, target);
        endTurn();
        return true;
    }

    // Wall?
    if (G.tiles[ny * G.width + nx] === WALL) return false;

    G.player.x = nx;
    G.player.y = ny;

    // Pick up items automatically
    const groundItems = G.items.filter(it => it.x === nx && it.y === ny);
    for (const it of groundItems) {
        if (G.player.inventory.length < 10) {
            it.x = -1; it.y = -1;
            G.player.inventory.push(it);
            addLog(`Picked up ${it.name}.`, '#9cf');
        } else {
            addLog('Inventory full!', '#f88');
            break;
        }
    }
    G.items = G.items.filter(it => it.x >= 0);

    endTurn();
    return true;
}

function useStairs() {
    const tile = G.tiles[G.player.y * G.width + G.player.x];
    if (tile === STAIRS_DOWN) {
        if (G.dungeonLevel >= G.maxDungeonLevel) {
            addLog('You have conquered the dungeon! Victory!', '#ff0');
            G.victory = true;
            return true;
        }
        addLog(`You descend to level ${G.dungeonLevel + 1}.`, '#9cf');
        generateLevel(G.dungeonLevel + 1);
        return true;
    }
    if (tile === STAIRS_UP && G.dungeonLevel > 1) {
        addLog(`You ascend to level ${G.dungeonLevel - 1}.`, '#9cf');
        generateLevel(G.dungeonLevel - 1);
        return true;
    }
    return false;
}

function useItem(index) {
    if (G.gameOver || G.victory) return;
    const inv = G.player.inventory;
    if (index < 0 || index >= inv.length) return;
    const item = inv[index];

    if (item.type === 'potion') {
        const heal = Math.min(item.value, G.player.maxHp - G.player.hp);
        G.player.hp += heal;
        addLog(`Used ${item.name}. Healed ${heal} HP.`, '#4f4');
    } else if (item.type === 'weapon') {
        if (G.player.weapon) {
            inv.push(G.player.weapon); // Put old weapon back
        }
        G.player.weapon = item;
        addLog(`Equipped ${item.name}.`, '#6af');
        inv.splice(index, 1);
        G.itemsUsed++;
        return; // Don't remove from inv twice
    } else if (item.type === 'armor') {
        if (G.player.armor) {
            inv.push(G.player.armor);
        }
        G.player.armor = item;
        addLog(`Equipped ${item.name}.`, '#da5');
        inv.splice(index, 1);
        G.itemsUsed++;
        return;
    } else if (item.type === 'scroll_lit') {
        const alive = G.monsters.filter(m => m.hp > 0 && G.visible[m.y * G.width + m.x]);
        if (alive.length === 0) {
            addLog('No visible enemies to strike.', '#888');
            return;
        }
        // Hit nearest visible
        let nearest = alive[0], minDist = Infinity;
        for (const m of alive) {
            const d = Math.abs(m.x - G.player.x) + Math.abs(m.y - G.player.y);
            if (d < minDist) { minDist = d; nearest = m; }
        }
        nearest.hp -= item.value;
        addLog(`Lightning strikes ${nearest.name} for ${item.value} damage!`, '#c8f');
        if (nearest.hp <= 0) {
            addLog(`${nearest.name} is dead!`, '#4f4');
            G.player.xp += nearest.xp;
            G.monstersKilled++;
            checkLevelUp();
        }
    } else if (item.type === 'scroll_fire') {
        const alive = G.monsters.filter(m => m.hp > 0);
        let hit = 0;
        for (const m of alive) {
            const d = Math.abs(m.x - G.player.x) + Math.abs(m.y - G.player.y);
            if (d <= 4) {
                m.hp -= item.value;
                hit++;
                if (m.hp <= 0) {
                    addLog(`${m.name} is incinerated!`, '#4f4');
                    G.player.xp += m.xp;
                    G.monstersKilled++;
                    checkLevelUp();
                }
            }
        }
        addLog(`Fireball hits ${hit} enemies for ${item.value} damage each!`, '#f83');
    }

    inv.splice(index, 1);
    G.itemsUsed++;
    endTurn();
}

function dropItem(index) {
    const inv = G.player.inventory;
    if (index < 0 || index >= inv.length) return;
    const item = inv.splice(index, 1)[0];
    item.x = G.player.x;
    item.y = G.player.y;
    G.items.push(item);
    addLog(`Dropped ${item.name}.`, '#888');
}

function playerWait() {
    if (G.gameOver || G.victory) return;
    addLog('You wait.', '#888');
    endTurn();
}

// ===== Monster AI =====

function endTurn() {
    G.turn++;

    for (const m of G.monsters) {
        if (m.hp <= 0 || !m.awake) continue;

        const dist = Math.abs(m.x - G.player.x) + Math.abs(m.y - G.player.y);

        // Adjacent? Attack
        if (dist <= 1) {
            const pDef = playerEffectiveDef();
            const baseDmg = m.atk - pDef;
            const dmg = Math.max(1, baseDmg + Math.floor(Math.random() * 3) - 1);
            G.player.hp -= dmg;
            addLog(`${m.name} hits you for ${dmg} damage.`, '#f88');
            if (G.player.hp <= 0) {
                addLog('You died!', '#f44');
                G.gameOver = true;
            }
            continue;
        }

        // Chase player if awake
        const allEntities = [...G.monsters.filter(o => o !== m && o.hp > 0), G.player];
        const step = chaseStep(G.tiles, G.width, G.height, m.x, m.y, G.player.x, G.player.y, allEntities);
        if (step) {
            m.x = step.x;
            m.y = step.y;
        }
    }

    // Clean dead monsters
    G.monsters = G.monsters.filter(m => m.hp > 0);
    updateFOV();
}

function initGame(seed) {
    G.seed = typeof seed === 'string' ? hashSeed(seed) : seed;
    G.rng = createRNG(G.seed);
    G.dungeonLevel = 1;
    G.turn = 0;
    G.gameOver = false;
    G.victory = false;
    G.log = [];
    G.player = null;
    G.monstersKilled = 0;
    G.itemsUsed = 0;
    addLog('Welcome to the dungeon! Find the stairs on level 10 to escape.', '#ff0');
    addLog('Move: arrows/WASD/hjkl | Stairs: Enter | Wait: . | Items: 1-9', '#888');
    generateLevel(1);
}
