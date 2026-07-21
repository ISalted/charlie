---
name: analyze-cost
description: Calculate what a test / task / session / working day actually cost on the Charlie AQA stack — pull real per-model token usage from Claude Code's session logs and price it two ways: (1) the real flat-subscription cost, and (2) the API-equivalent value for ROI/leverage. Reports a clean per-run / per-day figure with an honest verdict. Use when asked the cost of a test/task/run/day, token spend, "how much did this cost", per-session cost, unit economics, or the ROI/leverage of the AI automation. ALWAYS outputs a table — token count + the cost of ONE test (scoped to the request) at both current-subscription and pay-per-token (Enterprise/API) rates. Read-only — never edits, runs tests, or changes billing.
model: claude-sonnet-4-6
effort: low
---

# /analyze-cost — what a task / test / day cost

Read-only cost lens, sibling of `/analyze-report`. The job: pull **real token usage from Claude Code's
own session logs** and turn it into money two honest ways. You report numbers; you never edit code,
run tests, or touch billing.

## The two lenses — NEVER blur them
1. **Real money (what we actually pay).** The Claude layer is a **flat subscription** — either
   **Standard ($20/mo)** or **Premium ($100/mo)**. Fixed non-Claude infra is effectively **$0**:
   Charlie uses **Playwright-native reporting** (no Testomatio) and runs on **GitHub Actions**, and
   because the repo is **public, GitHub Actions minutes are free** — no runner bill. Flat means
   **marginal cost of one more test ≈ $0**; the real per-unit cost is the fixed Claude fee allocated by
   time, not by tokens:
   - Standard: `$20/mo ÷ 22 working days = $0.91/working-day = $0.11/hour`.
   - Premium: `$100/mo ÷ 22 working days = $4.55/working-day = $0.57/hour`.
   If the plan tier is unknown, **ask** — don't guess. Default to Standard if the user confirms a
   ~$20 seat.
2. **API-equivalent value (`V`) — for ROI, not the wallet.** Tokens × public API price. Below the
   weekly limit this is **virtual** ("what it would cost on the API"); it exists to show **leverage**
   (`V` vs the flat fee), prompt efficiency, and the real cost *if* you ever move to API/Usage-Credits.

> Over the weekly limit (Usage Credits, Owner-enabled): the same `V` **becomes the real charge**.
> You can't tell "over-limit" from the log — only the `/usage` weekly bar shows it. Don't try to read it from JSONL.

## Verified facts (apply, don't re-derive)
- **Input price `P` per 1M, by model** (the ONLY model knob — read `model` per request):
  `Opus 4.x = 5 · Sonnet 4.x = 3 · Haiku 4.5 = 1 · Fable 5 = 10`.
  Everything else derives: `output = 5·P`, `cache_read = 0.1·P`, `cache_write_1h = 2·P`, `cache_write_5m = 1.25·P`.
- **Effort (low…max) is NOT a separate factor** — higher effort just emits more output/thinking tokens, already counted.
- **Logs:** `~/.claude/projects/-Users-brudni-charlie/*.jsonl`, one `usage` block per request. **Dedup by
  `message.id`** (stream/retries repeat the block). Fields: `input_tokens`, `output_tokens`,
  `cache_read_input_tokens`, `cache_creation.ephemeral_{1h,5m}_input_tokens`, `model`.
- **The `/usage` weekly bar is NOT raw tokens** (weighted/opaque) — never derive a token cap from a %.

## Procedure
1. **Scope the window** (match the request exactly; ask only if ambiguous):
   - *this run / "what did this cost"* → **current session** (newest log file) — default.
   - *an area (e.g. "quiz")* → that area's tests + the session(s) that built them.
   - *a day / date / "this week"* → date or range.
   - *one test* → run it in a **fresh session**, then scope = current session.
2. **Run the script** (below) for that scope → tokens + `V` (API-equivalent, per model).
3. **Determine `N` = number of tests in scope** (mandatory — drives the per-test row):
   - area → count test blocks: `grep -rhcE "^[[:space:]]*test\(" tests/web/<area>/*.web.test.ts | paste -sd+ - | bc` (or `grep -rE "^[[:space:]]*test\(" tests/web/<area>/ | wc -l`).
   - whole session → the tests that session authored/touched (a single quiz test per session is normal; state which; if unclear, ask, or use the area's count and say so).
   - one test → `N = 1`.
4. **Print the MANDATORY table, then the verdict** (format below). Lead with the table, never a raw token dump.

## Script
```bash
DIR="$HOME/.claude/projects/-Users-brudni-charlie"
SINCE="${1:-}"; UNTIL="${2:-}"
[ -n "$UNTIL" ] && [ "${#UNTIL}" -le 10 ] && UNTIL="${UNTIL}T23:59:59Z"   # make a bare date whole-day inclusive
if [ -z "$SINCE" ]; then FILES=$(ls -1t "$DIR"/*.jsonl | head -1); SCOPE="current session"
else FILES=$(echo "$DIR"/*.jsonl); SCOPE="${1}..${2:-now}"; fi
for f in $FILES; do
  jq -rc 'select(.timestamp and .message.usage and .message.usage.output_tokens)
    | [ (.message.id//"x"), .timestamp, (.message.model//"?"),
        .message.usage.input_tokens, .message.usage.output_tokens,
        (.message.usage.cache_read_input_tokens//0),
        (.message.usage.cache_creation.ephemeral_1h_input_tokens // .message.usage.cache_creation_input_tokens // 0),
        (.message.usage.cache_creation.ephemeral_5m_input_tokens // 0) ] | @tsv' "$f" 2>/dev/null
done | awk -F'\t' '!seen[$1]++' | awk -F'\t' -v S="${SINCE:-0000}" -v U="${UNTIL:-9999}" -v scope="$SCOPE" '
function P(m){return m~/fable/?10:m~/opus/?5:m~/sonnet/?3:m~/haiku/?1:5}
$2>=S && $2<=U { p=P($3);
  v=($4*p + $5*5*p + $6*0.1*p + $7*2*p + $8*1.25*p)/1e6;
  V+=v; IN+=$4; OUT+=$5; CR+=$6; CW+=$7+$8; n++; byM[$3]+=v;
  if(mn==""||$2<mn)mn=$2; if($2>mx)mx=$2 }
END{ printf "scope:    %s\n", scope;
  printf "window:   %s -> %s\n", substr(mn,1,19), substr(mx,1,19);
  printf "requests: %d\n", n;
  printf "tokens:   in=%d  out=%d  cache_read=%d  cache_write=%d  (total %d)\n", IN,OUT,CR,CW, IN+OUT+CR+CW;
  printf "API-equivalent value (V): $%.2f\n", V;
  for(m in byM) printf "   %-20s $%.2f\n", m, byM[m] }'
```
- **Current run:** `bash <script>` (no args).
- **A day:** `bash <script> 2026-06-20 2026-06-20`. **A range/week:** `bash <script> 2026-06-23 2026-06-25`.

## Output — MANDATORY table first, then verdict
**Always print this table** (values scoped to the request; BOTH rows required — the per-test row is non-negotiable):

| Metric | Tokens | Cost now — subscription (real) | Cost if pay-per-token — Enterprise/API |
|---|---|---|---|
| **Total — {scope}** | {in+out+cache_read+cache_write} | {active-hrs × $/h; marginal ≈ $0} | {V} |
| **Per test (÷ N={N})** | {total ÷ N} | {real ÷ N} | {V ÷ N} |

- **Tokens** — total from the script (incl. cache; note most is `cache_read` at 0.1× — that's why real cost stays in cents).
- **Cost now (subscription)** — real flat money: estimate **active** hours from the window (exclude long
  idle/paused gaps) × the plan's hourly rate (Standard `$0.11/h`, Premium `$0.57/h`); also state
  marginal ≈ $0. Per-test = ÷ N. State which plan tier you used.
- **Cost if pay-per-token** — the script's `V` (what an Enterprise/API per-token plan *would* bill). Per-test = `V ÷ N`.
- Print **`N` and how it was derived** right under the table.

Then, below the table:
1. **Verdict (1 line):** per-test real + per-test metered + leverage. e.g. *"~$0.01/test real (Standard $20/mo seat), ~$0.36/test if metered → 10×+ leverage; marginal ~$0."*
2. **Real money:** flat Claude seat (Standard `$20/mo = $0.91/day = $0.11/h` or Premium `$100/mo = $4.55/day = $0.57/h`); non-Claude infra ≈ $0 (Playwright-native reporting + free public-repo GitHub Actions); the scope's slice; marginal ~$0. State the tier used.
3. **API-equivalent `V`:** frame as *"would have metered at"*, never *"we paid"* / *"we saved"*.
4. **Leverage (if asked for ROI):** `V ÷ real-fee-for-the-period`. Sustained period (a week), not an 8-day burst; anchor on **"order of magnitude / 10×+"**, face-value multiple only with the caveat.

## Guardrails (hard)
- **Read-only:** no edits, no test runs, no billing changes. Numbers + verdict only.
- **Real ≠ metered.** Real money is the flat fee; `V` is virtual below the limit. Never call `V` "savings" or "what we paid".
- **No invented caps.** Anthropic publishes no tokens/week for Team; don't compute "% of token allowance" — the `/usage` bar is weighted, not raw tokens.
- **Dedup by `message.id`** before summing, or stream/retry duplicates inflate every figure.
