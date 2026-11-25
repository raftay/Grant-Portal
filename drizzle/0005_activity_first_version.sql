create or replace view public.recent_activity with (security_barrier = true) as
select
  a.id,
  a.occurred_at,
  a.actor_id,
  u.name as actor_name,
  a.action,
  a.entity_type,
  a.entity_id,
  a.grant_id,
  coalesce(
    coalesce(a.after, a.before) ->> 'title',
    coalesce(a.after, a.before) ->> 'name',
    coalesce(a.after, a.before) ->> 'label',
    coalesce(a.after, a.before) ->> 'legal_name',
    coalesce(a.after, a.before) ->> 'vendor',
    d.title
  ) as label
from public.audit_log a
left join public.users u on u.id = a.actor_id
left join public.documents d
  on a.entity_type = 'document_versions' and d.id = (coalesce(a.after, a.before) ->> 'document_id')::uuid
where (select app.is_member())
  and a.sensitivity = 'general'
  and a.action in ('insert', 'update', 'delete')
  and not (a.entity_type = 'document_versions' and (a.after ->> 'version_no')::int = 1)
  and a.entity_type in (
    'organization_profile', 'documents', 'document_versions', 'grants', 'grant_contacts', 'grant_links',
    'deadlines', 'budgets', 'receipts'
  );
