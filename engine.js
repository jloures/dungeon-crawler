'use strict';

// ===== Seeded PRNG (Mulberry32) =====

function createRNG(seed) {
    let s = seed | 0;
    return {
        next() {
            s |= 0; s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        },
        int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); },
        pick(arr) { return arr[Math.floor(this.next() * arr.length)]; },
        chance(p) { return this.next() < p; },
        shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(this.next() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }
    };
}

function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
}

// ===== Tile Types =====

const WALL = 0, FLOOR = 1, STAIRS_DOWN = 2, STAIRS_UP = 3, DOOR = 4;

// ===== BSP Dungeon Generation =====

function generateDungeon(width, height, rng, dungeonLevel) {
    const tiles = new Uint8Array(width * height); // all walls by default
    const rooms = [];

    function idx(x, y) { return y * width + x; }

    // BSP split
    function splitBSP(x, y, w, h, depth) {
        const minRoom = 5;
        const minSplit = minRoom * 2 + 1;

        if (depth <= 0 || (w < minSplit && h < minSplit)) {
            // Place room in this leaf
            const rw = rng.int(minRoom, Math.min(w - 2, 12));
            const rh = rng.int(minRoom, Math.min(h - 2, 10));
            const rx = rng.int(x + 1, x + w - rw - 1);
            const ry = rng.int(y + 1, y + h - rh - 1);
            const room = { x: rx, y: ry, w: rw, h: rh, cx: (rx + rx + rw - 1) >> 1, cy: (ry + ry + rh - 1) >> 1 };
            rooms.push(room);
            for (let py = ry; py < ry + rh; py++)
                for (let px = rx; px < rx + rw; px++)
                    tiles[idx(px, py)] = FLOOR;
            return room;
        }

        const splitH = w > h ? false : h > w ? true : rng.chance(0.5);
        if (splitH && h >= minSplit) {
            const split = rng.int(y + minRoom + 1, y + h - minRoom - 1);
            const a = splitBSP(x, y, w, split - y, depth - 1);
            const b = splitBSP(x, split, w, y + h - split, depth - 1);
            connect(a, b);
            return rng.chance(0.5) ? a : b;
        } else if (!splitH && w >= minSplit) {
            const split = rng.int(x + minRoom + 1, x + w - minRoom - 1);
            const a = splitBSP(x, y, split - x, h, depth - 1);
            const b = splitBSP(split, y, x + w - split, h, depth - 1);
            connect(a, b);
            return rng.chance(0.5) ? a : b;
        } else {
            return splitBSP(x, y, w, h, 0);
        }
    }

    function connect(a, b) {
        let x1 = a.cx, y1 = a.cy, x2 = b.cx, y2 = b.cy;
        if (rng.chance(0.5)) {
            carveH(x1, x2, y1);
            carveV(y1, y2, x2);
        } else {
            carveV(y1, y2, x1);
            carveH(x1, x2, y2);
        }
    }

    function carveH(x1, x2, y) {
        const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
        for (let x = lo; x <= hi; x++) tiles[idx(x, y)] = tiles[idx(x, y)] || FLOOR;
    }

    function carveV(y1, y2, x) {
        const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
        for (let y = lo; y <= hi; y++) tiles[idx(x, y)] = tiles[idx(x, y)] || FLOOR;
    }

    splitBSP(0, 0, width, height, 6);

    // Place stairs
    if (rooms.length >= 2) {
        const startRoom = rooms[0];
        const endRoom = rooms[rooms.length - 1];
        tiles[idx(startRoom.cx, startRoom.cy)] = dungeonLevel > 1 ? STAIRS_UP : FLOOR;
        tiles[idx(endRoom.cx, endRoom.cy)] = STAIRS_DOWN;
    }

    return { tiles, rooms, width, height };
}

// ===== Field of View (Recursive Shadowcasting) =====

function computeFOV(tiles, width, height, px, py, radius, visible) {
    visible.fill(0);
    visible[py * width + px] = 1;

    const mult = [
        [1, 0, 0, -1, -1, 0, 0, 1],
        [0, 1, -1, 0, 0, -1, 1, 0],
        [0, 1, 1, 0, 0, -1, -1, 0],
        [1, 0, 0, 1, -1, 0, 0, -1]
    ];

    function cast(oct, row, startSlope, endSlope) {
        if (startSlope < endSlope) return;
        let nextStart = startSlope;
        for (let j = row; j <= radius; j++) {
            let blocked = false;
            for (let dx = -j; dx <= 0; dx++) {
                const dy = -j;
                const mapX = px + dx * mult[0][oct] + dy * mult[1][oct];
                const mapY = py + dx * mult[2][oct] + dy * mult[3][oct];
                const lSlope = (dx - 0.5) / (dy + 0.5);
                const rSlope = (dx + 0.5) / (dy - 0.5);

                if (startSlope < rSlope) continue;
                if (endSlope > lSlope) break;

                const dist2 = dx * dx + dy * dy;
                if (dist2 <= radius * radius && mapX >= 0 && mapX < width && mapY >= 0 && mapY < height) {
                    visible[mapY * width + mapX] = 1;
                }

                const isWall = mapX < 0 || mapX >= width || mapY < 0 || mapY >= height || tiles[mapY * width + mapX] === WALL;
                if (blocked) {
                    if (isWall) {
                        nextStart = rSlope;
                    } else {
                        blocked = false;
                        startSlope = nextStart;
                    }
                } else if (isWall && j < radius) {
                    blocked = true;
                    cast(oct, j + 1, nextStart, lSlope);
                    nextStart = rSlope;
                }
            }
            if (blocked) break;
        }
    }

    for (let oct = 0; oct < 8; oct++) cast(oct, 1, 1.0, 0.0);
}

// ===== Pathfinding (Simple chase) =====

function chaseStep(tiles, width, height, fx, fy, tx, ty, entities) {
    const dx = Math.sign(tx - fx);
    const dy = Math.sign(ty - fy);

    function passable(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        if (tiles[y * width + x] === WALL) return false;
        if (entities.some(e => e.x === x && e.y === y && e.hp > 0)) return false;
        return true;
    }

    // Try direct diagonal, then cardinal
    const attempts = [];
    if (dx !== 0 && dy !== 0) attempts.push([dx, dy]);
    if (dx !== 0) attempts.push([dx, 0]);
    if (dy !== 0) attempts.push([0, dy]);
    // Try perpendicular as fallback
    if (dy !== 0) attempts.push([0, dy]);
    if (dx !== 0) attempts.push([dx, 0]);

    for (const [mx, my] of attempts) {
        if (passable(fx + mx, fy + my)) return { x: fx + mx, y: fy + my };
    }
    return null;
}
