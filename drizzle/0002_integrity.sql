create function app.stamp_row() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := app.current_user_id();
  patch jsonb := '{}'::jsonb;
  fresh jsonb := to_jsonb(new);
  prior jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  col text;
begin
  if tg_op = 'UPDATE' and fresh ? 'updated_at' then
    patch := patch || jsonb_build_object('updated_at', now());
  end if;
  if actor is not null then
    foreach col in array string_to_array(coalesce(tg_argv[0], ''), ',') loop
      if col <> '' then
        patch := patch || jsonb_build_object(col, case when tg_op = 'INSERT' then to_jsonb(actor) else prior -> col end);
      end if;
    end loop;
    foreach col in array string_to_array(coalesce(tg_argv[1], ''), ',') loop
      if col <> '' and fresh ->> col is not null and fresh ->> col is distinct from prior ->> col then
        patch := patch || jsonb_build_object(col, actor);
      end if;
    end loop;
  end if;
  return jsonb_populate_record(new, patch);
end $$;

do $$
declare r record;
begin
  for r in select * from (values
    ('users', 'invited_by', ''),
    ('user_credentials', '', ''),
    ('organization_profile', '', ''),
    ('files', 'uploaded_by', ''),
    ('documents', 'created_by', ''),
    ('document_versions', 'uploaded_by', ''),
    ('grants', 'created_by', ''),
    ('grant_contacts', 'created_by', ''),
    ('grant_links', 'created_by', ''),
    ('deadlines', 'created_by', 'completed_by'),
    ('email_messages', '', ''),
    ('ai_extractions', 'requested_by', ''),
    ('ai_proposals', '', 'reviewed_by'),
    ('budget_categories', 'created_by', ''),
    ('budgets', 'created_by', 'approved_by,award_mismatch_ack_by'),
    ('imports', 'created_by', 'confirmed_by'),
    ('receipts', 'created_by', 'confirmed_by,voided_by'),
    ('employees', 'created_by', ''),
    ('payroll_runs', 'created_by', 'posted_by,voided_by'),
    ('warnings', '', 'reviewed_by')
  ) as v(tbl, creator, deciders) loop
    execute format(
      'create trigger a_stamp before insert or update on public.%I for each row execute function app.stamp_row(%L, %L)',
      r.tbl, r.creator, r.deciders);
  end loop;
end $$;

create function app.guard_users() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  was_admin boolean := false;
  stays_admin boolean := false;
begin
  perform pg_advisory_xact_lock(740001);
  if tg_op <> 'INSERT' then
    was_admin := old.role = 'admin' and old.status = 'active';
  end if;
  if tg_op = 'DELETE' then
    if was_admin and not exists (
      select 1 from public.users u where u.id <> old.id and u.role = 'admin' and u.status = 'active'
    ) then
      raise exception 'At least one active admin is required' using errcode = 'check_violation', constraint = 'users_last_admin';
    end if;
    return old;
  end if;
  if new.status in ('invited', 'active') and (tg_op = 'INSERT' or old.status = 'deactivated') then
    if (select count(*) from public.users u where u.status in ('invited', 'active') and u.id <> new.id) >= 5 then
      raise exception 'The limit of 5 user accounts has been reached' using errcode = 'check_violation', constraint = 'users_seat_limit';
    end if;
  end if;
  stays_admin := new.role = 'admin' and new.status = 'active';
  if was_admin and not stays_admin and not exists (
    select 1 from public.users u where u.id <> old.id and u.role = 'admin' and u.status = 'active'
  ) then
    raise exception 'At least one active admin is required' using errcode = 'check_violation', constraint = 'users_last_admin';
  end if;
  if tg_op = 'UPDATE' and (
    new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.can_view_payroll is distinct from old.can_view_payroll
    or new.email is distinct from old.email
  ) then
    new.session_version := greatest(new.session_version, old.session_version + 1);
  end if;
  return new;
end $$;

create trigger b_guard before insert or update or delete on public.users
  for each row execute function app.guard_users();

create function app.guard_lifecycle() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  locked text := tg_argv[0];
  closed text := tg_argv[1];
  movable text[] := array['status', 'updated_at', 'voided_by', 'voided_at'];
begin
  if tg_op = 'INSERT' then
    if new.status::text <> 'draft' then
      raise exception '% must start as draft', tg_table_name using errcode = 'check_violation', constraint = 'lifecycle_start';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status::text <> 'draft' then
      raise exception '% is %, so it cannot be deleted', tg_table_name, old.status using errcode = 'check_violation', constraint = 'lifecycle_locked';
    end if;
    return old;
  end if;
  if old.status::text = 'draft' then
    if new.status::text not in ('draft', locked) then
      raise exception '% cannot move from draft to %', tg_table_name, new.status using errcode = 'check_violation', constraint = 'lifecycle_step';
    end if;
    return new;
  end if;
  if old.status::text = locked and new.status::text = closed
    and (to_jsonb(new) - movable) = (to_jsonb(old) - movable) then
    return new;
  end if;
  raise exception '% is %, so it cannot be changed', tg_table_name, old.status using errcode = 'check_violation', constraint = 'lifecycle_locked';
end $$;

create trigger b_guard before insert or update or delete on public.budgets
  for each row execute function app.guard_lifecycle('approved', 'superseded');
create trigger b_guard before insert or update or delete on public.receipts
  for each row execute function app.guard_lifecycle('confirmed', 'voided');
create trigger b_guard before insert or update or delete on public.payroll_runs
  for each row execute function app.guard_lifecycle('posted', 'voided');

create function app.require_draft_parent() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  item jsonb;
  items jsonb[] := '{}';
  parent_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then items := items || to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then items := items || to_jsonb(new); end if;
  foreach item in array items loop
    parent_status := null;
    if tg_table_name = 'budget_lines' then
      select b.status::text into parent_status from public.budgets b
        where b.id = (item ->> 'budget_id')::uuid for update;
    elsif tg_table_name = 'receipt_allocations' then
      select r.status::text into parent_status from public.receipts r
        where r.id = (item ->> 'receipt_id')::uuid for update;
    elsif tg_table_name = 'payroll_entries' then
      select p.status::text into parent_status from public.payroll_runs p
        where p.id = (item ->> 'run_id')::uuid for update;
    elsif tg_table_name = 'payroll_allocations' then
      select p.status::text into parent_status from public.payroll_runs p
        join public.payroll_entries e on e.run_id = p.id
        where e.id = (item ->> 'entry_id')::uuid for update of p;
    end if;
    if parent_status is not null and parent_status <> 'draft' then
      raise exception '% cannot change once its parent is %', tg_table_name, parent_status
        using errcode = 'check_violation', constraint = 'lifecycle_locked';
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['budget_lines', 'receipt_allocations', 'payroll_entries', 'payroll_allocations'] loop
    execute format(
      'create trigger b_guard before insert or update or delete on public.%I for each row execute function app.require_draft_parent()', t);
  end loop;
end $$;

create function app.check_receipt_total() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare allocated bigint;
begin
  select coalesce(sum(a.amount_cents), 0) into allocated from public.receipt_allocations a where a.receipt_id = new.id;
  if allocated <> new.total_cents then
    raise exception 'Allocations of % cents do not equal the receipt total of % cents', allocated, new.total_cents
      using errcode = 'check_violation', constraint = 'receipts_reconcile';
  end if;
  return null;
end $$;

create constraint trigger z_reconcile after insert or update on public.receipts
  deferrable initially deferred for each row when (new.status = 'confirmed')
  execute function app.check_receipt_total();

create function app.check_payroll_total() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.payroll_entries e where e.run_id = new.id) then
    raise exception 'A payroll run needs at least one entry' using errcode = 'check_violation', constraint = 'payroll_reconcile';
  end if;
  if exists (
    select 1 from public.payroll_entries e
    left join public.payroll_allocations a on a.entry_id = e.id
    where e.run_id = new.id
    group by e.id, e.cost_cents
    having coalesce(sum(a.percent_bp), 0) <> 10000 or coalesce(sum(a.amount_cents), 0) <> e.cost_cents
  ) then
    raise exception 'Payroll splits must total 100 percent and the full cost' using errcode = 'check_violation', constraint = 'payroll_reconcile';
  end if;
  return null;
end $$;

create constraint trigger z_reconcile after insert or update on public.payroll_runs
  deferrable initially deferred for each row when (new.status = 'posted')
  execute function app.check_payroll_total();

create function app.check_employee_splits() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  target uuid;
  targets uuid[] := '{}';
  total bigint;
begin
  if tg_op in ('UPDATE', 'DELETE') then targets := targets || old.employee_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then targets := targets || new.employee_id; end if;
  foreach target in array targets loop
    select sum(s.percent_bp) into total from public.employee_splits s where s.employee_id = target;
    if total is not null and total <> 10000 then
      raise exception 'Employee splits must total 100 percent' using errcode = 'check_violation', constraint = 'employee_splits_total';
    end if;
  end loop;
  return null;
end $$;

create constraint trigger z_reconcile after insert or update or delete on public.employee_splits
  deferrable initially deferred for each row execute function app.check_employee_splits();

create function app.guard_import_row() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.raw is not null and exists (
    select 1 from public.imports i where i.id = new.import_id and i.kind = 'payroll'
  ) then
    raise exception 'Raw payroll rows are not stored' using errcode = 'check_violation', constraint = 'import_rows_payroll_raw';
  end if;
  return new;
end $$;

create trigger b_guard before insert or update on public.import_rows
  for each row execute function app.guard_import_row();

create function app.audit_row() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  prior jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  fresh jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  item jsonb := coalesce(fresh, prior);
  actor uuid := app.current_user_id();
  level public.sensitivity := 'general';
begin
  if tg_op = 'UPDATE' and (prior - 'updated_at') = (fresh - 'updated_at') then
    return null;
  end if;
  if tg_table_name in ('employees', 'employee_splits', 'payroll_runs', 'payroll_entries', 'payroll_allocations') then
    level := 'payroll';
  elsif item ? 'sensitivity' then
    level := case
      when coalesce(prior ->> 'sensitivity', '') = 'payroll' or coalesce(fresh ->> 'sensitivity', '') = 'payroll' then 'payroll'
      else 'general'
    end::public.sensitivity;
  elsif tg_table_name = 'ai_proposals' then
    select coalesce(
      (select e.sensitivity from public.ai_extractions e where e.id = (item ->> 'extraction_id')::uuid), 'payroll'
    ) into level;
  elsif tg_table_name = 'import_rows' then
    select coalesce(
      (select i.sensitivity from public.imports i where i.id = (item ->> 'import_id')::uuid), 'payroll'
    ) into level;
  end if;
  insert into public.audit_log (actor_id, actor_kind, action, entity_type, entity_id, grant_id, before, after, request_id, sensitivity)
  values (
    actor,
    case when actor is null then 'system' else 'user' end::public.actor_kind,
    lower(tg_op),
    tg_table_name,
    coalesce(item ->> 'id', item ->> 'user_id'),
    case when tg_table_name = 'grants' then (item ->> 'id')::uuid else (item ->> 'grant_id')::uuid end,
    prior - 'password_hash',
    fresh - 'password_hash',
    nullif(pg_catalog.current_setting('app.request_id', true), ''),
    level
  );
  return null;
end $$;

do $$
declare t text;
begin
  for t in select tablename from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename not in ('audit_log', 'accounts', 'verification_tokens', 'auth_tokens', 'login_attempts', 'notifications', 'email_messages')
  loop
    execute format(
      'create trigger y_audit after insert or update or delete on public.%I for each row execute function app.audit_row()', t);
  end loop;
end $$;

create function app.block_audit_change() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'The audit log is append-only' using errcode = 'insufficient_privilege';
end $$;

create trigger block_change before update or delete on public.audit_log
  for each row execute function app.block_audit_change();
create trigger block_truncate before truncate on public.audit_log
  for each statement execute function app.block_audit_change();

create function app.log_event(
  event text,
  subject_type text,
  subject_id text default null,
  subject_grant uuid default null,
  details jsonb default null,
  level public.sensitivity default 'general'
) returns void
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := app.current_user_id();
begin
  if session_user = 'app_user' and not app.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if event !~ '^(auth|file|approval|ai|job)\.[a-z_]+$' then
    raise exception 'Unknown audit event %', event using errcode = 'check_violation', constraint = 'audit_event_name';
  end if;
  insert into public.audit_log (actor_id, actor_kind, action, entity_type, entity_id, grant_id, after, request_id, sensitivity)
  values (
    actor,
    case when actor is null then 'system' else 'user' end::public.actor_kind,
    event, subject_type, subject_id, subject_grant, details,
    nullif(pg_catalog.current_setting('app.request_id', true), ''),
    level
  );
end $$;

create view public.category_balances with (security_barrier = true) as
select
  c.grant_id,
  c.id as category_id,
  c.name,
  c.is_salary,
  coalesce(b.cents, 0)::bigint as budget_cents,
  coalesce(r.cents, 0)::bigint as receipts_cents,
  coalesce(p.cents, 0)::bigint as payroll_cents,
  (coalesce(r.cents, 0) + coalesce(p.cents, 0))::bigint as spent_cents,
  (coalesce(b.cents, 0) - coalesce(r.cents, 0) - coalesce(p.cents, 0))::bigint as remaining_cents
from public.budget_categories c
left join (
  select l.category_id, sum(l.amount_cents) as cents
  from public.budget_lines l join public.budgets x on x.id = l.budget_id and x.status = 'approved'
  group by l.category_id
) b on b.category_id = c.id
left join (
  select a.category_id, sum(a.amount_cents) as cents
  from public.receipt_allocations a join public.receipts x on x.id = a.receipt_id and x.status = 'confirmed'
  group by a.category_id
) r on r.category_id = c.id
left join (
  select a.category_id, sum(a.amount_cents) as cents
  from public.payroll_allocations a
  join public.payroll_entries e on e.id = a.entry_id
  join public.payroll_runs x on x.id = e.run_id and x.status = 'posted'
  group by a.category_id
) p on p.category_id = c.id
where (select app.is_member());

create view public.grant_balances with (security_barrier = true) as
select
  g.id as grant_id,
  g.award_cents,
  coalesce(sum(c.budget_cents), 0)::bigint as budget_cents,
  coalesce(sum(c.spent_cents), 0)::bigint as spent_cents,
  coalesce(sum(c.remaining_cents), 0)::bigint as remaining_cents
from public.grants g
left join public.category_balances c on c.grant_id = g.id
where (select app.is_member())
group by g.id, g.award_cents;

grant select on public.category_balances, public.grant_balances to app_user;

revoke execute on all functions in schema app from public;
grant execute on function app.log_event(text, text, text, uuid, jsonb, public.sensitivity) to app_user, app_system;
