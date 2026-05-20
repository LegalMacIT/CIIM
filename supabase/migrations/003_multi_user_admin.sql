-- 1. Add customer status
ALTER TABLE public.customers ADD COLUMN status text NOT NULL DEFAULT 'active';

-- 2. New junction table: one Clerk user ID -> one company
CREATE TABLE public.customer_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  joined_at     timestamptz DEFAULT now(),
  UNIQUE (clerk_user_id)
);
ALTER TABLE public.customer_members ENABLE ROW LEVEL SECURITY;

-- 3. Migrate existing one-to-one relationships
INSERT INTO public.customer_members (customer_id, clerk_user_id)
SELECT id, clerk_user_id FROM public.customers
WHERE clerk_user_id IS NOT NULL AND clerk_user_id <> '';

-- 4. Remove the old column from customers
ALTER TABLE public.customers DROP COLUMN clerk_user_id;
