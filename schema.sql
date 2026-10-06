-- =====================================================================
-- Portal 7°BPM/M - Fase 1: contas, perfis, aprovação e permissões
-- Cole TUDO no Supabase: SQL Editor > New query > Run
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  username   text not null,
  age_range  text not null,
  entry_type text not null,
  rank       text not null,
  company    text not null,
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','reprovado','vetado')),
  role text not null default 'membro'
    check (role in ('membro','admin_geral','admin_sargenteante','admin_relatorios')),
  avatar_url text,
  banner_url text,
  bio text not null default '',
  created_at timestamptz not null default now()
);

-- Não permite 2 contas com o mesmo usuário ou o mesmo Nome e Sobrenome
create unique index if not exists profiles_username_uq on public.profiles (lower(username));
create unique index if not exists profiles_fullname_uq on public.profiles (lower(full_name));

alter table public.profiles enable row level security;

-- Cargo de quem está logado (security definer evita recursão nas regras)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "ver_perfis" on public.profiles;
create policy "ver_perfis" on public.profiles for select to authenticated
using (id = auth.uid() or status = 'aprovado'
       or public.my_role() in ('admin_geral','admin_sargenteante'));

drop policy if exists "editar_perfis" on public.profiles;
create policy "editar_perfis" on public.profiles for update to authenticated
using (id = auth.uid() or public.my_role() in ('admin_geral','admin_sargenteante'))
with check (id = auth.uid() or public.my_role() in ('admin_geral','admin_sargenteante'));

-- Trava: o usuário comum só altera foto, banner e biografia.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.my_role();
begin
  if auth.uid() is null then return new; end if;            -- painel do Supabase
  if r = 'admin_geral' then return new; end if;
  if r = 'admin_sargenteante' then
    if old.role = 'admin_geral' and old.id <> auth.uid() then
      raise exception 'Sem permissão para alterar um Admin Geral';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Somente o Admin Geral altera cargos de admin';
    end if;
    if old.id = auth.uid() and new.status is distinct from old.status then
      raise exception 'Você não pode alterar o próprio status';
    end if;
    return new;
  end if;
  if new.id <> old.id or new.full_name is distinct from old.full_name
     or new.username is distinct from old.username
     or new.age_range is distinct from old.age_range
     or new.entry_type is distinct from old.entry_type
     or new.rank is distinct from old.rank
     or new.company is distinct from old.company
     or new.status is distinct from old.status
     or new.role is distinct from old.role then
    raise exception 'Apenas foto, banner e biografia podem ser alterados';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update before update on public.profiles
for each row execute function public.guard_profile_update();

-- Cria o perfil automaticamente quando a conta é criada.
-- Todo mundo nasce "pendente". EXCEÇÃO: o usuário "sabbatino" vira Admin Geral
-- aprovado, mas só se ainda não existir nenhum Admin Geral (vale uma única vez).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := new.raw_user_meta_data; first_admin boolean;
begin
  first_admin := lower(trim(m->>'username')) = 'sabbatino'
    and not exists (select 1 from public.profiles where role = 'admin_geral');
  insert into public.profiles (id, full_name, username, age_range, entry_type, rank, company, status, role)
  values (new.id, trim(m->>'full_name'), lower(trim(m->>'username')), m->>'age_range',
          m->>'entry_type', m->>'rank', m->>'company',
          case when first_admin then 'aprovado' else 'pendente' end,
          case when first_admin then 'admin_geral' else 'membro' end);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Fotos de perfil e banner (cada usuário só grava na própria pasta)
insert into storage.buckets (id, name, public) values ('perfil','perfil',true)
on conflict (id) do nothing;

drop policy if exists "perfil_upload" on storage.objects;
create policy "perfil_upload" on storage.objects for insert to authenticated
with check (bucket_id = 'perfil' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "perfil_update" on storage.objects;
create policy "perfil_update" on storage.objects for update to authenticated
using (bucket_id = 'perfil' and (storage.foldername(name))[1] = auth.uid()::text);

-- Login por "usuário": devolve o e-mail interno da conta (necessário porque o
-- usuário pode ser editado por um admin sem alterar o login interno).
create or replace function public.login_email(p_username text) returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email from auth.users u join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username) limit 1
$$;
grant execute on function public.login_email(text) to anon, authenticated;
