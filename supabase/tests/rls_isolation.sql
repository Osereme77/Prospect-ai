-- Run after `supabase start` and `supabase db reset` with `supabase test db`.
create extension if not exists pgtap with schema extensions;

begin;
select extensions.plan(6);

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

select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
select extensions.is((select count(*)::integer from public.leads where owner_id='a1111111-1111-4111-8111-111111111111'),0,'owner B cannot read owner A lead');
select extensions.throws_ok(
  $$insert into public.leads(owner_id,kind,title,organization) values ('a1111111-1111-4111-8111-111111111111','opportunity','Injected','Example')$$,
  '42501',null,'owner B cannot insert a lead for owner A'
);
select extensions.throws_ok(
  $$update public.user_roles set role='super_admin' where user_id='b2222222-2222-4222-8222-222222222222'$$,
  '42501',null,'ordinary users cannot grant themselves a privileged role'
);
update public.leads set title='Changed by B' where id='c3333333-3333-4333-8333-333333333333';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select extensions.is((select title from public.leads where id='c3333333-3333-4333-8333-333333333333'),'Owner A lead','owner A lead remains unchanged after owner B update attempt');

select * from extensions.finish();
rollback;
