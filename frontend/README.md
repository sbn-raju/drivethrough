# DriveThrough web

React 19 + Vite + HeroUI v3 (Tailwind CSS v4) + React Router.

```bash
npm install
npm run dev      # http://localhost:5173 — /api is proxied to http://localhost:4000
```

Start the API in `../backend` first. To point the proxy elsewhere, set `VITE_API_PROXY_TARGET`.

## Screens (Feature 01 + onboarding)

| Route | Screen |
|---|---|
| `/login` | Sign in with email or mobile number + password |
| `/signup?role=consumer\|driver` | Choose a role, enter contact details and a password, accept the terms |
| `/verify` | 6-digit OTP with a resend countdown |
| `/forgot-password`, `/reset-password` | Code-based password reset |
| `/onboarding/consumer` | Your details → emergency contact → vehicle |
| `/onboarding/driver` | Personal → photo & experience → licence → identity → operating states → review & submit |
| `/driver` | Driver verification status and account security |
| `/app` | Consumer home: vehicles and account security |

The design tokens from `design.md` are mapped onto HeroUI's theme variables in `src/styles/globals.css`.
`public/brand/drivethrough-logo.png` is a trimmed, transparent-background copy of `public/DriveThrough_Road_Logo.png`.
