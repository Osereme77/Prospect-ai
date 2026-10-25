-- JSONB may contain a reviewed timestamp in either ISO form (date T time)
-- or PostgreSQL's textual timestamptz form (date space time). Accept both
-- representations while still requiring an explicit reviewed timestamp.
do $$
declare
  function_signature text;
  function_oid regprocedure;
  function_definition text;
  legacy_check constant text := $legacy$coalesce(s.config->>'terms_reviewed_at', '') ~ '^\d{4}-\d{2}-\d{2}T'$legacy$;
  compatible_check constant text := $compatible$coalesce(s.config->>'terms_reviewed_at', '') ~ '^\d{4}-\d{2}-\d{2}[T ]'$compatible$;
  scheduled_functions constant text[] := array[
    'public.claim_scheduled_remote_ok_sources(integer)',
    'public.persist_scheduled_remote_ok_results(uuid,uuid,uuid,jsonb)'
  ];
begin
  foreach function_signature in array scheduled_functions loop
    function_oid := pg_catalog.to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Required scheduled-discovery RPC is missing: %', function_signature;
    end if;

    function_definition := pg_catalog.pg_get_functiondef(function_oid);
    if pg_catalog.strpos(function_definition, legacy_check) = 0 then
      raise exception 'Expected timestamp guard was not found in %', function_signature;
    end if;

    execute pg_catalog.replace(function_definition, legacy_check, compatible_check);
  end loop;
end;
$$;
