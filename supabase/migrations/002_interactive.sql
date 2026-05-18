-- Task completion tracking (one row per checkbox checked per customer)
CREATE TABLE task_completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid REFERENCES customers(id) ON DELETE CASCADE,
  task_id      text NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, task_id)
);

-- Section comments (one row per comment per customer)
CREATE TABLE section_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid REFERENCES customers(id) ON DELETE CASCADE,
  section_key   text NOT NULL,
  comment_text  text NOT NULL,
  user_initials text NOT NULL DEFAULT '?',
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_comments ENABLE ROW LEVEL SECURITY;
