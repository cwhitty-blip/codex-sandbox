alter table public.jobs
  alter column job_status set default 'Lead';

update public.jobs
set job_status = case job_status
  when 'Active' then 'Lead'
  when 'Waiting on Customer' then 'Estimate sent'
  when 'Ready to Schedule' then 'Estimate sent'
  when 'In Progress' then 'Scheduled'
  when 'On Hold' then 'Waiting on insurance'
  else job_status
end
where job_status in (
  'Active',
  'Waiting on Customer',
  'Ready to Schedule',
  'In Progress',
  'On Hold'
);
