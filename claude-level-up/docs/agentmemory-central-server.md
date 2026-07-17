# agentmemory 중앙 메모리 서버 — 셋업 런북

루프 엔지니어링의 "세션 간 기억" 조각을 실제로 구현하는 설정. `agentmemory`(rohitg00, Apache-2.0)를 **한 머신에서 상시 서버로 띄우고**, Tailscale 사설망으로 **어느 기기/세션에서든** 같은 메모리를 주입·검색한다.

## 구조

```
   [메모리 서버]  REST :3111 · viewer :3113 · streams :3112 · engine :49134
        ▲  iii-engine 기반, npx -y @agentmemory/agentmemory 로 기동
        │  AGENTMEMORY_URL 로 접속 (Bearer 인증)
   ┌────┴───────────────────────────────────────────────┐
   │ 클라이언트(어느 머신이든): Claude Code 훅 12개 + MCP 53개 │
   │  AGENTMEMORY_INJECT_CONTEXT=true → 세션 시작 시 관련 기억 주입 │
   └──────────────────────────────────────────────────────┘
            ▲ 외부 접근: tailscale serve (tailnet only, HTTPS)
```

- 훅/MCP는 서버의 **클라이언트**일 뿐 — 모두 `AGENTMEMORY_URL`을 바라본다. **서버가 안 떠 있으면 훅은 조용히 실패**한다.
- "어디서든"의 정체 = 서버 1대 + 모든 클라이언트가 같은 `AGENTMEMORY_URL`을 가리키는 것.

## 전제

- Node 20+ (이 셋업은 v22). Docker 또는 iii-engine 네이티브 바이너리(npx가 자동 설치).
- 서버 호스트는 상시 켜져 있어야 함(이 셋업: Mac mini).

## 1) 서버 + 영속화 (호스트 머신, 1회)

시크릿 발급 — `~/.agentmemory/.env`:

```bash
mkdir -p ~/.agentmemory
printf 'AGENTMEMORY_SECRET=%s\n' "$(openssl rand -hex 32)" >> ~/.agentmemory/.env
chmod 600 ~/.agentmemory/.env
```

launchd LaunchAgent (`~/Library/LaunchAgents/com.<user>.agentmemory.plist`).
**`npx` 절대경로는 `command -v npx`로 확인해서 넣을 것**(nvm 사용 시 버전 경로 포함):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.<user>.agentmemory</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/<user>/.nvm/versions/node/v22.14.0/bin/npx</string>
    <string>-y</string><string>@agentmemory/agentmemory</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>/Users/<user></string>
    <key>PATH</key><string>/Users/<user>/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>WorkingDirectory</key><string>/Users/<user></string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/<user>/.agentmemory/launchd.log</string>
  <key>StandardErrorPath</key><string>/Users/<user>/.agentmemory/launchd.log</string>
</dict>
</plist>
```

로드 + 기동:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.<user>.agentmemory.plist 2>/dev/null \
  || launchctl load -w ~/Library/LaunchAgents/com.<user>.agentmemory.plist
sleep 6 && curl -fsS http://localhost:3111/agentmemory/livez   # {"status":"ok"} 이어야 함
```

> ⚠️ **단일 인스턴스 유지**: 재기동 중 워커가 둘 등록되면 엔진 라우팅이 깨져 `/agentmemory/*`가 전부 404가 된다. 재기동 시 `pkill -9 -f '@agentmemory/agentmemory'; pkill -9 -f '.agentmemory/bin/iii'` 로 완전히 죽이고 stale 상태(`~/.agentmemory/iii.pid`, `engine-state.json`) 제거 후 단일로 띄울 것.
> ⚠️ `III_REST_HOST` 같은 env로 바인딩을 바꾸려 하지 말 것 — 무시되며 기동이 깨진다. 바인딩은 iii-engine config 소관. 외부 노출은 아래 tailscale serve로 한다(서버는 127.0.0.1 그대로 두는 게 안전).

## 2) 외부 접근 — Tailscale serve (호스트 머신)

서버는 `127.0.0.1`에 그대로 두고 Tailscale이 타일넷에 HTTPS로 브리지. 공인 포트 노출 0, WireGuard 암호화.

```bash
TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale   # GUI 앱 CLI 경로
sudo "$TS" set --operator=$USER     # 1회: CLI가 sudo 없이 serve 관리 (macOS GUI 앱 필수)
"$TS" serve --bg 3111               # localhost:3111 → https://<magicdns>/ (tailnet only)
"$TS" serve status                  # https://<host>.<tailnet>.ts.net 확인
```

- 첫 HTTPS 요청은 TLS 인증서 발급으로 10~30s 지연될 수 있음(정상). 이후 빠름.
- 타일넷 HTTPS 인증서 기능이 켜져 있어야 함(Tailscale admin → DNS → HTTPS Certificates).
- 이 셋업의 주소: `https://<host>.<tailnet>.ts.net`

## 3) 클라이언트 배선 (기기마다)

Claude Code 훅이 환경변수를 읽는다. 셸에서 `claude`를 띄우면 `~/.zshrc`로 충분:

```bash
cat >> ~/.zshrc <<'ZRC'

# agentmemory (Claude Code 메모리 주입)
export AGENTMEMORY_URL="http://localhost:3111"          # 호스트 본인. 다른 기기는 ↓
# export AGENTMEMORY_URL="https://<host>.<tailnet>.ts.net"
export AGENTMEMORY_SECRET="<호스트의 ~/.agentmemory/.env 와 동일한 값>"
export AGENTMEMORY_INJECT_CONTEXT="true"
ZRC
```

- GUI 앱으로 Claude를 쓰면 `~/.claude/settings.json`의 `env` 블록에 같은 3개를 넣는다.
- **다른 기기**: Tailscale 설치+로그인 → `AGENTMEMORY_URL`을 타일넷 주소로 → agentmemory(또는 claude-level-up) 플러그인 설치.
- `AGENTMEMORY_INJECT_CONTEXT=true`는 매 세션 관련 기억을 주입하느라 토큰을 더 쓴다(원하는 "주입" 기능). 끄려면 그 줄 제거.

## 운영 메모

| 작업 | 명령 |
|---|---|
| 상태 | `curl -fsS http://localhost:3111/agentmemory/livez` |
| 저장 테스트 | `curl -X POST .../agentmemory/remember -H "Authorization: Bearer $SECRET" -d '{"content":"..."}'` |
| 검색 | `curl -X POST .../agentmemory/smart-search -H "Authorization: Bearer $SECRET" -d '{"query":"...","limit":5}'` |
| 뷰어 | `http://localhost:3113` (실시간 메모리 빌드 확인) |
| 서버 중지 | `launchctl bootout gui/$(id -u)/com.<user>.agentmemory` |
| 외부노출 해제 | `tailscale serve reset` |
| 인증 확인 | Bearer 없이 요청 시 `401` |

## LLM 기능(선택)

기본은 zero-LLM(BM25 + 로컬 임베딩)이라 키 없이 동작. 요약/자동 압축을 켜려면 `~/.agentmemory/.env`에:

```env
ANTHROPIC_API_KEY=sk-ant-...
AGENTMEMORY_AUTO_COMPRESS=true
```
(주: Claude Code 안에서 agent-sdk fallback은 Stop-hook 무한재귀 위험이 있어 기본 비활성.)
