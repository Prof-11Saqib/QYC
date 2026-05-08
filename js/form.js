// ============================================
//  form.js — Registration form logic
//  Handles: step nav, validation, firebase submit
// ============================================

import { db, storage, ref, set, push, get, sref, uploadBytes, getDownloadURL, showToast } from "./firebase.js";

let uploadedFile = null;

// ── DOM helpers ─────────────────────────────
const g   = id => document.getElementById(id)?.value.trim() ?? "";
const el  = id => document.getElementById(id);
const err = (id, msg) => {
  const inp = el(id);
  const errEl = el(id + "-err");
  if (inp)   inp.classList.add("error");
  if (errEl) { errEl.textContent = msg; errEl.classList.add("show"); }
};
const clearErr = id => {
  const inp = el(id);
  const errEl = el(id + "-err");
  if (inp)   inp.classList.remove("error");
  if (errEl) errEl.classList.remove("show");
};
const clearAllErrors = () => {
  ["f-pname","f-phone","f-emergency","f-cname","f-age","f-school"].forEach(clearErr);
};

// ── Live inline validation on blur ──────────
document.addEventListener("DOMContentLoaded", () => {

  // Phone: clear error on input
  el("f-phone")?.addEventListener("input", () => clearErr("f-phone"));
  el("f-age")?.addEventListener("input",   () => clearErr("f-age"));

  // Load settings for payment page
  loadSettings();
});

// ── Validation rules ────────────────────────
function validateStep1() {
  clearAllErrors();
  let valid = true;

  // Parent name
  if (!g("f-pname")) {
    err("f-pname", "Parent name is required"); valid = false;
  }

  // Phone: must be exactly 10 digits after stripping non-digits
  const rawPhone = g("f-phone").replace(/\D/g, "");
  if (!rawPhone) {
    err("f-phone", "Phone number is required"); valid = false;
  } else if (rawPhone.length !== 10) {
    err("f-phone", "Must be exactly 10 digits (e.g. 98765 43210)"); valid = false;
  }

  // Emergency contact
  const rawEmergency = g("f-emergency").replace(/\D/g, "");
  if (!rawEmergency) {
    err("f-emergency", "Emergency contact is required"); valid = false;
  } else if (rawEmergency.length !== 10) {
    err("f-emergency", "Must be exactly 10 digits"); valid = false;
  }

  // Child name
  if (!g("f-cname")) {
    err("f-cname", "Child's name is required"); valid = false;
  }

  // Age: must be between 14 and 24
  const age = parseInt(g("f-age"));
  if (!g("f-age")) {
    err("f-age", "Age is required"); valid = false;
  } else if (isNaN(age) || age < 14 || age > 24) {
    err("f-age", "Age must be between 14 and 24"); valid = false;
  }

  // School
  if (!g("f-school")) {
    err("f-school", "School name is required"); valid = false;
  }

  return valid;
}

// ── Step navigation ─────────────────────────
window.goStep2 = async function () {
  if (!validateStep1()) {
    showToast("⚠️ Please fix the errors above");
    return;
  }
  await loadSettings(); // refresh UPI/amount display
  el("step1").style.display = "none";
  el("step2").style.display = "block";
};

window.backStep1 = function () {
  el("step2").style.display = "none";
  el("step1").style.display = "block";
};

// ── File upload ──────────────────────────────
window.handleFile = function (input) {
  if (input.files && input.files[0]) {
    uploadedFile = input.files[0];
    el("upload-label").textContent = "✅ " + uploadedFile.name;
    el("upload-zone").classList.add("has-file");
    el("submit-btn").disabled = false;
  }
};
// Generate random 4-char alphanumeric code
function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Ensure unique code
function generateFastUID() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const rand = () => chars[Math.floor(Math.random() * chars.length)];

  // mix time + randomness → practically collision-free for your scale
  const t = Date.now().toString(36).toUpperCase().slice(-2);

  return rand() + rand() + t + rand(); // 4 chars
}

// async function getUniqueCode() {
//   let code;
//   let exists = true;

//   while (exists) {
//     code = generateCode();

//     const snapshot = await get(
//       ref(db, `registrations_by_uid/${code}`)
//     );

//     exists = snapshot.exists();
//   }

//   return code;
// }
// ── Submit registration ──────────────────────
window.submitReg = async function () {
  const btn = el("submit-btn");
  btn.disabled = true;
  btn.textContent = "⏳ Submitting…";

  try {
    // Upload screenshot to Firebase Storage
    let screenshotURL = "";
    if (uploadedFile) {
      const storageRef = sref(storage, "screenshots/" + Date.now() + "_" + uploadedFile.name);
      await uploadBytes(storageRef, uploadedFile);
      screenshotURL = await getDownloadURL(storageRef);
    }
    const uid = await generateFastUID();

    // Build registration object
    const reg = {
      uid,
      pname:         g("f-pname"),
      phone:         "+91" + g("f-phone").replace(/\D/g, ""),  // store with country code
      email:         g("f-email"),
      emergency:     "+91" + g("f-emergency").replace(/\D/g, ""),
      cname:         g("f-cname"),
      age:           parseInt(g("f-age")),
      school:        g("f-school"),
      notes:         g("f-notes"),
      screenshotURL,
      status:        "pending",
      ts:            Date.now()
    };

    // Save to Firebase Realtime Database
    await push(ref(db, "registrations"), reg);
    await set(ref(db, `registrations_by_uid/${uid}`), true);

    // Show success
    el("conf-child").textContent = reg.cname;
    el("conf-phone").textContent = reg.phone;
    el("conf-uid").textContent = reg.uid;
    el("step2").style.display = "none";
    el("step3").style.display = "block";

  } catch (e) {
    showToast("❌ Error: " + e.message, 5000);
    btn.disabled = false;
    btn.textContent = "🎉 Submit registration";
  }
};

// ── Reset form ───────────────────────────────
window.resetForm = function () {
  ["f-pname","f-phone","f-email","f-emergency","f-cname","f-age","f-school","f-notes"]
    .forEach(id => { if (el(id)) el(id).value = ""; });
  clearAllErrors();
  uploadedFile = null;
  el("upload-label").textContent = "Tap to upload payment screenshot";
  el("upload-zone").classList.remove("has-file");
  el("submit-btn").disabled = true;
  el("step3").style.display = "none";
  el("step1").style.display = "block";
};

// ── Load UPI/amount settings ─────────────────

async function loadSettings() {
  try {
    const snap = await get(ref(db, "settings"));

    if (snap.exists()) {

      const s = snap.val();

      const upiEl    = el("disp-upi");
      const amountEl = el("disp-amount");
      const qrImg    = el("qr-img");

      if (upiEl)
        upiEl.textContent = "UPI ID: " + (s.upi || "—");

      if (amountEl)
        amountEl.textContent = s.amount ? "₹" + s.amount : "₹—";

      // Show QR image
      if (qrImg && s.qrURL) {
        qrImg.src = s.qrURL;
        qrImg.style.display = "block";
      }
    }

  } catch(e) {
    console.error(e);
  }
}

