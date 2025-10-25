# Render.com Static IP Addresses

**서비스**: Telegram AI Bot (MultifulDobi_bot)
**호스팅**: Render.com Web Service
**리전**: Singapore (ap-southeast-1)
**날짜**: 2025-01-19

---

## 📍 Static Outbound IP Addresses

```
13.228.225.19
18.142.128.26
54.254.162.138
74.220.52.0/24
74.220.60.0/24
```

### IP 상세 정보

| IP/Range | 타입 | 용도 | 상태 |
|----------|------|------|------|
| 13.228.225.19 | 단일 IP | Outbound traffic | ✅ Active |
| 18.142.128.26 | 단일 IP | Outbound traffic | ✅ Active |
| 54.254.162.138 | 단일 IP | Outbound traffic | ✅ Active (현재 차단됨) |
| 74.220.52.0/24 | IP Range (256 IPs) | Outbound traffic | ✅ Active |
| 74.220.60.0/24 | IP Range (256 IPs) | Outbound traffic | ✅ Active |

---

## 🚨 Replicate API 403 Forbidden 이슈

### 문제
- Replicate API (api.replicate.com) 호출 시 Cloudflare 403 Forbidden 에러
- Cloudflare Ray ID: 98e7c5323d74fd3b
- 차단된 IP: 54.254.162.138

### 요청 사항
Replicate Support에 위 5개 IP/Range whitelist 요청 완료 (2025-01-19)

### Replicate 티켓 정보
- 담당자: Jordan (Replicate Support)
- 이메일: support@replicate.com
- 상태: ⏳ Whitelist 응답 대기 중
- 예상 소요: 1-3일

---

## 🔄 Fallback Plan

### 응답 없을 시 (3일 후):
1. **Cloudflare Workers 프록시 구현**
   - 예상 소요: 1시간
   - 비용: 무료 (10만 요청/일)
   - 문서: `docs/CLOUDFLARE_WORKERS_PROXY.md` (작성 예정)

2. **다른 호스팅 플랫폼 검토**
   - Fly.io
   - Railway
   - AWS Lambda

---

## 📝 참고 문서

- Render Networking Docs: https://render.com/docs/networking
- Replicate Support Thread: [이메일 스레드 참조]
- 관련 이슈: `docs/RENDER_NSFW_API_ISSUE.md`

---

## 📧 Contact

- **Replicate Support**: support@replicate.com (Jordan)
- **Render Support**: support@render.com (Mauricio)

---

*최종 업데이트: 2025-01-19*
*다음 액션: Replicate 응답 대기 (3일)*
