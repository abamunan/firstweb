// ============================================================
//  auth.js  —  Munan.hub Authentication Logic
//  Firebase 10.x CDN (ESM) — GitHub Pages compatible
// ============================================================

import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, sendEmailVerification, GoogleAuthProvider,
         signInWithPopup, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE INIT ────────────────────────────────────────────
const firebaseConfig = {
    apiKey:            "AIzaSyDl0Cqhjj-X9SjwMrrTWi_lW4ADsI8Gnq0",
    authDomain:        "login-system-309fc.firebaseapp.com",
    projectId:         "login-system-309fc",
    storageBucket:     "login-system-309fc.firebasestorage.app",
    messagingSenderId: "509365590175",
    appId:             "1:509365590175:web:2a1de8ab7688a96853aaaa",
    measurementId:     "G-M6V63MYZN6"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── SESSION STATE ────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user && user.emailVerified) {
        localStorage.setItem('munan_auth', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        if (window.location.pathname.includes("login.html")) {
            window.location.href = "dashboard.html";
        }
    } else {
        localStorage.removeItem('munan_auth');
        localStorage.removeItem('isLoggedIn');
    }
});

// ── LOGIN WITH EMAIL & PASSWORD ──────────────────────────────
async function loginWithEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
        await signOut(auth);
        const err = new Error("Please verify your email before logging in.");
        err.code = "auth/email-not-verified";
        throw err;
    }
    localStorage.setItem('munan_auth', 'true');
    localStorage.setItem('isLoggedIn', 'true');
    window.location.href = "dashboard.html";
}

// ── SIGNUP WITH EMAIL & PASSWORD ─────────────────────────────
async function signupWithEmail(name, email, phone, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    await setDoc(doc(db, "users", cred.user.uid, "profile", "info"), {
        name, email, phone: phone || "", created: serverTimestamp(),
    });
    await signOut(auth);
    return "Verification email sent! Check your inbox.";
}

// ── GOOGLE SIGN-IN ───────────────────────────────────────────
async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred     = await signInWithPopup(auth, provider);
    await setDoc(doc(db, "users", cred.user.uid, "profile", "info"), {
        name: cred.user.displayName || "", email: cred.user.email,
        phone: "", created: serverTimestamp(),
    }, { merge: true });
    localStorage.setItem('munan_auth', 'true');
    localStorage.setItem('isLoggedIn', 'true');
    window.location.href = "dashboard.html";
}

// ── LOGOUT ───────────────────────────────────────────────────
async function logout() {
    await signOut(auth);
    localStorage.removeItem('munan_auth');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loggedInUser');
    window.location.href = "dashboard.html";
}

// ── RESEND VERIFICATION ──────────────────────────────────────
async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (user) await sendEmailVerification(user);
}

// Expose globally
window.MunanAuth = { loginWithEmail, signupWithEmail, loginWithGoogle, logout, resendVerificationEmail };
