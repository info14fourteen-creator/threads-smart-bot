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

## Remaining authorization step

The Chrome session used to create the app is not currently logged into the
target Threads profile. A user must log in to the correct Threads account in
the open Threads tab before the app can generate a test user token for that
profile.

No app secret or access token belongs in this repository.
