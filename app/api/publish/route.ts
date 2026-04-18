import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { clientId, html } = await req.json();

    if (!clientId || !html) {
      return NextResponse.json({ error: "Missing clientId or html" }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, email, github_repo")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.github_repo) {
      return NextResponse.json({ error: "No GitHub repo configured" }, { status: 400 });
    }

    const [owner, repo] = client.github_repo.split("/");
    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/index.html`;

    let sha: string | undefined;
    const getRes = await fetch(apiBase, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    const content = Buffer.from(html).toString("base64");
    const pushRes = await fetch(apiBase, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Orfeas Studio publish — ${new Date().toISOString()}`,
        content,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!pushRes.ok) {
      const errData = await pushRes.json();
      return NextResponse.json({ error: errData.message || "GitHub push failed" }, { status: 500 });
    }

    const label = new Date().toLocaleString("el-GR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    await supabase.from("versions").insert({ client_id: clientId, html, label });
    await supabase.from("clients").update({ site_html: html }).eq("id", clientId);

    return NextResponse.json({ success: true, repo: client.github_repo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}