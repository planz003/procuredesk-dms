import { supabase } from "./supabase.js";

// ── Auth 
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSessionProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", session.user.id).single();
  if (error) return null;
  return data;
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_e, session) => cb(session));
}

// ── Reads 
export async function fetchProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function fetchFolders() {
  const { data, error } = await supabase.from("folders").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function fetchDocuments() {
  // RLS automatically filters: viewers only see published + shared docs.
  const { data, error } = await supabase
    .from("documents")
    .select("*, document_versions(*), document_shares(shared_with)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(normalizeDoc);
}

export async function fetchAudit() {
  const { data, error } = await supabase
    .from("audit_log").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data;
}

function normalizeDoc(d) {
  const versions = (d.document_versions || []).sort((a, b) => b.v - a.v);
  return {
    ...d,
    updated: (d.updated_at || "").slice(0, 10),
    versions,
    sharedIds: (d.document_shares || []).map((s) => s.shared_with),
  };
}

// ── Writes ───────────────────────────────────────────────────
export async function logAudit(actor_name, action, target) {
  await supabase.from("audit_log").insert({ actor_name, action, target });
}

export async function incrementViews(id) {
  await supabase.rpc("increment_views", { doc: id });
}

export async function createDocument(doc, file) {
  let storage_path = null;
  if (file) {
    storage_path = `${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(storage_path, file);
    if (upErr) throw upErr;
  }
  const { data, error } = await supabase.from("documents")
    .insert({ ...doc, storage_path }).select().single();
  if (error) throw error;

  // first version row
  await supabase.from("document_versions").insert({
    document_id: data.id, v: 1, note: "Initial upload", by_name: doc.owner_name, storage_path,
  });
  return data;
}

export async function publishDocument(id) {
  const { error } = await supabase.from("documents")
    .update({ status: "published", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function addVersion(doc, note, by_name, file) {
  let storage_path = doc.storage_path || null;
  if (file) {
    storage_path = `${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(storage_path, file);
    if (upErr) throw upErr;
  }
  const nextV = (doc.versions[0]?.v || 0) + 1;
  const { error } = await supabase.from("document_versions").insert({
    document_id: doc.id, v: nextV, note, by_name, storage_path,
  });
  if (error) throw error;
  await supabase.from("documents")
    .update({ updated_at: new Date().toISOString(), storage_path }).eq("id", doc.id);
  return nextV;
}

export async function shareDocument(document_id, shared_with) {
  const { error } = await supabase.from("document_shares")
    .insert({ document_id, shared_with });
  if (error && error.code !== "23505") throw error; // ignore duplicate
}

export async function getDownloadUrl(storage_path) {
  if (!storage_path) return null;
  const { data, error } = await supabase.storage
    .from("documents").createSignedUrl(storage_path, 60);
  if (error) throw error;
  return data.signedUrl;
}
