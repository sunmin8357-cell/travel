import os
import logging
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types

# 1. 환경변수(.env) 불러오기
load_dotenv()

# 2. 로깅(Log) 설정: 요청, 응답, 오류를 터미널에 알기 쉽게 출력
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)
logger = logging.getLogger(__name__)

# 3. Flask 앱 인스턴스 생성
app = Flask(__name__)

# 4. Gemini API 클라이언트 초기화
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logger.warning("경고: .env 파일에 GEMINI_API_KEY가 설정되어 있지 않습니다!")

# 5. 메인 홈 라우트: index.html 화면 렌더링
@app.route("/")
def index():
    return render_template("index.html")

# 6. AI 여행 일정 생성 API 라우트
@app.route("/generate", methods=["POST"])
def generate_plan():
    logger.info("=== 새로운 여행 일정 생성 요청 수신 ===")
    
    # 6-1. JSON 요청 데이터 수신
    data = request.get_json()
    if not data:
        logger.error("요청 데이터가 비어 있거나 올바른 JSON 형식이 아닙니다.")
        return jsonify({
            "success": False, 
            "error": "요청 데이터가 전송되지 않았습니다. 입력을 다시 확인해 주세요."
        }), 400

    # 6-2. 7가지 필수 입력 항목 추출
    destination = data.get("destination", "").strip()
    duration = data.get("duration", "").strip()
    budget = data.get("budget", "").strip()
    interests = data.get("interests", "").strip()
    companions = data.get("companions", "").strip()
    transportation = data.get("transportation", "").strip()
    accommodation = data.get("accommodation", "").strip()

    # 6-3. 백엔드 입력값 검증 (모든 항목이 채워져 있는지 확인)
    missing_fields = []
    if not destination: missing_fields.append("여행지")
    if not duration: missing_fields.append("여행 기간")
    if not budget: missing_fields.append("예산")
    if not interests: missing_fields.append("관심사")
    if not companions: missing_fields.append("동행자")
    if not transportation: missing_fields.append("이동수단")
    if not accommodation: missing_fields.append("숙소 선호")

    if missing_fields:
        error_msg = f"다음 필수 항목이 누락되었습니다: {', '.join(missing_fields)}"
        logger.warning(f"입력 검증 실패: {error_msg}")
        return jsonify({"success": False, "error": error_msg}), 400

    logger.info(f"요청 파라미터 - 여행지: {destination}, 기간: {duration}, 예산: {budget}")

    # 6-4. API Key 유효성 사전 검사
    current_key = os.getenv("GEMINI_API_KEY")
    if not current_key or current_key == "your_gemini_api_key_here":
        error_msg = ".env 파일에 유효한 GEMINI_API_KEY가 입력되지 않았습니다. .env 파일을 열어 실제 키를 등록해 주세요."
        logger.error(error_msg)
        return jsonify({"success": False, "error": error_msg}), 500

    # 6-5. AI 시스템 프롬프트 및 사용자 프롬프트 구성 (제약조건 준수)
    system_instruction = (
        "당신은 전문 여행 컨설턴트 AI입니다. "
        "사용자의 7가지 여행 조건(여행지, 기간, 예산, 관심사, 동행자, 이동수단, 숙소 선호)을 바탕으로 "
        "친절하고 실용적인 맞춤형 여행 일정을 마크다운(Markdown) 형식으로 작성해야 합니다.\n\n"
        "【핵심 제약사항 - 절대 준수】\n"
        "1. 실시간 변동 가능성이 높은 정보인 가격, 운영시간, 입장료, 교통 요금, 예약 가능 여부 등은 "
        "AI가 임의로 숫자를 지어내지 말고 반드시 '[확인 필요]'라고 명시해야 합니다.\n"
        "   예시: '입장료: 성인 1인당 [확인 필요]', '운영시간: [확인 필요], 매주 월요일 휴무 여부 사전 확인 권장'\n"
        "2. 반드시 다음 6가지 대주제를 마크다운 헤더(##)로 포함하여 작성하세요:\n"
        "   - ## 1. 전체 일정 요약\n"
        "   - ## 2. 일자별 상세 일정 (시간대별 추천 동선 포함)\n"
        "   - ## 3. 예상 비용 안내 (실시간 금액은 [확인 필요] 표기)\n"
        "   - ## 4. 이동 계획 및 추천 교통수단\n"
        "   - ## 5. 추천 준비물 리스트\n"
        "   - ## 6. 여행 시 주의사항 및 꿀팁\n"
        "3. 답변은 정중하고 가독성 좋은 한국어로 작성하세요."
    )

    user_prompt = f"""
다음 조건에 맞추어 여행 일정을 작성해 주세요:
- 여행지: {destination}
- 여행 기간: {duration}
- 예산 수준: {budget}
- 여행 관심사 및 테마: {interests}
- 동행자 정보: {companions}
- 선호 이동수단: {transportation}
- 선호 숙소 형태: {accommodation}
"""

    # 6-6. Gemini API 호출
    try:
        logger.info("Gemini API 호출 시작...")
        client = genai.Client(api_key=current_key)
        
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
        logger.info(f"사용 모델: {model_name}")
        response = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            )
        )
        
        generated_plan = response.text
        logger.info("Gemini API 응답 생성 완료 (성공)")
        
        return jsonify({
            "success": True,
            "plan": generated_plan
        })

    except Exception as e:
        error_detail = str(e)
        logger.error(f"Gemini API 호출 중 오류 발생: {error_detail}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"AI 일정 생성 중 오류가 발생했습니다: {error_detail}"
        }), 500

# 7. 서버 실행 진입점
if __name__ == "__main__":
    logger.info("AI 여행 플래너 서버 시작 (http://127.0.0.1:5000)")
    app.run(host="127.0.0.1", port=5000, debug=True)
