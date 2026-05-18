export type CustomerRow = {
  id: string;
  clerk_user_id: string;
  company_name: string;
  slug: string;
  created_at: string;
};

export type FormValueRow = {
  id: string;
  customer_id: string;
  field_key: string;
  field_value: string | null;
  updated_at: string;
};

export type TemplateVersionRow = {
  id: string;
  version: number;
  html_content: string;
  docx_storage_path: string;
  is_active: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
};

export type TemplateSectionRow = {
  id: string;
  template_version_id: string;
  field_key: string;
  section_id: string;
  label: string;
};

export type TaskCompletionRow = {
  id: string;
  customer_id: string;
  task_id: string;
  completed_at: string;
};

export type SectionCommentRow = {
  id: string;
  customer_id: string;
  section_key: string;
  comment_text: string;
  user_initials: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: CustomerRow;
        Insert: Omit<CustomerRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CustomerRow, "id">>;
        Relationships: [];
      };
      form_values: {
        Row: FormValueRow;
        Insert: Omit<FormValueRow, "id" | "updated_at"> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<FormValueRow, "id">>;
        Relationships: [];
      };
      template_versions: {
        Row: TemplateVersionRow;
        Insert: Omit<TemplateVersionRow, "id" | "uploaded_at"> & {
          id?: string;
          uploaded_at?: string;
        };
        Update: Partial<Omit<TemplateVersionRow, "id">>;
        Relationships: [];
      };
      template_sections: {
        Row: TemplateSectionRow;
        Insert: Omit<TemplateSectionRow, "id"> & { id?: string };
        Update: Partial<Omit<TemplateSectionRow, "id">>;
        Relationships: [];
      };
      task_completions: {
        Row: TaskCompletionRow;
        Insert: Omit<TaskCompletionRow, "id" | "completed_at"> & { id?: string; completed_at?: string };
        Update: Partial<Omit<TaskCompletionRow, "id">>;
        Relationships: [];
      };
      section_comments: {
        Row: SectionCommentRow;
        Insert: Omit<SectionCommentRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<SectionCommentRow, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
