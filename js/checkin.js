// ============================================
//  checkin.js — Venue entry check logic
// ============================================

import { db, ref, get, showToast } from "./firebase.js";

const el = id => document.getElementById(id);

window.clearCI = () => { el("ci-result").style.display = "none"; };

window.doCheckin = async function () {
  const name = el("ci-name").value.trim().toLowerCase();
  const uid   = el("ci-uid").value.trim().toUpperCase();
  const out   = el("ci-result");

  if (!name || !uid) {
    showToast("⚠️ Enter both name and UID");
    return;
  }

  out.innerHTML = `<div class="ci-warn"><h3>🔍 Checking…</h3></div>`;
  out.style.display = "block";

  const snap = await get(ref(db, "registrations"));

  let found = null;

  if (snap.exists()) {
    snap.forEach(child => {
      const r = child.val();

      if (
        r.uid === uid &&
        r.cname.toLowerCase().includes(name)
      ) {
        found = r;
      }
    });
  }

  if (found && found.status === "approved") {
    out.innerHTML = `
      <div class="ci-ok">
        <h3>✅ Entry allowed!</h3>
        <p>Registration confirmed & payment verified.</p>
        <div class="ci-detail">
          <p><strong>${found.cname}</strong>, age ${found.age}</p>
          <p>UID: <strong>${found.uid}</strong></p>
          <p>School: <strong>${found.school}</strong></p>
          <p>Parent: <strong>${found.pname}</strong> · ${found.phone}</p>
          ${found.notes ? `<p>⚠️ <strong>${found.notes}</strong></p>` : ""}
        </div>
      </div>`;
  }

  else if (found) {
    out.innerHTML = `
      <div class="ci-warn">
        <h3>⚠️ Not approved</h3>
        <p>${found.cname} is registered but status is <strong>${found.status}</strong>.</p>
      </div>`;
  }

  else {
    out.innerHTML = `
      <div class="ci-fail">
        <h3>❌ Not found</h3>
        <p>No registration found for this Name + UID.</p>
      </div>`;
  }
};