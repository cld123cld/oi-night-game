/* 断电模式 + 新评级 的平衡验证 */
const DIFF_BASE = {
    easy:   { hourMs:32000, aiMs:6000, mainP:0.24, subP:0.20, backP:0.60, fwdP:0.78, retreatP:0.85, clsUp:2.0, clsDown:30, jcPush:false, repairMs:55, repairAdd:3, doorDmg:9,  subGrace:7, studyRate:0.18, target:60, blackoutN:1,  blackoutSec:6  },
    normal: { hourMs:28000, aiMs:5000, mainP:0.32, subP:0.28, backP:0.55, fwdP:0.82, retreatP:0.80, clsUp:3.0, clsDown:28, jcPush:false, repairMs:65, repairAdd:3, doorDmg:11, subGrace:7, studyRate:0.19, target:70, blackoutN:2,  blackoutSec:7  },
    hard:   { hourMs:25000, aiMs:4500, mainP:0.40, subP:0.34, backP:0.48, fwdP:0.86, retreatP:0.78, clsUp:4.0, clsDown:26, jcPush:false, repairMs:75, repairAdd:3, doorDmg:12, subGrace:7, studyRate:0.24, target:80, blackoutN:3,  blackoutSec:8  },
    hell:   { hourMs:22000, aiMs:3800, mainP:0.42, subP:0.36, backP:0.50, fwdP:0.90, retreatP:0.76, clsUp:4.5, clsDown:24, jcPush:true,  repairMs:85, repairAdd:3, doorDmg:13, subGrace:7, studyRate:0.29, target:85, blackoutN:4,  blackoutSec:9  },
    epic:   { hourMs:19000, aiMs:3300, mainP:0.40, subP:0.34, backP:0.48, fwdP:0.95, retreatP:0.74, clsUp:5.0, clsDown:22, jcPush:true,  repairMs:95, repairAdd:3, doorDmg:15, subGrace:7, studyRate:0.34, target:92, blackoutN:4,  blackoutSec:8 },
};
const END_HOUR = 23;
const DIFF_MULT = { easy:0.8, normal:1.0, hard:1.3, hell:1.7, epic:2.2 };
const LVL_SCORE = { C:80, B:150, A:300, S:500 };
const RANK_ORDER = ['D','C','B','A','S','SS','SSS'];
const RANK_CAP  = { easy:'A', normal:'S', hard:'SS', hell:'SS', epic:'SSS' };
const FLOW_SEC = 30, FLOW_MULT = 1.3;

function rawRank(s){ if(s>=6300)return 'SSS'; if(s>=3300)return 'SS'; if(s>=2400)return 'S';
                     if(s>=1700)return 'A'; if(s>=1100)return 'B'; if(s>=600)return 'C'; return 'D'; }
function rankOf(s,k){ let r=rawRank(s); const c=RANK_CAP[k]||'SSS';
                      return RANK_ORDER.indexOf(r)>RANK_ORDER.indexOf(c)?c:r; }

function run(D, seed, withBO) {
    let rnd = seed >>> 0;
    const R = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    /* 断电表 */
    const boHours = [];
    for (let i = 1; i <= (D.blackoutN||0); i++) boHours.push(Math.round(i*END_HOUR/((D.blackoutN||0)+1)));

    let dead=false, reason='', mainPos=0, subPos=0, cls=0;
    let doorClosed=false, dur=100, studying=false, subDanger=0, studyProg=0, sec=0;
    let prog=0, streak=0, jc=0, studySec=0;
    let blackout=false, boLeft=0;
    const totalSec = END_HOUR * D.hourMs/1000;
    const aiEvery = D.aiMs/1000;

    for (; sec < totalSec && !dead; sec++) {
        /* 断电触发（按整点） */
        const hour = Math.floor(sec / (D.hourMs/1000));
        if (withBO && !blackout && boHours.indexOf(hour) >= 0) {
            blackout = true; boLeft = D.blackoutSec;
        }
        if (blackout) { boLeft--; if (boLeft <= 0) blackout = false; }

        /* ---- 玩家策略 ----
           断电时看不到任何东西：理性玩家切刷题（进度照涨，且躲副教练） */
        if (subPos===1 && subDanger>0) studying = true;
        else if (blackout) studying = true;              // 断电：闭眼刷题
        else if (mainPos >= 2) studying = false;
        else if (prog < (sec/totalSec) * D.target * 1.05) studying = true;
        else if (cls >= 55) studying = false;
        else if (dur < 70) studying = false;
        else studying = false;

        /* ★ 关键修正：断电期间【大门状态被冻结】—— 你看不见，就没法反应。
           所以断电前的"提前关门"才是真正的技巧点。 */
        if (blackout) {
            // 什么都做不了，doorClosed 保持断电瞬间的值
        } else if (mainPos >= 1) doorClosed = true;
        else if (dur < 70 && !studying) doorClosed = false;
        else if (dur >= 100) doorClosed = false;

        /* 老练玩家：下一个整点要停电，提前把门关上 */
        if (!blackout && boHours.indexOf(hour + 1) >= 0) doorClosed = true;

        if (studying) {
            studySec++; streak++;
            prog += D.studyRate * (streak >= FLOW_SEC ? FLOW_MULT : 1.0);
        } else streak = 0;

        /* 每秒事件 */
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
    return { dead, reason, hours, prog, jc, studySec, totalSec:Math.max(1,sec), dur, streak };
}

function scoreOf(r, key) {
    const D = DIFF_BASE[key];
    const win = !r.dead;
    const trueWin = win && r.prog >= D.target;
    const base = r.hours * 40;
    const progScore = Math.round(Math.min(r.prog, D.target*1.5) * 8);
    const winBonus = trueWin ? 1500 : 0;
    const durBonus = win ? Math.round(Math.max(0,r.dur)*2) : 0;
    const jcPenalty = r.jc * 80;
    const ratio = r.studySec / r.totalSec;
    let ach = 0;
    if (ratio >= 0.45) ach += LVL_SCORE.B;
    if (ratio >= 0.80) ach += LVL_SCORE.B;
    if (r.jc >= 5)     ach += LVL_SCORE.S;
    if (r.streak >= 60) ach += LVL_SCORE.B;      // 心流
    if (trueWin && Math.abs(r.prog - D.target) <= 3) ach += LVL_SCORE.A;
    if (r.prog >= D.target*1.5) ach += LVL_SCORE.S;
    if (win && !trueWin) ach += LVL_SCORE.B;     // 熬了个寂寞
    if (trueWin && key==='epic') ach += LVL_SCORE.A;
    const perf = Math.max(0, base + progScore + durBonus - jcPenalty + ach);
    return Math.round(perf * DIFF_MULT[key] + winBonus);
}

const EPIC_VAR = process.argv[2]==='var';
if (EPIC_VAR) {
    console.log('史诗断电强度对比（目标：真通关 5~9%，SSS 罕见）');
    console.log('配置        真通关%  SSS%   平均分');
    console.log('-'.repeat(50));
    for (const [n,sec] of [[3,8],[4,8],[4,9],[5,10],[6,11]]) {
        DIFF_BASE.epic.blackoutN=n; DIFF_BASE.epic.blackoutSec=sec;
        const D=DIFF_BASE.epic; let tw=0,sss=0,sum=0;
        for(let i=1;i<=4000;i++){
            const r=run(D,i*7919+13,true);
            const sc=scoreOf(r,'epic');
            if(!r.dead&&r.prog>=D.target) tw++;
            if(rankOf(sc,'epic')==='SSS') sss++;
            sum+=sc;
        }
        console.log(`${n}次×${sec}s`.padEnd(12)+`${(tw/40).toFixed(1).padStart(6)}%${(sss/40).toFixed(1).padStart(6)}%${(sum/4000).toFixed(0).padStart(8)}`);
    }
    process.exit(0);
}
for (const withBO of [false, true]) {
    console.log('\n' + '='.repeat(84));
    console.log('  ' + (withBO ? '★ 开启断电' : '☆ 关闭断电') + '　每档 4000 局');
    console.log('='.repeat(84));
    console.log('难度    真通关%  平均分   评级分布');
    console.log('-'.repeat(84));
    for (const k of Object.keys(DIFF_BASE)) {
        const D = DIFF_BASE[k];
        let tw=0; const scores=[]; const causes={};
        for (let i=1;i<=4000;i++){
            const r = run(D, i*7919+13, withBO);
            if (!r.dead && r.prog >= D.target) tw++; else if (r.dead) causes[r.reason]=(causes[r.reason]||0)+1;
            scores.push(scoreOf(r,k));
        }
        scores.sort((a,b)=>a-b);
        const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
        const cnt={}; scores.forEach(s=>{const rr=rankOf(s,k); cnt[rr]=(cnt[rr]||0)+1;});
        const dist = RANK_ORDER.filter(x=>cnt[x]).map(x=>`${x}:${(cnt[x]/40).toFixed(0)}%`).join(' ');
        const top = Object.entries(causes).sort((a,b)=>b[1]-a[1])[0];
        console.log(`${k.padEnd(7)} ${(tw/40).toFixed(1).padStart(6)}% ${avg.toFixed(0).padStart(7)}   ${dist}` +
                    (top?`   [${top[0]}]`:''));
    }
}
