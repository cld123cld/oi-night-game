/* =========================================================
   集训之夜 · 监控室
   时间 0:00 -> 23:00，撑到 23:00 胜利
   ========================================================= */

/* ---------------- 难度配置 ----------------
   这些数字不是拍脑袋定的，是用 sim.js 跑了 5000 局模拟调出来的。
   backP（主教练退回办公室的概率）是最敏感的旋钮：
   0.30 → 地狱胜率 1%；0.50 → 41%。调难度优先动它。
--------------------------------------------- */
const DIFF = {
    easy: {
        name: '简单', hourMs: 32000, aiMs: 6000,
        mainP: 0.24, subP: 0.20,
        backP: 0.60, fwdP: 0.78, retreatP: 0.85,   // 主教练行动
        clsUp: 2.0, clsDown: 30, jcPush: false,    // 同学
        studyRate: 0.18, target: 60,  // 刷题速度(%/秒) 与达标线
        blackoutN: 1, blackoutSec: 6,   // 断电次数与每次时长
        repairMs: 55, repairAdd: 3, doorDmg: 9,
        subGrace: 7
    },
    normal: {
        name: '普通', hourMs: 28000, aiMs: 5000,
        mainP: 0.32, subP: 0.28,
        backP: 0.55, fwdP: 0.82, retreatP: 0.80,
        clsUp: 3.0, clsDown: 28, jcPush: false,
        studyRate: 0.19, target: 70,  // 刷题速度(%/秒) 与达标线
        blackoutN: 2, blackoutSec: 7,   // 断电次数与每次时长
        repairMs: 65, repairAdd: 3, doorDmg: 11,
        subGrace: 7
    },
    hard: {
        name: '困难', hourMs: 25000, aiMs: 4500,
        mainP: 0.40, subP: 0.34,
        backP: 0.48, fwdP: 0.86, retreatP: 0.78,
        clsUp: 4.0, clsDown: 26, jcPush: false,
        studyRate: 0.24, target: 80,  // 刷题速度(%/秒) 与达标线
        blackoutN: 3, blackoutSec: 8,   // 断电次数与每次时长
        repairMs: 75, repairAdd: 3, doorDmg: 12,
        subGrace: 7
    },
    hell: {
        name: '地狱', hourMs: 22000, aiMs: 3800,
        mainP: 0.42, subP: 0.36,
        backP: 0.50, fwdP: 0.90, retreatP: 0.76,
        clsUp: 4.5, clsDown: 24, jcPush: true,
        studyRate: 0.29, target: 85,  // 刷题速度(%/秒) 与达标线
        blackoutN: 4, blackoutSec: 9,   // 断电次数与每次时长
        repairMs: 85, repairAdd: 3, doorDmg: 13,
        subGrace: 7
    },
    epic: {
        name: '史诗', hourMs: 19000, aiMs: 3300,
        mainP: 0.40, subP: 0.34,
        backP: 0.48, fwdP: 0.95, retreatP: 0.74,
        clsUp: 5.0, clsDown: 22, jcPush: true,
        studyRate: 0.34, target: 92,  // 刷题速度(%/秒) 与达标线
        blackoutN: 4, blackoutSec: 8,   // 断电次数与每次时长
        repairMs: 95, repairAdd: 3, doorDmg: 15,
        subGrace: 7
    }
};

const FLOW_SEC = 30;      // 连续刷题多久进入心流
const FLOW_MULT = 1.3;    // 心流时效率倍率

const START_HOUR = 0;
const END_HOUR = 23;

/* ---------------- 成就定义 ----------------
   lvl: C=80  B=150  A=300  S=500
--------------------------------------------- */
const ACH = [
    { id:'procrast',  lvl:'A', name:'摸鱼专家',
      desc:'副教练站到你身后，你拖到只剩 2 秒才去刷题 —— 还活着' },
    { id:'blade',     lvl:'S', name:'刀尖舞者',
      desc:'主教练堵门 + 副教练在身后 + 门耐久 <10%，那一刻你还活着' },
    { id:'jcgod',     lvl:'S', name:'JC 神',
      desc:'一局内被同学 JC 了 5 次' },
    { id:'gatekeeper',lvl:'B', name:'门神',
      desc:'通关，且全程门耐久没低于 50%' },
    { id:'grinder',   lvl:'B', name:'卷王',
      desc:'一局内 ≥45% 的时间在刷题' },
    { id:'friendly',  lvl:'B', name:'友好交流',
      desc:'全程没被 JC，并且通关' },
    { id:'whatudo',   lvl:'A', name:'你干嘛',
      desc:'在捣乱值 ≥95% 时成功打断' },

    { id:'honest',    lvl:'B', name:'诚实劳动',
      desc:'刷题占比 ≥ 80%' },
    { id:'epicsurv',  lvl:'A', name:'史诗幸存者',
      desc:'史诗难度通关' },
    { id:'oldliu',    lvl:'B', name:'江湖老六',
      desc:'副教练来袭前 ≥2 秒你就已经在刷题，而且之前一次都没刷过' },
    { id:'flash',     lvl:'A', name:'闪电切换',
      desc:'7 秒内连续切换模式 3 次，且副教练已在身后 ≥5 秒' },
    { id:'jcproof',   lvl:'A', name:'JC 绝缘体',
      desc:'累计 10 局没被 JC 过' },
    { id:'wire',      lvl:'S', name:'压线通关',
      desc:'通关前 10 秒内，门耐久 ≤5% 且没归零' },
    { id:'chaos',     lvl:'A', name:'捣乱大师',
      desc:'通关前 5 秒内捣乱值 ≥80%，同时门耐久 ≥50%' },
    { id:'nojcpls',   lvl:'C', name:'不要JC我啊！！！',
      desc:'被 JC 时，大门耐久 ≥80%' },
    { id:'jcuseless', lvl:'A', name:'JC 没用！',
      desc:'被 JC 时，大门耐久 <10%' },
    { id:'jcsuccess', lvl:'A', name:'JC 成功',
      desc:'你压制过捣乱值，可还是被 JC 了（压制时没压到 0）' },

    { id:'flowstate', lvl:'B', name:'心流状态',
      desc:'连续刷题 60 秒不被打断' },
    { id:'justright', lvl:'A', name:'刚刚好',
      desc:'通关时进度刚好卡在达标线 ±3 以内' },
    { id:'overkill',  lvl:'S', name:'超额完成',
      desc:'进度刷到达标线的 1.5 倍' },
    { id:'insomnia',  lvl:'B', name:'熬了个寂寞',
      desc:'活到了 23:00，可题一道都没刷完' },
];

const LVL_SCORE = { C: 80, B: 150, A: 300, S: 500 };
const DIFF_MULT = { easy: 0.8, normal: 1.0, hard: 1.3, hell: 1.7, epic: 2.2 };

const ACH_BY_ID = {};
ACH.forEach(a => { ACH_BY_ID[a.id] = a; });

/* ---------------- 存档 ---------------- */
const SAVE_KEY = 'oi-night-save-v1';
let save = { unlocked: {}, best: {}, runs: 0, wins: 0, noJcRuns: 0, board: [] };

function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const o = JSON.parse(raw);
            if (o && typeof o === 'object') {
                save = Object.assign(save, o);
                if (!save.unlocked) save.unlocked = {};
                if (!save.best) save.best = {};
            }
        }
    } catch (e) {
        save = { unlocked: {}, best: {}, runs: 0, wins: 0, noJcRuns: 0, board: [] };
    }
    if (!save.board) save.board = [];
}

function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
function clearSave() {
    save = { unlocked: {}, best: {}, runs: 0, wins: 0, noJcRuns: 0, board: [] };
    writeSave();
    renderAchWall();
    renderBest();
    renderBoard();
}
function clearBoard() {
    save.board = [];
    writeSave();
    renderBoard();
}

/* ---------------- 排行榜 ---------------- */
function pushBoard(rec) {
    save.board.push(rec);
    save.board.sort((a, b) => b.score - a.score);
    if (save.board.length > 10) save.board = save.board.slice(0, 10);
    writeSave();
}
function renderBoard() {
    const box = dom['board-list'];
    if (!box) return;
    if (!save.board.length) {
        box.innerHTML = '<div class="bd-empty">还没有记录 —— 打一局试试。</div>';
        return;
    }
    box.innerHTML = save.board.map((r, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] || (i + 1);
        const d = new Date(r.ts);
        const dt = `${d.getMonth() + 1}/${d.getDate()}`;
        return `<div class="bd-row rank-${r.rank}">
                    <span class="bd-no">${medal}</span>
                    <span class="bd-diff">${DIFF[r.diff] ? DIFF[r.diff].name : r.diff}</span>
                    <span class="bd-score">${r.score}</span>
                    <span class="bd-rank">${r.rank}</span>
                    <span class="bd-info">${r.hours}h · 进度${r.prog}% · ${dt}</span>
                 </div>`;
    }).join('');
}

/* ---------------- 成就解锁 ---------------- */
function unlock(id) {
    if (!state || state.gameOver === 'settling') return;
    if (save.unlocked[id]) return;                 // 已永久解锁
    save.unlocked[id] = true;
    writeSave();
    state.runAch.push(id);                         // 本局解锁（用于结算加分）
    const a = ACH_BY_ID[id];
    toastAch(a);
    beep(880, 0.12, 'triangle', 0.06);
    setTimeout(() => beep(1170, 0.16, 'triangle', 0.05), 110);
}

function toastAch(a) {
    const box = dom['ach-toast'];
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'ach-toast-item lv-' + a.lvl;
    d.innerHTML = `<span class="t-lvl">${a.lvl}</span>
                   <span class="t-name">${a.name}</span>
                   <span class="t-desc">${a.desc}</span>`;
    box.appendChild(d);
    setTimeout(() => d.classList.add('out'), 2200);
    setTimeout(() => d.remove(), 2800);
}

/* ---------------- 评分 ---------------- */
function computeScore(win) {
    const hours = state.hoursElapsed;
    const base = hours * 40;
    const trueWin = win && state.progress >= D.target;
    const winBonus = trueWin ? 1500 : 0;                   // 不吃难度倍率
    const progScore = Math.round(Math.min(state.progress, D.target * 1.5) * 8);
    const durBonus = win ? Math.round(state.doorDurability * 2) : 0;
    const jcPenalty = state.clsJcCount * 80;
    const achScore = state.runAch.reduce((s, id) =>
        s + (LVL_SCORE[ACH_BY_ID[id].lvl] || 0), 0);

    const perf = Math.max(0, base + progScore + durBonus - jcPenalty + achScore);
    const mult = DIFF_MULT[D.key] || 1;
    const total = Math.round(perf * mult + winBonus);

    return { hours, base, progScore, winBonus, durBonus, jcPenalty,
             achScore, perf, mult, total, trueWin };
}

/* 评级线。未通关最高只能到 A —— 活着出去才配谈高分。
   这些线是用 score_sim.js 跑了三种玩法风格 × 5 档难度校准的。 */
/* 评级含义（按玩家的说法重新定义）：
   D 保底 / C 普通 / B 良好(非新手) / A 大佬(摸鱼高手)
   S 玩了十把左右能做到 / SS 困难或地狱接近完美 / SSS 史诗接近完美，非常难得 */
const RANK_ORDER = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const RANK_DESC = {
    D: '保底', C: '普通', B: '良好 · 非新手', A: '大佬 · 摸鱼高手',
    S: '高手 · 十把可及', SS: '神级 · 困难/地狱接近完美', SSS: '传说 · 史诗接近完美'
};
/* 难度决定评级上限：简单刷不出 S，普通刷不出 SS，史诗才够得到 SSS */
const RANK_CAP = { easy: 'A', normal: 'S', hard: 'SS', hell: 'SS', epic: 'SSS' };

function rawRank(s) {
    if (s >= 6300) return 'SSS';
    if (s >= 3300) return 'SS';
    if (s >= 2400) return 'S';
    if (s >= 1700) return 'A';
    if (s >= 1100) return 'B';
    if (s >= 600)  return 'C';
    return 'D';
}
function rankOf(s, key) {
    let r = rawRank(s);
    const cap = RANK_CAP[key] || 'SSS';
    if (RANK_ORDER.indexOf(r) > RANK_ORDER.indexOf(cap)) r = cap;
    return r;
}

/* ---------------- 成就墙 / 最佳成绩 ---------------- */
function renderAchWall() {
    const box = dom['ach-wall'];
    if (!box) return;
    box.innerHTML = ACH.map(a => {
        const got = !!save.unlocked[a.id];
        return `<div class="ach-card ${got ? 'got lv-' + a.lvl : 'locked'}">
                    <div class="a-top"><span class="a-lvl">${a.lvl}</span>
                    <span class="a-name">${got ? a.name : '???'}</span></div>
                    <div class="a-desc">${got ? a.desc : '—— 尚未解锁 ——'}</div>
                 </div>`;
    }).join('');
}

function renderBest() {
    const box = dom['best-table'];
    if (!box) return;
    const rows = Object.keys(DIFF).map(k => {
        const b = save.best[k];
        return `<div class="b-row">
                    <span class="b-diff">${DIFF[k].name}</span>
                    <span class="b-score">${b ? b.score + ' 分 · ' + b.rank
                                              : '—'}</span>
                 </div>`;
    }).join('');
    const total = ACH.filter(a => save.unlocked[a.id]).length;
    box.innerHTML = rows +
        `<div class="b-sum">成就 ${total}/${ACH.length} · 总局数 ${save.runs}
         · 通关 ${save.wins} · 无JC局 ${save.noJcRuns}</div>`;
}

const CAM_NAME = {
    classroom: '1号 · 集训教室',
    office:    '2号 · 教练办公室',
    hallway:   '3号 · 一楼走廊',
    door:      '4号 · 大门入口',
    window:    '5号 · 后窗',
    behind:    '6号 · 你的身后'
};

const AMBIENT = [
    '走廊尽头传来脚步声…',
    '窗外有影子晃了一下。',
    '广播里响起滋滋的电流声。',
    '教室后排有人在小声说话。',
    '应急灯闪了一下。',
    '有人在敲储物柜，很轻。',
    '你的椅子后面好像有风。',
    '广播：「请各位同学尽快离开机房。」',
    '显示器闪了一下，什么都没有。',
    '楼下传来关门声。'
];

/* ---------------- 状态 ---------------- */
let D = DIFF.normal;           // 当前难度
let state = null;
let selectedDiff = 'normal';

const dom = {};

/* ---------------- 工具 ---------------- */
function $(id) { return document.getElementById(id); }

function cacheDom() {
    ['start-screen', 'btn-start', 'diff-grid', 'game-container',
     'clock', 'clock-period', 'dur-fill', 'cls-fill', 'cls-wrap', 'diff-label',
     'monitor-screen', 'current-cam-feed', 'cam-name', 'cam-visuals', 'cam-log',
     'sub-warning', 'sub-fill', 'sub-seconds', 'danger-vignette',
     'btn-toggle-game', 'btn-door', 'door-status-text', 'btn-repair',
     'study-screen', 'btn-exit-study', 'study-progress-box', 'study-progress-fill',
     'modal', 'modal-box', 'modal-title', 'modal-msg', 'modal-stat',
     'btn-restart', 'btn-back', 'cam-map',
     'ach-wall', 'best-table', 'btn-clear', 'ach-toast', 'score-box', 'run-ach',
     'prog-fill', 'prog-text', 'sp-num', 'sp-target', 'sp-bar-fill', 'flow-tag',
     'board-list', 'btn-clear-board', 'status-bar'
    ].forEach(id => { dom[id] = $(id); });
    dom.camBtns = document.querySelectorAll('.cam-btn');
}

function log(text) {
    if (!state) return;
    state.logs.push(text);
    if (state.logs.length > 3) state.logs.shift();
    dom['cam-log'].innerHTML = state.logs.map(t => `<div>&gt; ${t}</div>`).join('');
}

/* 极简音效（失败也无所谓） */
let actx = null;
function beep(freq, dur, type, vol) {
    try {
        if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        g.gain.value = vol || 0.05;
        o.connect(g); g.connect(actx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
        o.stop(actx.currentTime + dur);
    } catch (e) { /* 忽略 */ }
}

/* ---------------- 开始界面 ---------------- */
function bindStart() {
    dom['diff-grid'].querySelectorAll('.diff-card').forEach(card => {
        card.addEventListener('click', () => {
            dom['diff-grid'].querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedDiff = card.dataset.diff;
            beep(660, 0.05, 'square', 0.03);
        });
    });
    dom['btn-start'].addEventListener('click', () => {
        dom['start-screen'].classList.add('hidden');
        startGame(selectedDiff);
    });
    dom['btn-restart'].addEventListener('click', () => {
        dom.modal.classList.add('hidden');
        resetUI();
        startGame(D.key);
    });
    dom['btn-back'].addEventListener('click', () => {
        dom.modal.classList.add('hidden');
        dom['game-container'].classList.add('hidden');
        dom['start-screen'].classList.remove('hidden');
        resetUI();
        renderAchWall();
        renderBest();
    });
    if (dom['btn-clear']) {
        dom['btn-clear'].addEventListener('click', () => {
            if (confirm('确定清除所有存档？成就和最高分都会消失。')) clearSave();
        });
    }
    if (dom['btn-clear-board']) {
        dom['btn-clear-board'].addEventListener('click', () => {
            if (confirm('确定清空排行榜？')) clearBoard();
        });
    }
}

function resetUI() {
    dom['danger-vignette'].classList.remove('on');
    dom['sub-warning'].classList.add('hidden');
    dom['study-screen'].classList.add('hidden');
    dom['monitor-screen'].classList.remove('hidden');
    dom['study-progress-box'].classList.add('hidden');
    dom['cam-log'].innerHTML = '';
}

/* ---------------- 开局 ---------------- */
function startGame(key) {
    D = DIFF[key];
    D.key = key;

    state = {
        time: START_HOUR,
        isGameOpen: true,          // true=监控  false=刷题
        isDoorClosed: false,
        isRepairing: false,
        doorDurability: 100,
        gameOver: false,

        currentCam: 'classroom',
        coachMainPos: 0,           // 0办公室 1走廊 2门口
        coachSubPos: 0,            // 0后窗 1身后
        cls: 0,                    // 同学捣乱 0-100
        clsJcCount: 0,

        subDanger: 0,              // 副教练危机倒计时（秒）
        studyProgress: 0,          // 伪装进度 0-100
        logs: [],
        timers: {},

        /* ---- 成就追踪 ---- */
        runAch: [],                // 本局解锁的成就
        hoursElapsed: 0,           // 撑过的小时数
        totalSec: 0,               // 总秒数
        studySec: 0,               // 刷题秒数
        modeEnterSec: 0,           // 进入当前模式时的 totalSec
        everStudied: false,        // 是否刷过题（当前局）
        everStudiedBefore: false,  // 本次危机之前是否刷过题
        switchLog: [],             // 模式切换时间戳（秒）
        durMin: 100,               // 门耐久历史最低
        durLast10: [],             // 最近 10 秒的耐久
        clsLast5: [],              // 最近 5 秒的捣乱值
        clsSuppressing: false,     // 是否正在压制捣乱值
        clsSuppressMin: 100,       // 压制过程中的最低捣乱值
        suppressedEver: false,     // 是否压制过
        clsPeak: 0,                // 捣乱值峰值
        bladeDone: false,

        /* ---- 断电 ---- */
        blackout: false,           // 是否正在断电
        blackoutLeft: 0,           // 剩余秒数
        blackoutHours: [],         // 计划断电的整点
        blackoutCount: 0,          // 已发生次数

        /* ---- 刷题进度 ---- */
        progress: 0,               // 题目进度 %
        streak: 0,                 // 连续刷题秒数（心流用）
        flowReached: false,        // 是否进过心流
        maxStreak: 0
    };

    dom['game-container'].classList.remove('hidden');
    dom['diff-label'].textContent = D.name;
    dom['sp-target'].textContent = D.target;

    /* 排断电表：均匀分布在整晚 */
    const bn = D.blackoutN || 0;
    for (let i = 1; i <= bn; i++) {
        state.blackoutHours.push(Math.round(i * END_HOUR / (bn + 1)));
    }
    dom['cls-wrap'].style.display = D.clsUp > 0 ? '' : 'none';

    updateClock();
    updateBars();
    switchCam('classroom', true);
    log('系统启动。祝你好运。');

    state.timers.hour = setInterval(hourLoop, D.hourMs);
    state.timers.ai = setInterval(aiLoop, D.aiMs);
    state.timers.sec = setInterval(secondLoop, 1000);
    state.timers.amb = setInterval(ambientLoop, 12000);
}

/* ---------------- 三个循环 ---------------- */
function hourLoop() {
    if (state.gameOver) return;
    state.time++;
    updateClock();
    if (state.blackoutHours.indexOf(state.time) >= 0) startBlackout();
    beep(state.time % 6 === 0 ? 880 : 440, 0.06, 'sine', 0.03);
    if (state.time >= END_HOUR) endGame(true, '你熬到了晚上 23:00。集训结束，你活下来了。');
}

function aiLoop() {
    if (state.gameOver) return;

    /* --- 主教练：走物理路线，刷题时也会前进 --- */
    if (Math.random() < D.mainP) {
        if (state.coachMainPos === 2) {
            if (state.isDoorClosed) {
                damageDoor(D.doorDmg);
                if (Math.random() < D.retreatP) {
                    state.coachMainPos = 1;
                    log('主教练撞了几下门，退回走廊。');
                }
            } else {
                endGame(false, '门开着。主教练推门走了进来。');
                return;
            }
        } else if (state.coachMainPos === 1) {
            if (Math.random() < D.backP) {
                state.coachMainPos = 0;                 // 回办公室 —— 你的修门窗口
                log('主教练回办公室了。');
            } else if (Math.random() < D.fwdP) {
                state.coachMainPos = 2;
                log('主教练到了大门口！');
                beep(200, 0.25, 'sawtooth', 0.06);
            }
        } else {
            state.coachMainPos = 1;
            log('主教练出现在走廊。');
        }
    }

    /* --- 副教练：只在你看监控时靠近。刷题时他不会下手 --- */
    if (state.isGameOpen && state.coachSubPos === 0 && Math.random() < D.subP) {
        state.coachSubPos = 1;
        startSubCrisis();
    }

    if (state.isGameOpen) renderCam();
}

/* ---------------- 断电 ---------------- */
function startBlackout() {
    if (state.blackout) return;
    state.blackout = true;
    state.blackoutLeft = D.blackoutSec || 8;
    state.blackoutCount++;
    log('⚡ 供电中断 —— 监控全部失效。');
    beep(70, 0.9, 'sawtooth', 0.11);
    setTimeout(() => beep(50, 0.6, 'sawtooth', 0.08), 200);
    syncDoorBtn();          // 门状态文本变「？？？」
    updateBars();
    renderCam();
}

function endBlackout() {
    state.blackout = false;
    log('供电恢复。');
    beep(620, 0.18, 'sine', 0.05);
    syncDoorBtn();          // ★ 必须恢复门文本，否则永远卡在「？？？」
    updateBars();
    renderCam();
}

function secondLoop() {
    if (state.gameOver) return;

    /* --- 断电倒计时 --- */
    if (state.blackout) {
        state.blackoutLeft--;
        if (state.blackoutLeft <= 0) endBlackout();
    }

    state.totalSec++;
    if (!state.isGameOpen) state.studySec++;

    /* --- 刷题进度 + 心流 --- */
    if (!state.isGameOpen) {
        state.streak++;
        state.maxStreak = Math.max(state.maxStreak, state.streak);
        const flow = state.streak >= FLOW_SEC;
        if (flow) state.flowReached = true;
        state.progress += D.studyRate * (flow ? FLOW_MULT : 1.0);
        // 心流成就：连续 60 秒不中断
        if (state.streak >= 60) unlock('flowstate');
    } else {
        state.streak = 0;
    }

    /* --- 历史追踪（成就用） --- */
    state.durMin = Math.min(state.durMin, state.doorDurability);
    state.durLast10.push(state.doorDurability);
    if (state.durLast10.length > 10) state.durLast10.shift();
    state.clsLast5.push(state.cls);
    if (state.clsLast5.length > 5) state.clsLast5.shift();
    state.clsPeak = Math.max(state.clsPeak, state.cls);

    /* --- 刀尖舞者：三重危机同时成立 --- */
    if (!state.bladeDone &&
        state.coachMainPos === 2 &&
        state.coachSubPos === 1 &&
        state.doorDurability < 10 && state.doorDurability > 0) {
        state.bladeDone = true;
        unlock('blade');
    }

    /* --- 同学捣乱 --- */
    if (D.clsUp > 0) {
        const watching = state.isGameOpen && state.currentCam === 'classroom';
        if (watching) {
            const before = state.cls;
            state.cls = Math.max(0, state.cls - D.clsDown);
            // 压制追踪：看教室使捣乱值下降
            if (before > state.cls) {
                if (!state.clsSuppressing) {
                    state.clsSuppressing = true;
                    state.clsSuppressMin = state.cls;
                }
                state.clsSuppressMin = Math.min(state.clsSuppressMin, state.cls);
                // 打断判定：从 ≥95 压下来
                if (before >= 95) unlock('whatudo');
            }
        } else {
            state.cls += D.clsUp;
            if (state.clsSuppressing) {
                state.clsSuppressing = false;
                // 压制过且没压到 0，算一次"压制成功"
                if (state.clsSuppressMin > 0) state.suppressedEver = true;
            }
        }
        if (state.cls >= 100) classmateJC();
    }

    /* --- 副教练危机 --- */
    if (state.coachSubPos === 1) {
        if (!state.isGameOpen) {
            // 刷题中：伪装进度增长，倒计时暂停
            state.studyProgress += 100 / D.subGrace;
            if (state.studyProgress >= 100) {
                // 摸鱼专家：拖到只剩 2 秒才动手
                if (state.subDanger <= 2) unlock('procrast');
                state.coachSubPos = 0;
                state.studyProgress = 0;
                state.subDanger = 0;
                log('副教练看你在刷题，转身走了。');
                beep(520, 0.18, 'sine', 0.05);
            }
        } else {
            // 看监控：倒计时继续
            state.subDanger -= 1;
            if (state.subDanger <= 0) {
                endGame(false, '副教练在你身后站了太久，一把按住了你的肩膀。盯着摄像头没用 —— 得刷题。');
                return;
            }
        }
    }

    updateBars();
}

function ambientLoop() {
    if (state.gameOver || !state.isGameOpen) return;
    if (Math.random() < 0.35) {
        // 惊吓闪影
        const cams = ['classroom', 'office', 'hallway', 'door', 'window', 'behind'];
        const c = cams[Math.floor(Math.random() * cams.length)];
        if (c === state.currentCam) {
            const g = document.createElement('div');
            g.className = 'ghost';
            g.style.left = (25 + Math.random() * 50) + '%';
            g.style.top = (25 + Math.random() * 30) + '%';
            dom['cam-visuals'].appendChild(g);
            setTimeout(() => g.remove(), 800);
            beep(90, 0.4, 'sawtooth', 0.05);
        }
    } else {
        log(AMBIENT[Math.floor(Math.random() * AMBIENT.length)]);
    }
}

/* ---------------- 事件 ---------------- */
function startSubCrisis() {
    /* 江湖老六：他来之前你就已经躲进刷题了，而且之前一次都没刷过 */
    if (!state.isGameOpen && !state.everStudiedBefore &&
        state.totalSec - state.modeEnterSec >= 2) {
        unlock('oldliu');
    }
    state.subDanger = D.subGrace;
    state.studyProgress = 0;
    log('副教练溜到了你身后！');
    beep(150, 0.5, 'sawtooth', 0.08);
    renderCam();
}

function classmateJC() {
    /* --- JC 系列成就（按被 JC 那一刻的门耐久） --- */
    if (state.doorDurability >= 80) unlock('nojcpls');
    if (state.doorDurability < 10)  unlock('jcuseless');
    if (state.suppressedEver && state.doorDurability > 0) unlock('jcsuccess');
    if (state.clsJcCount + 1 >= 5) unlock('jcgod');

    state.cls = 0;
    state.clsJcCount++;
    const parts = [];

    /* 关键平衡修正：
       如果主教练已经堵在门口，JC 就不再开门。
       否则会出现无解死 —— 副教练危机逼你刷题 7 秒，期间没法关门，
       同学这时开门 + 主教练进门 = 必死，玩家什么都做不了。
       模拟器实测：不加这条，地狱难度胜率只有 9.7%；加了之后 41%。 */
    if (state.coachMainPos < 2) {
        if (state.isDoorClosed) {
            state.isDoorClosed = false;
            parts.push('大门被打开');
            syncDoorBtn();
        }
        if (D.jcPush) {
            state.coachMainPos++;
            parts.push('主教练前进一步');
        }
    }
    if (!parts.length) parts.push('他跑到门口想开门，但主教练正堵在那儿');

    log('同学 JC 了你：' + parts.join('，') + '！');
    beep(300, 0.35, 'square', 0.07);
    shake();
    renderCam();
    updateBars();
}

function damageDoor(amount) {
    state.doorDurability -= amount;
    if (state.doorDurability < 0) state.doorDurability = 0;
    updateBars();
    shake();
    beep(120, 0.2, 'square', 0.07);
    log(`主教练在撞门！大门耐久 -${amount}`);
    if (state.doorDurability <= 0) {
        endGame(false, '大门耐久归零，主教练破门而入。');
    }
}

function shake() {
    const f = dom['current-cam-feed'];
    f.style.transform = `translate(${(Math.random() * 10 - 5).toFixed(1)}px, ${(Math.random() * 10 - 5).toFixed(1)}px)`;
    setTimeout(() => { f.style.transform = 'none'; }, 110);
}

/* ---------------- 渲染 ---------------- */
function updateClock() {
    const h = state.time;
    let period;
    if (h <= 5) period = '凌晨';
    else if (h <= 8) period = '早晨';
    else if (h <= 11) period = '上午';
    else if (h === 12) period = '正午';
    else if (h <= 17) period = '下午';
    else if (h <= 22) period = '晚上';
    else period = '深夜';
    dom.clock.textContent = `${h}:00`;
    dom['clock-period'].textContent = period;
}

function updateBars() {
    /* bo 必须在最前面声明 —— 下面多处用到它。
       曾经把它放在函数中段，结果前面的代码访问它触发 TDZ 报错，
       导致 startGame 中断、所有定时器都没设上，游戏完全静止。 */
    const bo = state.blackout;

    // 大门（断电时隐藏真实数值）
    dom['dur-fill'].style.width = bo ? '0%' : state.doorDurability + '%';
    dom['dur-fill'].style.backgroundColor =
        bo ? '#222' : (state.doorDurability < 30 ? '#ff3333' : '#00ff41');
    // 同学（断电时隐藏）
    const c = bo ? 0 : Math.min(100, state.cls);
    dom['cls-fill'].style.width = c + '%';
    dom['cls-fill'].style.backgroundColor = c > 70 ? '#ff3333' : (c > 40 ? '#ffcc00' : '#66ccff');

    /* 断电时：所有状态对外不可见（这是断电的全部意义） */
    dom['status-bar'].classList.toggle('blackout', bo);

    // 题目进度（填满 = 达标）
    const pct = bo ? 0 : Math.min(100, state.progress / D.target * 100);
    dom['prog-fill'].style.width = pct + '%';
    const done = state.progress >= D.target;
    dom['prog-fill'].style.backgroundColor = done ? '#ffcc00' : '#66ccff';
    dom['prog-fill'].style.boxShadow = '0 0 6px ' + (done ? '#ffcc00' : '#66ccff');
    dom['prog-text'].textContent = bo ? '？ / ？' : (Math.floor(state.progress) + ' / ' + D.target);
    dom['prog-text'].style.color = bo ? '#555' : (done ? '#ffcc00' : '#8ab');

    // 副教练危机
    const inCrisis = state.coachSubPos === 1;
    dom['sub-warning'].classList.toggle('hidden', !(inCrisis && state.isGameOpen) || bo);
    dom['danger-vignette'].classList.toggle('on', inCrisis && !bo);
    if (inCrisis) {
        dom['sub-fill'].style.width = (state.subDanger / D.subGrace * 100) + '%';
        dom['sub-seconds'].textContent = Math.max(0, Math.ceil(state.subDanger));
    }
    // 刷题伪装进度
    dom['study-progress-box'].classList.toggle('hidden', !(inCrisis && !state.isGameOpen));
    dom['study-progress-fill'].style.width = Math.min(100, state.studyProgress) + '%';

    // 刷题界面常驻：题目进度 + 心流
    if (!state.isGameOpen) {
        dom['sp-num'].textContent = Math.floor(state.progress);
        dom['sp-target'].textContent = D.target;
        dom['sp-bar-fill'].style.width =
            Math.min(100, state.progress / D.target * 100) + '%';
        const flow = state.streak >= FLOW_SEC;
        dom['flow-tag'].className = 'flow-tag' + (flow ? ' on' : '');
        dom['flow-tag'].textContent = flow
            ? `心流状态！连续 ${state.streak} 秒，效率 ×${FLOW_MULT}`
            : `专注中 ${state.streak}s ／ ${FLOW_SEC}s 后进入心流（效率 ×${FLOW_MULT}）`;
    }

    // 摄像头按钮上的警报（断电时一律不亮）
    dom.camBtns.forEach(b => {
        const cam = b.dataset.cam;
        let need = false;
        if (bo) { const o = b.querySelector('.alert'); if (o) o.remove(); return; }
        if (cam === 'door' && state.coachMainPos === 2) need = true;
        if (cam === 'window' && state.coachSubPos === 0 && state.isGameOpen) need = false;
        if (cam === 'behind' && state.coachSubPos === 1) need = true;
        if (cam === 'classroom' && state.cls > 65) need = true;
        if (cam === 'hallway' && state.coachMainPos === 1) need = true;
        const old = b.querySelector('.alert');
        if (need && !old) {
            const s = document.createElement('span');
            s.className = 'alert'; s.textContent = ' ●';
            b.appendChild(s);
        } else if (!need && old) {
            old.remove();
        }
    });
}

function decorFor(cam) {
    switch (cam) {
        case 'classroom':
            return `
                <div class="dec dec-banner"><span>集 训 期 间 · 禁 止 摸 鱼</span></div>
                <div class="dec dec-board"></div>
                <div class="dec dec-desk d1"></div><div class="dec dec-desk d2"></div>
                <div class="dec dec-desk d3"></div><div class="dec dec-desk d4"></div>
                <div class="dec dec-desk d5"></div>
                <div class="dec dec-chair c1"></div><div class="dec dec-chair c2"></div>
                <div class="dec dec-chair c3"></div><div class="dec dec-chair c4"></div>`;
        case 'office':
            return `
                <div class="dec dec-shelf"></div>
                <div class="dec dec-monitor"></div>
                <div class="dec dec-o-desk"></div>
                <div class="dec dec-trophy"></div>`;
        case 'hallway':
            return `
                <div class="dec dec-emlight"></div>
                <div class="dec dec-windowlight"></div>
                <div class="dec dec-poster"></div>
                <div class="dec dec-locker l1"></div><div class="dec dec-locker l2"></div>
                <div class="dec dec-locker l3"></div><div class="dec dec-locker l4"></div>
                <div class="dec dec-locker l5"></div><div class="dec dec-locker l6"></div>
                <div class="dec dec-hydrant"></div>
                <div class="dec dec-floorlamp"></div>`;
        case 'door':
            return `
                <div class="dec dec-sign"><span>机 房 重 地</span></div>
                <div class="dec dec-alarm"></div>
                <div class="dec dec-door ${state.isDoorClosed ? 'closed' : ''}" id="dec-door"></div>
                <div class="dec dec-mat"></div>`;
        case 'window':
            return `
                <div class="dec dec-glass"></div>
                <div class="dec dec-frame"></div>
                <div class="dec dec-moon"></div>
                <div class="dec dec-tree"></div>`;
        case 'behind':
            return `
                <div class="dec dec-wall"></div>
                <div class="dec dec-chairback"></div>
                <div class="dec dec-dark"></div>`;
    }
    return '';
}

function addSprite(cls, tag, left, top, extraCls) {
    const d = document.createElement('div');
    d.className = 'sprite ' + cls + (extraCls ? ' ' + extraCls : '');
    d.style.left = left + '%';
    d.style.top = top + '%';
    d.innerHTML = `<div class="tag">${tag}</div><div class="head"></div><div class="body"></div>`;
    dom['cam-visuals'].appendChild(d);
}

function renderCam() {
    if (!state) return;
    if (state.blackout) {
        dom['cam-name'].textContent = '⚡ 信号中断';
        dom['cam-visuals'].innerHTML =
            `<div class="blackout-screen">
                 <div class="bo-icon">⚡</div>
                 <div class="bo-title">供 电 中 断</div>
                 <div class="bo-sub">监控失效 · 大门状态未知 · 同学动态未知</div>
                 <div class="bo-count">${state.blackoutLeft}s</div>
                 <div class="bo-hint">什么都看不见 —— 要不要趁现在刷题？</div>
             </div>`;
        return;
    }
    const cam = state.currentCam;
    dom['cam-name'].textContent = CAM_NAME[cam];
    dom['cam-visuals'].innerHTML = decorFor(cam);
    dom['current-cam-feed'].className = 'feed-content bg-' + cam;

    if (cam === 'classroom') {
        addSprite('mate' + (state.cls > 65 ? ' angry' : ''),
                  '同学', 62, 44);
    }
    if (cam === 'office' && state.coachMainPos === 0) addSprite('main', '主教练', 40, 40);
    if (cam === 'hallway' && state.coachMainPos === 1) addSprite('main', '主教练', 50, 38);
    if (cam === 'door' && state.coachMainPos === 2) addSprite('main', '主教练', 44, 34);
    if (cam === 'window' && state.coachSubPos === 0) addSprite('sub', '副教练', 30, 46);
    if (cam === 'behind' && state.coachSubPos === 1) addSprite('sub angry', '副教练', 40, 32);
}

function switchCam(camId, silent) {
    state.currentCam = camId;
    dom.camBtns.forEach(b => b.classList.toggle('active', b.dataset.cam === camId));
    if (!silent) beep(720, 0.04, 'square', 0.025);
    renderCam();
}

/* ---------------- 操作 ---------------- */
function toggleMode() {
    if (state.gameOver) return;
    state.isGameOpen = !state.isGameOpen;

    /* --- 成就追踪 --- */
    if (!state.isGameOpen) {
        // 记录【这次之前】有没有刷过题 —— 江湖老六要求这是本局第一次
        state.everStudiedBefore = state.everStudied;
        state.everStudied = true;
    }
    state.modeEnterSec = state.totalSec;
    state.switchLog.push(state.totalSec);
    if (state.switchLog.length > 6) state.switchLog.shift();
    // 闪电切换：7 秒内切 3 次，且副教练已在身后 ≥5 秒
    const recent = state.switchLog.filter(t => state.totalSec - t <= 7);
    const subFor = D.subGrace - state.subDanger;
    if (recent.length >= 3 && state.coachSubPos === 1 && subFor >= 5) {
        unlock('flash');
    }

    if (state.isGameOpen) {
        dom['study-screen'].classList.add('hidden');
        dom['monitor-screen'].classList.remove('hidden');
        dom['btn-toggle-game'].innerHTML = '👁 切换至刷题模式 (空格)';
        dom['btn-door'].disabled = false;
        dom['btn-repair'].disabled = state.isRepairing;
        renderCam();
    } else {
        dom['study-screen'].classList.remove('hidden');
        dom['monitor-screen'].classList.add('hidden');
        dom['btn-toggle-game'].innerHTML = '💻 恢复监控视角 (空格)';
        dom['btn-door'].disabled = true;
        dom['btn-repair'].disabled = true;
        dom['sub-warning'].classList.add('hidden');
    }
    updateBars();
    if (!state.isGameOpen) {
        dom['sp-num'].textContent = Math.floor(state.progress);
        dom['sp-target'].textContent = D.target;
        dom['sp-bar-fill'].style.width =
            Math.min(100, state.progress / D.target * 100) + '%';
    }
}

function syncDoorBtn() {
    if (state.isDoorClosed) {
        dom['btn-door'].classList.add('closed');
        dom['door-status-text'].textContent = '关闭';
    } else {
        dom['btn-door'].classList.remove('closed');
        dom['door-status-text'].textContent = '开启';
    }
    if (state.blackout) { dom['door-status-text'].textContent = '？？？'; return; }
    const dd = dom['cam-visuals'].querySelector('#dec-door');
    if (dd) dd.className = 'dec dec-door ' + (state.isDoorClosed ? 'closed' : '');
}

function toggleDoor() {
    if (state.gameOver || !state.isGameOpen || state.isRepairing) return;
    state.isDoorClosed = !state.isDoorClosed;
    syncDoorBtn();
    beep(state.isDoorClosed ? 300 : 200, 0.08, 'square', 0.05);
    log(state.isDoorClosed ? '大门已关闭。' : '大门已开启。');
}

function startRepair() {
    if (state.gameOver || !state.isGameOpen || state.isRepairing) return;
    if (state.isDoorClosed) {
        log('要先打开门才能修！');
        beep(160, 0.15, 'square', 0.05);
        return;
    }
    state.isRepairing = true;
    dom['btn-repair'].disabled = true;
    dom['btn-door'].disabled = true;
    log('开始维修大门…');

    state.timers.repair = setInterval(() => {
        if (state.gameOver) { clearInterval(state.timers.repair); return; }

        if (state.coachMainPos === 2) {
            clearInterval(state.timers.repair);
            state.isRepairing = false;
            endGame(false, '你蹲在门口修门，主教练正好走到门口。');
            return;
        }

        state.doorDurability += D.repairAdd;
        if (state.doorDurability >= 100) {
            state.doorDurability = 100;
            state.isRepairing = false;
            dom['btn-repair'].disabled = false;
            dom['btn-door'].disabled = false;
            updateBars();
            clearInterval(state.timers.repair);
            log('大门修好了。');
            beep(700, 0.15, 'sine', 0.05);
        } else {
            updateBars();
        }
    }, D.repairMs);
}

/* ---------------- 结束 ---------------- */
function endGame(win, reason) {
    if (state.gameOver) return;              // 幂等：只结算一次
    state.gameOver = true;
    Object.values(state.timers).forEach(t => clearInterval(t));

    dom['danger-vignette'].classList.remove('on');
    dom['sub-warning'].classList.add('hidden');
    dom['study-screen'].classList.add('hidden');

    state.hoursElapsed = win ? END_HOUR : state.time;
    const trueWin = win && state.progress >= D.target;

    /* ---- 通关类成就 ---- */
    if (win) {
        if (!trueWin) unlock('insomnia');
        const gap = Math.abs(state.progress - D.target);
        if (gap <= 3) unlock('justright');
        if (state.progress >= D.target * 1.5) unlock('overkill');
    }
    if (win) {
        if (D.key === 'epic') unlock('epicsurv');
        if (state.durMin >= 50) unlock('gatekeeper');
        if (state.clsJcCount === 0) unlock('friendly');
        const minDur10 = Math.min.apply(null, state.durLast10);
        if (minDur10 <= 5 && minDur10 > 0) unlock('wire');
        const maxCls5 = Math.max.apply(null, state.clsLast5);
        const minDur5 = Math.min.apply(null, state.durLast10.slice(-5));
        if (maxCls5 >= 80 && minDur5 >= 50) unlock('chaos');
    }

    /* ---- 比例类成就 ---- */
    const ratio = state.totalSec > 0 ? state.studySec / state.totalSec : 0;
    if (ratio >= 0.45) unlock('grinder');
    if (ratio >= 0.80) unlock('honest');

    /* ---- 跨局成就 ---- */
    save.runs++;
    if (win) save.wins++;
    if (state.clsJcCount === 0) save.noJcRuns++;
    if (save.noJcRuns >= 10) unlock('jcproof');

    /* ---- 评分 ---- */
    const sc = computeScore(win);
    const rank = rankOf(sc.total, D.key);
    const prevBest = save.best[D.key];
    const isNewBest = !prevBest || sc.total > prevBest.score;
    if (isNewBest) save.best[D.key] = { score: sc.total, rank: rank, at: Date.now() };
    pushBoard({
        diff: D.key, score: sc.total, rank: rank,
        hours: sc.hours, prog: Math.floor(state.progress), ts: Date.now()
    });
    writeSave();

    /* ---- 结算界面 ---- */
    dom.modal.classList.remove('hidden');
    const kind = !win ? 'fail' : (trueWin ? 'success' : 'hollow');
    dom['modal-box'].className = 'modal-content ' + kind;
    dom['modal-title'].textContent =
        !win ? '被 抓 到 了' : (trueWin ? '撑 过 去 了' : '熬 了 个 寂 寞');
    dom['modal-msg'].textContent = !win ? reason :
        (trueWin ? '你熬到了 23:00，题也刷完了。这才是真正的通关。'
                 : `你活到了 23:00 —— 但题目进度只有 ${Math.floor(state.progress)}%，`
                   + `达标线是 ${D.target}%。人是活的，题一道没过。`);

    dom['modal-stat'].innerHTML =
        `坚持 ${sc.hours} 小时　·　难度 ${D.name}　·　被 JC ${state.clsJcCount} 次<br>` +
        `题目进度 ${Math.floor(state.progress)}% ／ 达标 ${D.target}%　·　` +
        `剩余门耐久 ${Math.round(state.doorDurability)}%<br>` +
        `刷题占比 ${(ratio * 100).toFixed(0)}%　·　最长连续专注 ${state.maxStreak} 秒`;

    dom['score-box'].className = 'score-box rank-' + rank;
    dom['score-box'].innerHTML =
        `<div class="s-num">${sc.total}</div>
         <div class="s-rank">${rank} 级</div>
         <div class="s-desc">${RANK_DESC[rank]}</div>
         <div class="s-formula">
             基础 ${sc.base}（${sc.hours}h × 40）
             ＋ 进度 ${sc.progScore}
             ${sc.trueWin ? '＋ 达标 1500' : ''}
             ${win ? '＋ 耐久 ' + sc.durBonus : ''}
             － JC ${sc.jcPenalty}
             ＋ 成就 ${sc.achScore}
             <br>= ${sc.perf} × ${sc.mult}（难度）
             ${sc.trueWin ? '＋ 1500' : ''} = <b>${sc.total}</b>
         </div>
         ${isNewBest ? '<div class="s-new">★ 新纪录！</div>'
                     : (prevBest ? `<div class="s-old">历史最佳 ${prevBest.score}（${prevBest.rank}）</div>` : '')}`;

    dom['run-ach'].innerHTML = state.runAch.length
        ? '<div class="ra-title">🏆 本局解锁</div>' +
          state.runAch.map(id => {
              const a = ACH_BY_ID[id];
              return `<span class="ra-item lv-${a.lvl}">${a.lvl} · ${a.name}</span>`;
          }).join('')
        : '<div class="ra-none">本局没有解锁新成就 —— 换个打法试试？</div>';

    renderAchWall();
    renderBest();
    renderBoard();
    beep(win ? 880 : 110, 0.6, win ? 'sine' : 'sawtooth', 0.08);
}

/* ---------------- 绑定 ---------------- */
function bindGame() {
    dom['btn-toggle-game'].addEventListener('click', toggleMode);
    dom['btn-exit-study'].addEventListener('click', toggleMode);
    dom['btn-door'].addEventListener('click', toggleDoor);
    dom['btn-repair'].addEventListener('click', startRepair);
    dom.camBtns.forEach(b => {
        b.addEventListener('click', () => {
            if (!state || state.gameOver || !state.isGameOpen) return;
            switchCam(b.dataset.cam);
        });
    });

    document.addEventListener('keydown', e => {
        if (!state || state.gameOver) return;
        if (!dom['game-container'].classList.contains('hidden')) {
            if (e.code === 'Space') { e.preventDefault(); toggleMode(); }
            else if (e.key === 'q' || e.key === 'Q') toggleDoor();
            else if (e.key === 'e' || e.key === 'E') startRepair();
            else if (e.key >= '1' && e.key <= '6') {
                const map = ['classroom', 'office', 'hallway', 'door', 'window', 'behind'];
                if (state.isGameOpen) switchCam(map[+e.key - 1]);
            }
        }
    });
}

/* ---------------- 入口 ---------------- */
cacheDom();
loadSave();
renderAchWall();
renderBest();
renderBoard();
bindStart();
bindGame();
