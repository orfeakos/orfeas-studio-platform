"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

interface Version {
  id: string;
  label: string;
  created_at: string;
}

interface Client {
  id: string;
  email: string;
  github_repo: string | null;
  site_html: string | null;
}

type Tab = "editor" | "versions";

export default function EditorPage() {
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [client, setClient] = useState<Client | null>(null);
  const [currentHtml, setCurrentHtml] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [versions, setVersions] = useState<Version[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"idle" | "success" | "error">("idle");
  const [publishMessage, setPublishMessage] = useState("");
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClient() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data, error } = await supabase
        .from("clients")
        .select("id, email, github_repo, site_html")
        .eq("email", user.email)
        .single();

      if (error || !data) { setLoading(false); return; }

      setClient(data);
      setCurrentHtml(data.site_html || "");
      setLoading(false);
    }
    loadClient();
  }, [supabase, router]);

  useEffect(() => {
  function handleMessage(event: MessageEvent) {
    if (event.data?.type === "html_update" && event.data?.html) {
      setCurrentHtml(event.data.html);
    }
    if (event.data?.type === "publish_html" && event.data?.html) {
      setCurrentHtml(event.data.html);
      handlePublish();
    }
  }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleIframeLoad = useCallback(() => {
    if (iframeRef.current && currentHtml) {
      iframeRef.current.contentWindow?.postMessage(
        { type: "load_html", html: currentHtml }, "*"
      );
    }
  }, [currentHtml]);

  async function handlePublish() {
    if (!client || !currentHtml) return;
    setPublishing(true);
    setPublishStatus("idle");

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, html: currentHtml }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");

      setPublishStatus("success");
      setPublishMessage(`✓ Pushed to ${data.repo}`);
      if (activeTab === "versions") fetchVersions();
    } catch (err: unknown) {
      setPublishStatus("error");
      setPublishMessage(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPublishing(false);
      setTimeout(() => setPublishStatus("idle"), 5000);
    }
  }

  async function fetchVersions() {
    if (!client) return;
    setLoadingVersions(true);
    const res = await fetch(`/api/versions?clientId=${client.id}`);
    const data = await res.json();
    setVersions(data.versions || []);
    setLoadingVersions(false);
  }

  async function handleRestore(versionId: string, label: string) {
    if (!confirm(`Restore "${label}"?`)) return;
    setRestoringVersion(versionId);

    const res = await fetch("/api/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    const data = await res.json();

    if (data.html) {
      setCurrentHtml(data.html);
      setActiveTab("editor");
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "load_html", html: data.html }, "*"
        );
      }, 300);
    }
    setRestoringVersion(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0a0a0a", color:"#444", fontFamily:"monospace", gap:16 }}>
        <div style={{ width:28, height:28, border:"2px solid #222", borderTopColor:"#7c6af7", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize:12, letterSpacing:"0.1em" }}>Loading your studio...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#0a0a0a", fontFamily:"'DM Mono', monospace", color:"#e0e0e0" }}>

        {/* TOPBAR */}
        <div style={{ display:"flex", alignItems:"center", gap:16, height:52, padding:"0 20px", background:"#111", borderBottom:"1px solid #222", flexShrink:0, position:"relative" }}>
          <span style={{ fontSize:13, fontWeight:700, letterSpacing:"0.12em", color:"#fff", textTransform:"uppercase" }}>
            Orfeas<span style={{ color:"#7c6af7" }}>Studio</span>
          </span>

          <span style={{ fontSize:11, color:"#555", flex:1, letterSpacing:"0.05em" }}>
            <strong style={{ color:"#888" }}>{client?.email}</strong>
            {client?.github_repo && <> · {client.github_repo}</>}
          </span>

          <div style={{ display:"flex", gap:2, background:"#1a1a1a", borderRadius:6, padding:3 }}>
            {(["editor","versions"] as Tab[]).map(tab => (
              <button key={tab} onClick={() => tab === "versions" ? (setActiveTab("versions"), fetchVersions()) : setActiveTab("editor")}
                style={{ padding:"5px 14px", borderRadius:4, border:"none", background: activeTab===tab ? "#2a2a2a" : "transparent", color: activeTab===tab ? "#e0e0e0" : "#555", fontSize:11, fontFamily:"inherit", letterSpacing:"0.08em", cursor:"pointer", textTransform:"uppercase" }}>
                {tab === "editor" ? "Editor" : "History"}
              </button>
            ))}
          </div>

          <button onClick={handlePublish} disabled={publishing || !client?.github_repo}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 18px", background: publishStatus==="success" ? "#2d7a4a" : publishStatus==="error" ? "#7a2d2d" : "#7c6af7", color:"#fff", border:"none", borderRadius:6, fontFamily:"inherit", fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", cursor: publishing||!client?.github_repo ? "not-allowed" : "pointer", opacity: publishing||!client?.github_repo ? 0.5 : 1 }}>
            {publishing ? "Publishing..." : publishStatus==="success" ? "✓ Published" : publishStatus==="error" ? "✗ Error" : "↑ Publish"}
          </button>

          <button onClick={handleLogout}
            style={{ padding:"5px 12px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:5, color:"#444", fontFamily:"inherit", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer" }}>
            Exit
          </button>

          {publishStatus !== "idle" && (
            <div style={{ position:"absolute", bottom:-32, right:20, fontSize:11, padding:"4px 12px", borderRadius:4, letterSpacing:"0.04em", animation:"fadeIn 0.2s ease", background: publishStatus==="success" ? "#1a3d2a" : "#3d1a1a", color: publishStatus==="success" ? "#4ade80" : "#f87171", border: `1px solid ${publishStatus==="success" ? "#2d7a4a" : "#7a2d2d"}` }}>
              {publishMessage}
            </div>
          )}
        </div>

        {!client?.github_repo && (
          <div style={{ padding:"6px 16px", background:"#1e1500", borderBottom:"1px solid #332200", fontSize:11, color:"#b07d30", letterSpacing:"0.04em" }}>
            ⚠ No GitHub repo configured — add github_repo to this client in Supabase.
          </div>
        )}

        {/* MAIN */}
        <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
          {activeTab === "editor" && (
            <iframe ref={iframeRef} src="/orfeas_studio_v4-9.html"
              style={{ width:"100%", height:"100%", border:"none", display:"block" }}
              onLoad={handleIframeLoad} title="Site Editor" />
          )}

          {activeTab === "versions" && (
            <div style={{ height:"100%", overflowY:"auto", padding:32, background:"#0d0d0d" }}>
              <p style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.15em", color:"#444", marginBottom:24 }}>Version History</p>

              {loadingVersions ? (
                <div style={{ display:"flex", gap:12, alignItems:"center", color:"#333" }}>
                  <div style={{ width:20, height:20, border:"2px solid #222", borderTopColor:"#7c6af7", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
                  <span style={{ fontSize:11 }}>Loading...</span>
                </div>
              ) : versions.length === 0 ? (
                <p style={{ color:"#333", fontSize:12, letterSpacing:"0.05em" }}>No versions yet — publish your first version.</p>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8, maxWidth:560 }}>
                  {versions.map(v => (
                    <div key={v.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#141414", border:"1px solid #1f1f1f", borderRadius:8 }}>
                      <div>
                        <div style={{ fontSize:13, color:"#ccc", marginBottom:4 }}>{v.label}</div>
                        <div style={{ fontSize:10, color:"#444", letterSpacing:"0.05em" }}>{new Date(v.created_at).toLocaleString("el-GR")}</div>
                      </div>
                      <button onClick={() => handleRestore(v.id, v.label)} disabled={restoringVersion === v.id}
                        style={{ padding:"6px 14px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:5, color:"#7c6af7", fontFamily:"inherit", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer" }}>
                        {restoringVersion === v.id ? "Restoring..." : "Restore"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}