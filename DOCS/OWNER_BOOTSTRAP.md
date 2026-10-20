# Owner account bootstrap and recovery

Use this runbook only after the Supabase project has been created and the database migrations have been applied. Ordinary authenticated users can read their own role but cannot insert or update `user_roles` through the browser API.

## Provision the first Super Admin

1. Create the owner's account through the normal Supabase Auth sign-up flow and complete email verification.
2. In Supabase Dashboard, open **Authentication → Users** and copy the UUID for the verified owner account. Confirm the email matches the intended owner.
3. Open the project's SQL Editor using an administrator account. Replace the placeholder UUID and run:

   ```sql
   begin;

   update public.user_roles
   set role = 'super_admin'
   where user_id = '00000000-0000-0000-0000-000000000000'::uuid;

   -- Require exactly one existing Auth-provisioned role row.
   do $$
   begin
     if not exists (
       select 1 from public.user_roles
       where user_id = '00000000-0000-0000-0000-000000000000'::uuid
         and role = 'super_admin'
     ) then
       raise exception 'Owner role was not updated; verify the account UUID';
     end if;
   end $$;

   insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
   values (
     '00000000-0000-0000-0000-000000000000'::uuid,
     'owner_role_bootstrapped',
     'user_role',
     '00000000-0000-0000-0000-000000000000'::uuid,
     jsonb_build_object('role', 'super_admin', 'method', 'trusted_dashboard_sql')
   );

   commit;
   ```

4. Verify the role in the SQL Editor and in the owner account session. Keep the SQL Editor administrator credential private. Never add a browser button, public Edge Function, or service-role key that lets a user promote themselves.
5. Grant later Admin roles only through the same trusted server-side/database-admin process, verify the target identity independently, and record the change in `audit_logs`.

If the transaction fails, correct the UUID and rerun it. Do not insert a `user_roles` row for an ID that does not exist in `auth.users`.

## Recover the owner account

- Use the normal password-reset flow for the owner's verified email. Confirm Supabase Auth email delivery and redirect URLs are configured for the correct environment.
- If the owner loses access to the mailbox or the Super Admin role is damaged, use the Supabase organization's trusted administrator account and SQL Editor to verify `auth.users`, repair the corresponding `user_roles` row, and write an audit entry. Do not weaken RLS or add self-service privilege changes as a recovery shortcut.
- Rotate any compromised dashboard credentials and Edge Function secrets through the provider's secret manager. Never paste service-role or provider keys into the frontend environment.
- Record recovery date, operator, and outcome without recording passwords, tokens, or recovery codes.

This process has not been run against a live project; project ownership, two-person verification, and deployed RLS behavior remain acceptance checks.
