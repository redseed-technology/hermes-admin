# Hermes Frontend

Next.js frontend for the Hermes Platform local MVP, styled with Tailwind CSS and
daisyUI.

## Local setup

```bash
cp .env.example .env.local
yarn install
yarn dev
```

The frontend runs at `http://localhost:3000` and expects the Express API at
`http://localhost:4000` by default.

## Included flows

- Create an account
- Log in and log out
- View Hermes agent profiles
- Create, edit, and delete a profile
- Check the configured DigitalOcean worker plan and live monthly price
- Create a Docker-ready worker droplet after confirming billing
- Track droplet status, provider ID, and public IPv4 address
- Open a root SSH terminal in the browser for an active droplet as superadmin
- Deploy an isolated Hermes container
- Select its AI provider and model and enter the provider token privately

The DigitalOcean token and SSH key configuration stay in the backend. The
frontend only receives the non-sensitive plan and worker status fields.
AI provider tokens are submitted over HTTPS and are not stored in browser
storage or returned by the control plane.

The browser terminal uses the localhost-only `hermes-terminal-proxy` service.
It validates the current superadmin session against the control plane and uses
the SSH private key on the local machine without sending that key to the browser
or remote backend.
