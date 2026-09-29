 // 주소창에 불필요한 파라미터(?destination=...)가 남아있으면 깔끔하게 제거
if (window.location.search) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

// 전역 변수: 마크다운 원본 텍스트 및 여행지 이름 저장 (복사/다운로드용)
let currentRawPlan = "";
    let currentDestination = "AI_여행플랜";

    // DOM 요소 참조
    const travelForm = document.getElementById("travelForm");
    const submitBtn = document.getElementById("submitBtn");
    const btnText = submitBtn.querySelector(".btn-text");

    const emptyState = document.getElementById("emptyState");
    const loadingState = document.getElementById("loadingState");
    const errorBox = document.getElementById("errorBox");
    const planContent = document.getElementById("planContent");
    const actionButtons = document.getElementById("actionButtons");
    const copyBtn = document.getElementById("copyBtn");
    const downloadBtn = document.getElementById("downloadBtn");

    // 7가지 입력 필드 정의
    const fields = [
      { id: "destination", name: "여행지" },
      { id: "duration", name: "여행 기간" },
      { id: "budget", name: "예산" },
      { id: "interests", name: "관심사" },
      { id: "companions", name: "동행자" },
      { id: "transportation", name: "이동수단" },
      { id: "accommodation", name: "숙소 선호" }
    ];

    // 1. 입력 필드 유효성 검증 함수
    function validateInputs() {
      let isValid = true;

      fields.forEach(field => {
        const input = document.getElementById(field.id);
        const errorElem = document.getElementById(`error-${field.id}`);
        const value = input.value.trim();

        if (!value) {
          input.classList.add("input-error");
          errorElem.textContent = `${field.name} 항목을 입력해 주세요.`;
          isValid = false;
        } else {
          input.classList.remove("input-error");
          errorElem.textContent = "";
        }
      });

      return isValid;
    }

    // 입력 중일 때 빨간색 에러 테두리 즉각 해제
    fields.forEach(field => {
      const input = document.getElementById(field.id);
      input.addEventListener("input", () => {
        if (input.value.trim()) {
          input.classList.remove("input-error");
          document.getElementById(`error-${field.id}`).textContent = "";
        }
      });
    });

    // 2. 폼 제출 및 생성 버튼 클릭 핸들러
    async function handleGenerate(e) {
      if (e) e.preventDefault();

      // 2-1. 프론트엔드 검증 통과 여부 확인
      if (!validateInputs()) {
        return;
      }

      // 2-2. 7가지 입력값 취합
      const payload = {
        destination: document.getElementById("destination").value.trim(),
        duration: document.getElementById("duration").value.trim(),
        budget: document.getElementById("budget").value.trim(),
        interests: document.getElementById("interests").value.trim(),
        companions: document.getElementById("companions").value.trim(),
        transportation: document.getElementById("transportation").value.trim(),
        accommodation: document.getElementById("accommodation").value.trim()
      };

      currentDestination = payload.destination;

      // 2-3. UI를 '로딩 상태'로 전환
      setLoading(true);
      hideError();

      try {
        // 2-4. Flask 백엔드 /generate 라우트로 POST 요청
        const response = await fetch("/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 2-5. 백엔드 처리 결과 확인
        if (response.ok && data.success) {
          currentRawPlan = data.plan;
          displayPlan(data.plan);
        } else {
          showError(data.error || "일정 생성 중 알 수 없는 문제가 발생했습니다.");
        }

      } catch (err) {
        console.error("통신 오류:", err);
        showError("서버와의 통신에 실패했습니다. Flask 서버(app.py)가 정상 실행 중인지 확인해 주세요.");
      } finally {
        setLoading(false);
      }
    }

    travelForm.addEventListener("submit", handleGenerate);
    submitBtn.addEventListener("click", handleGenerate);

    // 3. UI 로딩 상태 제어 함수
    function setLoading(isLoading) {
      if (isLoading) {
        submitBtn.disabled = true;
        btnText.textContent = "⏳ 일정 생성 중...";
        emptyState.style.display = "none";
        planContent.style.display = "none";
        actionButtons.style.display = "none";
        loadingState.style.display = "block";
      } else {
        submitBtn.disabled = false;
        btnText.textContent = "✨ AI 여행 일정 생성하기";
        loadingState.style.display = "none";
      }
    }

    // 4. 생성된 일정 렌더링 함수
    function displayPlan(markdownText) {
      // [확인 필요] 문구를 강조 태그로 감싸서 시각적 강조
      const highlightedMarkdown = markdownText.replace(/\[확인 필요\]/g, "`[확인 필요]`");

      // marked.js 라이브러리를 통해 마크다운을 HTML로 변환
      if (typeof marked !== "undefined" && marked.parse) {
        planContent.innerHTML = marked.parse(highlightedMarkdown);
      } else {
        // 혹시 CDN 로드에 실패했을 경우 줄바꿈 유지 일반 텍스트로 폴백
        planContent.textContent = markdownText;
      }

      planContent.style.display = "block";
      actionButtons.style.display = "flex";
      emptyState.style.display = "none";

      // 결과 영역으로 부드럽게 스크롤 이동
      planContent.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // 5. 오류 메시지 표시/숨김 함수
    function showError(message) {
      errorBox.textContent = `❌ ${message}`;
      errorBox.style.display = "block";
      emptyState.style.display = "block";
      actionButtons.style.display = "none";
      planContent.style.display = "none";
    }

    function hideError() {
      errorBox.style.display = "none";
      errorBox.textContent = "";
    }

    // 6. 결과 복사 기능 (클립보드 API)
    copyBtn.addEventListener("click", async () => {
      if (!currentRawPlan) return;

      try {
        await navigator.clipboard.writeText(currentRawPlan);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "✅ 복사 완료!";
        copyBtn.style.borderColor = "#10b981";
        copyBtn.style.color = "#10b981";

        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.borderColor = "";
          copyBtn.style.color = "";
        }, 2000);
      } catch (err) {
        alert("클립보드 복사에 실패했습니다. 수동으로 텍스트를 복사해 주세요.");
      }
    });

    // 7. Markdown (.md) 파일 다운로드 기능
    downloadBtn.addEventListener("click", () => {
      if (!currentRawPlan) return;

      // Blob 객체 생성 및 가상 다운로드 링크 트리거
      const blob = new Blob([currentRawPlan], { type: "text/markdown;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");

      // 안전한 파일명 생성 (특수문자 제거)
      const safeDestination = currentDestination.replace(/[\\/:*?"<>|]/g, "_");
      a.href = downloadUrl;
      a.download = `${safeDestination}_여행일정.md`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    });