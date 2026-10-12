/* 新机制模拟器：JC 永远开门 + 同学打断 + 成就每局计分
   用途：重新校准评级门槛（S 太好拿） */

const DIFF = {
    easy:   { hourMs:32000, aiMs:6000, mainP:0.24, subP:0.20, backP:0.60, fwdP:0.78, retreatP:0.85,
              clsUp:2.0, clsDown:30, jcPush:false, studyRate:0.18, target:60, clsInterrupt:0,
              blackoutN:1, blackoutSec:6,  repairMs:55, repairAdd:3, doorDmg:9,  subGrace:7 },
    normal: { hourMs:28000, aiMs:5000, mainP:0.32, subP:0.28, backP:0.55, fwdP:0.82, retreatP:0.80,
              clsUp:3.0, clsDown:28, jcPush:false, studyRate:0.19, target:70, clsInterrupt:0.025,
              blackoutN:2, blackoutSec:7,  repairMs:65, repairAdd:3, doorDmg:11, subGrace:7 },
    hard:   { hourMs:25000, aiMs:4500, mainP:0.40, subP:0.34, backP:0.48, fwdP:0.86, retreatP:0.78,
              clsUp:4.0, clsDown:26, jcPush:false, studyRate:0.24, target:80, clsInterrupt:0.035,
              blackoutN:3, blackoutSec:8,  repairMs:75, repairAdd:3, doorDmg:12, subGrace:7 },
    hell:   { hourMs:22000, aiMs:3800, mainP:0.42, subP:0.36, backP:0.50, fwdP:0.90, retreatP:0.76,
              clsUp:4.5, clsDown:24, jcPush:true,  studyRate:0.29, target:85, clsInterrupt:0.045,
              blackoutN:4, blackoutSec:9,  repairMs:85, repairAdd:3, doorDmg:13, subGrace:7 },
    epic:   { hourMs:19000, aiMs:3300, mainP:0.40, subP:0.34, backP:0.48, fwdP:0.95, retreatP:0.74,
              clsUp:5.0, clsDown:22, jcPush:true,  studyRate:0.34, target:92, clsInterrupt:0.055,
              blackoutN:4, blackoutSec:8,  repairMs:95, repairAdd:3, doorDmg:15, subGrace:7 },
};
const END_HOUR = 23, FLOW_SEC = 30, FLOW_MULT = 1.3;
const JC_GRACE = 3, INTERRUPT_AT = 50, INTERRUPT_CD = 15;
const LVL_SCORE = { C:80, B:150, A:300, S:500 };

function run(D, seed) {
    let rnd = seed >>> 0;
    const R = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    const boHours = [];
    for (let i = 1; i <= (D.blackoutN||0); i++) boHours.push(Math.round(i*END_HOUR/((D.blackoutN||0)+1)));

    let dead=false, mainPos=0, subPos=0, cls=0;
    let doorClosed=false, dur=100, studying=false, subDanger=0, studyProg=0, sec=0;
    let prog=0, streak=0, jc=0, studySec=0, durMin=100, maxStreak=0;
    let blackout=false, boLeft=0, doorGrace=0, interrupts=0, lastItp=-999;
    let savedFromJc=false, jcAtDoor=0;
    const totalSec = END_HOUR * D.hourMs/1000, aiEvery = D.aiMs/1000;

    for (; sec < totalSec && !dead; sec++) {
        const hour = Math.floor(sec / (D.hourMs/1000));
        if (!blackout && boHours.indexOf(hour) >= 0) { blackout = true; boLeft = D.blackoutSec; }
        if (blackout) { boLeft--; if (boLeft<=0) blackout=false; }
        if (doorGrace > 0) doorGrace--;

        /* ---- 玩家策略 ---- */
        let wantStudy;
        if (subPos===1 && subDanger>0) wantStudy = true;                 // 躲副教练
        else if (!doorClosed && mainPos===2) wantStudy = false;          // 门开了+人在门口 → 赶紧关！
        else if (mainPos >= 2) wantStudy = false;                        // 守门
        else if (prog < (sec/totalSec) * D.target * 1.05) wantStudy = true;
        else if (cls >= 55) wantStudy = false;                           // 压捣乱
        else if (dur < 70) wantStudy = false;                            // 修门
        else wantStudy = false;

        // 断电：啥也看不见，只能刷（但门口有人时必须盯着）
        if (blackout && !(mainPos===2 && !doorClosed)) wantStudy = true;

        studying = wantStudy;

        /* 开关门（只在非刷题时） */
        if (!blackout) {
            if (mainPos >= 1) doorClosed = true;
            else if (dur < 70 && !studying) doorClosed = false;
            else if (dur >= 100) doorClosed = false;
            if (boHours.indexOf(hour+1) >= 0) doorClosed = true;   // 提前关门
        }
        // 极限救门：宽限期内关回去
        if (!doorClosed && doorGrace > 0 && mainPos === 2 && !studying) {
            doorClosed = true; savedFromJc = true;
        }

        /* ---- 同学打断刷题 ---- */
        const itp = D.clsInterrupt || 0;
        if (itp > 0 && studying && !blackout && subDanger<=0 &&
            cls >= INTERRUPT_AT && sec - lastItp >= INTERRUPT_CD) {
            if (R() < itp) { lastItp = sec; interrupts++; streak = 0; studying = false; }
        }

        /* ---- 进度 & 心流 ---- */
        if (studying) {
            studySec++; streak++; maxStreak = Math.max(maxStreak, streak);
            prog += D.studyRate * (streak >= FLOW_SEC ? FLOW_MULT : 1.0);
        } else streak = 0;
        durMin = Math.min(durMin, dur);

        /* ---- 每秒事件 ---- */
        const watching = !studying && cls >= 55 && !(mainPos===2);
        if (watching) cls = Math.max(0, cls - D.clsDown); else cls += D.clsUp;

        if (cls >= 100) {
            cls = 0; jc++;
            if (doorClosed) { doorClosed = false; if (mainPos===2) { jcAtDoor++; doorGrace = JC_GRACE; } }
            if (D.jcPush && mainPos < 2) mainPos++;
            if (mainPos === 2 && !doorClosed && doorGrace <= 0) { /* 下一 tick 判死 */ }
        }

        if (subPos===1) {
            if (studying) { studyProg += 100/D.subGrace; if (studyProg>=100){subPos=0;studyProg=0;subDanger=0;} }
            else { subDanger -= 1; if (subDanger<=0){dead=true;break;} }
        }
        if (!studying && !doorClosed && dur<100 && mainPos<=1) {
            if (mainPos===2){dead=true;break;}
            dur = Math.min(100, dur + (1000/D.repairMs)*D.repairAdd);
        }

        /* ---- AI tick ---- */
        if (sec % aiEvery < 1) {
            if (R() < D.mainP) {
                if (mainPos===2) {
                    if (doorClosed) { dur -= D.doorDmg; if (dur<=0){dead=true;break;} if (R()<D.retreatP) mainPos=1; }
                    else if (doorGrace > 0) { /* 宽限，不进门 */ }
                    else { dead = true; break; }
                } else if (mainPos===1) { if (R()<D.backP) mainPos=0; else if (R()<D.fwdP) mainPos=2; }
                else mainPos=1;
            }
            if (!studying && subPos===0 && R()<D.subP){ subPos=1; subDanger=D.subGrace; studyProg=0; }
        }
    }
    const hours = dead ? Math.floor(sec/(D.hourMs/1000)) : END_HOUR;
    return { dead, hours, prog, jc, studySec, totalSec:Math.max(1,sec), dur:Math.max(0,dur),
             durMin, maxStreak, interrupts, savedFromJc, jcAtDoor };
}

function scoreOf(r, key, MULT) {
    const D = DIFF[key];
    const win = !r.dead, trueWin = win && r.prog >= D.target;
    const base = r.hours * 40;
    const progScore = Math.round(Math.min(r.prog, D.target*1.5) * 8);
    const winBonus = trueWin ? 1500 : 0;
    const durBonus = win ? Math.round(r.dur * 2) : 0;
    const jcPenalty = r.jc * 80;
    const ratio = r.studySec / r.totalSec;
    let ach = 0;
    // 成就：本局达成即给（新逻辑）
    if (win) {
        if (r.durMin >= 50) ach += LVL_SCORE.B;                 // 门神
        if (r.jc === 0)     ach += LVL_SCORE.B;                 // 友好交流
        if (!trueWin)       ach += LVL_SCORE.B;                 // 熬了个寂寞
        if (Math.abs(r.prog - D.target) <= 3) ach += LVL_SCORE.A; // 刚刚好
        if (r.prog >= D.target*1.5) ach += LVL_SCORE.S;         // 超额完成
        if (key==='epic')   ach += LVL_SCORE.A;                 // 史诗幸存者
    }
    if (ratio >= 0.45) ach += LVL_SCORE.B;                      // 卷王
    if (ratio >= 0.80) ach += LVL_SCORE.B;                      // 诚实劳动
    if (r.maxStreak >= 60) ach += LVL_SCORE.B;                  // 心流
    if (r.jc >= 5)     ach += LVL_SCORE.S;                      // JC神
    if (r.interrupts >= 5) ach += LVL_SCORE.B;                  // 注意纪律
    if (ratio >= 0.45 && r.interrupts === 0) ach += LVL_SCORE.A; // 心无旁骛
    if (r.savedFromJc) ach += LVL_SCORE.S;                      // 极限救门
    const perf = Math.max(0, base + progScore + durBonus - jcPenalty + ach);
    return { total: Math.round(perf * MULT[key] + winBonus), ach, trueWin, win };
}

const MULT = { easy:0.8, normal:1.0, hard:1.3, hell:1.7, epic:2.2 };
function rawRank(s){ if(s>=7700)return 'SSS'; if(s>=4700)return 'SS'; if(s>=4000)return 'S';
                     if(s>=3350)return 'A'; if(s>=1400)return 'B'; if(s>=700)return 'C'; return 'D'; }
const RANK_CAP={easy:'A',normal:'S',hard:'SS',hell:'SS',epic:'SSS'};
const ORDER=['D','C','B','A','S','SS','SSS'];
function rankOf(s,k){ let r=rawRank(s); const c=RANK_CAP[k];
  return ORDER.indexOf(r)>ORDER.indexOf(c)?c:r; }
const N = 4000;

console.log('新机制下的真通关率与分数（每档 ' + N + ' 局）\n');
console.log('难度    真通关%  被打断均次  JC@门口  平均分');
console.log('-'.repeat(56));
const all = {};
for (const k of Object.keys(DIFF)) {
    let tw=0, itpSum=0, jadSum=0, sSum=0;
    const scores=[];
    for (let i=1;i<=N;i++){
        const r = run(DIFF[k], i*7919+13);
        const s = scoreOf(r,k,MULT);
        if (s.trueWin) tw++;
        itpSum += r.interrupts; jadSum += r.jcAtDoor; sSum += s.total;
        scores.push(s.total);
    }
    all[k]=scores.sort((a,b)=>a-b);
    console.log(`${k.padEnd(7)} ${(tw/N*100).toFixed(1).padStart(6)}% ${(itpSum/N).toFixed(1).padStart(9)} ${(jadSum/N).toFixed(1).padStart(9)} ${(sSum/N).toFixed(0).padStart(8)}`);
}

// 分数分位 —— 用来定门槛
console.log('\n各难度分数分位（用于定门槛）');
console.log('难度      p10    p25    p50    p75    p90    p95    p99');
console.log('-'.repeat(56));
for (const k of Object.keys(DIFF)) {
    const a = all[k], q=p=>a[Math.floor(a.length*p)];
    console.log(`${k.padEnd(8)} ${String(q(.1)).padStart(6)} ${String(q(.25)).padStart(6)} ${String(q(.5)).padStart(6)} ${String(q(.75)).padStart(6)} ${String(q(.9)).padStart(6)} ${String(q(.95)).padStart(6)} ${String(q(.99)).padStart(6)}`);
}

// 只用真通关局的分位（高评级应该只给通关的人）
console.log('\n【真通关局】分数分位');
console.log('难度      p10    p25    p50    p75    p90    p95');
console.log('-'.repeat(50));
const winScores = {};
for (const k of Object.keys(DIFF)) {
    const ws=[];
    for (let i=1;i<=N;i++){
        const r = run(DIFF[k], i*7919+13);
        const s = scoreOf(r,k,MULT);
        if (s.trueWin) ws.push(s.total);
    }
    ws.sort((a,b)=>a-b); winScores[k]=ws;
    const q=p=>ws.length?ws[Math.floor(ws.length*p)]:0;
    console.log(`${k.padEnd(8)} ${String(q(.1)).padStart(6)} ${String(q(.25)).padStart(6)} ${String(q(.5)).padStart(6)} ${String(q(.75)).padStart(6)} ${String(q(.9)).padStart(6)} ${String(q(.95)).padStart(6)}`);
}


console.log('\n【最终评级分布】每档 4000 局');
console.log('难度    真通关%  评级分布');
console.log('-'.repeat(78));
for (const k of Object.keys(DIFF)) {
    const cnt={}; let tw=0;
    for (let i=1;i<=N;i++){
        const r = run(DIFF[k], i*7919+13);
        const sc = scoreOf(r,k,MULT);
        if (sc.trueWin) tw++;
        const rk = rankOf(sc.total,k);
        cnt[rk]=(cnt[rk]||0)+1;
    }
    const dist = ORDER.filter(x=>cnt[x]).map(x=>`${x}:${(cnt[x]/N*100).toFixed(0)}%`).join(' ');
    console.log(`${k.padEnd(7)} ${(tw/N*100).toFixed(1).padStart(6)}%   ${dist}`);
}
