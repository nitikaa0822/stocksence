# Enable email signup and OTP recovery

The screens and server routes are implemented. Real emails cannot be sent until you connect your Supabase project. Stock stays in Cloudflare D1; Supabase is used only for identity.

1. Create a project at https://supabase.com/dashboard. Keep the database password private.
2. Open the project's connection/API settings. Copy the project URL and **publishable key** (the legacy public `anon` key also works). Never use the secret/service-role key.
3. Copy `.env.example` to `.env` in the repository and fill `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Restart the development server. For the hosted Site, set the same two runtime environment variables and redeploy; local `.env` files are not uploaded.
4. Enable the Email provider and email confirmation in Authentication. Set the Site URL to your actual demo origin. Use `http://localhost:5173` for local rehearsal.
5. In Authentication email templates, change **Confirm signup** to include this code:

```html
<h2>Confirm your StockSense account</h2>
<p>Enter this code in StockSense: <strong>{{ .Token }}</strong></p>
```

6. Change **Reset password** to:

```html
<h2>Reset your StockSense password</h2>
<p>Enter this recovery code in StockSense: <strong>{{ .Token }}</strong></p>
<p>If you did not request this, ignore this email.</p>
```

7. Configure SMTP with your email provider for real recipients. Supabase's default email service has recipient restrictions and rate limits; do not rely on it for judge signup. Check Authentication logs if delivery fails.
8. Open `/auth`. Create an account using an email you control, enter the emailed confirmation code, and verify you reach the dashboard. Sign out and log in again.
9. Select Forgot password, request a code, enter it with a new password, then confirm the old password fails and the new password works. Verify an invalid/expired code is rejected and a consumed code cannot be reused.

Passwords and verification codes are handled by Supabase, never stored in the inventory tables. The API verifies identity server-side. Each email identity has a separate workspace (`supabase:<user-id>`); existing ChatGPT/demo inventory is not automatically moved or shared. Do not switch account providers during a demo expecting the same stock.

The app polls stock every five seconds while visible and refreshes after every successful mutation. It does not provide WebSocket synchronization or shared organization membership.

## Module API

All routes are POST JSON under `/api/auth/`, use same-origin requests and return `{ok:true}` or `{error:string}`.

| Route | Input | Result |
|---|---|---|
| signup | name, email, password | `verify:true` means email confirmation required |
| verify | email, token | Establish verified signup session |
| login | email, password | Establish session |
| request-reset | email | Generic delivery response |
| reset | email, token, password | Verify recovery code and change password |
| logout | no body | Clear email session; UI then signs out of platform |

Inventory authentication accepts a verified Supabase session or the existing platform identity. Email routes report unavailable when configuration is missing; they never pretend to send an email.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
