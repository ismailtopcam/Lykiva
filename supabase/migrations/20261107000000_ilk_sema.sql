-- Lykiva — ilk şema TASLAĞI
-- Durum: henüz hiçbir Supabase projesine uygulanmadı. 2. aşamada gözden geçirilip uygulanacak.
-- Konum verileri PostGIS ile tutulur (SRID 4326, WGS84).

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- Türler
-- ---------------------------------------------------------------------------
create type activity_type as enum ('bike', 'mtb', 'run', 'walk', 'hike', 'trail_run');
create type visibility as enum ('private', 'followers', 'groups', 'public');
create type member_role as enum ('owner', 'admin', 'member');
create type rsvp_status as enum ('going', 'maybe', 'declined');
create type difficulty as enum ('easy', 'moderate', 'hard');

-- ---------------------------------------------------------------------------
-- Profiller (auth.users ile 1-1)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name text not null,
  avatar_url text,
  bio text,
  city text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table follows (
  follower_id uuid not null references profiles (id) on delete cascade,
  followee_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ---------------------------------------------------------------------------
-- Gruplar ve topluluklar (aynı tablo; topluluk = büyük, keşfedilebilir grup)
-- ---------------------------------------------------------------------------
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_community boolean not null default false,
  is_private boolean not null default true,
  requires_approval boolean not null default false,
  primary_activity activity_type,
  city text,
  avatar_url text,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Rotalar (planlanmış yol)
-- ---------------------------------------------------------------------------
create table routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  activity activity_type not null,
  path geography(LineStringZ, 4326) not null, -- Z: yükseklik (m)
  distance_m double precision not null,
  elevation_gain_m double precision,
  elevation_loss_m double precision,
  difficulty difficulty,
  is_loop boolean not null default false,
  surface jsonb, -- ör. {"asphalt":0.18,"gravel":0.34,"trail":0.48}
  notes text,
  visibility visibility not null default 'private',
  allow_edit boolean not null default false,
  created_at timestamptz not null default now()
);
create index routes_path_gix on routes using gist (path);

-- Rotanın paylaşıldığı gruplar ve kişiler
create table route_shares (
  route_id uuid not null references routes (id) on delete cascade,
  group_id uuid references groups (id) on delete cascade,
  user_id uuid references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((group_id is null) <> (user_id is null))
);

-- ---------------------------------------------------------------------------
-- Aktiviteler (kaydedilmiş hareket)
-- ---------------------------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  route_id uuid references routes (id) on delete set null,
  title text,
  activity activity_type not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  moving_time_s integer not null,
  elapsed_time_s integer not null,
  distance_m double precision not null,
  elevation_gain_m double precision,
  elevation_loss_m double precision,
  max_elevation_m double precision,
  avg_speed_mps double precision,
  max_speed_mps double precision,
  min_moving_speed_mps double precision,
  track geography(LineStringZ, 4326), -- sadeleştirilmiş iz; ham noktalar ayrı tabloda
  hide_endpoints boolean not null default true,
  visibility visibility not null default 'followers',
  created_at timestamptz not null default now()
);
create index activities_owner_started_idx on activities (owner_id, started_at desc);

-- Ham GPS noktaları (hız grafiği, 3B görünüm için)
create table activity_points (
  activity_id uuid not null references activities (id) on delete cascade,
  seq integer not null,
  recorded_at timestamptz not null,
  location geography(Point, 4326) not null,
  elevation_m double precision,
  speed_mps double precision,
  primary key (activity_id, seq)
);

-- Molalar
create table activity_stops (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  location geography(Point, 4326) not null,
  distance_at_m double precision not null,
  note text,
  photo_urls text[] not null default '{}'
);

-- Birlikte yapılan kişiler
create table activity_participants (
  activity_id uuid not null references activities (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  primary key (activity_id, user_id)
);

create table activity_likes (
  activity_id uuid not null references activities (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Etkinlikler
-- ---------------------------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups (id) on delete cascade, -- null = genel etkinlik
  created_by uuid not null references profiles (id),
  title text not null,
  description text,
  activity activity_type not null,
  starts_at timestamptz not null,
  meeting_point geography(Point, 4326),
  meeting_point_name text,
  route_id uuid references routes (id) on delete set null,
  difficulty difficulty,
  capacity integer check (capacity is null or capacity > 1),
  visibility visibility not null default 'groups',
  created_at timestamptz not null default now()
);

create table event_attendees (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status rsvp_status not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Mesajlaşma (grup sohbetleri)
-- ---------------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text,
  -- Ek: rota, aktivite, etkinlik ya da anket kartı
  attachment_type text check (attachment_type in ('route', 'activity', 'event', 'poll', 'location')),
  attachment_id uuid,
  created_at timestamptz not null default now()
);
create index messages_group_created_idx on messages (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Canlı konum (realtime ile yayınlanır; yalnızca son konum tutulur)
-- ---------------------------------------------------------------------------
create table live_locations (
  user_id uuid primary key references profiles (id) on delete cascade,
  activity activity_type,
  location geography(Point, 4326) not null,
  speed_mps double precision,
  is_paused boolean not null default false,
  shared_with_group uuid references groups (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Şikayetler (admin paneli)
-- ---------------------------------------------------------------------------
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'activity', 'route', 'message', 'group', 'event')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Satır düzeyi güvenlik: tüm tablolarda açık. Politikalar 2. aşamada yazılacak;
-- o zamana kadar istemciden hiçbir satıra erişilemez (güvenli varsayılan).
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table follows enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table routes enable row level security;
alter table route_shares enable row level security;
alter table activities enable row level security;
alter table activity_points enable row level security;
alter table activity_stops enable row level security;
alter table activity_participants enable row level security;
alter table activity_likes enable row level security;
alter table activity_comments enable row level security;
alter table events enable row level security;
alter table event_attendees enable row level security;
alter table messages enable row level security;
alter table live_locations enable row level security;
alter table reports enable row level security;
