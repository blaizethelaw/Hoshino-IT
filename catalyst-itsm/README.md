# Catalyst ITSM

## Deployment

1. Build the portal assets:
   ```sh
   pnpm --filter @catalyst/apps-portal build
   ```
2. Deploy to Firebase:
   ```sh
   firebase deploy
   ```

Firebase Hosting serves the built files from `apps/portal/build` and rewrites all routes to `index.html` to support the single-page app.
