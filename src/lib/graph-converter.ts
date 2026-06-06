const TENANT_ID = process.env.AZURE_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const USER_ID = process.env.ONEDRIVE_USER_ID!;

const GRAPH = "https://graph.microsoft.com/v1.0";

async function getAccessToken(): Promise<string> {
  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Graph token request failed (${resp.status}): ${body}`);
  }

  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}

// Upload a .docx buffer to a temporary OneDrive location, convert it to HTML
// via the Graph API, delete the temp file, and return the <body> content.
export async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  // fetch's body only accepts ArrayBuffer/Uint8Array, not Node Buffer directly
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  const token = await getAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  // Use a timestamped filename to avoid collisions on concurrent uploads
  const filename = `ciim-${Date.now()}.docx`;
  const uploadUrl = `${GRAPH}/users/${USER_ID}/drive/root:/ciim-temp/${filename}:/content`;

  const uploadResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      ...auth,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    body: arrayBuffer,
  });

  if (!uploadResp.ok) {
    const body = await uploadResp.text();
    throw new Error(`OneDrive upload failed (${uploadResp.status}): ${body}`);
  }

  const item = (await uploadResp.json()) as { id: string };
  const itemId = item.id;

  try {
    const convertResp = await fetch(
      `${GRAPH}/users/${USER_ID}/drive/items/${itemId}/content?format=html`,
      { headers: auth, redirect: "follow" }
    );

    if (!convertResp.ok) {
      const body = await convertResp.text();
      throw new Error(
        `Graph HTML conversion failed (${convertResp.status}): ${body}`
      );
    }

    const fullHtml = await convertResp.text();

    // Return just the <body> content — we supply our own CSS
    const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1].trim() : fullHtml;
  } finally {
    // Always clean up the temp file, even on conversion failure
    await fetch(`${GRAPH}/users/${USER_ID}/drive/items/${itemId}`, {
      method: "DELETE",
      headers: auth,
    }).catch((err) => console.warn("[graph-converter] Cleanup failed:", err));
  }
}
