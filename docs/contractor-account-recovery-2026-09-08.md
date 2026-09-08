# Contractor account recovery

Use this workflow when a contractor cannot remember whether an account already exists or cannot complete sign-in.

## What the contractor should do

1. Enter the email address they most likely used and try signing in once.
2. Follow the action shown by the portal:
   - **Confirm your email:** send one new confirmation email and use the newest link.
   - **We could not sign you in:** send one password-reset email.
   - **Please wait before trying again:** stop submitting the form and wait a few minutes before one new attempt.
   - **Workspace could not open:** retry opening the workspace once, then contact the person who invited them.
3. Check Inbox, Spam or Junk, and Promotions. Allow a few minutes for the email to arrive.
4. Return to the portal after confirming the email or choosing a new password.

The contractor should never send a password, reset link, or confirmation link to support.

## What support should ask for

Ask only for:

- The exact email address entered
- A screenshot of the message
- Whether a confirmation or reset email arrived
- The approximate time of the attempt

Never ask for the contractor's password.

## Supabase check

If the contractor still cannot recover access, open **Supabase > Authentication > Users** and search for the exact email address.

- **No user found:** ask the contractor to use **Create account**.
- **User found, email not confirmed:** have the contractor use **Resend confirmation email** in the portal.
- **User found, email confirmed:** have the contractor use **Send password reset** in the portal.
- **Repeated email attempts:** wait for the provider rate limit to clear before sending one more email.

If the password is accepted but the workspace does not open, use the Supabase SQL editor to check whether the authenticated user has a company membership:

```sql
select
  users.id as user_id,
  users.email,
  users.email_confirmed_at,
  users.last_sign_in_at,
  members.company_id,
  companies.name as company_name
from auth.users as users
left join public.company_members as members on members.user_id = users.id
left join public.companies as companies on companies.id = members.company_id
where lower(users.email) = lower('contractor@example.com');
```

Do not manually delete, merge, or move an account between companies while troubleshooting. A missing membership or duplicate-account situation needs a data-integrity review before changing records.

## Resolution note

Record the email address, failure category, action taken, and outcome. Do not record passwords or email-link tokens.
