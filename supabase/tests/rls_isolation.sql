-- Run after `supabase start` and `supabase db reset` with `supabase test db`.
create extension if not exists pgtap with schema extensions;

begin;
select extensions.plan(12);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111111','authenticated','authenticated','rls-owner-a@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b2222222-2222-4222-8222-222222222222','authenticated','authenticated','rls-owner-b@example.invalid','',now(),'{}','{}',now(),now());

insert into public.leads(id,owner_id,kind,title,organization)
values ('c3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','opportunity','Owner A lead','Example');

set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select extensions.is((select count(*)::integer from public.leads),1,'owner A can read their lead');
update public.profiles set email_notifications_enabled=true where id='a1111111-1111-4111-8111-111111111111';
insert into public.notifications(owner_id,lead_id,kind,title,body,idempotency_key)
values ('a1111111-1111-4111-8111-111111111111','c3333333-3333-4333-8333-333333333333','lead_match','Strong fit','Review this prospect','email-test/a');
select extensions.is((select count(*)::integer from public.outbox where owner_id='a1111111-1111-4111-8111-111111111111'),1,'verified opted-in owner gets one email outbox row');
insert into public.notifications(owner_id,lead_id,kind,title,body,idempotency_key)
values ('a1111111-1111-4111-8111-111111111111','c3333333-3333-4333-8333-333333333333','lead_match','Strong fit','Duplicate retry','email-test/a')
on conflict (owner_id,idempotency_key) do nothing;
select extensions.is((select count(*)::integer from public.outbox where owner_id='a1111111-1111-4111-8111-111111111111'),1,'duplicate notification retry does not enqueue another email');
insert into public.notifications(owner_id,lead_id,kind,title,body,idempotency_key)
values ('a1111111-1111-4111-8111-111111111111','c3333333-3333-4333-8333-333333333333','lead_match','Strong fit','Retry same signal','email-test/a-retry');
select extensions.is((select count(*)::integer from public.outbox where owner_id='a1111111-1111-4111-8111-111111111111'),2,'distinct notifications each queue once');

select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
select extensions.is((select count(*)::integer from public.leads where owner_id='a1111111-1111-4111-8111-111111111111'),0,'owner B cannot read owner A lead');
select extensions.is((select count(*)::integer from public.outbox where owner_id='a1111111-1111-4111-8111-111111111111'),0,'owner B cannot read owner A email outbox');
insert into public.notifications(owner_id,kind,title,body,idempotency_key)
values ('b2222222-2222-4222-8222-222222222222','lead_match','Strong fit','Owner B has not opted in','email-test/b-opt-out');
select extensions.is((select count(*)::integer from public.outbox where owner_id='b2222222-2222-4222-8222-222222222222'),0,'notification email is not queued without opt-in');
select extensions.throws_ok(
  $$insert into public.leads(owner_id,kind,title,organization) values ('a1111111-1111-4111-8111-111111111111','opportunity','Injected','Example')$$,
  '42501',null,'owner B cannot insert a lead for owner A'
);
select extensions.throws_ok(
  $$update public.user_roles set role='super_admin' where user_id='b2222222-2222-4222-8222-222222222222'$$,
  '42501',null,'ordinary users cannot grant themselves a privileged role'
);
select extensions.throws_ok(
  $$select public.admin_retry_notification_outbox('d4444444-4444-4444-8444-444444444444')$$,
  '42501',null,'ordinary users cannot retry notification delivery'
);
update public.leads set title='Changed by B' where id='c3333333-3333-4333-8333-333333333333';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select extensions.is((select title from public.leads where id='c3333333-3333-4333-8333-333333333333'),'Owner A lead','owner A lead remains unchanged after owner B update attempt');

select * from extensions.finish();
rollback;
