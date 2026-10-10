/* 平衡性模拟 v2：可调参数 + 更聪明的玩家 */
const BASE = {
    hourMs:28000, aiMs:5000,
    mainP:0.32, subP:0.28,
    clsUp:3, clsDown:28,
    repairMs:65, repairAdd:3, doorDmg:10,
    subGrace:7,
    retreatP:0.80,     // 撞门后退回走廊的概率
    backP:0.30,        // 在走廊时退回办公室的概率
    fwdP:0.80,         // 走廊->门口 相对 mainP 的倍率
    jcPush:false       // JC 是否顺带让主教练前进
};
const END_HOUR = 23;

function run(D, seed) {
    let rnd = seed >>> 0;
    const R = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    let dead = false, reason = '';
    let mainPos = 0, subPos = 0, cls = 0;
    let doorClosed = false, dur = 100;
    let studying = false, subDanger = 0, studyProg = 0;
    let sec = 0;

    const totalSec = END_HOUR * D.hourMs / 1000;
    const aiEvery = D.aiMs / 1000;

    for (; sec < totalSec && !dead; sec++) {
        /* ===== 玩家决策 ===== */
        if (subPos === 1 && subDanger > 0) {
            studying = true;                                   // 优先级1：躲副教练
        } else {
            studying = false;
            if (mainPos >= 1) {
                doorClosed = true;                             // 他靠近了：关门
            } else if (dur < 70) {
                doorClosed = false;                            // 他在办公室：开门抢修
            } else {
                doorClosed = true;                             // 其余时间关门
            }
        }
        const watchCls = !studying && cls >= 55 && !(mainPos === 2);

        /* ===== 每秒 ===== */
        if (watchCls) cls = Math.max(0, cls - D.clsDown);
        else cls += D.clsUp;
        if (cls >= 100) {
            cls = 0;
            // 关键修正：主教练已在门口时，JC 不再开门（否则玩家刷题中必死，无解）
            if (doorClosed && mainPos < 2) doorClosed = false;
            if (D.jcPush && mainPos < 2) mainPos++;
        }

        if (subPos === 1) {
            if (studying) {
                studyProg += 100 / D.subGrace;
                if (studyProg >= 100) { subPos = 0; studyProg = 0; subDanger = 0; }
            } else {
                subDanger -= 1;
                if (subDanger <= 0) { dead = true; reason = '副教练'; break; }
            }
        }

        // 修门
        if (!studying && !doorClosed && dur < 100 && mainPos <= 1) {
            if (mainPos === 2) { dead = true; reason = '修门被抓'; break; }
            dur = Math.min(100, dur + (1000 / D.repairMs) * D.repairAdd);
        }

        /* ===== AI tick ===== */
        if (sec % aiEvery < 1) {
            if (R() < D.mainP) {
                if (mainPos === 2) {
                    if (doorClosed) {
                        dur -= D.doorDmg;
                        if (dur <= 0) { dead = true; reason = '破门'; break; }
                        if (R() < D.retreatP) mainPos = 1;
                    } else { dead = true; reason = '主教练进门'; break; }
                } else if (mainPos === 1) {
                    if (R() < D.backP) mainPos = 0;
                    else if (R() < D.fwdP) mainPos = 2;
                } else {
                    mainPos = 1;
                }
            }
            if (!studying && subPos === 0 && R() < D.subP) {
                subPos = 1; subDanger = D.subGrace; studyProg = 0;
            }
        }
    }
    const hours = Math.floor(sec / (D.hourMs / 1000));
    return { win: !dead && hours >= END_HOUR, reason, hours };
}

function evalD(D, n = 3000) {
    let w = 0; const causes = {}; let sumH = 0;
    for (let i = 1; i <= n; i++) {
        const r = run(D, i * 7919 + 13);
        if (r.win) w++; else causes[r.reason] = (causes[r.reason] || 0) + 1;
        sumH += r.hours;
    }
    const top = Object.entries(causes).sort((a, b) => b[1] - a[1]);
    return { rate: w / n * 100, top, avgH: sumH / n };
}

const PRESETS = {
    easy:   { hourMs:32000, aiMs:6000, mainP:0.22, subP:0.18, clsUp:1.5, clsDown:30, repairMs:55, repairAdd:3, doorDmg:8,  subGrace:9, retreatP:0.85, backP:0.35, fwdP:0.75 },
    normal: { hourMs:28000, aiMs:5000, mainP:0.32, subP:0.28, clsUp:3,   clsDown:28, repairMs:65, repairAdd:3, doorDmg:10, subGrace:7, retreatP:0.80, backP:0.30, fwdP:0.80 },
    hard:   { hourMs:25000, aiMs:4300, mainP:0.42, subP:0.36, clsUp:4.5, clsDown:26, repairMs:75, repairAdd:3, doorDmg:12, subGrace:7, retreatP:0.75, backP:0.25, fwdP:0.85 },
    hell:   { hourMs:22000, aiMs:3700, mainP:0.52, subP:0.44, clsUp:6,   clsDown:24, repairMs:85, repairAdd:3, doorDmg:14, subGrace:7, retreatP:0.70, backP:0.20, fwdP:0.90 },
    epic:   { hourMs:19000, aiMs:3200, mainP:0.62, subP:0.52, clsUp:8,   clsDown:22, repairMs:95, repairAdd:3, doorDmg:16, subGrace:7, retreatP:0.65, backP:0.15, fwdP:0.95 },
};

if (process.argv[2] === 'sweep') {
    console.log('参数扫描（固定 normal 其它项，只变一个）\n');
    const tests = [
        ['retreatP', [0.5, 0.65, 0.75, 0.85, 0.95]],
        ['doorDmg',  [6, 8, 10, 12, 14]],
        ['repairAdd',[2, 3, 4, 5, 6]],
        ['mainP',    [0.22, 0.28, 0.32, 0.38, 0.45]],
        ['clsUp',    [2, 3, 4, 5, 6]],
    ];
    for (const [key, vals] of tests) {
        const row = vals.map(v => {
            const D = Object.assign({}, BASE, PRESETS.normal, { [key]: v });
            return `${v}:${evalD(D, 1500).rate.toFixed(0)}%`;
        });
        console.log(`  ${key.padEnd(10)} ${row.join('   ')}`);
    }
} else {
    console.log('每档 3000 局（理智玩家，反应零延迟）\n');
    console.log('难度    胜率    平均撑到  主要死因');
    console.log('--------------------------------------------------');
    for (const k of Object.keys(PRESETS)) {
        const D = Object.assign({}, BASE, PRESETS[k]);
        const r = evalD(D, 3000);
        console.log(`${k.padEnd(7)} ${r.rate.toFixed(1).padStart(5)}%  ${r.avgH.toFixed(1).padStart(6)}h   ` +
            (r.top[0] ? `${r.top[0][0]}(${(r.top[0][1]/30).toFixed(0)}%)` : '-'));
    }
}
