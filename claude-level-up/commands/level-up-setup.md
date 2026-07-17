---
description: 레벨업 스킬 스택 설치 상태를 점검하고, 누락된 upstream plugin을 설치한다
allowed-tools: Bash
---

# /level-up-setup — 레벨업 스킬 스택 셋업

이 plugin(`claude-level-up`)은 단일 파일 스킬 3종을 이미 벤더링해 활성화하고 있다:
**frontend-design · humanizer · karpathy-guidelines**.

나머지는 별도 plugin이라 `claude-level-up`과 함께 쓰는 `ljun-level-up` 마켓플레이스에서 설치한다.
이 커맨드는 설치 상태를 점검하고 누락분을 설치한다.

## 절차

1. 현재 설치 상태를 확인한다:

```bash
claude plugin list 2>/dev/null
```

2. `ljun-level-up` 마켓플레이스가 등록돼 있지 않으면 등록한다 (이 repo 경로 사용):

```bash
claude plugin marketplace list 2>/dev/null | grep -q ljun-level-up || \
  claude plugin marketplace add leecoder5359/claude-level-up
```

3. 누락된 plugin을 설치한다 (이미 설치돼 있으면 건너뛴다):

```bash
claude plugin install superpowers@ljun-level-up
claude plugin install understand-anything@ljun-level-up
claude plugin install agentmemory@ljun-level-up
claude plugin install watch@ljun-level-up   # 이미 claude-video로 설치돼 있으면 생략
```

4. 설치가 끝나면 **재시작이 필요**함을 사용자에게 알린다 (`claude plugin install`은 다음 세션부터 로드됨).

## 영상 스킬 ↔ 출처 매핑 (설명란 원본 링크 기준)

| 영상 스킬 | 출처 | 처리 |
|---|---|---|
| Karpathy Guidelines | multica-ai/andrej-karpathy-skills | 벤더링 |
| humanizer | DaleSeo/korean-skills (한국어판) | 벤더링 |
| frontend-design | anthropics/skills | 벤더링 |
| Superpowers | obra/superpowers | 참조 |
| Understand-Anything | Egonex-AI/Understand-Anything | 참조 |
| agentmemory | rohitg00/agentmemory | 참조 |
| claude-video (watch) | bradautomates/claude-video | 참조 |

## agentmemory 중앙 서버 (어디서든 메모리 주입)

agentmemory를 한 머신에 상시 서버로 띄우고 Tailscale로 어느 기기/세션에서든 같은 메모리를
주입·검색하는 셋업은 [`docs/agentmemory-central-server.md`](../docs/agentmemory-central-server.md)에
런북으로 정리돼 있다. 요점: `npx -y @agentmemory/agentmemory`를 launchd로 영속화 → `tailscale serve`로
타일넷 HTTPS 노출 → 클라이언트마다 `AGENTMEMORY_URL`·`AGENTMEMORY_SECRET`·`AGENTMEMORY_INJECT_CONTEXT=true` 배선.
서버 재기동 시 워커 중복 등록되면 `/agentmemory/*`가 404나니 단일 인스턴스 유지.
