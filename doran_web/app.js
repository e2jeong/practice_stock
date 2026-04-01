// 핵심 상태 관리
const PARTICIPANTS = ["피카츄", "라이츄", "파이리", "꼬북이", "버터풀", "야도란", "피죤투", "또가스"];
let CANDIDATES = [];
let VOTE_STATE = {}; // { "피카츄": "2026-05-12", ... }
let CURRENT_SELECTED_VOTER = null; // 현재 UI에서 조작 중인 투표자

// 2026 한국 공휴일 하드코딩 (파이썬과 동일 스펙)
const HOLIDAYS_2026 = [
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-03-02", "2026-05-05", "2026-05-25", "2026-06-06",
    "2026-08-15", "2026-09-24", "2026-09-25", "2026-09-26",
    "2026-10-03", "2026-10-09", "2026-12-25"
];

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 버튼 초기 텍스트 달아주기
    const btnStart = document.getElementById('btn-start');
    btnStart.innerText = "투표 생성";
    
    // 상태 맵 초기화
    PARTICIPANTS.forEach(p => VOTE_STATE[p] = null);
    
    // 시작 버튼 이벤트 연동
    btnStart.addEventListener('click', initGeminiProcess);
    
    // 키보드 엔터 지원
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') initGeminiProcess();
    });
    
    // 투표 종료 버튼
    document.getElementById('btn-finish').addEventListener('click', finalizeVoting);
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('result-modal').classList.remove('active');
    });

    // 시작 화면으로 복귀 (재설정)
    document.getElementById('btn-restart').addEventListener('click', () => {
        document.getElementById('result-modal').classList.remove('active');
        document.getElementById('section-dashboard').classList.remove('active');
        document.getElementById('section-start').classList.add('active');
        
        // 상태 초기화
        CANDIDATES = [];
        PARTICIPANTS.forEach(p => VOTE_STATE[p] = null);
        CURRENT_SELECTED_VOTER = null;
        
        // UI 초기화
        document.getElementById('chat-input').value = "";
        document.getElementById('btn-start').textContent = "투표 생성";
        document.getElementById('btn-start').disabled = false;
        document.getElementById('chat-feedback').textContent = "";
    });
});

// 달력 매니저 로직 (다음 달 평일 휴일제외 3~5개 추출)
function getNextMonthCandidates() {
    const now = new Date();
    let year = now.getFullYear();
    // Prompt context says 2026-04 is "now". So let's fall back to 2026 if needed, or just let JS use system time (which acts like 2026 during this runtime simulation).
    // Just to be safe with the requirements: We ensure we pick the NEXT month.
    let month = now.getMonth() + 1 + 1; // JS getMonth is 0-indexed, so +1 for current, +1 for next
    
    if (month > 12) {
        month = 1;
        year++;
    }
    
    const candidates = [];
    // JS 달력 일수 구하기
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month - 1, day);
        const dayOfWeek = d.getDay(); // 0(Sun) ~ 6(Sat)
        
        // 주말 제외
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        // YYYY-MM-DD 포맷 만들기
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        
        // 공휴일 제외
        if (HOLIDAYS_2026.includes(dateStr)) continue;
        
        candidates.push(dateStr);
    }
    
    // 3 ~ 5개 랜덤으로 뽑아서 정렬
    const randCount = Math.floor(Math.random() * 3) + 3; // 3,4,5
    // shuffle
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(randCount, candidates.length));
    
    return selected.sort(); // 오름차순
}

// Gemini API 연동 함수
async function checkIntentWithGemini(apiKey, promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: `사용자의 입력: "${promptText}". 이 입력이 "다음 달 도란 일정 잡아줘" 또는 팀 회식 투표 일정을 요구하는 의미인지 판단하세요. 의미가 맞다면 "YES", 아니라면 "NO"만 출력하세요.` }
                        ]
                    }
                ]
            })
        });
        
        if (!response.ok) throw new Error('API Key 검증 오류 또는 서버 에러');
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.toUpperCase() || "";
        return text.includes("YES");
    } catch (e) {
        throw e;
    }
}

async function initGeminiProcess() {
    const apiKey = document.getElementById('api-key').value.trim();
    const chatInput = document.getElementById('chat-input').value.trim();
    const btn = document.getElementById('btn-start');
    const feedback = document.getElementById('chat-feedback');
    
    if (!apiKey) {
        feedback.textContent = "Gemini API Key를 먼저 입력해주세요!";
        return;
    }
    if (!chatInput) return;
    
    btn.textContent = "분석 중...";
    btn.disabled = true;
    feedback.textContent = "";
    
    try {
        const isIntentMatched = await checkIntentWithGemini(apiKey, chatInput);
        
        if (isIntentMatched) {
             transitionToDashboard();
        } else {
             feedback.textContent = "명령을 이해하지 못했습니다. 정확히 일정을 요구해주세요.";
             btn.textContent = "투표 생성";
             btn.disabled = false;
        }
    } catch (error) {
         feedback.textContent = "API 호출 실패: 키가 유효하지 않거나 네트워크 문제입니다.";
         btn.textContent = "투표 생성";
         btn.disabled = false;
    }
}

// 화면 전환 및 컴포넌트 렌더링
function transitionToDashboard() {
    document.getElementById('section-start').classList.remove('active');
    
    CANDIDATES = getNextMonthCandidates();
    
    renderParticipants();
    renderCandidates();
    updateDashboardUI();
    
    document.getElementById('section-dashboard').classList.add('active');
}

function renderParticipants() {
    const ul = document.getElementById('participant-list');
    ul.innerHTML = '';
    
    PARTICIPANTS.forEach(person => {
        const li = document.createElement('li');
        li.className = 'participant-item';
        li.dataset.person = person;
        
        li.innerHTML = `
            <span class="name">${person}</span>
            <div class="vote-status" id="status-${person}"></div>
        `;
        
        li.addEventListener('click', () => {
            document.querySelectorAll('.participant-item').forEach(el => el.classList.remove('active-selector'));
            li.classList.add('active-selector');
            CURRENT_SELECTED_VOTER = person;
            
            const dp = document.getElementById('current-voter-display');
            dp.innerHTML = `<span class="pulse-dot"></span> <b>${person}</b> 님이 원하시는 날짜 카드를 누르세요.`;
            dp.style.borderColor = 'var(--accent-blue)';
        });
        
        ul.appendChild(li);
    });
}

function renderCandidates() {
    const grid = document.getElementById('candidate-list');
    grid.innerHTML = '';
    
    CANDIDATES.forEach(date => {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.dataset.date = date;
        
        // Render Template
        card.innerHTML = `
            <div class="date-lbl">${date.substring(5)}</div>
            <div class="vote-count" id="count-${date}">0 표</div>
            <div class="voter-avatars" id="avatars-${date}"></div>
        `;
        
        card.addEventListener('click', () => {
            if (!CURRENT_SELECTED_VOTER) return;
            // 로직 : 선택된 유저가 이 날짜에 한표
            VOTE_STATE[CURRENT_SELECTED_VOTER] = date;
            
            // 즉시 UI 업데이트 및 포커스 해제
            CURRENT_SELECTED_VOTER = null;
            document.querySelectorAll('.participant-item').forEach(el => el.classList.remove('active-selector'));
            const dp = document.getElementById('current-voter-display');
            dp.innerHTML = `<span class="pulse-dot"></span> 투표가 반영되었습니다. 다음 참여자를 선택하세요.`;
            dp.style.borderColor = 'var(--accent-purple)';
            
            updateDashboardUI();
        });
        
        grid.appendChild(card);
    });
}

function updateDashboardUI() {
    // 1. 사람별 V 상태 표시
    let votedNum = 0;
    PARTICIPANTS.forEach(person => {
        const statusDiv = document.getElementById(`status-${person}`);
        const votedDate = VOTE_STATE[person];
        if (votedDate) {
            statusDiv.classList.add('voted');
            statusDiv.innerHTML = '✔';
            votedNum++;
        } else {
            statusDiv.classList.remove('voted');
            statusDiv.innerHTML = '';
        }
    });
    
    // Voted Badge
    document.getElementById('voted-count-badge').textContent = `${votedNum} / 8`;
    
    // 2. 날짜별 표 카운트 및 아바타 표시
    let dayStats = {};
    CANDIDATES.forEach(d => dayStats[d] = { count: 0, pip: [] });
    
    PARTICIPANTS.forEach(person => {
        const votedDate = VOTE_STATE[person];
        if (votedDate && dayStats[votedDate]) {
            dayStats[votedDate].count++;
            dayStats[votedDate].pip.push(person);
        }
    });
    
    CANDIDATES.forEach(d => {
        document.getElementById(`count-${d}`).textContent = `${dayStats[d].count} 표`;
        const avaContainer = document.getElementById(`avatars-${d}`);
        avaContainer.innerHTML = dayStats[d].pip.map(p => `<span class="voter-badge">${p}</span>`).join('');
    });
}

// 결과 도출 및 종료
function finalizeVoting() {
    // 득표수 카운트
    let stats = {};
    CANDIDATES.forEach(c => stats[c] = 0);
    
    for (const [person, date] of Object.entries(VOTE_STATE)) {
        if (date) stats[date]++;
    }
    
    // 우승자 정렬 로직 : 득표 내림차순 -> 같으면 날짜 오름차순(빠른 날짜)
    const sortedDates = Object.keys(stats).sort((a, b) => {
        if (stats[b] !== stats[a]) return stats[b] - stats[a]; 
        return a.localeCompare(b);
    });
    
    const winner = (sortedDates.length > 0 && stats[sortedDates[0]] > 0) ? sortedDates[0] : (CANDIDATES.length ? CANDIDATES[0] : null);
    
    // 상태 매핑 format
    const participantsStatus = {};
    for (const [person, date] of Object.entries(VOTE_STATE)) {
         participantsStatus[person] = date ? "voted" : "pending";
    }
    
    // JSON Export
    const finalResult = {
        "event_name": "도란",
        "final_date": winner,
        "vote_stats": stats,
        "participants_status": participantsStatus
    };
    
    // UI Modal 노출
    document.getElementById('winner-date').textContent = winner || "투표 결과 없음";
    document.getElementById('json-result').textContent = JSON.stringify(finalResult, null, 2);
    document.getElementById('result-modal').classList.add('active');
}
