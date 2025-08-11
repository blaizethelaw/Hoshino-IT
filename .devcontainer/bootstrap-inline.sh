#!/usr/bin/env bash
set -e

echo "🚀 Starting inline bootstrap process..."

# Avoid nested repo issues
if [ -d "catalyst-itsm/.git" ]; then
  rm -rf catalyst-itsm/.git
fi

# Scaffold directories (simulate bootstrap.sh logic)
mkdir -p catalyst-itsm/apps/{portal,agent,api,worker}
mkdir -p catalyst-itsm/packages/{ui,utils,types,sdk}

# Add placeholder package.json
cat <<EOL > catalyst-itsm/package.json
{
  "name": "catalyst-itsm",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {}
}
EOL

# Touch docker-compose.yml
cat <<EOL > catalyst-itsm/docker-compose.yml
version: "3.8"
services:
  example:
    image: hello-world
EOL

echo "📦 Installing dependencies..."
cd catalyst-itsm
pnpm install

echo "✅ Bootstrap complete."
