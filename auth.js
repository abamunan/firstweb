// ============================================================
//  auth.js  —  Munan.hub Authentication Logic
//  Firebase 10.x CDN (ESM) — GitHub Pages compatible
// ============================================================

import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, sendEmailVerification, GoogleAuthProvider,
         signInWithPopup, onAuthStateChanged, fetchSignInMethodsForEmail,
         sendPasswordResetEmail }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, Timestamp }
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
    try {
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
    } catch (error) {
        if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found") {
            // Check if this email was registered via Google instead
            try {
                const methods = await fetchSignInMethodsForEmail(auth, email);
                if (methods.includes("google.com") && !methods.includes("password")) {
                    const err = new Error("This email is registered with Google. Please use the 'Continue with Google' button to log in.");
                    err.code = "auth/wrong-provider";
                    throw err;
                }
            } catch (innerErr) {
                if (innerErr.code === "auth/wrong-provider") throw innerErr;
                // fetchSignInMethodsForEmail itself failed — fall through to original error
            }
        }
        throw error;
    }
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
    window.location.href = "login.html";
}

// ── RESEND VERIFICATION ──────────────────────────────────────
async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (user) await sendEmailVerification(user);
}

// ── RESET PASSWORD (with 5-min cross-device cooldown) ────────
const RESET_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function emailToKey(email) {
    // Firestore doc IDs can't contain certain chars; encode safely
    return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// Returns: { allowed: true } or { allowed: false, remainingMs: number }
async function checkResetCooldown(email) {
    const key = emailToKey(email);
    try {
        const ref  = doc(db, "passwordResetCooldowns", key);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const lastSent = snap.data().lastSent;
            const lastMs   = lastSent?.toMillis ? lastSent.toMillis() : 0;
            const elapsed  = Date.now() - lastMs;
            if (elapsed < RESET_COOLDOWN_MS) {
                return { allowed: false, remainingMs: RESET_COOLDOWN_MS - elapsed };
            }
        }
        return { allowed: true };
    } catch (e) {
        // If Firestore check fails for any reason, don't block the user
        console.error("Cooldown check failed:", e);
        return { allowed: true };
    }
}

async function resetPassword(email) {
    // First, check if this email is even registered
    let methods = [];
    try {
        methods = await fetchSignInMethodsForEmail(auth, email);
    } catch (e) {
        // If the lookup itself fails, surface a generic error
        const err = new Error("Could not verify this email right now. Please try again.");
        err.code = "auth/lookup-failed";
        throw err;
    }

    if (methods.length === 0) {
        const err = new Error("No account found with this email.");
        err.code = "auth/user-not-found";
        throw err;
    }

    if (!methods.includes("password")) {
        // Account exists but was created via Google — no password to reset
        const err = new Error("This email is registered with Google. Please use the 'Continue with Google' button to log in.");
        err.code = "auth/wrong-provider";
        throw err;
    }

    const status = await checkResetCooldown(email);
    if (!status.allowed) {
        const err = new Error("COOLDOWN");
        err.code = "auth/reset-cooldown";
        err.remainingMs = status.remainingMs;
        throw err;
    }

    await sendPasswordResetEmail(auth, email);

    // Record the timestamp so other devices also see the cooldown
    try {
        const key = emailToKey(email);
        await setDoc(doc(db, "passwordResetCooldowns", key), {
            lastSent: serverTimestamp(),
        });
    } catch (e) {
        console.error("Failed to record cooldown:", e);
    }
}

// Lets the UI show a live countdown without re-sending
async function getResetCooldownRemaining(email) {
    const status = await checkResetCooldown(email);
    return status.allowed ? 0 : status.remainingMs;
}

// Expose globally
window.MunanAuth = { loginWithEmail, signupWithEmail, loginWithGoogle, logout, resendVerificationEmail, resetPassword, getResetCooldownRemaining };
