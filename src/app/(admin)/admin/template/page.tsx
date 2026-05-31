import { createServiceClient } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import TemplateUpload from "./TemplateUpload";

export default async function AdminTemplatePage() {
  const supabase = createServiceClient();

  const { data: active } = await supabase
    .from("template_versions")
    .select("id, version, uploaded_at, uploaded_by, html_content")
    .eq("is_active", true)
    .single();

  const { data: history } = await supabase
    .from("template_versions")
    .select("id, version, uploaded_at, is_active")
    .order("version", { ascending: false })
    .limit(10);

  return (
    <div className="max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manual Template</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a new .docx to update the manual all clients see.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload New Template</CardTitle>
          <CardDescription>
            The uploaded .docx will be converted to HTML and activated immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateUpload currentVersion={active?.version ?? null} />
        </CardContent>
      </Card>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Template Preview</CardTitle>
            <CardDescription>
              Uploaded {new Date(active.uploaded_at).toLocaleString()} · v{active.version}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border rounded p-4 max-h-96 overflow-y-auto text-xs bg-gray-50 font-mono whitespace-pre-wrap break-all"
            >
              {active.html_content.slice(0, 3000)}
              {active.html_content.length > 3000 && (
                <span className="text-gray-400">… (truncated)</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-gray-500">
                    {new Date(v.uploaded_at).toLocaleString()}
                  </span>
                  <span className={v.is_active ? "text-green-700 font-medium" : "text-gray-400"}>
                    {v.is_active ? "Active" : "Archived"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
