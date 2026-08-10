-- Goal Links Target Delete Cleanup
-- Removes explicit goal_links rows when a linked Project, Task, or Habit is hard-deleted.

BEGIN;

create or replace function public.cleanup_goal_links_for_project_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.goal_links
  where user_id = old.user_id
    and linked_type = 'project'
    and linked_id = old.id;
  return old;
end;
$$;

create or replace function public.cleanup_goal_links_for_task_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.goal_links
  where user_id = old.user_id
    and linked_type = 'task'
    and linked_id = old.id;
  return old;
end;
$$;

create or replace function public.cleanup_goal_links_for_habit_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.goal_links
  where user_id = old.user_id
    and linked_type = 'habit'
    and linked_id = old.id;
  return old;
end;
$$;

drop trigger if exists on_project_delete_cleanup_goal_links on public.projects;
create trigger on_project_delete_cleanup_goal_links
  after delete on public.projects
  for each row execute function public.cleanup_goal_links_for_project_delete();

drop trigger if exists on_task_delete_cleanup_goal_links on public.tasks;
create trigger on_task_delete_cleanup_goal_links
  after delete on public.tasks
  for each row execute function public.cleanup_goal_links_for_task_delete();

drop trigger if exists on_habit_delete_cleanup_goal_links on public.habits;
create trigger on_habit_delete_cleanup_goal_links
  after delete on public.habits
  for each row execute function public.cleanup_goal_links_for_habit_delete();

revoke all on function public.cleanup_goal_links_for_project_delete() from public, anon;
revoke all on function public.cleanup_goal_links_for_task_delete() from public, anon;
revoke all on function public.cleanup_goal_links_for_habit_delete() from public, anon;

COMMIT;

comment on function public.cleanup_goal_links_for_project_delete() is
  'Removes explicit goal_links rows pointing at a hard-deleted Project owned by the same user.';

comment on function public.cleanup_goal_links_for_task_delete() is
  'Removes explicit goal_links rows pointing at a hard-deleted Task owned by the same user.';

comment on function public.cleanup_goal_links_for_habit_delete() is
  'Removes explicit goal_links rows pointing at a hard-deleted Habit owned by the same user.';
