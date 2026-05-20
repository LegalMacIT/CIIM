export type FieldGroup = {
  title: string;
  description?: string;
  fields: FieldDef[];
};

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "url" | "password" | "date" | "time" | "boolean";
  placeholder?: string;
  hint?: string;
};

export const CREDENTIAL_KEYS = new Set([
  "cloudadmin_email",
  "cloudadmin_password",
  "imanadmin_email",
  "imanadmin_password",
]);

export const BOOLEAN_KEYS = new Set([
  "Getting_Started",
  "Exchange_Rule",
  "Checked_Out_Docs",
  "Auto_Discovery",
  "Upgrading_imWork",
  "Acrobat",
  "Workspace_Gen",
  "SAML_Share",
  "SAML_Work",
  "SCIM",
  "saml_okta",
  "UAT",
  "Drive",
  "iOS_Mobility",
  "Litera_Compare",
  "Power_PDF",
  "Foxit_PDF",
  "File_Transfer",
  "Go_Live",
]);

export const FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Company Information",
    fields: [
      { key: "firm_company_name", label: "Company Name", type: "text", placeholder: "Acme Law LLP" },
      { key: "firm_company_nickname", label: "Company Nickname / Short Name", type: "text", placeholder: "Acme" },
      { key: "firm_initials", label: "Company Initials", type: "text", placeholder: "ALL" },
    ],
  },
  {
    title: "IT Contact",
    fields: [
      { key: "it_contact1_fname", label: "First Name", type: "text" },
      { key: "it_contact1_lname", label: "Last Name", type: "text" },
      { key: "itcontact1_email", label: "Email", type: "email" },
    ],
  },
  {
    title: "iManage Cloud Configuration",
    description: "URLs and identifiers for your iManage Cloud tenant.",
    fields: [
      { key: "subdomain", label: "Subdomain", type: "text", placeholder: "acme", hint: "e.g. 'acme' from acme.imanage.work" },
      { key: "cim_url", label: "Control Center URL", type: "url", placeholder: "https://acme.cloudimanage.com" },
      { key: "cim_site", label: "Control Center Site Name", type: "text" },
      { key: "work_url", label: "iManage Work URL", type: "url", placeholder: "https://acme.imanage.work" },
      { key: "work_site", label: "iManage Work Site Name", type: "text" },
      { key: "library_name1", label: "Primary Library Name", type: "text" },
      { key: "library_name2", label: "Secondary Library Name", type: "text" },
      { key: "tenant_id", label: "Tenant ID", type: "text" },
      { key: "company_id", label: "Company ID", type: "text" },
    ],
  },
  {
    title: "Credentials",
    description: "Stored encrypted. Never displayed in the manual. Reserved for future automation.",
    fields: [
      { key: "cloudadmin_email", label: "Cloud Admin Email", type: "email" },
      { key: "cloudadmin_password", label: "Cloud Admin Password", type: "password" },
      { key: "imanadmin_email", label: "iManage Admin Email", type: "email" },
      { key: "imanadmin_password", label: "iManage Admin Password", type: "password" },
    ],
  },
  {
    title: "Migration Timeline",
    fields: [
      { key: "final_trans_date", label: "Final Transition Date", type: "date" },
      { key: "final_trans_hour", label: "Transition Start Time", type: "time", hint: "e.g. 6:00 PM" },
      { key: "final_trans_hour30", label: "Final Notification Time (-30 min)", type: "time", hint: "e.g. 5:30 PM" },
      { key: "final_timezone", label: "Timezone", type: "text", placeholder: "Eastern Time (ET)" },
      { key: "uat_doc_date", label: "Last Delta Migration Date", type: "date" },
      { key: "uat_deadline_date", label: "UAT Deadline Date", type: "date" },
    ],
  },
  {
    title: "Other Details",
    fields: [
      { key: "link_teams_channel", label: "Microsoft Teams Channel Link", type: "url" },
      { key: "drive_letter", label: "iManage Drive Letter", type: "text", placeholder: "Z" },
    ],
  },
  {
    title: "Manual Sections",
    description: "Check each section that applies to your migration. Unchecked sections will be hidden in your manual.",
    fields: [
      { key: "Getting_Started", label: "Getting Started", type: "boolean" },
      { key: "Exchange_Rule", label: "Create an Exchange Rule", type: "boolean" },
      { key: "Checked_Out_Docs", label: "Review Checked Out Documents", type: "boolean" },
      { key: "Auto_Discovery", label: "Enable Auto Discovery on DNS", type: "boolean" },
      { key: "Upgrading_imWork", label: "Upgrade iManage Work Desktop", type: "boolean" },
      { key: "Acrobat", label: "Configure Adobe Acrobat Integration", type: "boolean" },
      { key: "Workspace_Gen", label: "Prepare iManage Workspace Generation", type: "boolean" },
      { key: "SAML_Share", label: "Create SAML App for iManage Share", type: "boolean" },
      { key: "SAML_Work", label: "Create SAML App for iManage Work", type: "boolean" },
      { key: "SCIM", label: "Create SAML SCIM Application", type: "boolean" },
      { key: "saml_okta", label: "SAML via Okta", type: "boolean" },
      { key: "UAT", label: "Conduct User Acceptance Testing (UAT)", type: "boolean" },
      { key: "Drive", label: "Install and Configure iManage Drive", type: "boolean" },
      { key: "iOS_Mobility", label: "Install iManage Work for iPad/iPhone", type: "boolean" },
      { key: "File_Transfer", label: "Install iManage File Transfer Extension", type: "boolean" },
      { key: "Go_Live", label: "Go Live Issues to Anticipate", type: "boolean" },
      { key: "Litera_Compare", label: "Litera Compare Integration", type: "boolean" },
      { key: "Power_PDF", label: "Tungsten Power PDF Integration", type: "boolean" },
      { key: "Foxit_PDF", label: "Foxit PDF Editor Integration", type: "boolean" },
    ],
  },
];

/**
 * Compute derived field defaults based on other saved values.
 * Only fills a key if that key has no saved value.
 */
export function computeDerivedDefaults(values: Record<string, string>): Record<string, string> {
  const derived: Record<string, string> = {};

  // cim_site = cim_url without "https://"
  if (!values["cim_site"] && values["cim_url"]) {
    derived["cim_site"] = values["cim_url"].replace(/^https?:\/\//, "");
  }

  // work_site = work_url without "https://"
  if (!values["work_site"] && values["work_url"]) {
    derived["work_site"] = values["work_url"].replace(/^https?:\/\//, "");
  }

  // uat_deadline_date = final_trans_date − 7 days (YYYY-MM-DD)
  if (!values["uat_deadline_date"] && values["final_trans_date"]) {
    try {
      const d = new Date(values["final_trans_date"] + "T12:00:00");
      d.setDate(d.getDate() - 7);
      derived["uat_deadline_date"] = d.toISOString().split("T")[0];
    } catch {
      // ignore invalid date
    }
  }

  // final_trans_hour30 = final_trans_hour − 30 min (HH:mm)
  if (!values["final_trans_hour30"] && values["final_trans_hour"]) {
    try {
      const [h, m] = values["final_trans_hour"].split(":").map(Number);
      const total = h * 60 + m - 30;
      const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
      derived["final_trans_hour30"] =
        String(Math.floor(wrapped / 60)).padStart(2, "0") + ":" +
        String(wrapped % 60).padStart(2, "0");
    } catch {
      // ignore invalid time
    }
  }

  return derived;
}
