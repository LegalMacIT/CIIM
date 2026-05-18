import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { processDocx } from "@/lib/docx-processor";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.publicMetadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "docx") {
    return NextResponse.json({ error: "Only .docx files are accepted" }, { status: 400 });
  }

  // Convert to Node.js Buffer immediately — prevents ArrayBuffer from being
  // detached/consumed by the Supabase storage client before mammoth can use it.
  const nodeBuffer = Buffer.from(await file.arrayBuffer());
  const supabase = createServiceClient();

  // Determine next version number
  const { data: latest } = await supabase
    .from("template_versions")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latest?.version ?? 0) + 1;
  const storagePath = `templates/v${nextVersion}.docx`;

  // Convert .docx → processed HTML first (before storage upload consumes the buffer)
  let htmlContent: string;
  try {
    htmlContent = await processDocx(nodeBuffer);
  } catch (err) {
    return NextResponse.json({ error: `Document conversion failed: ${String(err)}` }, { status: 500 });
  }

  // Upload original .docx to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("templates")
    .upload(storagePath, nodeBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Deactivate previous active template
  await supabase
    .from("template_versions")
    .update({ is_active: false })
    .eq("is_active", true);

  // Save new template version
  const { data: newVersion, error: insertError } = await supabase
    .from("template_versions")
    .insert({
      version: nextVersion,
      html_content: htmlContent,
      docx_storage_path: storagePath,
      is_active: true,
      uploaded_by: user.id,
    })
    .select("id, version")
    .single();

  if (insertError) {
    return NextResponse.json({ error: `Failed to save template: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, version: newVersion.version, id: newVersion.id });
}
