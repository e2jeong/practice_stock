import os
import json
import random
import datetime
import calendar
import google.generativeai as genai

# 한국 주요 공휴일 (2026년 기준)
HOLIDAYS_2026 = {
    "2026-01-01": "신정",
    "2026-02-16": "설날 연휴",
    "2026-02-17": "설날",
    "2026-02-18": "설날 연휴",
    "2026-03-02": "삼일절 대체공휴일",
    "2026-05-05": "어린이날",
    "2026-05-25": "부처님오신날 대체공휴일",
    "2026-06-06": "현충일",
    "2026-08-15": "광복절",
    "2026-09-24": "추석 연휴",
    "2026-09-25": "추석",
    "2026-09-26": "추석 연휴",
    "2026-10-03": "개천절",
    "2026-10-09": "한글날",
    "2026-12-25": "기독탄신일(크리스마스)"
}

PARTICIPANTS = ["피카츄", "라이츄", "파이리", "꼬북이", "버터풀", "야도란", "피죤투", "또가스"]

def initialize_gemini():
    api_key = input("GEMINI_API_KEY를 입력하세요: ").strip()
    if not api_key:
        print("API Key가 입력되지 않았습니다. 프로그램을 종료합니다.")
        return None
    genai.configure(api_key=api_key)
    # Gemini 3 Flash Preview 초기화
    model = genai.GenerativeModel('gemini-3-flash-preview')
    return model

def get_next_month_candidates(year, month):
    next_month = month + 1
    next_year = year
    if next_month > 12:
        next_month = 1
        next_year += 1

    num_days = calendar.monthrange(next_year, next_month)[1]
    candidates = []

    for day in range(1, num_days + 1):
        date_obj = datetime.date(next_year, next_month, day)
        date_str = date_obj.strftime("%Y-%m-%d")
        
        # 주말 제외 (0: 월요일 ~ 4: 금요일 / 5: 토, 6: 일)
        if date_obj.weekday() >= 5:
            continue
            
        # 2026 공휴일 제외
        if date_str in HOLIDAYS_2026:
            continue
            
        candidates.append(date_str)
        
    # 랜덤하게 3~5개 후보 도출
    sample_size = min(len(candidates), random.randint(3, 5))
    return sorted(random.sample(candidates, sample_size))

def parse_user_intent(model, user_input):
    prompt = f"""
    사용자의 입력: "{user_input}"
    이 입력이 "다음 달 도란 일정 잡아줘" 같은 의미, 또는 팀 회식 투표 생성을 요구하는 의미인지 파악하세요.
    맞다면 "YES", 아니라면 "NO"만 출력하세요.
    """
    try:
        response = model.generate_content(prompt)
        text = response.text.strip().upper()
        return "YES" in text
    except Exception as e:
        print(f"Gemini API 호출 중 오류 발생: {e}")
        return False

def print_status(candidates, votes):
    print("\n--- 투표 현황판 ---")
    for date in candidates:
        count = sum(1 for person, vote in votes.items() if vote == date)
        print(f"{date}: {count}표")
    
    print("\n--- 참여자 현황 ---")
    for person in PARTICIPANTS:
        status = "[V]" if votes.get(person) else "[ ]"
        print(f"{status} {person}")
    print("-------------------\n")

def main():
    print("도란(팀 회식) 투표 생성 및 관리 시스템")
    print("=========================================\n")
    model = initialize_gemini()
    if not model:
        return

    while True:
        cmd = input("\n명령을 입력하세요 (예: '다음 달 도란 일정 잡아줘'): ").strip()
        if not cmd: continue
        
        if cmd in ["종료", "Exit", "exit"]:
            return
            
        print("Gemini 모델이 의도를 분석 중입니다...")
        is_intent = parse_user_intent(model, cmd)
        
        if is_intent:
            print("도란 예약 일정을 생성합니다!")
            break
        else:
            print("명령을 이해하지 못했습니다. 다시 시도하거나 '종료'를 입력하세요.")

    now = datetime.datetime.now()
    year, month = now.year, now.month
    
    candidates = get_next_month_candidates(year, month)
    print(f"\n다음 달 평일 휴일 제외 후보: {', '.join(candidates)}")
    print("========================================")
    print("투표를 시작합니다! 각 참여자들은 후보일을 선택해 주세요.")
    print("사용법: [참여자] [날짜] (예: 야도란 2026-05-12)")
    print("'종료' 입력 시 실시간 투표를 마감합니다.")
    
    votes = {person: None for person in PARTICIPANTS}
    print_status(candidates, votes)
    
    while True:
        cmd = input("\n투표 입력 ('종료'로 완료): ").strip()
        if cmd in ['종료', 'Exit', 'Finish', 'exit', 'finish']:
            break
            
        parts = cmd.split()
        if len(parts) == 2:
            person, date = parts[0], parts[1]
            if person in PARTICIPANTS:
                if date in candidates:
                    votes[person] = date
                    print_status(candidates, votes)
                else:
                    print(f"오류: '{date}'는 등록된 후보 날짜가 아닙니다.")
            else:
                 print(f"오류: '{person}'은(는) 참여자(명단)에 없습니다.")
        else:
            print("오류: 입력 방식이 잘못되었습니다. (예: 피카츄 2026-05-04)")

    print("\n=================")
    print("투표가 종료되었습니다!")
    print("결과를 도출합니다...")
    
    # 득표수 카운트
    stats = {c: 0 for c in candidates}
    for person, date in votes.items():
        if date:
            stats[date] += 1
            
    # 동점일 경우 날짜가 빠른 순 (내림차순 정렬된 득표수를 첫번째 기준으로, 그리고 날짜 문자열 오름차순)
    sorted_dates = sorted(stats.keys(), key=lambda d: (-stats[d], d))
    
    winner = sorted_dates[0] if sorted_dates and stats[sorted_dates[0]] > 0 else (candidates[0] if candidates else None)

    participants_status = {}
    for person, vote in votes.items():
        participants_status[person] = "voted" if vote else "pending"

    final_result = {
        "event_name": "도란",
        "final_date": winner,
        "vote_stats": stats,
        "participants_status": participants_status
    }
    
    print("\n최종 투표 결과 데이터(JSON):")
    print(json.dumps(final_result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
