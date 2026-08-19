# Local development

Start the MongoDB replica set with `docker compose up -d --wait`, then run the
site and server on the host as described in `README.md`.

To bypass Microsoft authentication locally, set the same `CRS_DEV_USER` email
in `packages/server/.env` and `packages/site/.env.local`, seed it with
`bun run --filter=server seed <email>`, then run `bun dev`. The bypass is
unavailable in production.
