-- The owner-approved bootstrap mailbox is application configuration, not a
-- user-editable claim. Never grant privileges from raw_user_meta_data/JWT data.
alter table public.content_admins add column grant_source text not null default 'manual'
  check (grant_source in ('manual', 'bootstrap_email'));

create function private.provision_verified_bootstrap_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_schema <> 'auth' or tg_table_name <> 'users' then
    raise exception 'Unsupported trigger source' using errcode = '42501';
  end if;
  if lower(new.email) = 'info@dgwebservices.nl'
    and new.email_confirmed_at is not null
    and not coalesce(new.is_anonymous, false) then
    insert into public.content_admins(user_id, grant_source)
      values (new.id, 'bootstrap_email') on conflict (user_id) do nothing;
  else
    -- Revocation follows the trusted Auth row. Separately granted administrators
    -- remain under operator control; this trigger only owns its bootstrap grant.
    delete from public.content_admins where user_id = new.id and grant_source = 'bootstrap_email';
  end if;
  return new;
end;
$$;
revoke all on function private.provision_verified_bootstrap_admin() from public, anon, authenticated;

create trigger fabelpad_verified_bootstrap_admin
after insert or update of email, email_confirmed_at, is_anonymous on auth.users
for each row execute function private.provision_verified_bootstrap_admin();

-- Existing verified accounts qualify without sending an email or changing Auth.
insert into public.content_admins(user_id, grant_source)
select id, 'bootstrap_email' from auth.users
where lower(email) = 'info@dgwebservices.nl' and email_confirmed_at is not null
  and not coalesce(is_anonymous, false)
on conflict (user_id) do nothing;

-- Some hosted projects include this SECURITY DEFINER event-trigger helper.
-- Event triggers retain their binding; API users never need to invoke it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
