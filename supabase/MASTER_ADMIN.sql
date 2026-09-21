-- Run only after you have registered the production master-admin user.
-- Replace the email below.
update public.profiles
set global_role = 'master_admin'
where auth_email = 'YOUR_MASTER_ADMIN_EMAIL@example.com';
