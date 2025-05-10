// authService.js

// Import các hàm và instance cần thiết từ firebaseService
import {
    auth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from './firebaseService.js';

// Biến cục bộ để lưu trữ người dùng hiện tại
let currentUserInternal = null;

// DOM Elements liên quan đến xác thực (sẽ được gán trong initAuthService)
let authModalOverlay, authModal, closeAuthModalBtn, showLoginModalBtn,
    showSignupModalBtn, loginForm, signupForm, loginError,
    signupError, showSignupLink, showLoginLink, logoutButton, userEmailDisplay;

// Callbacks sẽ được cung cấp bởi module chính
let onLoginCallback = (user) => { console.warn("onLoginCallback not set in authService", user); };
let onLogoutCallback = () => { console.warn("onLogoutCallback not set in authService"); };

/**
 * Mở modal xác thực.
 * @param {string} mode - Chế độ hiển thị ('login' hoặc 'signup').
 */
function openAuthModal(mode = 'login') {
    if (!authModal || !loginForm || !signupForm || !loginError || !signupError) {
        console.error("Auth modal DOM elements not initialized for openAuthModal.");
        return;
    }
    loginError.textContent = '';
    signupError.textContent = '';
    if (mode === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
    document.body.classList.add('modal-open');
}

/**
 * Đóng modal xác thực.
 */
function closeAuthModal() {
    if (!authModal) {
        console.error("Auth modal DOM element not initialized for closeAuthModal.");
        return;
    }
    document.body.classList.remove('modal-open');
}

/**
 * Xử lý submit form đăng nhập.
 * @param {Event} e - Sự kiện submit.
 */
async function handleLoginSubmit(e) {
    e.preventDefault();
    if (!loginForm || !loginError) return;

    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    loginError.textContent = '';
    const submitButton = loginForm.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang đăng nhập...';
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged sẽ xử lý việc đóng modal và cập nhật UI
        loginForm.reset();
    } catch (error) {
        loginError.textContent = `Lỗi: ${error.message}`;
        console.error("Login error:", error);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Đăng nhập';
        }
    }
}

/**
 * Xử lý submit form đăng ký.
 * @param {Event} e - Sự kiện submit.
 */
async function handleSignupSubmit(e) {
    e.preventDefault();
    if (!signupForm || !signupError) return;

    const email = signupForm['signup-email'].value;
    const password = signupForm['signup-password'].value;
    signupError.textContent = '';
    const submitButton = signupForm.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang đăng ký...';
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged sẽ xử lý việc đóng modal và cập nhật UI
        signupForm.reset();
    } catch (error) {
        signupError.textContent = `Lỗi: ${error.message}`;
        console.error("Signup error:", error);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Đăng ký';
        }
    }
}

/**
 * Xử lý đăng xuất.
 */
async function handleLogout() {
    try {
        await signOut(auth);
        // onAuthStateChanged sẽ xử lý việc cập nhật UI
    } catch (error) {
        console.error("Logout error:", error);
        alert(`Lỗi đăng xuất: ${error.message}`);
    }
}

/**
 * Cập nhật hiển thị email người dùng trên header.
 * @param {string | null} email - Email của người dùng hoặc null.
 */
function updateUserEmailHeader(email) {
    if (userEmailDisplay) {
        userEmailDisplay.textContent = email || '';
    }
}

/**
 * Khởi tạo dịch vụ xác thực.
 * Gán các DOM elements, thiết lập event listeners và lắng nghe thay đổi trạng thái auth.
 * @param {object} callbacks - Đối tượng chứa các hàm callback.
 * @param {function} callbacks.onLogin - Hàm được gọi khi người dùng đăng nhập thành công.
 * @param {function} callbacks.onLogout - Hàm được gọi khi người dùng đăng xuất.
 */
export function initAuthService(callbacks) {
    // Gán DOM elements
    authModalOverlay = document.getElementById('auth-modal-overlay');
    authModal = document.getElementById('auth-modal');
    closeAuthModalBtn = document.getElementById('close-auth-modal-btn');
    showLoginModalBtn = document.getElementById('show-login-modal-btn');
    showSignupModalBtn = document.getElementById('show-signup-modal-btn');
    loginForm = document.getElementById('login-form');
    signupForm = document.getElementById('signup-form');
    loginError = document.getElementById('login-error');
    signupError = document.getElementById('signup-error');
    showSignupLink = document.getElementById('show-signup-link');
    showLoginLink = document.getElementById('show-login-link');
    logoutButton = document.getElementById('logout-button');
    userEmailDisplay = document.getElementById('user-email');

    // Gán callbacks
    if (callbacks && typeof callbacks.onLogin === 'function') {
        onLoginCallback = callbacks.onLogin;
    }
    if (callbacks && typeof callbacks.onLogout === 'function') {
        onLogoutCallback = callbacks.onLogout;
    }

    // Lắng nghe thay đổi trạng thái xác thực
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("AuthService: User logged in -", user.uid, user.email);
            currentUserInternal = user;
            updateUserEmailHeader(user.email);
            document.body.classList.remove('logged-out');
            document.body.classList.add('logged-in');
            closeAuthModal();
            onLoginCallback(user); // Gọi callback khi đăng nhập
        } else {
            console.log("AuthService: User logged out.");
            currentUserInternal = null;
            updateUserEmailHeader(null);
            document.body.classList.remove('logged-in');
            document.body.classList.add('logged-out');
            // Không tự động mở modal khi logout, để người dùng quyết định
            onLogoutCallback(); // Gọi callback khi đăng xuất
        }
    });

    // Gán Event Listeners cho modal và các form
    if (showLoginModalBtn) showLoginModalBtn.addEventListener('click', () => openAuthModal('login'));
    if (showSignupModalBtn) showSignupModalBtn.addEventListener('click', () => openAuthModal('signup'));
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);
    if (authModalOverlay) authModalOverlay.addEventListener('click', closeAuthModal);

    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginForm) loginForm.style.display = 'none';
            if (signupForm) signupForm.style.display = 'block';
            if (loginError) loginError.textContent = '';
        });
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (signupForm) signupForm.style.display = 'none';
            if (loginForm) loginForm.style.display = 'block';
            if (signupError) signupError.textContent = '';
        });
    }

    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (signupForm) signupForm.addEventListener('submit', handleSignupSubmit);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    console.log("Auth service initialized.");
}

/**
 * Lấy thông tin người dùng hiện tại.
 * @returns {object | null} Đối tượng user của Firebase hoặc null.
 */
export function getCurrentUser() {
    return currentUserInternal;
}
