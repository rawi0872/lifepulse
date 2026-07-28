# NEXTRON Memory V1 Evals

Offline Promptfoo regression coverage for explicit user-confirmed preference memory.

Run:

```bash
npm run test:nextron-memory-evals
```

The suite is synthetic and uses zero provider calls. It covers explicit remember, implicit inference rejection, active owner-scoped view, supersession, forget/delete exclusion, cross-user isolation, prompt injection, fake admin/user id authority, structured truth precedence, irrelevant memory exclusion, secret rejection, and internal id suppression.
