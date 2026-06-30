#!/usr/bin/env bash
# Toggle recall-experience repo access for @gotham12
#
# unlock (default state now): admin + no branch protection — full access
# lock:                        write + PR required + AlmightyTamer CODEOWNER approval
#
# Param: tell Cursor "recall-lock" to lock, or "recall-unlock" to restore full access.
# Or run: ./scripts/repo-guard.sh lock|unlock|status

set -euo pipefail

REPO="AlmightyTamer/recall-experience"
BRANCH="main"
COLLAB="gotham12"

protection_enabled() {
  local count
  count="$(gh api "repos/${REPO}/branches/${BRANCH}/protection" --jq '.required_pull_request_reviews.required_approving_review_count' 2>/dev/null)" || { echo "off"; return; }
  echo "$count"
}

collab_role() {
  gh api "repos/${REPO}/collaborators/${COLLAB}/permission" --jq '.role_name' 2>/dev/null || echo "none"
}

status() {
  echo "Repo:     ${REPO}"
  echo "Branch:   ${BRANCH}"
  echo "gotham12: $(collab_role)"
  local p
  p="$(protection_enabled)"
  if [[ "$p" == "off" ]]; then
    echo "Protection: OFF (direct push / merge allowed)"
  else
    echo "Protection: ON (${p} owner approval(s) required on PRs)"
  fi
}

lock() {
  echo "Locking repo — gotham12 needs your PR approval..."
  gh api -X PUT "repos/${REPO}/collaborators/${COLLAB}" -f permission=push >/dev/null
  gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" --input - <<'EOF'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
EOF
  echo "Locked. @gotham12 is write-only; all merges to main need @AlmightyTamer approval."
}

unlock() {
  echo "Unlocking repo — full access for gotham12..."
  gh api -X DELETE "repos/${REPO}/branches/${BRANCH}/protection" 2>/dev/null || true
  gh api -X PUT "repos/${REPO}/collaborators/${COLLAB}" -f permission=admin >/dev/null
  echo "Unlocked. @gotham12 has admin access; no PR approval required."
}

case "${1:-status}" in
  lock)   lock; status ;;
  unlock) unlock; status ;;
  status) status ;;
  *)
    echo "Usage: $0 lock|unlock|status" >&2
    exit 1
    ;;
esac
