# GitHub Pages 배포

최초 배포에서는 원본 ZIP의 게임 파일을 유지했습니다.
UI Prototype 02는 화면과 장비 선택 흐름을 변경하며, 기존 게임 수식과 저장 키는 유지합니다.

## 저장소와 Pages

1. REDBNB 계정 아래 공개 저장소 `seoa-game-prototype`을 생성합니다.
2. 이 폴더의 파일들을 저장소의 `main` 브랜치 루트에 올립니다. `index.html`이 루트에 있어야 합니다.
3. Settings → Pages → Build and deployment에서 `Deploy from a branch`를 선택합니다.
4. Branch를 `main`, 폴더를 `/ (root)`로 선택하고 저장합니다.
5. Custom domain에 `game.seoaone.com`을 입력하고 저장합니다. CNAME 파일만으로 설정 완료를 가정하지 않습니다.

## 도메인 DNS

도메인의 DNS 관리 화면에서 다음 레코드를 등록합니다.

| 유형 | 호스트 | 값 |
| --- | --- | --- |
| CNAME | game | REDBNB.github.io |

동일한 `game` 호스트에 기존 레코드가 있다면 먼저 용도를 확인합니다. 다른 호스트나 네임서버 설정을 변경할 필요는 없습니다.
DNS 검증과 HTTPS 인증서 발급이 완료되면 Pages에서 Enforce HTTPS를 켭니다.

## 확인과 이후 수정

- Pages 배포 성공, DNS CNAME, `https://game.seoaone.com` 접속을 각각 확인합니다.
- 이후 `main`에 변경 사항을 반영하면 Pages에서 다시 배포합니다.
- UI Prototype 02 서비스 워커는 네트워크 우선 / 오프라인 캐시 대체 방식입니다. 설치 시 새 캐시를 준비하고 활성화 시 이전 게임 캐시를 정리합니다. v1 캐시를 사용하던 기존 방문자는 업데이트 활성화 후 새로고침하면 새 화면을 받습니다. localStorage 저장 데이터는 삭제하지 않습니다.
- 저장 데이터는 접속 주소별 브라우저 저장소에 남습니다. 로컬 파일, GitHub 기본 주소, 커스텀 도메인의 저장 데이터는 자동으로 이전되지 않습니다.

공식 문서:
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
