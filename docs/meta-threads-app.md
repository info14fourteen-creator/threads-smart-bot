# Meta Threads app

The Meta app for this project was created as **Stan At 4 Threads**.

- Meta app ID: `900958139260778`
- Threads app ID: `2110321363176548`
- Business portfolio: `4teentoken`
- Current mode: testing
- Use case: Access the Threads API

## Enabled permissions

- `threads_basic`
- `threads_content_publish`
- `threads_keyword_search`
- `threads_manage_insights`
- `threads_manage_mentions`
- `threads_profile_discovery`
- `threads_read_replies`

Reply creation/moderation permissions are intentionally not enabled yet. The
agent can read and classify conversations first; write-side reply automation
will be a separate decision.

## Authorization status

The `fourteentoken` Threads profile accepted the app invitation and completed
the consent flow. The generated token was verified against the official
`/v1.0/me` endpoint and returned:

- username: `fourteentoken`
- display name: `Stanislav Ataev`
- Threads user ID: `28347278724876585`

The real token is stored only in the local ignored `.env.local` file. It is
not written to this repository or GitHub.

The verified token can read the account profile and own threads. A live
`keyword_search` check currently returns Meta code `10` (missing permission),
so public conversation discovery needs a follow-up OAuth authorization that
explicitly includes `threads_keyword_search`.

No app secret or access token belongs in this repository.
