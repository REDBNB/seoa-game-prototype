SEOA Rift Loop Prototype

실행:
1) 이 폴더에서 간단한 웹서버를 실행합니다.
   예: python -m http.server 8080
2) 브라우저에서 http://localhost:8080 접속

구조:
- index.html: 화면
- styles.css: UI
- app.js: 게임 로직 + UI
- save-service.js: LocalSaveService (기존 seoa-rift-loop-v1 저장 키 유지)
- manifest.webmanifest / sw.js: PWA 기본 뼈대

확장 포인트:
- LocalSaveService를 CloudSaveService로 교체 가능
- 나중에 계정/클라우드 저장/랭킹/결제 추가 가능
- Capacitor로 Android/iOS 패키징 가능

UI Prototype 02:
- HUD, 현재 적용 스탯, 단일 장비 슬롯, 즉시 드랍 비교 및 장착/보관/분해 선택
- 레벨/경험치는 기존에 없으므로 미구현 표시. 새 성장 규칙은 추가하지 않음
- 치명타/공격속도/골드획득 등 랜덤 옵션은 기존처럼 설명 전용
- 분해는 확인 후 삭제하며 보상 없음. 기존 드랍/피해/강화 수식 유지
- pendingLoot는 선택 전 장비 목록. 재접속에도 보존. 보관함 12개 초과 시 자동 삭제하지 않음
