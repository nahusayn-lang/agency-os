-- 015_user_profile_trigger.sql
-- Trigger to automatically create a public.users row when a new auth.users account is created.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (
    id,
    name,
    email,
    role,
    shift_start,
    shift_end,
    is_active,
    created_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Unnamed User'),
    new.email,
    'member',
    '09:00:00'::time,
    '17:00:00'::time,
    false,
    now()
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
