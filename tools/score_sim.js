/* 评分分布验证：模拟两种玩家风格，套用游戏里的评分公式，看评级线合不合理 */

const DIFF = {
    easy:   { hourMs:32000, aiMs:6000, mainP:0.24, subP:0.20, backP:0.60, fwdP:0.78, retreatP:0.85, clsUp:2.0, clsDown:30, jcPush:false, repairMs:55, repairAdd:3, doorDmg:9,  subGrace:7 },
    normal: { hourMs:28000, aiMs:5000, mainP:0.32, subP:0.28, backP:0.55, fwdP:0.82, retreatP:0.80, clsUp:3.0, clsDown:28, jcPush:false, repairMs:65, repairAdd:3, doorDmg:11, subGrace:7 },
    hard:   { hourMs:25000, aiMs:4500, mainP:0.40, subP:0.34, backP:0.48, fwdP:0.86, retreatP:0.78, clsUp:4.0, clsDown:26, jcPush:false, repairMs:75, repairAdd:3, doorDmg:12, subGrace:7 },
    hell:   { hourMs:22000, aiMs:3800, mainP:0.42, subP:0.36, backP:0.50, fwdP:0.90, retreatP:0.76, clsUp:4.5, clsDown:24, jcPush:true,  repairMs:85, repairAdd:3, doorDmg:13, subGrace:7 },
    epic:   { hourMs:19000, aiMs:3300, mainP:0.46, subP:0.42, backP:0.48, fwdP:0.95, retreatP:0.74, clsUp:5.0, clsDown:22, jcPush:true,  repairMs:95, repairAdd:3, doorDmg:15, subGrace:7 },
};
const DIFF_MULT = { easy:0.8, normal:1.0, hard:1.3, hell:1.7, epic:2.2 };
const LVL_SCORE = { C:80, B:150, A:300, S:500 };
const END_HOUR = 23;

function run(D, seed, style) {
    let rnd = seed >>> 0;
    const R = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    let dead=false, reason='', mainPos=0, subPos=0, cls=0;
    let doorClosed=false, dur=100, studying=false, subDanger=0, studyProg=0, sec=0;
    let jc=0, studySec=0, durMin=100, clsPeak=0;
    const durLast10=[], clsLast5=[];
    const totalSec = END_HOUR * D.hourMs/1000, aiEvery = D.aiMs/1000;

    for (; sec < totalSec && !dead; sec++) {
        /* 玩家风格 */
        if (subPos===1 && subDanger>0) studying = true;
        else {
            if (mainPos >= 1) doorClosed = true;
            else if (dur < 70) doorClosed = false;
            else doorClosed = true;
            if (style === 'grinder') studying = true;        // 卷王：空闲也刷题
            else if (style === 'lazy') studying = (cls > 60); // 摆烂：看心情
            else studying = false;
        }
        if (studying) studySec++;

        const watchCls = !studying && cls >= 55 && !(mainPos===2);
        if (watchCls) cls = Math.max(0, cls - D.clsDown); else cls += D.clsUp;
        clsPeak = Math.max(clsPeak, cls);
        if (cls >= 100) { cls=0; jc++; if (doorClosed && mainPos<2) doorClosed=false; if (D.jcPush && mainPos<2) mainPos++; }

        if (subPos===1) {
            if (studying) { studyProg += 100/D.subGrace; if (studyProg>=100){subPos=0;studyProg=0;subDanger=0;} }
            else { subDanger -= 1; if (subDanger<=0){dead=true;reason='副教练';break;} }
        }
        if (!studying && !doorClosed && dur<100 && mainPos<=1) {
            if (mainPos===2){dead=true;reason='修门';break;}
            dur = Math.min(100, dur + (1000/D.repairMs)*D.repairAdd);
        }

        durMin = Math.min(durMin, dur);
        durLast10.push(dur); if (durLast10.length>10) durLast10.shift();
        clsLast5.push(cls);  if (clsLast5.length>5)  clsLast5.shift();

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
    return { win: !dead, hours, dur: Math.max(0,dur), jc, studySec,
             totalSec: Math.max(1, sec), durMin, durLast10, clsLast5, reason };
}

function scoreOf(r, key) {
    const win = r.win;
    const base = r.hours * 40;
    const winBonus = win ? 1500 : 0;
    const durBonus = win ? Math.round(r.dur * 2) : 0;
    const jcPenalty = r.jc * 80;
    const ratio = r.studySec / r.totalSec;
    let ach = 0;
    if (win && r.durMin >= 50) ach += LVL_SCORE.B;                 // 门神
    if (win && r.jc === 0)     ach += LVL_SCORE.B;                 // 友好交流
    if (ratio >= 0.45)         ach += LVL_SCORE.B;                 // 卷王
    if (ratio >= 0.80)         ach += LVL_SCORE.B;                 // 诚实劳动
    if (r.jc >= 5)             ach += LVL_SCORE.S;                 // JC神
    if (win && key === 'epic') ach += LVL_SCORE.A;                 // 史诗幸存者
    if (win && r.durLast10.length) {
        const md = Math.min(...r.durLast10);
        if (md <= 5 && md > 0) ach += LVL_SCORE.S;                 // 压线通关
        const mc = Math.max(...r.clsLast5);
        const md5 = Math.min(...r.durLast10.slice(-5));
        if (mc >= 80 && md5 >= 50) ach += LVL_SCORE.A;             // 捣乱大师
    }
    const perf = Math.max(0, base + durBonus - jcPenalty + ach);
    const mult = DIFF_MULT[key];
    return Math.round(perf * mult + winBonus);
}

function rankOf(s){ if(s>=4200)return 'SSS'; if(s>=3400)return 'SS'; if(s>=2700)return 'S';
                    if(s>=1900)return 'A'; if(s>=1200)return 'B'; if(s>=600)return 'C'; return 'D'; }

for (const style of ['optimal', 'grinder', 'lazy']) {
    console.log(`\n${'='.repeat(70)}\n  玩法风格：${style}\n${'='.repeat(70)}`);
    console.log('难度    平均分   中位   评级分布');
    console.log('-'.repeat(70));
    for (const k of Object.keys(DIFF)) {
        const scores = [];
        for (let i = 1; i <= 3000; i++) scores.push(scoreOf(run(DIFF[k], i*7919+13, style), k));
        scores.sort((a,b)=>a-b);
        const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
        const med = scores[Math.floor(scores.length/2)];
        const cnt = {};
        scores.forEach(s => { const r = rankOf(s); cnt[r] = (cnt[r]||0)+1; });
        const dist = ['D','C','B','A','S','SS','SSS'].filter(r=>cnt[r])
            .map(r=>`${r}:${(cnt[r]/scores.length*100).toFixed(0)}%`).join(' ');
        console.log(`${k.padEnd(7)} ${avg.toFixed(0).padStart(6)} ${String(med).padStart(6)}   ${dist}`);
    }
}
