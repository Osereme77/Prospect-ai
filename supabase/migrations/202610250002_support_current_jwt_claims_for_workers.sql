-- Supabase/PostgREST versions may place the JWT role in the aggregate claims
-- setting instead of the legacy per-claim setting. Preserve the same strict
-- service_role guard while accepting both request formats for worker RPCs.
do $$
declare
  function_signature text;
  function_oid regprocedure;
  function_definition text;
  legacy_guard constant text := $legacy$coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'$legacy$;
  compatible_guard constant text := $compatible$coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role'$compatible$;
  worker_functions constant text[] := array[
    'public.claim_notification_outbox(integer)',
    'public.finish_notification_outbox(uuid,boolean,text,timestamptz,boolean)',
    'public.claim_scheduled_remote_ok_sources(integer)',
    'public.finish_scheduled_remote_ok_source(uuid,boolean,text)',
    'public.persist_scheduled_remote_ok_results(uuid,uuid,uuid,jsonb)',
    'public.record_scheduled_worker_health(text,integer,integer,integer,text)'
  ];
begin
  foreach function_signature in array worker_functions loop
    function_oid := pg_catalog.to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Required worker RPC is missing: %', function_signature;
    end if;

    function_definition := pg_catalog.pg_get_functiondef(function_oid);
    if pg_catalog.strpos(function_definition, legacy_guard) = 0 then
      raise exception 'Expected legacy service-role guard was not found in %', function_signature;
    end if;

    execute pg_catalog.replace(function_definition, legacy_guard, compatible_guard);
  end loop;
end;
$$;
