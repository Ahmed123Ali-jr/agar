-- ============================================
-- أغراضي - إعداد قاعدة بيانات Supabase
-- الصق هذا الملف في Supabase SQL Editor واضغط Run
-- ============================================

-- تفعيل uuid
create extension if not exists "uuid-ossp";

-- ============ الجداول ============

-- جدول العائلات
create table if not exists families (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text unique not null,
  created_at timestamp default now(),
  created_by uuid references auth.users
);

-- جدول أعضاء العائلة
create table if not exists family_members (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families on delete cascade,
  user_id uuid references auth.users on delete cascade,
  display_name text not null,
  role text default 'member',
  joined_at timestamp default now(),
  unique(family_id, user_id)
);

-- جدول أماكن التخزين
create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families on delete cascade,
  name text not null,
  description text,
  image_url text,
  icon text default '📦',
  created_by uuid references auth.users,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- جدول الأغراض
create table if not exists items (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations on delete cascade,
  family_id uuid references families on delete cascade,
  name text not null,
  notes text,
  image_url text,
  quantity int default 1,
  created_by uuid references auth.users,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- ============ الفهارس ============
create index if not exists items_name_idx on items using gin(to_tsvector('simple', name));
create index if not exists items_family_idx on items(family_id);
create index if not exists items_location_idx on items(location_id);
create index if not exists locations_family_idx on locations(family_id);
create index if not exists family_members_user_idx on family_members(user_id);
create index if not exists family_members_family_idx on family_members(family_id);

-- ============ RLS ============
alter table families enable row level security;
alter table family_members enable row level security;
alter table locations enable row level security;
alter table items enable row level security;

-- helper function: هل المستخدم عضو في هذه العائلة؟
create or replace function is_family_member(fid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from family_members
    where family_id = fid and user_id = auth.uid()
  );
$$;

-- ===== سياسات families =====
drop policy if exists "view own families" on families;
create policy "view own families" on families for select
  using (is_family_member(id) or created_by = auth.uid());

drop policy if exists "anyone authenticated can create family" on families;
create policy "anyone authenticated can create family" on families for insert
  with check (auth.uid() = created_by);

drop policy if exists "view family by invite_code" on families;
-- نحتاج نخلي أي مستخدم مسجل دخول يقدر يقرأ الفاميلي عند الانضمام بالكود
-- نسوي ذلك عبر RPC منفصلة لأمان أعلى

drop policy if exists "members update family" on families;
create policy "members update family" on families for update
  using (is_family_member(id));

-- ===== سياسات family_members =====
drop policy if exists "view members of own family" on family_members;
create policy "view members of own family" on family_members for select
  using (is_family_member(family_id) or user_id = auth.uid());

drop policy if exists "join family" on family_members;
create policy "join family" on family_members for insert
  with check (user_id = auth.uid());

drop policy if exists "leave family" on family_members;
create policy "leave family" on family_members for delete
  using (user_id = auth.uid());

drop policy if exists "update own membership" on family_members;
create policy "update own membership" on family_members for update
  using (user_id = auth.uid());

-- ===== سياسات locations =====
drop policy if exists "view family locations" on locations;
create policy "view family locations" on locations for select
  using (is_family_member(family_id));

drop policy if exists "insert family locations" on locations;
create policy "insert family locations" on locations for insert
  with check (is_family_member(family_id));

drop policy if exists "update family locations" on locations;
create policy "update family locations" on locations for update
  using (is_family_member(family_id));

drop policy if exists "delete family locations" on locations;
create policy "delete family locations" on locations for delete
  using (is_family_member(family_id));

-- ===== سياسات items =====
drop policy if exists "view family items" on items;
create policy "view family items" on items for select
  using (is_family_member(family_id));

drop policy if exists "insert family items" on items;
create policy "insert family items" on items for insert
  with check (is_family_member(family_id));

drop policy if exists "update family items" on items;
create policy "update family items" on items for update
  using (is_family_member(family_id));

drop policy if exists "delete family items" on items;
create policy "delete family items" on items for delete
  using (is_family_member(family_id));

-- ============ RPC: الانضمام بكود ============
create or replace function join_family_by_code(code text, member_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  fid uuid;
begin
  select id into fid from families where invite_code = upper(code) limit 1;
  if fid is null then
    raise exception 'INVALID_CODE';
  end if;
  insert into family_members (family_id, user_id, display_name)
  values (fid, auth.uid(), member_name)
  on conflict (family_id, user_id) do nothing;
  return fid;
end;
$$;

-- ============ Storage Bucket ============
-- نفّذ هذا في Supabase Dashboard > Storage:
-- 1. أنشئ bucket باسم: agradi-images
-- 2. اجعله Public
-- أو استخدم SQL التالي:
insert into storage.buckets (id, name, public)
values ('agradi-images', 'agradi-images', true)
on conflict (id) do nothing;

-- سياسة رفع الصور للمستخدمين المسجلين
drop policy if exists "auth users upload images" on storage.objects;
create policy "auth users upload images" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'agradi-images');

drop policy if exists "anyone read images" on storage.objects;
create policy "anyone read images" on storage.objects for select
  using (bucket_id = 'agradi-images');

drop policy if exists "owners delete images" on storage.objects;
create policy "owners delete images" on storage.objects for delete
  to authenticated
  using (bucket_id = 'agradi-images' and owner = auth.uid());
