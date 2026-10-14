SEOA Rift Loop Prototype

실행:
1) 이 폴더에서 간단한 웹서버를 실행합니다.
   예: python -m http.server 8080
2) 브라우저에서 http://localhost:8080 접속

구조:
- index.html: 화면
- styles.css: UI
- app.js: 게임 로직 + LocalSaveService
- manifest.webmanifest / sw.js: PWA 기본 뼈대

확장 포인트:
- LocalSaveService를 CloudSaveService로 교체 가능
- 나중에 계정/클라우드 저장/랭킹/결제 추가 가능
- Capacitor로 Android/iOS 패키징 가능
