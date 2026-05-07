// ============================================
//  firebase.js — Firebase init (shared)
//  Imported by form.js, admin.js, checkin.js
// ============================================

import { initializeApp }                                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, update, get }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getStorage, ref as sref, uploadBytes, getDownloadURL }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCI_XLi6kO36CvpKvVBCu2Ijjk5Vr-wka8",
  authDomain:        "qyc-camp.firebaseapp.com",
  databaseURL:       "https://qyc-camp-default-rtdb.firebaseio.com",
  projectId:         "qyc-camp",
  storageBucket:     "qyc-camp.firebasestorage.app",
  messagingSenderId: "803525326616",
  appId:             "1:803525326616:web:74a264acf74d47152d906d"
};

const app     = initializeApp(firebaseConfig);
const db      = getDatabase(app);
const storage = getStorage(app);
const auth    = getAuth(app);

// ── Shared toast ──────────────────────────────
export function showToast(msg, ms = 2800) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), ms);
}

export {
  db, storage, auth,
  ref, push, set, onValue, update, get,
  sref, uploadBytes, getDownloadURL,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
};