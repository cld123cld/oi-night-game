/* 刷题机制参数搜索：找出"需要多少比例时间刷题"以及各难度真通关率 */

const DIFF_BASE = {
    easy:   { hourMs:32000, aiMs:6000, mainP:0.24, subP:0.20, backP:0.60, fwdP:0.78, retreatP:0.85, clsUp:2.0, clsDown:30, jcPush:false, repairMs:55, repairAdd:3, doorDmg:9,  subGrace:7 },
    normal: { hourMs:28000, aiMs:5000, mainP:0.32, subP:0.28, backP:0.55, fwdP:0.82, retreatP:0.80, clsUp:3.0, clsDown:28, jcPush:false, repairMs:65, repairAdd:3, doorDmg:11, subGrace:7 },
    hard:   { hourMs:25000, aiMs:4500, mainP:0.40, subP:0.34, backP:0.48, fwdP:0.86, retreatP:0.78, clsUp:4.0, clsDown:26, jcPush:false, repairMs:75, repairAdd:3, doorDmg:12, subGrace:7 },
    hell:   { hourMs:22000, aiMs:3800, mainP:0.42, subP:0.36, backP:0.50, fwdP:0.90, retreatP:0.76, clsUp:4.5, clsDown:24, jcPush:true,  repairMs:85, repairAdd:3, doorDmg:13, subGrace:7 },
    epic:   { hourMs:19000, aiMs:3300, mainP:0.46, subP:0.42, backP:0.48, fwdP:0.95, retreatP:0.74, clsUp:5.0, clsDown:22, jcPush:true,  repairMs:95, repairAdd:3, doorDmg:15, subGrace:7 },
};
const END_HOUR = 23;

/* 候选 (target, studyRate) */
const CAND = {
    easy:   { target:60, rate:0.18 },
    normal: { target:70, rate:0.19 },
    hard:   { target:80, rate:0.24 },
    hell:   { target:85, rate:0.29 },
    epic:   { target:92, rate:0.34 },
};
const FLOW_SEC = 30, FLOW_MULT = 1.3;

function run(D, seed) {
    let rnd = seed >>> 0;
    const R = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    let dead=false, reason='', mainPos=0, subPos=0, cls=0;
    let doorClosed=false, dur=100, studying=false, subDanger=0, studyProg=0, sec=0;
    let prog=0, streak=0, jc=0, studySec=0;
    const totalSec = END_HOUR * D.hourMs/1000;
    const aiEvery = D.aiMs/1000;

    for (; sec < totalSec && !dead; sec++) {
        /* ---- 玩家策略 ---- */
        if (subPos===1 && subDanger>0) {
            studying = true;                          // 1. 躲副教练（最高优先级）
        } else if (mainPos >= 2) {
            studying = false;                         // 2. 门口堵人 → 关门
        } else if (prog < (sec/totalSec) * D.target * 1.05) {
            studying = true;                          // 3. 进度落后 → 刷
        } else if (cls >= 55) {
            studying = false;                         // 4. 看教室压捣乱
        } else if (dur < 70) {
            studying = false;                         // 5. 修门
        } else {
            studying = false;                         // 6. 待命防守
        }
        if (mainPos >= 1) doorClosed = true;
        else if (dur < 70 && !studying) doorClosed = false;
        else if (dur >= 100) doorClosed = false;

        /* ---- 进度 & 心流 ---- */
        if (studying) {
            studySec++;
            streak++;
            const mult = streak >= FLOW_SEC ? FLOW_MULT : 1.0;
            prog += D.rate * mult;
        } else {
            streak = 0;
        }

        /* ---- 每秒事件 ---- */
        const watching = !studying && cls >= 55 && !(mainPos===2);
        if (watching) cls = Math.max(0, cls - D.clsDown); else cls += D.clsUp;
        if (cls >= 100) { cls=0; jc++; if (doorClosed && mainPos<2) doorClosed=false; if (D.jcPush && mainPos<2) mainPos++; }

        if (subPos===1) {
            if (studying) { studyProg += 100/D.subGrace; if (studyProg>=100){subPos=0;studyProg=0;subDanger=0;} }
            else { subDanger -= 1; if (subDanger<=0){dead=true;reason='副教练';break;} }
        }
        if (!studying && !doorClosed && dur<100 && mainPos<=1) {
            if (mainPos===2){dead=true;reason='修门';break;}
            dur = Math.min(100, dur + (1000/D.repairMs)*D.repairAdd);
        }

        /* ---- AI tick ---- */
        if (sec % aiEvery < 1) {
            if (R() < D.mainP) {
                if (mainPos===2) {
                    if (doorClosed) { dur -= D.doorDmg; if (dur<=0){dead=true;reason='破门';break;} if (R()<D.retreatP) mainPos=1; }
                    else { dead=true; reason='进门'; break; }
                } else if (mainPos===1) { if (R()<D.backP) mainPos=0; else if (R()<D.fwdP) mainPos=2; }
                else mainPos=1;
            }
            if (!studying && subPos===0 && R()<D.subP){ subPos=1; subDanger=D.subGrace; studyProg=0; }
        }
    }
    const hours = dead ? Math.floor(sec/(D.hourMs/1000)) : END_HOUR;
    return { dead, reason, hours, prog, jc, studySec, totalSec:Math.max(1,sec), dur };
}

function evaluate(key, n=3000) {
    const D = Object.assign({}, DIFF_BASE[key], CAND[key]);
    let trueWin=0, aliveNoProg=0, deadN=0;
    let progSum=0, studyRatioSum=0;
    const causes={};
    for (let i=1;i<=n;i++){
        const r = run(D, i*7919+13);
        progSum += r.prog;
        studyRatioSum += r.studySec/r.totalSec;
        if (!r.dead && r.prog >= D.target) trueWin++;
        else if (!r.dead) aliveNoProg++;
        else { deadN++; causes[r.reason]=(causes[r.reason]||0)+1; }
    }
    const top = Object.entries(causes).sort((a,b)=>b[1]-a[1])[0];
    return {
        trueWin: trueWin/n*100,
        aliveNoProg: aliveNoProg/n*100,
        dead: deadN/n*100,
        avgProg: progSum/n,
        avgRatio: studyRatioSum/n*100,
        top: top?top[0]:'-'
    };
}

console.log('目标/速率候选方案验证（每个 3000 局）\n');
console.log('难度    目标  速率   真通关%  活但没刷完%  被抓%  平均进度  刷题时间占比');
console.log('-'.repeat(92));
for (const k of Object.keys(CAND)) {
    const r = evaluate(k);
    console.log(
        `${k.padEnd(7)} ${String(CAND[k].target).padStart(4)} ${String(CAND[k].rate).padStart(6)}` +
        `${r.trueWin.toFixed(1).padStart(9)}%${r.aliveNoProg.toFixed(1).padStart(12)}%` +
        `${r.dead.toFixed(1).padStart(8)}%${r.avgProg.toFixed(0).padStart(10)}%` +
        `${r.avgRatio.toFixed(0).padStart(13)}%`
    );
}

/* ================= 评分分布 ================= */
const DIFF_MULT = { easy:0.8, normal:1.0, hard:1.3, hell:1.7, epic:2.2 };
const LVL_SCORE = { C:80, B:150, A:300, S:500 };

function scoreOf(r, key) {
    const D = Object.assign({}, DIFF_BASE[key], CAND[key]);
    const win = !r.dead;
    const trueWin = win && r.prog >= D.target;
    const hours = r.hours;
    const base = hours * 40;
    const progScore = Math.round(Math.min(r.prog, D.target * 1.5) * 8);
    const winBonus = trueWin ? 1500 : 0;
    const durBonus = win ? Math.round(Math.max(0,r.dur) * 2) : 0;
    const jcPenalty = r.jc * 80;
    const ratio = r.studySec / r.totalSec;
    let ach = 0;
    if (ratio >= 0.45) ach += LVL_SCORE.B;          // 卷王
    if (ratio >= 0.80) ach += LVL_SCORE.B;          // 诚实劳动
    if (r.jc >= 5)     ach += LVL_SCORE.S;          // JC神
    if (r.studySec >= 0 && win && trueWin) ach += LVL_SCORE.B;  // 友好交流(近似)
    if (trueWin && key==='epic') ach += LVL_SCORE.A;
    const perf = Math.max(0, base + progScore + durBonus - jcPenalty + ach);
    return Math.round(perf * DIFF_MULT[key] + winBonus);
}
function rankOf(s){ if(s>=4200)return 'SSS'; if(s>=3400)return 'SS'; if(s>=2700)return 'S';
                    if(s>=1900)return 'A'; if(s>=1200)return 'B'; if(s>=600)return 'C'; return 'D'; }

console.log('\n' + '='.repeat(78));
console.log('  评分分布（含刷题进度）· 每档 3000 局');
console.log('='.repeat(78));
console.log('难度    真通关%  平均分   评级分布');
console.log('-'.repeat(78));
for (const k of Object.keys(CAND)) {
    const D = Object.assign({}, DIFF_BASE[k], CAND[k]);
    const scores=[]; let tw=0;
    for (let i=1;i<=3000;i++){
        const r = run(D, i*7919+13);
        if (!r.dead && r.prog >= D.target) tw++;
        scores.push(scoreOf(r,k));
    }
    scores.sort((a,b)=>a-b);
    const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
    const cnt={}; scores.forEach(s=>{const rr=rankOf(s); cnt[rr]=(cnt[rr]||0)+1;});
    const dist=['D','C','B','A','S','SS','SSS'].filter(x=>cnt[x])
        .map(x=>`${x}:${(cnt[x]/30).toFixed(0)}%`).join(' ');
    console.log(`${k.padEnd(7)} ${(tw/30).toFixed(1).padStart(6)}% ${avg.toFixed(0).padStart(7)}   ${dist}`);
}

console.log('\n典型局面：');
function demo(name,hours,prog,dur,jc,ach,key,tw){
    const D=Object.assign({},DIFF_BASE[key],CAND[key]);
    const base=hours*40, ps=Math.round(Math.min(prog,D.target*1.5)*8);
    const wb=tw?1500:0, db=tw?Math.round(dur*2):0, jp=jc*80;
    const perf=Math.max(0,base+ps+db-jp+ach);
    const tot=Math.round(perf*DIFF_MULT[key]+wb);
    console.log('  '+name.padEnd(38)+String(tot).padStart(5)+'  '+rankOf(tot));
}
demo('被抓，撑10h 进度30%',10,30,60,1,0,'normal',false);
demo('熬了个寂寞（23h 进度40%）',23,40,80,2,150,'normal',false);
demo('真通关 普通（进度72%）',23,72,80,1,300,'normal',true);
demo('真通关 普通 完美（进度105%）',23,105,100,0,800,'normal',true);
demo('真通关 地狱',23,90,70,2,600,'hell',true);
demo('真通关 史诗 完美',23,138,100,0,1000,'epic',true);
