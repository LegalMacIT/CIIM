-- Allow a single Clerk user to belong to multiple companies.
-- Previously customer_members had UNIQUE (clerk_user_id), limiting each
-- user to exactly one company. Replace with a per-company uniqueness
-- constraint so a user can be a member of several companies, but not
-- be added twice to the same one.

ALTER TABLE public.customer_members DROP CONSTRAINT customer_members_clerk_user_id_key;

ALTER TABLE public.customer_members ADD CONSTRAINT customer_members_customer_id_clerk_user_id_key
  UNIQUE (customer_id, clerk_user_id);
