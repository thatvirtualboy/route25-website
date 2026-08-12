# Route 25 deployment workflow

Production deploys from the protected `main` branch. Do not deploy a dirty local working tree directly to production and do not push feature branches directly to `main`.

## Start a change

```sh
git fetch origin
git switch main
git pull --ff-only
git switch -c codex/short-description
```

Starting from `origin/main` is important: a branch created from an older local commit can reintroduce code that production has already replaced.

## Validate and publish

1. Run `npm test`.
2. Run `npm run verify:production`.
3. Commit every file intended for deployment. Confirm `git status --short` is clean.
4. Push the feature branch and open a pull request into `main`.
5. Wait for the required **Site CI / Test and production contract** check.
6. For rendered-page or API changes, inspect the Vercel preview before merging.
7. Merge the pull request. Vercel deploys the resulting `main` commit to production.
8. For search or card-catalog changes, run:

   ```sh
   ROUTE25_AUDIT_URL=https://route25.app npm run audit:local
   ```

## Rules

- `main` is the only durable source of production code.
- Never use `vercel --prod` from a dirty working tree.
- Never rely on a production deployment that is not represented by a commit on `main`.
- If a preview contains work worth keeping, commit it before merging.
- If production must be repaired urgently, restore through a tested commit and immediately reconcile that commit back to `main`.
