// ============================================================
//  auth.js  —  Munan.hub Authentication Logic
//  Firebase 10.x CDN (ESM) — works on GitHub Pages
// ============================================================

import { auth, db } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ── SESSION STATE ────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user && user.emailVerified) {
        localStorage.setItem('munan_auth', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        // If already on login page, redirect away
        if (window.location.pathname.includes("login.html")) {
            window.location.href = "index.html";
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
    window.location.href = "index.html";
}


// ── SIGNUP WITH EMAIL & PASSWORD ─────────────────────────────
async function signupWithEmail(name, email, phone, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Send verification email
    await sendEmailVerification(cred.user);

    // Save user profile to Firestore
    await setDoc(doc(db, "users", cred.user.uid, "profile", "info"), {
        name,
        email,
        phone:   phone || "",
        created: serverTimestamp(),
    });

    // Sign out immediately — must verify email first
    await signOut(auth);

    return "Verification email sent! Check your inbox.";
}


// ── GOOGLE SIGN-IN ───────────────────────────────────────────
async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred     = await signInWithPopup(auth, provider);

    // Upsert Firestore profile
    await setDoc(doc(db, "users", cred.user.uid, "profile", "info"), {
        name:    cred.user.displayName || "",
        email:   cred.user.email,
        phone:   "",
        created: serverTimestamp(),
    }, { merge: true });

    localStorage.setItem('munan_auth', 'true');
    localStorage.setItem('isLoggedIn', 'true');
    window.location.href = "index.html";
}


// ── LOGOUT ───────────────────────────────────────────────────
async function logout() {
    await signOut(auth);
    localStorage.removeItem('munan_auth');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loggedInUser');
    window.location.href = "index.html";
}


// ── RESEND VERIFICATION EMAIL ────────────────────────────────
async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (user) await sendEmailVerification(user);
}


// Expose globally (no bundler)
window.MunanAuth = {
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    logout,
    resendVerificationEmail
};
