// ════════════════════════════════════════════════════════════
// Client-side constants for ProcureDesk.
// All real data (users, folders, documents, versions, shares,
// audit) now lives in Supabase. This file only holds UI lookups
// and the demo login credentials.
// ════════════════════════════════════════════════════════════

export const DEPTS = [
  { id: "sourcing", name: "Sourcing", color: "#1F6F54" },
  { id: "contracts", name: "Contracts", color: "#9A3412" },
  { id: "vendors", name: "Vendor Mgmt", color: "#1D4E89" },
  { id: "finance", name: "Finance & AP", color: "#6B21A8" },
  { id: "compliance", name: "Compliance", color: "#A16207" },
];

export const ROLE_RANK = { viewer: 0, editor: 1, admin: 2 };
export const ROLE_LABEL = { viewer: "Viewer", editor: "Editor", admin: "Administrator" };

export const FILE_KINDS = {
  pdf: { label: "PDF", color: "#B91C1C", ext: "pdf" },
  docx: { label: "Word", color: "#1D4E89", ext: "docx" },
  xlsx: { label: "Excel", color: "#1F6F54", ext: "xlsx" },
  img: { label: "Image", color: "#6B21A8", ext: "jpg" },
  sop: { label: "SOP", color: "#A16207", ext: "sop" },
};

// One-tap demo logins. These map to real Supabase Auth accounts.
// Passwords are intentionally simple for demonstration only.
export const DEMO_LOGINS = [
  { name: "Asiribo Olawale", email: "adunni@procuredesk.demo", password: "Demo1234!", role: "admin", dept: "contracts", initials: "AA" },
  { name: "Tunde Bakare", email: "tunde@procuredesk.demo", password: "Demo1234!", role: "editor", dept: "sourcing", initials: "TB" },
  { name: "Folake Ogunsola", email: "folake@procuredesk.demo", password: "Demo1234!", role: "viewer", dept: "vendors", initials: "FO" },
];
