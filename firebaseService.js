// firebaseService.js

// Import các hàm cần thiết từ Firebase SDK
// Đây là những hàm bạn sẽ gọi trực tiếp từ các module khác thông qua export của file này.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Cấu hình Firebase của bạn ---
// QUAN TRỌNG: Giữ API key và các thông tin cấu hình này cẩn thận.
// Mặc dù API key phía client là có thể thấy được, bảo mật chính của ứng dụng Firebase
// nằm ở Firebase Security Rules (quy tắc bảo mật Firestore, Storage, v.v.).
const firebaseConfig = {
    apiKey: "AIzaSyAe5UOFul4ce8vQN66Bpcktj4oiV19ht-I", // API key của bạn
    authDomain: "ghichu-198277.firebaseapp.com",
    projectId: "ghichu-198277",
    storageBucket: "ghichu-198277.appspot.com",
    messagingSenderId: "1001550945488",
    appId: "1:1001550945488:web:bbda01f5a11f15a81192d5"
};

// --- Khởi tạo Firebase ---
// Khởi tạo Firebase app một lần duy nhất.
const app = initializeApp(firebaseConfig);

// Lấy các instance của dịch vụ Firebase.
const auth = getAuth(app);
const db = getFirestore(app);

// --- Export các instance và hàm của Firebase ---
// Các module khác trong ứng dụng của bạn sẽ import những thứ này.
export {
    // Firebase app instance (ít khi cần dùng trực tiếp ở module khác, nhưng có thể export nếu cần)
    // app, 
    
    // Dịch vụ Authentication
    auth, 
    // Dịch vụ Firestore
    db,   
    // Đối tượng Timestamp của Firestore
    Timestamp, 

    // Các hàm tiện ích từ Firebase Auth SDK
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,

    // Các hàm tiện ích từ Firebase Firestore SDK
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    deleteDoc
};

// Log để xác nhận module đã được tải và Firebase đã được cấu hình (hữu ích khi debug)
console.log("Firebase service (firebaseService.js) initialized and configured.");
