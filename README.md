# ljun-level-up

내 개인 Claude Code 마켓플레이스. 잭피디 영상 [클로드 코드 레벨업 필수 스킬](https://www.youtube.com/watch?v=u23ZCPtkYjU) 의 스킬 스택을 한 곳에 큐레이션했다.

## 한 번에 설치

```bash
claude plugin marketplace add leecoder5359/claude-level-up
claude plugin install claude-level-up@ljun-level-up
# 그 다음 Claude 안에서:  /level-up-setup
```

## 구성

| plugin | 형태 | 출처 |
|---|---|---|
| **claude-level-up** | 로컬 번들 (frontend-design · humanizer · karpathy-guidelines 벤더링 + `/level-up-setup`) | 이 repo `./claude-level-up` |
| **superpowers** | 참조 | obra/superpowers |
| **understand-anything** | 참조 (git-subdir) | Egonex-AI/Understand-Anything |
| **agentmemory** | 참조 (git-subdir) | rohitg00/agentmemory |
| **watch** | 참조 | bradautomates/claude-video |

영상 설명란의 원본 링크 7종을 모두 반영했다. 이미 환경에 있던 것: `watch`, `find-skills`(보너스).
humanizer는 영상이 쓴 한국어판(DaleSeo/korean-skills), karpathy는 multica-ai 출처를 따랐다.

벤더링 스킬 라이선스: [claude-level-up/ATTRIBUTION.md](./claude-level-up/ATTRIBUTION.md)
