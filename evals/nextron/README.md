# NEXTRON Promptfoo Evals

This directory contains the OSS Promptfoo eval harness for NEXTRON safety and behavior checks.

Run the deterministic suite with:

```bash
npm run test:nextron-evals
```

The default suite is offline, synthetic, and zero-cost. It uses `offline-provider.cjs` as a local Promptfoo provider, performs no network calls, requires no provider API key, and does not read or write production data.

Run the optional bounded live Groq smoke suite with:

```bash
npm run test:nextron-evals:live
```

The live suite is skipped unless `GROQ_API_KEY` is set. It uses only `groq:openai/gpt-oss-120b`, caps the run to five prompts, and is intended as a smoke check rather than a replacement for the deterministic suite.

Fixtures are synthetic. Do not add real user data, secrets, private prompts, production writes, paid fallback providers, or cloud-hosted graders to these evals.
