-- Run after `supabase start` and `supabase db reset` with `supabase test db`.
create extension if not exists pgtap with schema extensions;

begin;
select extensions.plan(33);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111111','authenticated','authenticated','rls-owner-a@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b2222222-2222-4222-8222-222222222222','authenticated','authenticated','rls-owner-b@example.invalid','',now(),'{}','{}',now(),now());
update public.user_roles set role='super_admin' where user_id='a1111111-1111-4111-8111-111111111111';

insert into public.search_runs(id,owner_id,query,idempotency_key) values
  ('e1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','quota a 1','quota-a-1'),
  ('e2222222-2222-4222-8222-222222222222','a1111111-1111-4111-8111-111111111111','quota a 2','quota-a-2'),
  ('e3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','quota a 3','quota-a-3'),
  ('f1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222','quota b 1','quota-b-1'),
  ('f2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222','quota b 2','quota-b-2'),
  ('f3333333-3333-4333-8333-333333333333','b2222222-2222-4222-8222-222222222222','quota b 3','quota-b-3');

insert into public.leads(id,owner_id,kind,title,organization)
values ('c3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','opportunity','Owner A lead','Example');

set local role anon;
select extensions.lives_ok(
  $query$
    do $assert$
    begin
      if exists(select 1 from public.leads) then
        raise exception 'anonymous requests can read private leads';
      end if;
    exception when insufficient_privilege then
      null;
    end
    $assert$;
  $query$,
  'anonymous requests cannot read private leads'
);
select extensions.throws_ok(
  $$select public.reserve_discovery_slot('a1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111',100,100)$$,
  '42501',null,'anonymous requests cannot reserve discovery quota'
);
select extensions.throws_ok(
  $$select public.sync_workspace(null,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb)$$,
  '42501',null,'anonymous requests cannot save a workspace'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select extensions.is((select count(*)::integer from public.leads),1,'owner A can read their lead');
select extensions.is((select contact_availability from public.leads where id='c3333333-3333-4333-8333-333333333333'),'unknown','new leads default contact availability to unknown');
select extensions.throws_ok(
  $$update public.leads set contact_availability='private_details' where id='c3333333-3333-4333-8333-333333333333'$$,
  '23514',null,'contact availability accepts only the documented states'
);
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
  $$select public.admin_retry_notification_outbox('d4444444-4444-4444-8444-444444444444')$$,
  '42501',null,'ordinary users cannot retry notification delivery'
);
select extensions.lives_ok(
  $query$
    do $assert$
    begin
      update public.user_roles set role='super_admin'
      where user_id='b2222222-2222-4222-8222-222222222222';
    exception when insufficient_privilege then
      null;
    end
    $assert$;
  $query$,
  'ordinary users cannot grant themselves a privileged role'
);
select extensions.is(
  (select role from public.user_roles where user_id='b2222222-2222-4222-8222-222222222222'),
  'user',
  'ordinary user role remains unchanged after escalation attempt'
);
select extensions.throws_ok(
  $$select public.admin_set_discovery_source_enabled('d4444444-4444-4444-8444-444444444444',true)$$,
  '42501',null,'ordinary users cannot change a discovery source state'
);
select extensions.throws_ok(
  $$select * from public.admin_discovery_usage()$$,
  '42501',null,'ordinary users cannot inspect aggregate discovery usage'
);
select extensions.throws_ok(
  $$select * from public.admin_queue_health()$$,
  '42501',null,'ordinary users cannot inspect email queue health'
);
select extensions.throws_ok(
  $$select public.reserve_discovery_slot('b2222222-2222-4222-8222-222222222222','f1111111-1111-4111-8111-111111111111',10000,1000000)$$,
  '42501',null,'ordinary users cannot reserve discovery quota directly'
);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select extensions.ok(public.reserve_discovery_slot('a1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111',100,2),'first account can reserve under global cap');
select extensions.ok(public.reserve_discovery_slot('a1111111-1111-4111-8111-111111111111','e2222222-2222-4222-8222-222222222222',100,2),'second request can use the remaining global slot');
select extensions.ok(not public.reserve_discovery_slot('a1111111-1111-4111-8111-111111111111','e3333333-3333-4333-8333-333333333333',100,2),'provider-wide cap blocks further accounts');
select extensions.ok(public.reserve_discovery_slot('b2222222-2222-4222-8222-222222222222','f1111111-1111-4111-8111-111111111111',2,100),'second account can reserve under account cap');
select extensions.ok(public.reserve_discovery_slot('b2222222-2222-4222-8222-222222222222','f2222222-2222-4222-8222-222222222222',2,100),'second account can use its remaining slot');
select extensions.ok(not public.reserve_discovery_slot('b2222222-2222-4222-8222-222222222222','f3333333-3333-4333-8333-333333333333',2,100),'per-account cap blocks excess requests');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
update public.leads set title='Changed by B' where id='c3333333-3333-4333-8333-333333333333';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select extensions.is((select title from public.leads where id='c3333333-3333-4333-8333-333333333333'),'Owner A lead','owner A lead remains unchanged after owner B update attempt');
select extensions.is((select queued_count::integer from public.admin_queue_health()),2,'admin queue health reports both opted-in owner A notifications');
select extensions.throws_ok(
  $$select public.sync_workspace(
    '{"name":"Changed profile","role":"","skills":[],"services":[],"markets":[],"portfolioLinks":[],"experienceSummary":"","notificationThreshold":65,"emailNotificationsEnabled":false}'::jsonb,
    '[{"id":"c3333333-3333-4333-8333-333333333333","kind":"opportunity","title":"Should roll back","organization":"Example","source_url":null,"location":null,"summary":"","status":"new","budget_signal":null,"contact_availability":"unknown","follow_up_at":null,"notes":"","duplicate_of":null,"source_label":"Saved prospect","source_id":null,"search_run_id":null,"tags":[],"research_gaps":[],"posted_label":"Saved prospect","score":50,"score_reason":"Score not calculated yet."}]'::jsonb,
    '[{"lead_id":"c3333333-3333-4333-8333-333333333333","source_url":"javascript:alert(1)","claim":"invalid","observed_at":"2026-10-22T00:00:00Z","evidence_type":"public_page","verification_status":"unverified","reviewed_at":null}]'::jsonb,
    '[]'::jsonb
  )$$,
  '23514',null,'workspace save failure rolls back every earlier write'
);
select extensions.is((select title from public.leads where id='c3333333-3333-4333-8333-333333333333'),'Owner A lead','failed workspace save preserves the existing lead');
select extensions.is((select display_name from public.profiles where id='a1111111-1111-4111-8111-111111111111'),'','failed workspace save preserves the existing profile');
select extensions.ok(public.sync_workspace(
  null,
  '[{"id":"c3333333-3333-4333-8333-333333333333","kind":"opportunity","title":"Owner A lead","organization":"Example","source_url":null,"location":null,"summary":"","status":"new","budget_signal":null,"contact_availability":"unknown","follow_up_at":null,"notes":"","duplicate_of":null,"source_label":"Saved prospect","source_id":null,"search_run_id":null,"tags":[],"research_gaps":[],"posted_label":"Saved prospect","score":50,"score_reason":"Score not calculated yet."}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb
), 'authenticated owner can save a workspace transactionally');
select extensions.is((select title from public.leads where id='c3333333-3333-4333-8333-333333333333'),'Owner A lead','transactional workspace save can retrieve its lead');

select * from extensions.finish();
rollback;
