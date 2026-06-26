-- TaskOps initial schema
-- Run this in Supabase SQL Editor

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now(),
  is_default boolean default false
);

insert into groups (name, is_default) values
  ('Followup', true),
  ('To Do', true)
on conflict (name) do nothing;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  original_entry text not null,
  refined_entry text,
  group_id uuid references groups(id),
  assigned_date date,
  reminder_time timestamptz,
  created_at timestamptz default now(),
  ai_confidence int,
  ai_reasoning text,
  status text default 'processing',
  source text not null,
  is_recurring boolean default false,
  recurring_pattern text,
  recurring_parent_id uuid references tasks(id),
  raw_audio_url text
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id),
  action text not null,
  actor text not null,
  meta jsonb,
  created_at timestamptz default now()
);

create table if not exists corrections (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id),
  field_changed text not null,
  old_value text,
  new_value text,
  created_at timestamptz default now()
);

-- Indexes for common query patterns
create index if not exists tasks_assigned_date_idx on tasks(assigned_date);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_group_id_idx on tasks(group_id);
create index if not exists activity_log_task_id_idx on activity_log(task_id);
create index if not exists activity_log_created_at_idx on activity_log(created_at desc);
create index if not exists corrections_created_at_idx on corrections(created_at desc);

-- Enable Row Level Security with permissive policies
-- (single-user app; revisit when multi-user auth is added)
alter table tasks enable row level security;
alter table groups enable row level security;
alter table activity_log enable row level security;
alter table corrections enable row level security;

create policy "allow_all_tasks" on tasks for all using (true) with check (true);
create policy "allow_all_groups" on groups for all using (true) with check (true);
create policy "allow_all_activity_log" on activity_log for all using (true) with check (true);
create policy "allow_all_corrections" on corrections for all using (true) with check (true);

-- Enable Realtime
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table activity_log;
alter publication supabase_realtime add table groups;
