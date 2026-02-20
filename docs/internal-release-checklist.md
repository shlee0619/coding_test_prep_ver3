# SolveMate Internal Release Checklist

## Day 0 - Baseline

- [ ] Commit release candidate changes (exclude `.claude/settings.local.json`)
- [ ] Run `pnpm check`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm test`
- [ ] Run `pnpm build`
- [ ] Run `EXPO_PUBLIC_API_BASE_URL=https://api.example.com EXPO_PUBLIC_PRIVACY_POLICY_URL=https://app.example.com/privacy EXPO_PUBLIC_TERMS_OF_SERVICE_URL=https://app.example.com/terms pnpm build:web`

## Day 1 - Always-on API + Web

- [ ] Deploy API service from `Dockerfile.backend` (Render/Fly/AWS)
- [ ] Set production env vars: `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`
- [ ] Optionally set `REDIS_URL`
- [ ] Rotate `JWT_SECRET` and redeploy API (force re-login)
- [ ] Run `pnpm release:env -- --target api`
- [ ] Apply DB migrations in production
- [ ] Verify `GET /api/health` returns HTTP 200
- [ ] Configure Vercel env var: `EXPO_PUBLIC_API_BASE_URL`
- [ ] Deploy static web and run web smoke flow
- [ ] Run API smoke check: `pnpm smoke:api https://<api-domain>`
- [ ] Run release gate: `pnpm release:gate -- --api https://<api-domain> --privacy https://<app-domain>/privacy --terms https://<app-domain>/terms`

## Day 2 - EAS Internal Build

- [ ] Confirm EAS project linked (`eas init`)
- [ ] Set EAS preview env vars: `EXPO_PUBLIC_API_BASE_URL`, `EAS_PROJECT_ID`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`
- [ ] Run `pnpm release:env -- --target preview,production`
- [ ] Build iOS preview: `eas build --profile preview --platform ios`
- [ ] Build Android preview: `eas build --profile preview --platform android`
- [ ] Distribute TestFlight/Internal artifacts to testers

## Day 3 - QA Rehearsal + Branch Governance

- [ ] Validate login -> sync -> recommendations -> analytics -> logout flow on both platforms
- [ ] Validate old token invalidation after `JWT_SECRET` rotation (`/api/auth/me` -> 401)
- [ ] Validate re-login after rotation and protected APIs succeed
- [ ] Validate `excludeSolved=true/false` behavior
- [ ] Validate offline/restore UX behavior
- [ ] Validate `/api/health` behavior during dependency issues
- [ ] Enable branch protection on default branch with required status check: `CI / validate`

## Exit Criteria

- [ ] No blocker issues
- [ ] No major issues
- [ ] Internal release approved
