# claude-level-up

잭피디 영상 [클로드 코드 10분안에 레벨업 시키는 필수 스킬 7개](https://www.youtube.com/watch?v=u23ZCPtkYjU) 에서 소개된 스킬 스택을 **하나의 plugin/마켓플레이스로 묶은** 번들.

## 무엇이 들어있나

이 plugin은 **단일 파일 스킬 3종을 직접 벤더링**한다 (설치 즉시 활성화):

- **frontend-design** — 프론트엔드 작업 시 "AI 티 나는" 템플릿 디자인을 피하도록 안내 (Anthropic 공식, Apache-2.0)
- **humanizer** — AI 한국어 문체를 제거하고 자연스럽게 다시 씀, KatFishNet 기반 40패턴 (DaleSeo/korean-skills, MIT)
- **karpathy-guidelines** — 과한 변경·오버엔지니어링을 막는 코딩 행동 가이드 (multica-ai, MIT)

나머지는 별도 plugin이라 **같은 마켓플레이스(`ljun-level-up`)에서 참조**로 설치한다:

- **superpowers** — 요구사항→계획→테스트→구현→리뷰 강제 (obra)
- **understand-anything** — 프로젝트 지식 그래프/대시보드, `/understand` (Egonex-AI)
- **agentmemory** — AI 코딩 에이전트용 영속 메모리, 세션 간 맥락 주입 (rohitg00). 중앙 서버를 한 머신에 띄워 어디서든 쓰는 셋업은 [docs/agentmemory-central-server.md](./docs/agentmemory-central-server.md) 참고.
- **watch** — 영상 이해 (claude-video) · *이미 설치돼 있을 수 있음*

## 설치

```bash
# 1) 마켓플레이스 등록 (이 repo)
claude plugin marketplace add leecoder5359/claude-level-up

# 2) 번들 plugin 설치 (벤더링 스킬 3종 즉시 활성화)
claude plugin install claude-level-up@ljun-level-up

# 3) 나머지 upstream plugin 설치 — 또는 Claude 안에서 /level-up-setup 실행
claude plugin install superpowers@ljun-level-up
claude plugin install understand-anything@ljun-level-up
claude plugin install agentmemory@ljun-level-up
```

설치 후 **재시작**하면 로드된다.

## 커맨드

- `/level-up-setup` — 설치 상태 점검 + 누락된 upstream plugin 설치 안내/실행

## 출처·라이선스

벤더링 스킬의 출처와 라이선스는 [ATTRIBUTION.md](./ATTRIBUTION.md) 참고.
