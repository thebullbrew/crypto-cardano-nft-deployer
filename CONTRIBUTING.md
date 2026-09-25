# Contributing

Thanks for your interest in improving the Cardano NFT Deployer.

## Workflow

1. Fork the repo and create a branch from `main`.
2. Test every change against **Preprod** before opening a PR.
3. Policy changes: recompile with `aiken build` in `validators/`, copy the new
   `plutus.json` to the repo root, and re-verify mint + burn on Preprod.
4. Keep scripts idempotent where possible — a failed mint should be safely re-runnable
   (note: each mint consumes a fresh seed UTxO by design).
5. Update the README if you change CLI behavior or env variables.

## Standards

- TypeScript, strict mode, no `any` without justification.
- Aiken code follows the [Aiken style guide](https://aiken-lang.org).
- No secrets in code, logs, or committed files. Ever.
- One concern per script: `mint.ts`, `burn.ts`, `policy.ts`, `config.ts` stay focused.

## Security

If you find a vulnerability (especially around key handling), please open an issue rather than a PR so it can be handled carefully.
