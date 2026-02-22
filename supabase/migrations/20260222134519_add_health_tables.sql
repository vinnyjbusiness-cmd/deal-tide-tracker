create table public.service_health (
    id uuid default gen_random_uuid() primary key,
    service_name text not null unique,
    status text not null check (status in ('ok', 'warn', 'error', 'pending')),
    detail text,
    last_seen timestamp with time zone default now() not null
);

create table public.health_logs (
    id uuid default gen_random_uuid() primary key,
    service_name text not null,
    level text not null check (level in ('INFO', 'WARN', 'ERROR')),
    message text not null,
    created_at timestamp with time zone default now() not null
);

-- Turn on Realtime for health_logs and service_health
alter publication supabase_realtime add table public.health_logs;
alter publication supabase_realtime add table public.service_health;
