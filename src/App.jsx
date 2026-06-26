import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, FolderClosed, FolderOpen, Plus, ChevronRight, ChevronDown, Clock, User, Tag, X, Check,
  Shield, ArrowLeft, Upload, FileText, FileSpreadsheet, FileImage, ListChecks, History,
  Share2, LayoutDashboard, Eye, Download, CornerDownRight, Activity, AlertCircle,
  TrendingUp, HardDrive, LogOut, Folder, CheckCircle2, Users, UserPlus
} from "lucide-react";
import { DEPTS, ROLE_RANK, ROLE_LABEL, FILE_KINDS, DEMO_LOGINS } from "./data.js";
import {
  signIn, signOut, getSessionProfile, onAuthChange,
  fetchProfiles, fetchFolders, fetchDocuments, fetchAudit,
  logAudit, incrementViews, createDocument, publishDocument,
  addVersion, shareDocument, getDownloadUrl, adminCreateUser,
} from "./api.js";

const kindIcon = (kind, size = 16) => {
  const p = { size, strokeWidth: 2 };
  if (kind === "pdf") return <FileText {...p} />;
  if (kind === "docx") return <FileText {...p} />;
  if (kind === "xlsx") return <FileSpreadsheet {...p} />;
  if (kind === "img") return <FileImage {...p} />;
  if (kind === "sop") return <ListChecks {...p} />;
  return <FileText {...p} />;
};

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessionProfile().then((p) => { setProfile(p); setLoading(false); });
    const { data: sub } = onAuthChange(async (session) => {
      setProfile(session ? await getSessionProfile() : null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  if (loading) return <div style={S.app}><style>{CSS}</style><div style={S.loginWrap}><div style={S.muted}>Loading…</div></div></div>;
  if (!profile) return <Login onSignedIn={setProfile} />;
  return <DMS user={profile} onLogout={async () => { await signOut(); setProfile(null); }} />;
}

function Login({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doSignIn = async (e, p) => {
    setBusy(true); setErr("");
    try {
      await signIn(e, p);
      const prof = await getSessionProfile();
      onSignedIn(prof);
    } catch (ex) {
      setErr("Sign in failed. Check your email and password.");
      setBusy(false);
    }
  };

  return (
    <div style={S.app}><style>{CSS}</style>
      <div style={S.loginWrap}>
        <div style={S.loginCard} className="pop">
          <div style={S.brandRow}>
            <div style={S.brandMark}><HardDrive size={22} strokeWidth={2.5} /></div>
            <div><div style={S.brandName}>ProcureDesk</div><div style={S.brandSub}>Procurement Document Management</div></div>
          </div>
          <p style={S.loginLede}>A secure cloud home for every tender, contract, vendor record, and procedure — so nothing is lost when people move on.</p>

          <label style={S.lbl}>Email</label>
          <input style={S.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" onKeyDown={e => e.key === "Enter" && doSignIn(email, password)} />
          <label style={S.lbl}>Password</label>
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && doSignIn(email, password)} />
          {err && <p style={S.loginErr}>{err}</p>}
          <button style={{ ...S.primary, width: "100%", justifyContent: "center", marginTop: 14, opacity: busy ? .6 : 1 }} disabled={busy} onClick={() => doSignIn(email, password)}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div style={S.loginDivider} data-divider><span>or try a demo profile</span></div>
          {DEMO_LOGINS.map((u) => {
            const d = DEPTS.find(x => x.id === u.dept);
            return (
              <button key={u.email} style={S.loginUser} className="loginUser" disabled={busy} onClick={() => doSignIn(u.email, u.password)}>
                <span style={{ ...S.avatar, background: d.color }}>{u.initials}</span>
                <span style={{ textAlign: "left", flex: 1 }}>
                  <span style={S.loginName}>{u.name}</span>
                  <span style={S.loginRole}>{ROLE_LABEL[u.role]} · {d.name}</span>
                </span>
                <ChevronRight size={16} style={{ color: "#B3A593" }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DMS({ user, onLogout }) {
  const [view, setView] = useState("files");
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showShare, setShowShare] = useState(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [toast, setToast] = useState("");

  const can = (lvl) => ROLE_RANK[user.role] >= ROLE_RANK[lvl];
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const reload = async () => {
    const [d, f, p, a] = await Promise.all([fetchDocuments(), fetchFolders(), fetchProfiles(), fetchAudit()]);
    setDocs(d); setFolders(f); setProfiles(p); setAudit(a); setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const log = async (action, target) => { await logAudit(user.name, action, target); setAudit(await fetchAudit()); };

  // RLS already filters what comes back, so `docs` is the visible set.
  const visible = docs;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visible.filter((d) => {
      if (folder && d.folder_id !== folder) return false;
      if (kindFilter !== "all" && d.kind !== kindFilter) return false;
      if (!q) return true;
      const hay = [d.title, d.summary, (d.tags || []).join(" "), d.owner_name, (d.steps || []).map(s => s.text + " " + (s.sub || []).join(" ")).join(" ")].join(" ").toLowerCase();
      return q.split(/\s+/).every(t => hay.includes(t));
    });
  }, [visible, query, folder, kindFilter]);

  const rootFolders = folders.filter(f => f.parent_id === null);
  const childrenOf = (id) => folders.filter(f => f.parent_id === id);
  const folderName = (id) => folders.find(f => f.id === id)?.name || "All documents";

  const openDoc = (d) => { setSelected(d); incrementViews(d.id); setDocs(p => p.map(x => x.id === d.id ? { ...x, views: x.views + 1 } : x)); };

  return (
    <div style={S.app}><style>{CSS}</style>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.brandMark}><HardDrive size={19} strokeWidth={2.5} /></div>
          <div><div style={S.brandNameSm}>ProcureDesk</div><div style={S.brandSub}>DMS</div></div>
        </div>

        {can("editor") && (
          <button style={S.uploadBtn} className="uploadBtn" onClick={() => setShowUpload(true)}>
            <Upload size={15} /> Upload document
          </button>
        )}

        <div style={S.navSection}>WORKSPACE</div>
        <button style={{ ...S.navItem, ...(view === "files" && !folder ? S.navActive : {}) }} onClick={() => { setView("files"); setFolder(null); setSelected(null); }}>
          <Folder size={15} /> All documents <span style={S.count}>{visible.length}</span>
        </button>
        <button style={{ ...S.navItem, ...(view === "dashboard" ? S.navActive : {}) }} onClick={() => { setView("dashboard"); setSelected(null); }}>
          <LayoutDashboard size={15} /> Dashboard
        </button>
        {can("admin") && (
          <button style={{ ...S.navItem, ...(view === "users" ? S.navActive : {}) }} onClick={() => { setView("users"); setSelected(null); }}>
            <Users size={15} /> Users
          </button>
        )}

        <div style={S.navSection}>FOLDERS</div>
        <div style={S.folderTree}>
          {rootFolders.map(f => {
            const kids = childrenOf(f.id);
            const d = DEPTS.find(x => x.id === f.dept);
            const isOpen = expanded[f.id];
            return (
              <div key={f.id}>
                <button style={{ ...S.navItem, ...(folder === f.id ? S.navActive : {}) }}
                  onClick={() => { setFolder(f.id); setView("files"); setSelected(null); if (kids.length) setExpanded(e => ({ ...e, [f.id]: !e[f.id] })); }}>
                  {kids.length ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span style={{ width: 13 }} />}
                  {folder === f.id ? <FolderOpen size={15} style={{ color: d.color }} /> : <FolderClosed size={15} style={{ color: d.color }} />}
                  <span style={S.folderLabel}>{f.name}</span>
                  <span style={S.count}>{visible.filter(x => x.folder_id === f.id).length}</span>
                </button>
                {isOpen && kids.map(k => (
                  <button key={k.id} style={{ ...S.navItem, paddingLeft: 34, ...(folder === k.id ? S.navActive : {}) }}
                    onClick={() => { setFolder(k.id); setView("files"); setSelected(null); }}>
                    <FolderClosed size={14} style={{ color: DEPTS.find(x => x.id === k.dept)?.color }} />
                    <span style={S.folderLabel}>{k.name}</span>
                    <span style={S.count}>{visible.filter(x => x.folder_id === k.id).length}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div style={S.userBox}>
          <span style={{ ...S.avatar, background: DEPTS.find(d => d.id === user.dept).color }}>{user.initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.userName}>{user.name}</div>
            <div style={S.userRole}><Shield size={10} /> {ROLE_LABEL[user.role]}</div>
          </div>
          <button style={S.logout} onClick={onLogout} title="Sign out"><LogOut size={15} /></button>
        </div>
      </aside>

      <main style={S.main}>
        {view === "dashboard" ? (
          <Dashboard docs={docs} audit={audit} folders={folders} />
        ) : view === "users" ? (
          <UsersScreen profiles={profiles} currentUser={user} onCreate={() => setShowCreateUser(true)} />
        ) : selected ? (
          <DocDetail doc={selected} user={user} can={can} folderName={folderName} profiles={profiles}
            onBack={() => setSelected(null)}
            onShare={() => setShowShare(selected)}
            onPublish={async () => {
              await publishDocument(selected.id);
              await log("published", selected.title);
              await reload();
              setSelected(s => ({ ...s, status: "published" }));
              flash("Document published.");
            }}
            onNewVersion={async (note) => {
              const nextV = await addVersion(selected, note, user.name, null);
              await log("uploaded", `${selected.title} (v${nextV})`);
              const fresh = await fetchDocuments();
              setDocs(fresh);
              setSelected(fresh.find(x => x.id === selected.id) || null);
              flash(`Version ${nextV} saved.`);
            }} />
        ) : (
          <>
            <header style={S.header}>
              <div>
                <div style={S.crumb}>{folder ? <>Folders <ChevronRight size={12} /> {folderName(folder)}</> : "Workspace"}</div>
                <h1 style={S.h1}>{folder ? folderName(folder) : "All documents"}</h1>
              </div>
              {can("editor") && <button style={S.primary} onClick={() => setShowUpload(true)}><Upload size={15} /> Upload</button>}
            </header>

            <div style={S.controls}>
              <div style={S.searchWrap}>
                <Search size={17} style={{ color: "#9C8B7A" }} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documents, SOPs, tags, owners…" style={S.search} />
                {query && <button style={S.iconBtn} onClick={() => setQuery("")}><X size={15} /></button>}
              </div>
              <div style={S.filters}>
                {["all", "pdf", "docx", "xlsx", "sop"].map(k => (
                  <button key={k} style={{ ...S.filterChip, ...(kindFilter === k ? S.filterActive : {}) }} onClick={() => setKindFilter(k)}>
                    {k === "all" ? "All types" : FILE_KINDS[k].label}
                  </button>
                ))}
              </div>
            </div>

            {results.length === 0 ? (
              <div style={S.empty}>
                <FolderOpen size={28} style={{ opacity: .3 }} />
                <p>{query ? `No documents match “${query}”.` : "This folder is empty."}</p>
                {can("editor") && <button style={S.ghost} onClick={() => setShowUpload(true)}><Upload size={14} /> Upload a document</button>}
              </div>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Name</th>
                    <th style={{ ...S.th, width: 110 }}>Type</th>
                    <th style={{ ...S.th, width: 150 }}>Owner</th>
                    <th style={{ ...S.th, width: 110 }}>Updated</th>
                    <th style={{ ...S.th, width: 70, textAlign: "right" }}>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(d => {
                    const fk = FILE_KINDS[d.kind];
                    return (
                      <tr key={d.id} style={S.tr} className="row" onClick={() => openDoc(d)}>
                        <td style={S.td}>
                          <div style={S.nameCell}>
                            <span style={{ ...S.fileIcon, background: fk.color + "18", color: fk.color }}>{kindIcon(d.kind, 15)}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={S.docTitle}>{d.title}{d.status === "draft" && <span style={S.draftTag}>Draft</span>}</div>
                              <div style={S.docSummary}>{d.summary}</div>
                            </div>
                          </div>
                        </td>
                        <td style={S.td}><span style={{ ...S.typeBadge, color: fk.color, background: fk.color + "12", borderColor: fk.color + "44" }}>{fk.label}</span></td>
                        <td style={{ ...S.td, color: "#6B5C4A" }}>{d.owner_name}</td>
                        <td style={{ ...S.td, color: "#6B5C4A" }}>{d.updated}</td>
                        <td style={{ ...S.td, textAlign: "right", color: "#6B5C4A" }}>{d.views}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </main>

      {showUpload && <UploadModal user={user} folders={folders} onClose={() => setShowUpload(false)}
        onUpload={async ({ doc, file }) => {
          await createDocument(doc, file);
          await log(doc.status === "draft" ? "saved draft" : "uploaded", doc.title);
          await reload();
          setShowUpload(false);
          flash(doc.status === "draft" ? "Draft saved." : "Document uploaded.");
        }} />}
      {showShare && <ShareModal doc={showShare} profiles={profiles} onClose={() => setShowShare(null)}
        onShare={async (profileId, name) => {
          await shareDocument(showShare.id, profileId);
          await log("shared", `${showShare.title} with ${name}`);
          const fresh = await fetchDocuments();
          setDocs(fresh);
          if (selected?.id === showShare.id) setSelected(fresh.find(x => x.id === showShare.id) || null);
          setShowShare(null);
          flash(`Shared with ${name}.`);
        }} />}
      {showCreateUser && <CreateUserModal onClose={() => setShowCreateUser(false)}
        onCreate={async (form) => {
          await adminCreateUser(form);
          await log("created user", `${form.name} (${form.role})`);
          setProfiles(await fetchProfiles());
          setAudit(await fetchAudit());
          setShowCreateUser(false);
          flash(`User ${form.name} created.`);
        }} />}
      {toast && <div style={S.toast}><Check size={15} /> {toast}</div>}
    </div>
  );
}

// ─── Document / SOP detail ───────────────────────────────────
function DocDetail({ doc, user, can, folderName, profiles, onBack, onShare, onPublish, onNewVersion }) {
  const fk = FILE_KINDS[doc.kind];
  const d = DEPTS.find(x => x.id === doc.dept);
  const [tab, setTab] = useState(doc.kind === "sop" ? "steps" : "overview");
  const [done, setDone] = useState({});
  const [verNote, setVerNote] = useState("");
  const [addingVer, setAddingVer] = useState(false);

  const tabs = doc.kind === "sop"
    ? [["steps", "Procedure"], ["versions", "History"], ["activity", "Sharing"]]
    : [["overview", "Overview"], ["versions", "Version history"], ["activity", "Sharing"]];

  return (
    <div style={S.detail}>
      <button style={S.back} onClick={onBack}><ArrowLeft size={15} /> Back</button>
      <div style={S.detailHead}>
        <span style={{ ...S.fileIconLg, background: fk.color + "18", color: fk.color }}>{kindIcon(doc.kind, 24)}</span>
        <div style={{ flex: 1 }}>
          <div style={S.crumb}>{folderName(doc.folder)} · {d.name}</div>
          <h1 style={S.detailTitle}>{doc.title}{doc.status === "draft" && <span style={S.draftTag}>Draft</span>}</h1>
          <div style={S.detailMeta}>
            <span><User size={13} /> {doc.owner}</span>
            <span><Clock size={13} /> {doc.updated}</span>
            <span><Eye size={13} /> {doc.views} views</span>
            {doc.kind !== "sop" && <span><HardDrive size={13} /> {doc.size}</span>}
            <span style={{ ...S.typeBadge, color: fk.color, background: fk.color + "12", borderColor: fk.color + "44" }}>{fk.label}</span>
          </div>
        </div>
      </div>

      <div style={S.detailTags}>{doc.tags.map(t => <span key={t} style={S.chip}><Tag size={10} /> {t}</span>)}</div>

      <div style={S.actionBar}>
        {doc.kind !== "sop" && <button style={S.ghost} onClick={async () => {
          if (!doc.storage_path) { alert("No file is attached to this document yet."); return; }
          try { const url = await getDownloadUrl(doc.storage_path); window.open(url, "_blank"); }
          catch { alert("Could not generate a download link."); }
        }}><Download size={14} /> Download</button>}
        <button style={S.ghost} onClick={onShare}><Share2 size={14} /> Share</button>
        {can("editor") && <button style={S.ghost} onClick={() => setAddingVer(v => !v)}><Upload size={14} /> New version</button>}
        {doc.status === "draft" && can("editor") && <button style={S.primary} onClick={onPublish}><CheckCircle2 size={14} /> Publish</button>}
      </div>

      {addingVer && (
        <div style={S.verForm}>
          <input style={S.input} value={verNote} onChange={e => setVerNote(e.target.value)} placeholder="What changed in this version?" />
          <button style={{ ...S.primary, opacity: verNote.trim() ? 1 : .5 }} onClick={() => { if (verNote.trim()) { onNewVersion(verNote.trim()); setVerNote(""); setAddingVer(false); } }}>Save version</button>
        </div>
      )}

      <div style={S.tabBar}>
        {tabs.map(([id, label]) => (
          <button key={id} style={{ ...S.tab, ...(tab === id ? S.tabActive : {}) }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "steps" && doc.steps && (
        <ol style={S.steps}>
          {doc.steps.map((st, i) => (
            <li key={i} style={{ ...S.step, ...(done[i] ? S.stepDone : {}) }}>
              <button style={{ ...S.stepNum, background: done[i] ? "#1F6F54" : d.color }} onClick={() => setDone(p => ({ ...p, [i]: !p[i] }))}>{done[i] ? <Check size={14} /> : i + 1}</button>
              <div>
                <span style={done[i] ? { textDecoration: "line-through", opacity: .55 } : {}}>{st.text}</span>
                {(st.sub || []).length > 0 && <ul style={S.subList}>{st.sub.map((s, j) => <li key={j} style={S.subItem}><CornerDownRight size={12} style={{ opacity: .5, flexShrink: 0, marginTop: 3 }} /> {s}</li>)}</ul>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {tab === "overview" && (
        <div style={S.preview}>
          <div style={S.previewIcon}>{kindIcon(doc.kind, 40)}</div>
          <p style={S.previewText}>{doc.summary}</p>
          <p style={S.previewNote}>Document preview is simulated in this demo. In production, {fk.label} files render inline or open in the associated viewer.</p>
        </div>
      )}

      {tab === "versions" && (
        <div style={S.verList}>
          {doc.versions.map((v, i) => (
            <div key={v.v} style={S.verRow}>
              <span style={{ ...S.verBadge, ...(i === 0 ? S.verCurrent : {}) }}>v{v.v}</span>
              <div style={{ flex: 1 }}>
                <div style={S.verNote}>{v.note}</div>
                <div style={S.verMeta}>{v.by_name} · {(v.created_at || "").slice(0, 10)}</div>
              </div>
              {i === 0 ? <span style={S.currentTag}>Current</span> : <button style={S.restoreBtn} onClick={() => alert("Demo: reverting to this version is simulated.")}><History size={12} /> Restore</button>}
            </div>
          ))}
        </div>
      )}

      {tab === "activity" && (
        <div style={S.shareBox}>
          <div style={S.shareHead}><Share2 size={14} /> Shared with</div>
          {(doc.sharedIds || []).length === 0 ? <p style={S.muted}>Not shared with anyone yet. Use the Share button to grant access.</p> : (
            <div style={S.shareList}>
              {doc.sharedIds.map(pid => {
                const u = (profiles || []).find(x => x.id === pid);
                return <div key={pid} style={S.shareItem}><span style={{ ...S.avatarSm, background: u ? DEPTS.find(d => d.id === u.dept).color : "#999" }}>{u?.initials || "?"}</span> {u?.name || "Unknown"} <span style={S.shareRole}>can view</span></div>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Upload modal (simulated) ────────────────────────────────
function UploadModal({ user, folders, onClose, onUpload }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("pdf");
  const [folder, setFolder] = useState(folders[0]?.id);
  const [tags, setTags] = useState("");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const isSop = kind === "sop";
  const ok = title.trim() && folder && (isSop ? steps.trim() : true);

  const pickFile = (f) => { if (f) { setFile(f); setTitle(t => t || f.name.replace(/\.[^.]+$/, "")); const ext = f.name.split(".").pop().toLowerCase(); if (["pdf"].includes(ext)) setKind("pdf"); else if (["doc", "docx"].includes(ext)) setKind("docx"); else if (["xls", "xlsx", "csv"].includes(ext)) setKind("xlsx"); else if (["jpg", "jpeg", "png", "gif"].includes(ext)) setKind("img"); } };

  const build = (status) => ({
    kind, title: title.trim(), folder_id: folder, dept: folders.find(f => f.id === folder).dept,
    size: isSop ? "—" : (file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "—"),
    owner_id: user.id, owner_name: user.name, status,
    tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    summary: summary.trim() || "",
    steps: isSop ? steps.split("\n").map(t => t.trim()).filter(Boolean).map(t => ({ text: t, sub: [] })) : null,
  });

  const submit = async (status) => {
    if (!ok || busy) return;
    setBusy(true);
    try { await onUpload({ doc: build(status), file: isSop ? null : file }); }
    catch (e) { alert("Upload failed: " + (e.message || "unknown error")); setBusy(false); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} className="pop" onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><h2 style={S.modalTitle}>Upload document</h2><button style={S.iconBtn} onClick={onClose}><X size={17} /></button></div>

        <div style={S.kindTabs}>
          {[["pdf", "File"], ["sop", "Procedure (SOP)"]].map(([k, label]) => (
            <button key={k} style={{ ...S.kindTab, ...((k === "sop") === isSop ? S.kindTabActive : {}) }} onClick={() => setKind(k === "sop" ? "sop" : "pdf")}>{label}</button>
          ))}
        </div>

        {!isSop && (
          <div style={{ ...S.dropZone, ...(dragOver ? S.dropOver : {}) }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" hidden onChange={e => pickFile(e.target.files[0])} />
            <Upload size={22} style={{ color: "#9C8B7A" }} />
            <div style={S.dropText}>{file ? file.name : <>Drag a file here or <span style={{ color: "#9A3412", fontWeight: 600 }}>browse</span></>}</div>
            <div style={S.dropHint}>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ready to upload` : "PDF, Word, Excel, or image"}</div>
          </div>
        )}

        <label style={S.lbl}>Title</label>
        <input style={S.input} value={title} onChange={e => setTitle(e.target.value)} placeholder={isSop ? "How to…" : "Document name"} />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={S.lbl}>Folder</label>
            <select style={S.input} value={folder} onChange={e => setFolder(e.target.value)}>
              {folders.map(f => <option key={f.id} value={f.id}>{f.parent_id ? "— " : ""}{f.name}</option>)}
            </select>
          </div>
          {!isSop && (
            <div style={{ flex: 1 }}>
              <label style={S.lbl}>Type</label>
              <select style={S.input} value={kind} onChange={e => setKind(e.target.value)}>
                {["pdf", "docx", "xlsx", "img"].map(k => <option key={k} value={k}>{FILE_KINDS[k].label}</option>)}
              </select>
            </div>
          )}
        </div>

        <label style={S.lbl}>Tags</label>
        <input style={S.input} value={tags} onChange={e => setTags(e.target.value)} placeholder="comma, separated" />
        <label style={S.lbl}>Summary</label>
        <input style={S.input} value={summary} onChange={e => setSummary(e.target.value)} placeholder="One line describing this document" />

        {isSop && (<><label style={S.lbl}>Steps (one per line)</label>
          <textarea style={{ ...S.input, minHeight: 100, resize: "vertical" }} value={steps} onChange={e => setSteps(e.target.value)} placeholder={"First do this…\nThen do that…"} /></>)}

        <div style={S.modalActions}>
          <button style={S.ghost} onClick={() => submit("draft")} disabled={busy}>Save as draft</button>
          <button style={{ ...S.primary, opacity: ok && !busy ? 1 : .5, pointerEvents: ok && !busy ? "auto" : "none" }} onClick={() => submit("published")}>{busy ? "Saving…" : (isSop ? "Publish" : "Upload")}</button>
        </div>
      </div>
    </div>
  );
}

function ShareModal({ doc, profiles, onClose, onShare }) {
  const candidates = (profiles || []).filter(u => !(doc.sharedIds || []).includes(u.id) && u.id !== doc.owner_id);
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} className="pop" onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><h2 style={S.modalTitle}>Share document</h2><button style={S.iconBtn} onClick={onClose}><X size={17} /></button></div>
        <p style={{ fontSize: 13, color: "#7A6A58", marginBottom: 14 }}>Grant view access to <strong>{doc.title}</strong>.</p>
        {candidates.length === 0 ? <p style={S.muted}>Already shared with everyone.</p> : candidates.map(u => {
          const d = DEPTS.find(x => x.id === u.dept);
          return (
            <button key={u.id} style={S.shareCandidate} className="loginUser" onClick={() => onShare(u.id, u.name)}>
              <span style={{ ...S.avatarSm, background: d.color }}>{u.initials}</span>
              <span style={{ flex: 1, textAlign: "left" }}><span style={S.loginName}>{u.name}</span><span style={S.loginRole}>{ROLE_LABEL[u.role]}</span></span>
              <Plus size={15} style={{ color: "#9A3412" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Users management (admin only) ───────────────────────────
function UsersScreen({ profiles, currentUser, onCreate }) {
  return (
    <div>
      <header style={S.header}>
        <div><div style={S.crumb}>Workspace</div><h1 style={S.h1}>Users</h1></div>
        <button style={S.primary} onClick={onCreate}><UserPlus size={15} /> Add user</button>
      </header>
      <p style={{ ...S.sub, marginTop: -8, marginBottom: 18 }}>Accounts are provisioned by administrators. New users are created with a role and department, then sign in with their email and password.</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Name</th>
            <th style={{ ...S.th, width: 140 }}>Role</th>
            <th style={{ ...S.th, width: 160 }}>Department</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map(u => {
            const d = DEPTS.find(x => x.id === u.dept);
            return (
              <tr key={u.id} style={{ borderBottom: `1px solid ${LINE}88` }}>
                <td style={S.td}>
                  <div style={S.nameCell}>
                    <span style={{ ...S.avatarSm, background: d?.color || "#999" }}>{u.initials}</span>
                    <div>
                      <div style={S.docTitle}>{u.name}{u.id === currentUser.id && <span style={S.youTag}>you</span>}</div>
                    </div>
                  </div>
                </td>
                <td style={S.td}><span style={{ ...S.roleBadge, ...roleBadgeStyle(u.role) }}>{ROLE_LABEL[u.role]}</span></td>
                <td style={{ ...S.td, color: "#6B5C4A" }}>{d?.name || u.dept}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function roleBadgeStyle(role) {
  if (role === "admin") return { color: "#9A3412", background: "#9A341212", borderColor: "#9A341244" };
  if (role === "editor") return { color: "#1D4E89", background: "#1D4E8912", borderColor: "#1D4E8944" };
  return { color: "#6B5C4A", background: "#6B5C4A12", borderColor: "#6B5C4A44" };
}

function CreateUserModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [dept, setDept] = useState("sourcing");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const ok = name.trim() && email.trim() && password.length >= 8;

  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr("");
    try {
      await onCreate({ name: name.trim(), email: email.trim(), password, role, dept });
    } catch (e) {
      setErr(e.message || "Could not create user.");
      setBusy(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} className="pop" onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><h2 style={S.modalTitle}>Add user</h2><button style={S.iconBtn} onClick={onClose}><X size={17} /></button></div>
        <p style={{ fontSize: 13, color: "#7A6A58", marginTop: -6, marginBottom: 8 }}>Create an account and assign its role. The person signs in with the email and password you set here.</p>

        <label style={S.lbl}>Full name</label>
        <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chidi Okafor" />

        <label style={S.lbl}>Email</label>
        <input style={S.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="person@company.com" />

        <label style={S.lbl}>Temporary password</label>
        <input style={S.input} type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={S.lbl}>Role</label>
            <select style={S.input} value={role} onChange={e => setRole(e.target.value)}>
              <option value="viewer">Viewer — read only</option>
              <option value="editor">Editor — upload & manage</option>
              <option value="admin">Administrator — full control</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.lbl}>Department</label>
            <select style={S.input} value={dept} onChange={e => setDept(e.target.value)}>
              {DEPTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {err && <p style={{ fontSize: 12.5, color: "#B91C1C", marginTop: 12, marginBottom: 0 }}>{err}</p>}

        <div style={S.modalActions}>
          <button style={S.ghost} onClick={onClose} disabled={busy}>Cancel</button>
          <button style={{ ...S.primary, opacity: ok && !busy ? 1 : .5, pointerEvents: ok && !busy ? "auto" : "none" }} onClick={submit}>{busy ? "Creating…" : "Create user"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────
function Dashboard({ docs, audit, folders }) {
  const published = docs.filter(d => d.status === "published");
  const totalViews = docs.reduce((a, d) => a + d.views, 0);
  const byKind = Object.keys(FILE_KINDS).map(k => ({ k, ...FILE_KINDS[k], n: docs.filter(d => d.kind === k).length })).filter(x => x.n > 0);
  const maxKind = Math.max(1, ...byKind.map(x => x.n));
  const top = [...published].sort((a, b) => b.views - a.views).slice(0, 5);
  const maxViews = Math.max(1, ...top.map(d => d.views));
  const drafts = docs.filter(d => d.status === "draft");
  const stale = docs.filter(d => d.updated < "2026-05-01");

  return (
    <div>
      <header style={S.header}><div><div style={S.crumb}>Workspace</div><h1 style={S.h1}>Dashboard</h1></div></header>
      <div style={S.statRow}>
        <Stat icon={<FileText size={16} />} label="Documents" value={docs.length} sub={`${published.length} published`} c="#9A3412" />
        <Stat icon={<Eye size={16} />} label="Total views" value={totalViews.toLocaleString()} sub="all time" c="#1D4E89" />
        <Stat icon={<FolderClosed size={16} />} label="Folders" value={folders.length} sub="across departments" c="#1F6F54" />
        <Stat icon={<AlertCircle size={16} />} label="Drafts" value={drafts.length} sub="unpublished" c="#A16207" />
      </div>
      <div style={S.dashGrid}>
        <div style={S.panel}>
          <div style={S.panelHead}><TrendingUp size={15} /> Most accessed</div>
          {top.map(d => (
            <div key={d.id} style={S.barRow}>
              <span style={S.barLabel}>{d.title}</span>
              <div style={S.barTrack}><div style={{ ...S.barFill, width: `${(d.views / maxViews) * 100}%`, background: FILE_KINDS[d.kind].color }} /></div>
              <span style={S.barVal}>{d.views}</span>
            </div>
          ))}
        </div>
        <div style={S.panel}>
          <div style={S.panelHead}><HardDrive size={15} /> Documents by type</div>
          {byKind.map(x => (
            <div key={x.k} style={S.barRow}>
              <span style={S.barLabel}>{x.label}</span>
              <div style={S.barTrack}><div style={{ ...S.barFill, width: `${(x.n / maxKind) * 100}%`, background: x.color }} /></div>
              <span style={S.barVal}>{x.n}</span>
            </div>
          ))}
        </div>
        <div style={{ ...S.panel, gridColumn: "1 / -1" }}>
          <div style={S.panelHead}><Activity size={15} /> Audit trail</div>
          {audit.slice(0, 8).map(a => (
            <div key={a.id} style={S.auditItem}>
              <span style={S.auditDot} />
              <span style={S.auditText}><strong>{a.actor_name}</strong> {a.action} <em>{a.target}</em></span>
              <span style={S.auditWhen}>{(a.created_at || "").slice(0, 16).replace("T", " ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, c }) {
  return <div style={S.stat}><div style={{ ...S.statIcon, background: c + "18", color: c }}>{icon}</div><div style={S.statVal}>{value}</div><div style={S.statLabel}>{label}</div><div style={S.statSub}>{sub}</div></div>;
}

// ─── Theme ───────────────────────────────────────────────────
const INK = "#241B12", PAPER = "#F3EEE4", CARD = "#FCFAF5", LINE = "#E0D6C4", MUTE = "#7A6A58", ACCENT = "#9A3412";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  .pop { animation: pop .18s ease; }
  @keyframes pop { from { transform: scale(.97); opacity: 0 } to { transform: scale(1); opacity: 1 } }
  .row { transition: background .12s ease; }
  .row:hover { background: #EFE8DA !important; }
  .uploadBtn:hover { background: ${ACCENT} !important; color: #fff !important; }
  .loginUser:hover { border-color: ${ACCENT}66 !important; background: #fff !important; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: ${ACCENT} !important; }
  ::placeholder { color: #B3A593; }
  ::-webkit-scrollbar { width: 9px; height: 9px; }
  ::-webkit-scrollbar-thumb { background: ${LINE}; border-radius: 9px; }
  [data-divider]::before, [data-divider]::after { content: ""; flex: 1; height: 1px; background: ${LINE}; }
`;

const S = {
  app: { display: "flex", height: "100vh", fontFamily: "'Inter',sans-serif", background: PAPER, color: INK, overflow: "hidden" },

  loginWrap: { flex: 1, display: "grid", placeItems: "center", background: `radial-gradient(circle at 25% 15%, #EBE1CF, ${PAPER})`, padding: 20 },
  loginCard: { background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: 30, width: 400, boxShadow: "0 24px 60px -24px rgba(36,27,18,.4)" },
  loginLede: { fontSize: 13.5, color: MUTE, lineHeight: 1.55, margin: "18px 0 20px" },
  loginPick: { fontSize: 11, fontWeight: 600, color: MUTE, textTransform: "uppercase", letterSpacing: .6, marginBottom: 10 },
  loginUser: { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 11, borderRadius: 11, border: `1px solid ${LINE}`, background: PAPER, cursor: "pointer", marginBottom: 8, fontFamily: "inherit", transition: "all .15s" },
  loginName: { display: "block", fontSize: 14, fontWeight: 600, color: INK },
  loginRole: { display: "block", fontSize: 12, color: MUTE, marginTop: 1 },
  loginNote: { fontSize: 11.5, color: "#A0917D", textAlign: "center", marginTop: 12 },
  loginErr: { fontSize: 12.5, color: "#B91C1C", marginTop: 10, marginBottom: 0 },
  loginDivider: { display: "flex", alignItems: "center", textAlign: "center", color: "#A0917D", fontSize: 11.5, margin: "20px 0 12px", gap: 10 },

  brandRow: { display: "flex", gap: 11, alignItems: "center", marginBottom: 18 },
  brandMark: { width: 38, height: 38, borderRadius: 10, background: ACCENT, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 },
  brandName: { fontFamily: "'Newsreader',serif", fontWeight: 700, fontSize: 21, letterSpacing: .2 },
  brandNameSm: { fontFamily: "'Newsreader',serif", fontWeight: 700, fontSize: 17 },
  brandSub: { fontSize: 10.5, color: MUTE, marginTop: 1, textTransform: "uppercase", letterSpacing: .5 },

  sidebar: { width: 264, flexShrink: 0, background: "#EAE1D1", borderRight: `1px solid ${LINE}`, padding: "20px 14px", display: "flex", flexDirection: "column" },
  uploadBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 0", borderRadius: 11, border: `1px solid ${ACCENT}`, background: ACCENT + "12", color: ACCENT, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 14, fontFamily: "inherit", transition: "all .15s" },
  navSection: { fontSize: 10, fontWeight: 700, color: "#A0917D", letterSpacing: .8, margin: "12px 8px 6px" },
  navItem: { display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", borderRadius: 9, border: "none", background: "transparent", color: INK, fontSize: 13.5, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%" },
  navActive: { background: CARD, boxShadow: "0 1px 4px rgba(36,27,18,.08)" },
  count: { marginLeft: "auto", fontSize: 11, color: MUTE, background: "#0000000d", borderRadius: 20, padding: "1px 8px" },
  folderTree: { overflowY: "auto", flex: 1, minHeight: 0 },
  folderLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userBox: { display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderTop: `1px solid ${LINE}`, marginTop: 8 },
  avatar: { width: 34, height: 34, borderRadius: 9, color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, flexShrink: 0 },
  avatarSm: { width: 26, height: 26, borderRadius: 7, color: "#fff", display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 700, flexShrink: 0 },
  userName: { fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { fontSize: 11, color: MUTE, display: "flex", alignItems: "center", gap: 3 },
  logout: { border: "none", background: "transparent", color: MUTE, cursor: "pointer", padding: 5 },

  main: { flex: 1, padding: "24px 30px", overflowY: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 },
  crumb: { fontSize: 12, color: MUTE, display: "flex", alignItems: "center", gap: 5, marginBottom: 5 },
  h1: { fontFamily: "'Newsreader',serif", fontSize: 27, fontWeight: 600, margin: 0, lineHeight: 1.1 },
  primary: { display: "inline-flex", alignItems: "center", gap: 7, background: ACCENT, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" },
  ghost: { display: "inline-flex", alignItems: "center", gap: 7, background: CARD, color: INK, border: `1px solid ${LINE}`, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  iconBtn: { border: "none", background: "transparent", color: MUTE, cursor: "pointer", display: "grid", placeItems: "center", padding: 3 },

  controls: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 },
  searchWrap: { display: "flex", alignItems: "center", gap: 10, background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 15px" },
  search: { flex: 1, border: "none", background: "transparent", fontSize: 14.5, color: INK, fontFamily: "inherit" },
  filters: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterChip: { fontSize: 12.5, color: MUTE, background: CARD, border: `1px solid ${LINE}`, borderRadius: 20, padding: "6px 13px", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
  filterActive: { background: INK, color: "#fff", borderColor: INK },

  table: { width: "100%", borderCollapse: "collapse", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left", fontSize: 11, fontWeight: 600, color: MUTE, textTransform: "uppercase", letterSpacing: .5, padding: "12px 16px", borderBottom: `1px solid ${LINE}`, background: "#F7F2E8" },
  tr: { cursor: "pointer", borderBottom: `1px solid ${LINE}88` },
  td: { padding: "12px 16px", fontSize: 13.5, verticalAlign: "middle" },
  nameCell: { display: "flex", gap: 12, alignItems: "center" },
  fileIcon: { width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", flexShrink: 0 },
  fileIconLg: { width: 52, height: 52, borderRadius: 13, display: "grid", placeItems: "center", flexShrink: 0 },
  docTitle: { fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  docSummary: { fontSize: 12, color: MUTE, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 420 },
  typeBadge: { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, border: "1px solid" },
  roleBadge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "1px solid" },
  youTag: { fontSize: 10.5, fontWeight: 600, color: "#1F6F54", background: "#1F6F5415", border: "1px solid #1F6F5440", padding: "1px 7px", borderRadius: 20, marginLeft: 8 },
  draftTag: { fontSize: 10.5, fontWeight: 600, color: "#A16207", background: "#A1620715", border: "1px solid #A1620740", padding: "1px 7px", borderRadius: 20 },

  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "70px 0", color: MUTE, fontSize: 14 },

  detail: { maxWidth: 760 },
  back: { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: MUTE, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 16, fontFamily: "inherit" },
  detailHead: { display: "flex", gap: 16, alignItems: "flex-start" },
  detailTitle: { fontFamily: "'Newsreader',serif", fontSize: 26, fontWeight: 600, margin: "2px 0 0", lineHeight: 1.15, display: "flex", alignItems: "center", gap: 10 },
  detailMeta: { display: "flex", gap: 16, fontSize: 12.5, color: MUTE, marginTop: 10, flexWrap: "wrap", alignItems: "center" },
  detailTags: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 },
  chip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: MUTE, background: "#0000000a", borderRadius: 6, padding: "3px 7px" },
  actionBar: { display: "flex", gap: 9, marginTop: 18, flexWrap: "wrap" },
  verForm: { display: "flex", gap: 9, marginTop: 12 },

  tabBar: { display: "flex", gap: 4, marginTop: 22, borderBottom: `1px solid ${LINE}`, marginBottom: 18 },
  tab: { border: "none", background: "transparent", padding: "9px 14px", fontSize: 13.5, fontWeight: 600, color: MUTE, cursor: "pointer", borderBottom: "2px solid transparent", fontFamily: "inherit" },
  tabActive: { color: ACCENT, borderBottomColor: ACCENT },

  steps: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 },
  step: { display: "flex", gap: 13, alignItems: "flex-start", fontSize: 14.5, lineHeight: 1.5, background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 16px" },
  stepDone: { background: "#F1F5F0", borderColor: "#1F6F5433" },
  stepNum: { flexShrink: 0, width: 26, height: 26, borderRadius: 8, color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, fontFamily: "'Newsreader',serif", border: "none", cursor: "pointer" },
  subList: { listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 5 },
  subItem: { display: "flex", gap: 7, fontSize: 13, color: MUTE, lineHeight: 1.45 },

  preview: { background: CARD, border: `1px solid ${LINE}`, borderRadius: 13, padding: "34px 28px", textAlign: "center" },
  previewIcon: { color: MUTE, display: "grid", placeItems: "center", marginBottom: 14 },
  previewText: { fontSize: 15, color: INK, lineHeight: 1.55, maxWidth: 520, margin: "0 auto 14px" },
  previewNote: { fontSize: 12.5, color: MUTE, fontStyle: "italic" },

  verList: { display: "flex", flexDirection: "column", gap: 8 },
  verRow: { display: "flex", alignItems: "center", gap: 13, background: CARD, border: `1px solid ${LINE}`, borderRadius: 11, padding: "12px 15px" },
  verBadge: { fontSize: 12, fontWeight: 700, color: MUTE, background: "#0000000a", borderRadius: 7, padding: "4px 9px", fontFamily: "'Newsreader',serif" },
  verCurrent: { color: "#fff", background: "#1F6F54" },
  verNote: { fontSize: 13.5, fontWeight: 500 },
  verMeta: { fontSize: 11.5, color: MUTE, marginTop: 2 },
  currentTag: { fontSize: 11, fontWeight: 600, color: "#1F6F54" },
  restoreBtn: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: MUTE, background: "transparent", border: `1px solid ${LINE}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" },

  shareBox: { background: CARD, border: `1px solid ${LINE}`, borderRadius: 13, padding: 18 },
  shareHead: { display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 13 },
  shareList: { display: "flex", flexDirection: "column", gap: 9 },
  shareItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 },
  shareRole: { marginLeft: "auto", fontSize: 11.5, color: MUTE },
  shareCandidate: { display: "flex", alignItems: "center", gap: 11, width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${LINE}`, background: PAPER, cursor: "pointer", marginBottom: 7, fontFamily: "inherit" },
  muted: { fontSize: 13, color: MUTE, fontStyle: "italic" },

  statRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 },
  stat: { background: CARD, border: `1px solid ${LINE}`, borderRadius: 13, padding: 16 },
  statIcon: { width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", marginBottom: 10 },
  statVal: { fontFamily: "'Newsreader',serif", fontSize: 26, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 12.5, fontWeight: 600, marginTop: 6 },
  statSub: { fontSize: 11.5, color: MUTE, marginTop: 2 },
  dashGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  panel: { background: CARD, border: `1px solid ${LINE}`, borderRadius: 13, padding: 18 },
  panelHead: { display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 14, fontFamily: "'Newsreader',serif" },
  barRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 11 },
  barLabel: { fontSize: 12.5, width: 150, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  barTrack: { flex: 1, height: 8, background: "#0000000d", borderRadius: 20, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 20 },
  barVal: { fontSize: 12, fontWeight: 600, color: MUTE, width: 34, textAlign: "right" },
  auditItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 13, borderBottom: `1px solid ${LINE}88` },
  auditDot: { width: 7, height: 7, borderRadius: 4, background: ACCENT, flexShrink: 0 },
  auditText: { flex: 1 }, auditWhen: { fontSize: 11, color: MUTE, flexShrink: 0 },

  overlay: { position: "fixed", inset: 0, background: "rgba(36,27,18,.44)", display: "grid", placeItems: "center", padding: 20, zIndex: 50, backdropFilter: "blur(2px)" },
  modal: { background: PAPER, borderRadius: 16, padding: 24, width: "100%", maxWidth: 500, border: `1px solid ${LINE}`, boxShadow: "0 24px 60px -20px rgba(36,27,18,.5)", maxHeight: "92%", overflowY: "auto" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontFamily: "'Newsreader',serif", fontSize: 21, fontWeight: 600, margin: 0 },
  kindTabs: { display: "flex", gap: 6, background: CARD, borderRadius: 10, padding: 4, border: `1px solid ${LINE}`, marginBottom: 16 },
  kindTab: { flex: 1, padding: "8px 0", border: "none", background: "transparent", borderRadius: 7, fontSize: 13, fontWeight: 600, color: MUTE, cursor: "pointer", fontFamily: "inherit" },
  kindTabActive: { background: ACCENT, color: "#fff" },
  dropZone: { display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "26px 20px", border: `2px dashed ${LINE}`, borderRadius: 12, cursor: "pointer", marginBottom: 6, background: CARD, transition: "all .15s" },
  dropOver: { borderColor: ACCENT, background: ACCENT + "0a" },
  dropText: { fontSize: 13.5, color: INK }, dropHint: { fontSize: 11.5, color: MUTE },
  lbl: { display: "block", fontSize: 12, fontWeight: 600, color: MUTE, marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: .5 },
  input: { width: "100%", border: `1px solid ${LINE}`, background: CARD, borderRadius: 10, padding: "11px 13px", fontSize: 14, color: INK, fontFamily: "inherit" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 },

  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: INK, color: "#fff", padding: "11px 18px", borderRadius: 11, fontSize: 13.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, zIndex: 60, boxShadow: "0 12px 30px -10px rgba(0,0,0,.4)" },
};