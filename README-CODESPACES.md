# Run in Codespaces

1. Create a new Codespace on this repo. If prompted, choose **Use default image** and **Disable dotfiles** for this session.
2. Wait for the container to finish building (you’ll see `✅ Devcontainer ready`).
3. In the terminal, run:

   ```bash
   bash .devcontainer/bootstrap-inline.sh   # optional; creates minimal monorepo
   cd catalyst-itsm && pnpm install
   pnpm -r dev
