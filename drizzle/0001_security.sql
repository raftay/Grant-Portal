create schema app;

create function app.current_user_id() returns uuid
language sql stable set search_path = ''
as $$ select nullif(pg_catalog.current_setting('app.user_id', true), '')::uuid $$;

create function app.user_role() returns public.user_role
language sql stable security definer set search_path = ''
as $$ select u.role from public.users u where u.id = app.current_user_id() and u.status = 'active' $$;

create function app.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select app.user_role() is not null $$;

create function app.can_write() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.user_role() in ('admin', 'staff'), false) $$;

create function app.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.user_role() = 'admin', false) $$;

create function app.can_view_payroll() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select u.can_view_payroll from public.users u where u.id = app.current_user_id() and u.status = 'active'),
    false
  )
$$;

create function app.can_see(level public.sensitivity) returns boolean
language sql stable security definer set search_path = ''
as $$ select app.is_member() and (level = 'general' or app.can_view_payroll()) $$;

create function app.can_edit(level public.sensitivity) returns boolean
language sql stable security definer set search_path = ''
as $$ select app.can_write() and (level = 'general' or app.can_view_payroll()) $$;

revoke all on schema public from public;
grant usage on schema public to app_user, app_system;
grant usage on schema app to app_user, app_system;
revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to app_user;
grant execute on function app.current_user_id() to app_system;

do $$
declare t text;
begin
  for t in select tablename from pg_catalog.pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['organization_profile', 'documents', 'grants', 'grant_contacts', 'grant_links', 'deadlines',
    'budget_categories', 'budgets', 'budget_lines', 'receipts', 'receipt_allocations'] loop
    execute format('grant select, insert, update on public.%I to app_user', t);
    execute format('create policy member_select on public.%I for select to app_user using ((select app.is_member()))', t);
    execute format('create policy writer_insert on public.%I for insert to app_user with check ((select app.can_write()))', t);
    execute format('create policy writer_update on public.%I for update to app_user using ((select app.can_write())) with check ((select app.can_write()))', t);
  end loop;

  foreach t in array array['grant_contacts', 'grant_links', 'budget_lines', 'receipt_allocations'] loop
    execute format('grant delete on public.%I to app_user', t);
    execute format('create policy writer_delete on public.%I for delete to app_user using ((select app.can_write()))', t);
  end loop;

  foreach t in array array['budgets', 'receipts'] loop
    execute format('grant delete on public.%I to app_user', t);
    execute format('create policy draft_delete on public.%I for delete to app_user using (status = ''draft'' and (select app.can_write()))', t);
  end loop;

  foreach t in array array['files', 'ai_extractions', 'imports', 'warnings'] loop
    execute format('grant select, insert, update on public.%I to app_user', t);
    execute format('create policy writer_insert on public.%I for insert to app_user with check (app.can_edit(sensitivity))', t);
    execute format('create policy writer_update on public.%I for update to app_user using (app.can_edit(sensitivity)) with check (app.can_edit(sensitivity))', t);
  end loop;

  foreach t in array array['files', 'imports', 'warnings'] loop
    execute format('create policy member_select on public.%I for select to app_user using (app.can_see(sensitivity))', t);
  end loop;

  foreach t in array array['employees', 'employee_splits', 'payroll_runs', 'payroll_entries', 'payroll_allocations'] loop
    execute format('grant select, insert, update on public.%I to app_user', t);
    execute format('create policy payroll_select on public.%I for select to app_user using ((select app.can_see(''payroll'')))', t);
    execute format('create policy payroll_insert on public.%I for insert to app_user with check ((select app.can_edit(''payroll'')))', t);
    execute format('create policy payroll_update on public.%I for update to app_user using ((select app.can_edit(''payroll''))) with check ((select app.can_edit(''payroll'')))', t);
  end loop;

  foreach t in array array['employee_splits', 'payroll_entries', 'payroll_allocations'] loop
    execute format('grant delete on public.%I to app_user', t);
    execute format('create policy payroll_delete on public.%I for delete to app_user using ((select app.can_edit(''payroll'')))', t);
  end loop;
end $$;

grant delete on public.payroll_runs to app_user;
create policy draft_delete on public.payroll_runs for delete to app_user
  using (status = 'draft' and (select app.can_edit('payroll')));

grant delete on public.imports to app_user;
create policy unconfirmed_delete on public.imports for delete to app_user
  using (status <> 'confirmed' and app.can_edit(sensitivity));

create policy writer_select on public.ai_extractions for select to app_user
  using (app.can_edit(sensitivity));

revoke update on public.files from app_user;
grant update (status, sha256, sensitivity, ready_at) on public.files to app_user;

grant select, insert on public.document_versions to app_user;
create policy member_select on public.document_versions for select to app_user
  using ((select app.is_member()));
create policy writer_insert on public.document_versions for insert to app_user
  with check ((select app.can_write()));

grant select, insert on public.ai_proposals to app_user;
grant update (status, final_value, reviewed_by, reviewed_at, applied_entity_id) on public.ai_proposals to app_user;
create policy writer_select on public.ai_proposals for select to app_user
  using (exists (select 1 from public.ai_extractions e where e.id = extraction_id));
create policy writer_insert on public.ai_proposals for insert to app_user
  with check (status = 'pending' and exists (select 1 from public.ai_extractions e where e.id = extraction_id));
create policy writer_update on public.ai_proposals for update to app_user
  using (status = 'pending' and exists (select 1 from public.ai_extractions e where e.id = extraction_id))
  with check (exists (select 1 from public.ai_extractions e where e.id = extraction_id));

grant select, insert, update, delete on public.import_rows to app_user;
create policy member_select on public.import_rows for select to app_user
  using (exists (select 1 from public.imports i where i.id = import_id));
create policy writer_insert on public.import_rows for insert to app_user
  with check (exists (select 1 from public.imports i where i.id = import_id and app.can_edit(i.sensitivity)));
create policy writer_update on public.import_rows for update to app_user
  using (exists (select 1 from public.imports i where i.id = import_id and app.can_edit(i.sensitivity)))
  with check (exists (select 1 from public.imports i where i.id = import_id and app.can_edit(i.sensitivity)));
create policy writer_delete on public.import_rows for delete to app_user
  using (exists (select 1 from public.imports i where i.id = import_id and app.can_edit(i.sensitivity)));

grant select on public.users to app_user;
grant insert (id, name, email, role, status, can_view_payroll, invited_by) on public.users to app_user;
grant update (name, email, role, status, can_view_payroll) on public.users to app_user;
create policy member_select on public.users for select to app_user
  using ((select app.is_member()));
create policy admin_insert on public.users for insert to app_user
  with check ((select app.is_admin()) and status = 'invited');
create policy admin_update on public.users for update to app_user
  using ((select app.is_admin())) with check ((select app.is_admin()));

grant select on public.audit_log to app_user;
create policy admin_select on public.audit_log for select to app_user
  using ((select app.is_admin()) and app.can_see(sensitivity));

grant select on public.notifications to app_user;
create policy own_or_admin_select on public.notifications for select to app_user
  using ((select app.is_admin()) or ((select app.is_member()) and recipient_id = (select app.current_user_id())));

grant select on public.email_messages to app_user;
create policy admin_select on public.email_messages for select to app_user
  using ((select app.is_admin()));

grant select on public.users to app_system;
grant update (name, image, email_verified, status, session_version, updated_at) on public.users to app_system;
create policy system_select on public.users for select to app_system using (true);
create policy system_update on public.users for update to app_system
  using (status <> 'deactivated') with check (status = 'active' or status = 'invited');

grant select, insert, update on public.user_credentials to app_system;
grant select on public.accounts to app_system;
grant select, insert, delete on public.verification_tokens to app_system;
grant select, insert, update on public.auth_tokens to app_system;
grant select, insert, delete on public.login_attempts to app_system;
grant select, insert, update on public.notifications to app_system;
grant select, insert, update on public.email_messages to app_system;
grant select on public.organization_profile, public.documents, public.deadlines, public.grants to app_system;
grant select, update (status) on public.files to app_system;

do $$
declare t text;
begin
  foreach t in array array['user_credentials', 'accounts', 'verification_tokens', 'auth_tokens', 'login_attempts',
    'notifications', 'email_messages'] loop
    execute format('create policy system_all on public.%I for all to app_system using (true) with check (true)', t);
  end loop;
  foreach t in array array['organization_profile', 'documents', 'deadlines', 'grants'] loop
    execute format('create policy system_select on public.%I for select to app_system using (true)', t);
  end loop;
end $$;

create policy system_select on public.files for select to app_system using (status <> 'ready');
create policy system_update on public.files for update to app_system
  using (status = 'pending') with check (status = 'failed');
