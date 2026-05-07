// ============================================
//  admin.js — Admin dashboard logic
//  Uses Firebase Authentication (real login)
// ============================================

import {
  db, auth, storage,
  ref, set, onValue, update, get,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  sref, uploadBytes, getDownloadURL,
  showToast
} from "./firebase.js";

let allRegs    = [];
let unsubRegs  = null;

const el = id => document.getElementById(id);

// ── Auth state listener ───────────────────────
// Runs on page load — if already logged in, show panel
onAuthStateChanged(auth, user => {
  if (user) {
    showPanel();
  } else {
    showGate();
  }
});

// ── Login ─────────────────────────────────────
window.adminLogin = async function () {
  const email    = el("admin-email").value.trim();
  const password = el("admin-password").value.trim();
  const errEl    = el("login-error");
  const btn      = el("login-btn");

  if (!email || !password) {
    errEl.textContent = "Please enter email and password.";
    errEl.style.display = "block";
    return;
  }

  btn.disabled    = true;
  btn.textContent = "⏳ Logging in…";
  errEl.style.display = "none";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will fire and call showPanel()
  } catch (e) {
    btn.disabled    = false;
    btn.textContent = "Login →";
    errEl.textContent = friendlyError(e.code);
    errEl.style.display = "block";
  }
};

// ── Logout ────────────────────────────────────
window.adminLogout = async function () {
  if (unsubRegs) { unsubRegs(); unsubRegs = null; }
  await signOut(auth);
  // onAuthStateChanged fires → showGate()
};

// ── Show / hide panels ────────────────────────
function showPanel() {
  el("admin-gate").style.display  = "none";
  el("admin-panel").style.display = "block";
  startLiveListener();
  loadSettingsIntoForm();
}
function showGate() {
  el("admin-gate").style.display  = "block";
  el("admin-panel").style.display = "none";
  if (el("admin-email"))    el("admin-email").value    = "";
  if (el("admin-password")) el("admin-password").value = "";
}

// ── Friendly error messages ───────────────────
function friendlyError(code) {
  switch (code) {
    case "auth/invalid-email":        return "❌ Invalid email address.";
    case "auth/user-not-found":       return "❌ No admin account found.";
    case "auth/wrong-password":       return "❌ Wrong password.";
    case "auth/invalid-credential":   return "❌ Wrong email or password.";
    case "auth/too-many-requests":    return "⚠️ Too many attempts. Try again later.";
    default:                          return "❌ Login failed. Try again.";
  }
}

// ── Settings ──────────────────────────────────

window.saveSettings = async function () {

  let qrURL = "";

  const qrFile = el("set-qr").files[0];

  // Upload QR if selected
  if (qrFile) {
    const qrRef = sref(storage, "settings/qr_" + Date.now());
    await uploadBytes(qrRef, qrFile);
    qrURL = await getDownloadURL(qrRef);
  }

  const existing = await get(ref(db, "settings"));
  const oldData = existing.exists() ? existing.val() : {};

  const s = {
    upi:    el("set-upi").value.trim(),
    amount: el("set-amount").value.trim(),
    walink: el("set-walink").value.trim(),
    qrURL:  qrURL || oldData.qrURL || ""
  };

  await set(ref(db, "settings"), s);

  showToast("✅ Settings saved!");
};


// ── Live registrations listener ───────────────
function startLiveListener() {
  if (unsubRegs) { unsubRegs(); unsubRegs = null; }
  unsubRegs = onValue(ref(db, "registrations"), snap => {
    console.log("🔥 snapshot received, count:", snap.numChildren());
    allRegs = [];
    if (snap.exists()) {
      snap.forEach(child => allRegs.push({ fbKey: child.key, ...child.val() }));
      allRegs.sort((a, b) => b.ts - a.ts);
    }
    updateStats();
    const q = el("search-inp")?.value || "";
    renderRegs(q ? filterList(q) : allRegs);
  });
}

// ── Stats ─────────────────────────────────────
function updateStats() {
  el("st-total").textContent    = allRegs.length;
  el("st-pending").textContent  = allRegs.filter(r => r.status === "pending").length;
  el("st-approved").textContent = allRegs.filter(r => r.status === "approved").length;
}

// ── Render list ───────────────────────────────
function initials(n="") {
  return n
  .split(" ")
  .map(w=> w[0] || "").join("").toUpperCase().slice(0,2);
}
function ago(ts) {
  const d = Date.now() - ts;
  if (d < 60000)    return "just now";
  if (d < 3600000)  return Math.floor(d / 60000) + "m ago";
  if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
  return new Date(ts).toLocaleDateString("en-IN");
}

function renderRegs(list) {
  const container = el("reg-list");
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">📭 No registrations yet</div>';
    return;
  }
  container.innerHTML = list.map(r => `
    <div class="reg-item">
      <div class="reg-av">${initials(r.cname)}</div>
      <div class="reg-info">
        <div class="reg-name">${r.cname || "Unknown"}, ${r.age || "—"}</div>
        <div class="reg-sub">${r.pname || "Unknown"} · ${r.phone || "—"} · ${ago(r.ts)}</div>
      </div>
      <span class="badge badge-${r.status}">${r.status}</span>
      <div style="display:flex;gap:5px">
        <button class="btn-xs" onclick="openModal('${r.fbKey}')">View</button>
        ${r.status === "pending"
          ? `<button class="btn-xs btn-xs-green" onclick="approveReg('${r.fbKey}')">Approve</button>`
          : ""}
      </div>
    </div>`).join("");
}

// ── Search ────────────────────────────────────
function filterList(q) {
  const l = q.toLowerCase();
  return allRegs.filter(r =>
    (r.cname || "").toLowerCase().includes(l)||
    (r.pname || "").toLowerCase().includes(l) ||
    (r.school || "").toLowerCase().includes(l)
  );
}
window.filterRegs = q => renderRegs(q ? filterList(q) : allRegs);

// ── Approve ───────────────────────────────────
window.approveReg = async function (key) {
  const r = allRegs.find(x => x.fbKey === key);
  if (!r) return;
  await update(ref(db, "registrations/" + key), { status: "approved" });
  const snap = await get(ref(db, "settings"));
  const lnk  = snap.exists() ? (snap.val().walink || "#") : "#";
  showToast("✅ Approved! Send WhatsApp invite to " + r.phone, 4000);
  closeModal();
};

// ── Reject ────────────────────────────────────
window.rejectReg = async function (key) {
  const r = allRegs.find(x => x.fbKey === key);
  if (!r || !confirm("Reject registration for " + r.cname + "?")) return;
  await update(ref(db, "registrations/" + key), { status: "rejected" });
  showToast("🗑️ Registration rejected");
  closeModal();
};

// ── Modal ─────────────────────────────────────
window.openModal = function (key) {
  const r = allRegs.find(x => x.fbKey === key);
  if (!r) return;
  el("modal-body").innerHTML = `
    <div class="d-row"><span class="d-key">Child</span><span class="d-val">${r.cname}, age ${r.age}</span></div>
    <div class="d-row"><span class="d-key">School</span><span class="d-val">${r.school || "—"}</span></div>
    <div class="d-row"><span class="d-key">Parent</span><span class="d-val">${r.pname}</span></div>
    <div class="d-row"><span class="d-key">Phone</span><span class="d-val">${r.phone}</span></div>
    <div class="d-row"><span class="d-key">Email</span><span class="d-val">${r.email || "—"}</span></div>
    <div class="d-row"><span class="d-key">Emergency</span><span class="d-val">${r.emergency}</span></div>
    <div class="d-row"><span class="d-key">Status</span><span class="d-val"><span class="badge badge-${r.status}">${r.status}</span></span></div>
    <div class="d-row"><span class="d-key">Registered</span><span class="d-val">${new Date(r.ts).toLocaleString("en-IN")}</span></div>
    ${r.notes ? `<p style="font-size:12px;color:#6e7681;margin:10px 0 4px;font-weight:700;text-transform:uppercase">⚠️ Notes</p><div class="notes-box">${r.notes}</div>` : ""}
    <p style="font-size:12px;color:#6e7681;margin:10px 0 4px;font-weight:700;text-transform:uppercase">Payment screenshot</p>
    <div class="ss-box">${r.screenshotURL
      ? `<a href="${r.screenshotURL}" target="_blank" style="color:#56d364;font-weight:600">📎 View screenshot →</a>`
      : "No screenshot uploaded"}</div>`;
  el("modal-actions").innerHTML = `
    ${r.status === "pending"  ? `<button class="m-approve" onclick="approveReg('${r.fbKey}')">✅ Approve</button>` : ""}
    ${r.status !== "rejected" ? `<button class="m-reject"  onclick="rejectReg('${r.fbKey}')">Reject</button>`    : ""}
    <button class="m-close" onclick="closeModal()">Close</button>`;
  el("modal").classList.add("open");
};
window.closeModal = () => el("modal").classList.remove("open");

// ── Export CSV ────────────────────────────────
window.exportCSV = function () {
  if (!allRegs.length) { showToast("No data to export"); return; }
  const cols = ["Name","Age","School","Parent","Phone","Email","Emergency","Notes","Status","Registered"];
  const rows = allRegs.map(r => [
    r.cname, r.age, r.school, r.pname, r.phone,
    r.email || "", r.emergency, r.notes || "", r.status,
    new Date(r.ts).toLocaleString("en-IN")
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [cols.join(","), ...rows].join("\n");
  const a   = document.createElement("a");
  a.href     = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = "qyc-registrations-" + Date.now() + ".csv";
  a.click();
  showToast("📥 CSV downloaded!");
};
async function loadSettingsIntoForm() {
  try {
    const snap = await get(ref(db, "settings"));
    if (snap.exists()) {
      const s = snap.val();
      if (el("set-upi"))    el("set-upi").value    = s.upi    || "";
      if (el("set-amount")) el("set-amount").value = s.amount || "";
      if (el("set-walink")) el("set-walink").value = s.walink || "";
    }
  } catch(e) {
    console.error("Failed to load settings:", e);
  }
}