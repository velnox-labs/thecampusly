/* Campusly Firebase layer: Authentication + Firestore sync.
   Loaded by every page with <script type="module" src="campusly-firebase.js"></script>.
   The pages keep working from localStorage; this file signs people in, protects the app pages,
   and keeps each user's data in Firestore (users/{uid}) so it follows them across devices. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmvrN57LBpVaSmQvOgLSu4ei0UuCI4D4Q",
  authDomain: "thecampusly.firebaseapp.com",
  projectId: "thecampusly",
  storageBucket: "thecampusly.firebasestorage.app",
  messagingSenderId: "1095619752372",
  appId: "1:1095619752372:web:ceef37240fa36d40f482e1"
};
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);

/* Data that follows the user. Theme stays per device. */
const KEYS = ["campusly-profile-demo", "campusly-cgpa-demo", "campusly-more-prefs", "campusly-attendance-demo", "campusly-attendance-summary", "campusly-schedule-demo", "campusly-tasks-demo", "campusly-activity"];
const EPOCH = "campusly-epoch", UID_KEY = "campusly-uid", DIRTY = "campusly-dirty", SESSION = "campusly-demo-session";
const onAuthPage = /\/auth(\.html)?$/.test(location.pathname);
const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
const put = (k, v) => { try { rawSet.call(localStorage, k, v); } catch (e) {} };
const del = (k) => { try { rawRemove.call(localStorage, k); } catch (e) {} };
const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
let applying = false, timer = null, current = null, busy = 0;

const snapshot = () => { const o = {}; KEYS.forEach(k => { const v = get(k); if (v !== null) o[k] = v; }); return o; };
const wipeLocal = () => { applying = true; KEYS.forEach(del); del(DIRTY); applying = false; };

async function push() {
  if (!current) return;
  try {
    await setDoc(doc(db, "users", current.uid), { data: snapshot(), updatedAt: serverTimestamp(), email: current.email || "", name: current.displayName || "", epoch: +get(EPOCH) || 0 });
    del(DIRTY);
  } catch (e) { console.warn("Campusly sync failed, will retry:", e && e.code || e); }
}
function markDirty() { put(DIRTY, "1"); if (!current) return; clearTimeout(timer); timer = setTimeout(push, 1200); }
/* Any page that saves a synced key marks the data as changed; no page code needs to know about Firebase. */
Storage.prototype.setItem = function (k, v) { rawSet.call(this, k, v); if (this === localStorage && !applying && KEYS.indexOf(k) > -1) markDirty(); };
Storage.prototype.removeItem = function (k) { rawRemove.call(this, k); if (this === localStorage && !applying && KEYS.indexOf(k) > -1) markDirty(); };
window.addEventListener("pagehide", () => { if (current && get(DIRTY) === "1") push(); });
window.addEventListener("online", () => { if (current && get(DIRTY) === "1") push(); });   // upload what was saved offline

const DEFAULT_PROFILE = { college: "", branch: "", semester: 1, year: "", sid: "", email: "" };
function writeProfile(user, extra) {
  const p = Object.assign({}, DEFAULT_PROFILE, extra || {});
  p.name = String(p.name || user.displayName || (user.email || "Student").split("@")[0]).replace(/\s+/g, " ").trim().slice(0, 60) || "Student";
  p.email = String(p.email || user.email || "").slice(0, 80);
  applying = true; put("campusly-profile-demo", JSON.stringify({ v: 1, p })); applying = false;
}

function reloadOnce() {                                   // at most one reload per 5 s, so a page can never loop
  if (Date.now() - (+sessionStorage.getItem("cs-rl") || 0) < 5000) return false;
  sessionStorage.setItem("cs-rl", String(Date.now())); location.reload(); return true;
}
async function start(user) {
  current = user; put(SESSION, "1");
  const last = get(UID_KEY);
  let changed = false;
  if (get(UID_KEY) && get(UID_KEY) !== user.uid) { wipeLocal(); del(EPOCH); changed = true; }   // never show another person's data
  put(UID_KEY, user.uid);
  let snap;
  try { snap = await getDoc(doc(db, "users", user.uid)); } catch (e) { console.warn("Campusly is offline, using this device's data."); return; }
  const cloud = snap.exists() ? (snap.data() || {}) : null;
  if (!cloud || typeof cloud.epoch !== "number") {      // brand-new account, or an older test account: start completely clean
    wipeLocal(); put(EPOCH, String(Date.now())); writeProfile(user); await push(); reloadOnce(); return;
  }
  if (String(cloud.epoch) !== get(EPOCH)) {             // new device, or the data was deleted from another device
    wipeLocal(); put(EPOCH, String(cloud.epoch));
    const remoteAll = cloud.data || {}; applying = true; KEYS.forEach(k => { if (typeof remoteAll[k] === "string") put(k, remoteAll[k]); }); applying = false;
    reloadOnce(); return;
  }
  if (get(DIRTY) === "1") { await push(); if (changed) reloadOnce(); return; }   // unsent local changes win
  const remote = cloud.data || {}, local = snapshot();
  const extra = KEYS.filter(k => remote[k] === undefined && local[k] !== undefined);
  const differ = KEYS.filter(k => typeof remote[k] === "string" && remote[k] !== local[k]);
  if (!differ.length) { if (extra.length) await push(); if (changed) reloadOnce(); return; }
  applying = true; differ.forEach(k => put(k, remote[k])); applying = false;
  reloadOnce();
}

const reveal = () => { const g = document.getElementById("cs-guard"); if (g) g.remove(); };
onAuthStateChanged(auth, (user) => {
  if (user) {
    if (onAuthPage) { if (!busy) location.replace("index.html"); return; }
    reveal(); start(user);
  } else {
    current = null; del(SESSION);
    if (!onAuthPage) { location.replace("auth.html"); return; }
    reveal();
  }
});

const MESSAGES = {
  "auth/invalid-credential": "Email or password is incorrect.", "auth/wrong-password": "Email or password is incorrect.", "auth/user-not-found": "Email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.", "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
  "auth/weak-password": "Choose a stronger password (at least 8 characters).", "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "No internet connection. Check your network and try again.", "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
  "auth/cancelled-popup-request": "Google sign-in was cancelled.", "auth/popup-blocked": "Your browser blocked the Google pop-up. Allow pop-ups and try again.",
  "auth/operation-not-allowed": "This sign-in method is not enabled yet in the Firebase console.", "auth/unauthorized-domain": "This website address is not authorised in Firebase (Authentication > Settings > Authorised domains).",
  "auth/user-disabled": "This account has been disabled."
};
const guard = async (fn) => { busy++; try { return await fn(); } finally { busy--; } };
const api = {
  errText: (e) => MESSAGES[e && e.code] || "Something went wrong. Please try again.",
  login: (email, pass, remember) => guard(async () => {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, pass);
  }),
  google: () => guard(async () => { await setPersistence(auth, browserLocalPersistence); await signInWithPopup(auth, new GoogleAuthProvider()); }),
  register: (f) => guard(async () => {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, f.email, f.pass);
    try { await updateProfile(cred.user, { displayName: f.name }); } catch (e) {}
    current = cred.user; wipeLocal(); put(UID_KEY, cred.user.uid); put(SESSION, "1"); put(EPOCH, String(Date.now()));
    writeProfile(cred.user, { name: f.name, email: f.email, sid: /^[A-Za-z0-9\-_\/]{1,30}$/.test(f.roll || "") ? f.roll : "" });
    await push();
  }),
  resetData: async () => {                              // deletes every saved item, here and in the cloud
    if (!current) return; clearTimeout(timer); wipeLocal(); put(EPOCH, String(Date.now())); writeProfile(current); await push(); location.reload();
  },
  reset: (email) => guard(() => sendPasswordResetEmail(auth, email)),
  logout: async () => { clearTimeout(timer); if (current && get(DIRTY) === "1") await push(); try { await signOut(auth); } catch (e) {} del(SESSION); current = null; location.href = "auth.html"; }
};
window.CampuslyAuth = api;
if (window.CS) window.CS.logout = api.logout;
