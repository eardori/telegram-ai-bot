# NSFW Safety System Documentation

## 📋 Overview

Phase 1 implementation of NSFW (Not Safe For Work) content safety system.

**Purpose:**
- Legal compliance (age verification)
- User safety and consent
- Usage monitoring and limits
- Abuse prevention

**Status:** ✅ Phase 1 Complete (2025-01-10)

---

## 🏗️ Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    User Request                          │
│            (NSFW Template Selection)                      │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │  checkNSFWAccess()   │
         │  (consent-handler)   │
         └──────────┬──────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
    [No Consent]        [Has Consent]
          │                   │
          ▼                   ▼
  Show Consent Dialog   Check Daily Limit
          │                   │
          ▼           ┌───────┴──────┐
    User Agrees       │              │
          │           ▼              ▼
          ▼      [Within Limit] [Exceeded]
  grantConsent()      │              │
          │           ▼              ▼
          │   Execute Template  Show Limit
          │           │          Message
          │           ▼
          │   recordUsage()
          │           │
          └───────────┴──────────────┘
                      │
                      ▼
                [Task Complete]
```

---

## 🗄️ Database Schema

### New Columns in `users` Table

| Column | Type | Description |
|--------|------|-------------|
| `nsfw_consent_given` | BOOLEAN | User consented to NSFW features |
| `nsfw_consent_date` | TIMESTAMPTZ | When consent was given |
| `nsfw_age_verified` | BOOLEAN | User verified 19+ years old |
| `nsfw_daily_limit` | INTEGER | Daily NSFW usage limit (default: 5) |
| `nsfw_enabled` | BOOLEAN | Admin can disable NSFW for user |

### New Table: `nsfw_usage_log`

Tracks all NSFW feature usage:

```sql
CREATE TABLE nsfw_usage_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    template_key TEXT REFERENCES prompt_templates(template_key),
    prompt TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    generation_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Views

- `v_nsfw_daily_usage` - Daily usage statistics per user
- `v_nsfw_admin_stats` - Overall NSFW stats for admin
- `v_nsfw_popular_templates` - Most used NSFW templates (30 days)

### Functions

- `check_nsfw_daily_limit(user_id)` - Check if user can use NSFW
- `record_nsfw_usage(...)` - Log NSFW usage
- `grant_nsfw_consent(user_id, age_verified)` - Grant consent
- `revoke_nsfw_access(user_id, reason)` - Admin revoke access

---

## 🎯 Features

### 1. Age Verification & Consent

**Flow:**
1. User selects NSFW template
2. System checks `nsfw_consent_given`
3. If no consent → Show consent dialog
4. User clicks "✅ Yes, I agree (19+)"
5. System calls `grant_nsfw_consent()`
6. User can now use NSFW features

**UI Messages:**

Korean:
```
⚠️ 성인 전용 기능 안내

이 기능은 만 19세 이상만 사용할 수 있습니다.

주의사항:
• 성인 컨텐츠가 포함될 수 있습니다
• 불법적인 용도로 사용할 수 없습니다
...

만 19세 이상이며, 위 내용에 동의하시나요?

[✅ 네, 동의합니다 (19세 이상)] [❌ 아니오]
```

English:
```
⚠️ Adult Content Warning

This feature is restricted to users 19 years or older.

Terms of Use:
• May contain adult content
• Cannot be used for illegal purposes
...

Are you 19 years or older and agree to these terms?

[✅ Yes, I agree (19+)] [❌ No]
```

### 2. Daily Usage Limits

**Limits:**
- **Free users**: 5 NSFW requests per day
- **VIP subscribers**: Unlimited

**Implementation:**
```typescript
const limitCheck = await nsfwSafetyService.checkDailyLimit(userId);

if (!limitCheck.can_use) {
  // Show limit exceeded message
  ctx.reply(getLimitExceededMessage(limitCheck));
  return;
}
```

**Limit Exceeded Message:**
```
❌ 일일 사용 한도 초과

오늘 사용 가능한 NSFW 크레딧을 모두 사용했습니다.

📊 오늘의 사용량:
• 사용: 5회
• 한도: 5회
• 남은 횟수: 0회

⏰ 내일 다시 사용 가능합니다

💎 무제한 사용을 원하신다면:
• VIP 구독으로 일일 제한 없이 사용하세요
• /credits 명령어로 구독 플랜 확인
```

### 3. Usage Tracking

Every NSFW generation is logged:

```typescript
await nsfwSafetyService.recordUsage(
  userId,
  templateKey,
  prompt,
  success,        // true/false
  errorMessage,   // if failed
  generationTimeMs // performance metric
);
```

**What is tracked:**
- Who used NSFW features (user_id)
- What template (template_key)
- What prompt (for abuse detection)
- Success/failure rate
- Generation time (performance)
- Timestamp

**What is NOT tracked:**
- Generated images (not stored)
- Personal information (anonymous usage stats only)

### 4. Safety Checks

Every NSFW request goes through:

```typescript
const { allowed, reason } = await nsfwSafetyService.canUseNSFW(userId);

// Checks:
// 1. Is NSFW enabled for this user? (nsfw_enabled)
// 2. Has user given consent? (nsfw_consent_given)
// 3. Has user verified age? (nsfw_age_verified)
// 4. Within daily limit? (check_nsfw_daily_limit)
```

**Possible rejection reasons:**
- `nsfw_disabled` - Admin disabled NSFW for user
- `no_consent` - User hasn't agreed to terms
- `age_not_verified` - Age verification required
- `daily_limit_exceeded` - Used all daily credits

---

## 💻 Code Usage

### In Image Edit Handler

```typescript
import { checkNSFWAccess, executeWithNSFWTracking } from '../handlers/nsfw-consent-handler';

// Before executing NSFW template
const hasAccess = await checkNSFWAccess(ctx, userId, templateKey);
if (!hasAccess) {
  return; // checkNSFWAccess already sent appropriate message
}

// Execute with tracking
const result = await executeWithNSFWTracking(
  userId,
  templateKey,
  prompt,
  async () => {
    // Your NSFW generation code
    return await replicateService.generateNSFWImage(prompt, options);
  }
);
```

### Manual Consent Check

```typescript
import { nsfwSafetyService } from '../services/nsfw-safety';

const consentStatus = await nsfwSafetyService.checkConsent(userId);

if (!consentStatus.consent_given) {
  // Show consent dialog
}
```

### Admin: Revoke Access

```sql
-- Revoke NSFW access for specific user
SELECT revoke_nsfw_access(123456789, 'Terms of service violation');
```

---

## 📊 Admin Monitoring

### View Overall NSFW Stats

```sql
SELECT * FROM v_nsfw_admin_stats;
```

**Output:**
```
total_nsfw_users | total_nsfw_requests | successful_requests | failed_requests | avg_generation_time_ms | requests_today | active_users_today | requests_last_7d | active_users_last_7d
-----------------+---------------------+---------------------+-----------------+------------------------+----------------+--------------------+------------------+---------------------
             245 |                1823 |                1756 |              67 |                  12350 |            142 |                 45 |             1204 |                  178
```

### View Popular NSFW Templates

```sql
SELECT * FROM v_nsfw_popular_templates
LIMIT 10;
```

**Output:**
```
template_key        | usage_count | unique_users | avg_time_ms | success_rate
--------------------+-------------+--------------+-------------+-------------
nsfw_outfit_change  |         456 |          123 |       11234 |        96.05
nsfw_pose_change    |         342 |           89 |       13567 |        94.15
...
```

### View User's NSFW Usage

```sql
SELECT *
FROM nsfw_usage_log
WHERE user_id = 139680303
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🔒 Security & Privacy

### Data Protection

- ✅ No generated images are stored
- ✅ Only usage statistics collected
- ✅ Anonymous aggregation for analytics
- ✅ User can revoke consent (feature request)

### Age Verification

- ⚠️ **Self-declaration only** (Phase 1)
- User clicks "I am 19+"
- No ID verification (would require third-party service)
- Legal disclaimer shown before consent

### Abuse Prevention

- Daily limits for free users
- Admin can disable NSFW for specific users
- Usage logging for pattern detection
- Extreme content filtering (Phase 3 - planned)

---

## 🚀 Deployment

### 1. Run SQL Schema

```bash
# Execute in Supabase SQL Editor
psql $SUPABASE_URL < sql/028_nsfw_safety_system.sql
```

### 2. Build & Deploy

```bash
npm run build
git add .
git commit -m "feat: NSFW safety system (Phase 1)"
git push origin main
```

Render.com will auto-deploy in 2-3 minutes.

### 3. Test

Telegram bot → Select any template with "NSFW" in name → Should show consent dialog

---

## ✅ Phase 1 Checklist

- [x] Database schema (users columns, nsfw_usage_log table)
- [x] SQL functions (check limit, record usage, grant consent)
- [x] Admin views (stats, popular templates)
- [x] NSFW Safety Service (TypeScript)
- [x] Consent UI/UX (Korean + English)
- [x] Daily limit checking
- [x] Usage tracking
- [x] Integration with webhook handlers
- [x] Documentation

---

## 🔮 Future Phases

### Phase 2: Template Activation (Next)
- Identify existing NSFW templates in DB
- Activate and optimize prompts
- Test with real users
- UI separation (NSFW category)

### Phase 3: Content Filtering
- Generated image safety check
- Extreme content blocking
- Report system
- Auto-moderation

### Phase 4: Business Model
- NSFW-specific credit packages
- NSFW VIP subscription tier
- Cost analysis (Replicate API)
- Revenue tracking

---

## 📝 Notes

**Legal Considerations:**
- Self-declaration age verification is common but not foolproof
- Consider adding stronger verification in future (KYC service)
- Terms of service must clearly state age requirements
- Local laws vary (some countries: 18+, others: 21+)

**Technical Debt:**
- Templates don't have `requires_nsfw_api` flag yet (manual check via name)
- Need to add this column in future migration
- Need admin UI for bulk template management

**Performance:**
- All safety checks are async (DB calls)
- Consider caching consent status (Redis/memory)
- Usage logging is fire-and-forget (doesn't block generation)

---

*Last updated: 2025-01-10*
*Files:*
- `sql/028_nsfw_safety_system.sql` - Database schema
- `src/services/nsfw-safety.ts` - Service layer
- `src/handlers/nsfw-consent-handler.ts` - UI handlers
- `netlify/functions/webhook.ts` - Integration
