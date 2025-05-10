// noteService.js
import {
    db, Timestamp,
    collection, addDoc, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, deleteDoc
} from './firebaseService.js';
import { getNearestUpcomingDeadline } from './utils.js'; // Giả sử hàm này vẫn ở utils.js

// --- Biến trạng thái cục bộ của module ---
let notesCache = {};
let trashedNotesCache = {};
let allUserTags = new Set();
let activeTagFilter = null;
let currentSearchTermFilter = '';
let currentSortOptionFilter = 'updatedAt_desc';

let notesUnsubscribe = null;
let trashUnsubscribe = null;

// Callbacks để render UI (sẽ được cung cấp bởi script.js)
let renderNotesListCallback = (notes) => console.warn("renderNotesListCallback not set in noteService", notes);
let renderTrashedNotesListCallback = (notes) => console.warn("renderTrashedNotesListCallback not set in noteService", notes);
let renderTagsListCallback = () => console.warn("renderTagsListCallback not set in noteService");
let displayGlobalUrgentTaskCallback = () => console.warn("displayGlobalUrgentTaskCallback not set in noteService");
let populateCalendarTagFilterCallback = () => console.warn("populateCalendarTagFilterCallback not set in noteService");
let initializeCalendarCallback = () => console.warn("initializeCalendarCallback not set in noteService");
let displayNoteDetailContentCallback = (note) => console.warn("displayNoteDetailContentCallback not set", note);

// Tham chiếu đến các module khác
let uiService = null;
let authService = null;


/**
 * Khởi tạo Note Service.
 * @param {object} renderCb - Callbacks cho việc render.
 * @param {object} uiServiceInstance - Instance của uiService.
 * @param {object} authServiceInstance - Instance của authService.
 */
export function initNoteService(renderCb, uiServiceInstance, authServiceInstance) {
    if (renderCb) {
        renderNotesListCallback = renderCb.renderNotesList || renderNotesListCallback;
        renderTrashedNotesListCallback = renderCb.renderTrashedNotesList || renderTrashedNotesListCallback;
        renderTagsListCallback = renderCb.renderTagsList || renderTagsListCallback;
        displayGlobalUrgentTaskCallback = renderCb.displayGlobalUrgentTask || displayGlobalUrgentTaskCallback;
        populateCalendarTagFilterCallback = renderCb.populateCalendarTagFilter || populateCalendarTagFilterCallback;
        initializeCalendarCallback = renderCb.initializeCalendar || initializeCalendarCallback;
        displayNoteDetailContentCallback = renderCb.displayNoteDetailContent || displayNoteDetailContentCallback;
    }
    uiService = uiServiceInstance;
    authService = authServiceInstance;
    console.log("Note service initialized.");
}

/**
 * Tải ghi chú và tags từ Firestore.
 */
export function loadNotesAndTags() {
    const user = authService.getCurrentUser();
    if (!user) {
        console.log("NoteService: No user, aborting loadNotesAndTags.");
        return;
    }
    console.log(`NoteService: Loading notes for user: ${user.uid}, Sort: ${currentSortOptionFilter}`);
    const [sortField, sortDirection] = currentSortOptionFilter.split('_');
    let notesQuery = query(
        collection(db, "notes"),
        where("userId", "==", user.uid),
        where("isTrashed", "==", false)
    );

    if (currentSortOptionFilter !== 'deadline_asc') {
        notesQuery = query(notesQuery, orderBy("isPinned", "desc"), orderBy(sortField, sortDirection));
    } else {
        notesQuery = query(notesQuery, orderBy("isPinned", "desc"), orderBy("updatedAt", "desc"));
    }

    if (notesUnsubscribe) notesUnsubscribe();
    notesUnsubscribe = onSnapshot(notesQuery, (querySnapshot) => {
        console.log("NoteService: Notes data received from Firestore");
        const newNotesCache = {};
        const newAllUserTags = new Set();
        querySnapshot.forEach((docSnap) => {
            const note = { id: docSnap.id, ...docSnap.data() };
            newNotesCache[note.id] = note;
            if (note.tags && Array.isArray(note.tags)) {
                note.tags.forEach(tag => newAllUserTags.add(tag));
            }
        });
        notesCache = newNotesCache;
        allUserTags = newAllUserTags;

        const currentUIType = uiService.getCurrentUIType ? uiService.getCurrentUIType() : 'notes';

        if (currentUIType === 'notes') {
            renderNotesListCallback(getFilteredAndSortedNotes());
            displayGlobalUrgentTaskCallback();
        } else if (currentUIType === 'calendar') {
            initializeCalendarCallback();
        }
        renderTagsListCallback();
        populateCalendarTagFilterCallback();
        
        const currentNoteId = getCurrentNoteId(); // Lấy ID note hiện tại (nếu có)
        if (currentNoteId && !notesCache[currentNoteId] && currentUIType === 'detail') {
            uiService.showMainNotesViewUI(activeTagFilter);
        } else if (currentNoteId && notesCache[currentNoteId] && currentUIType === 'detail') {
            displayNoteDetailContentCallback(notesCache[currentNoteId]);
        }

    }, (error) => {
        console.error("NoteService: Error loading main notes: ", error);
        // Xử lý lỗi hiển thị trên UI có thể được thực hiện bởi script.js thông qua callback hoặc trực tiếp
    });
}

/**
 * Tải các ghi chú trong thùng rác.
 */
export function loadTrashedNotes() {
    const user = authService.getCurrentUser();
    if (!user) {
        console.log("NoteService: No user, aborting loadTrashedNotes.");
        return;
    }
    console.log(`NoteService: Loading trashed notes for user: ${user.uid}`);
    const trashQuery = query(
        collection(db, "notes"),
        where("userId", "==", user.uid),
        where("isTrashed", "==", true),
        orderBy("trashedAt", "desc")
    );

    if (trashUnsubscribe) trashUnsubscribe();
    trashUnsubscribe = onSnapshot(trashQuery, (querySnapshot) => {
        console.log("NoteService: Trashed notes data received");
        const newTrashedNotesCache = {};
        querySnapshot.forEach((docSnap) => {
            newTrashedNotesCache[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        trashedNotesCache = newTrashedNotesCache;
        if (uiService.getCurrentUIType && uiService.getCurrentUIType() === 'trash') {
            renderTrashedNotesListCallback(Object.values(trashedNotesCache));
        }
    }, (error) => {
        console.error("NoteService: Error loading trashed notes: ", error);
    });
}

/**
 * Lấy danh sách ghi chú đã được lọc và sắp xếp.
 */
export function getFilteredAndSortedNotes() {
    const user = authService.getCurrentUser();
    if (!user) return [];

    let notesToRender = Object.values(notesCache).filter(note => {
        const tagMatch = !activeTagFilter || (note.tags && note.tags.includes(activeTagFilter));
        if (!tagMatch) return false;
        if (currentSearchTermFilter) {
            const searchTermLower = currentSearchTermFilter.toLowerCase();
            const titleMatch = note.title?.toLowerCase().includes(searchTermLower);
            const contentMatch = note.content?.toLowerCase().includes(searchTermLower);
            const tagsMatch = note.tags?.some(tag => tag.toLowerCase().includes(searchTermLower));
            const todosMatch = note.todos?.some(todo => todo.text?.toLowerCase().includes(searchTermLower));
            return titleMatch || contentMatch || tagsMatch || todosMatch;
        }
        return true;
    });

    if (currentSortOptionFilter === 'deadline_asc') {
        notesToRender.sort((a, b) => {
            const deadlineA = getNearestUpcomingDeadline(a);
            const deadlineB = getNearestUpcomingDeadline(b);
            if (deadlineA && deadlineB) return deadlineA - deadlineB;
            if (deadlineA && !deadlineB) return -1;
            if (!deadlineA && deadlineB) return 1;
            const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(0);
            const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(0);
            return dateB - dateA;
        });
    } else {
        notesToRender.sort((a, b) => {
            const pinA = a.isPinned || false;
            const pinB = b.isPinned || false;
            if (pinA !== pinB) return pinB - pinA;
            const [sortField, sortDirection] = currentSortOptionFilter.split('_');
            if (sortField === 'updatedAt') {
                const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(0);
                const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(0);
                return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
            } else if (sortField === 'title') {
                const titleA = (a.title || '').toLowerCase();
                const titleB = (b.title || '').toLowerCase();
                return sortDirection === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
            }
            return 0;
        });
    }
    return notesToRender;
}


/**
 * Lưu ghi chú (thêm mới hoặc cập nhật).
 * @param {object} noteData - Dữ liệu ghi chú.
 * @param {string|null} noteId - ID của ghi chú nếu đang cập nhật, null nếu thêm mới.
 * @returns {Promise<string|void>} Promise giải quyết với ID của note (nếu tạo mới) hoặc không có gì (nếu cập nhật).
 */
export async function saveNote(noteData, noteId = null) {
    const user = authService.getCurrentUser();
    if (!user) throw new Error("Người dùng chưa đăng nhập.");

    const dataToSave = {
        ...noteData,
        userId: user.uid,
        updatedAt: Timestamp.now(),
    };

    if (!noteId) { // Tạo mới
        dataToSave.createdAt = Timestamp.now();
        dataToSave.isPinned = false; // Mặc định khi tạo mới
        dataToSave.isTrashed = false;
        const docRef = await addDoc(collection(db, "notes"), dataToSave);
        console.log("NoteService: Note added with ID:", docRef.id);
        return docRef.id;
    } else { // Cập nhật
        console.log("NoteService: Updating note with ID:", noteId);
        const noteRef = doc(db, "notes", noteId);
        // Đảm bảo không ghi đè createdAt và isPinned (nếu không được cung cấp)
        const existingNote = notesCache[noteId] || {};
        await updateDoc(noteRef, {
            ...dataToSave,
            isPinned: dataToSave.isPinned !== undefined ? dataToSave.isPinned : (existingNote.isPinned || false)
        });
        console.log("NoteService: Note updated successfully");
    }
}

/**
 * Di chuyển ghi chú vào thùng rác.
 * @param {string} noteId - ID của ghi chú.
 */
export async function moveNoteToTrash(noteId) {
    const user = authService.getCurrentUser();
    if (!user || !notesCache[noteId]) throw new Error("Ghi chú không hợp lệ hoặc người dùng chưa đăng nhập.");
    console.log("NoteService: Moving note to trash, ID:", noteId);
    const noteRef = doc(db, "notes", noteId);
    await updateDoc(noteRef, {
        isTrashed: true,
        trashedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });
    console.log("NoteService: Note moved to trash successfully");
}

/**
 * Thay đổi trạng thái ghim của ghi chú.
 * @param {string} noteId - ID của ghi chú.
 */
export async function togglePinStatus(noteId) {
    const user = authService.getCurrentUser();
    if (!user || !notesCache[noteId]) throw new Error("Ghi chú không hợp lệ hoặc người dùng chưa đăng nhập.");
    const currentPinnedStatus = notesCache[noteId].isPinned || false;
    const newPinnedStatus = !currentPinnedStatus;
    console.log(`NoteService: Toggling pin for note ${noteId} to ${newPinnedStatus}`);
    const noteRef = doc(db, "notes", noteId);
    await updateDoc(noteRef, {
        isPinned: newPinnedStatus,
        updatedAt: Timestamp.now()
    });
    // onSnapshot sẽ tự động cập nhật UI
}

/**
 * Khôi phục ghi chú từ thùng rác.
 * @param {string} noteId - ID của ghi chú.
 */
export async function restoreNoteFromTrash(noteId) {
    const user = authService.getCurrentUser();
    if (!user || !trashedNotesCache[noteId]) throw new Error("Ghi chú không hợp lệ hoặc người dùng chưa đăng nhập.");
    console.log(`NoteService: Restoring note ${noteId} from trash.`);
    const noteRef = doc(db, "notes", noteId);
    await updateDoc(noteRef, {
        isTrashed: false,
        trashedAt: null,
        updatedAt: Timestamp.now()
    });
}

/**
 * Xóa vĩnh viễn một ghi chú.
 * @param {string} noteId - ID của ghi chú.
 */
export async function deleteNotePermanently(noteId) {
    const user = authService.getCurrentUser();
    if (!user || !trashedNotesCache[noteId]) throw new Error("Ghi chú không hợp lệ hoặc người dùng chưa đăng nhập.");
    console.log(`NoteService: Permanently deleting note ${noteId}.`);
    const noteRef = doc(db, "notes", noteId);
    await deleteDoc(noteRef);
}

export function getNoteById(noteId) {
    return notesCache[noteId] || null;
}

export function getAllUserTagsSet() {
    return new Set(allUserTags); // Trả về bản sao để tránh thay đổi trực tiếp
}

export function getActiveTag() {
    return activeTagFilter;
}

export function setActiveTagFilterAndRender(tagName) {
    activeTagFilter = tagName;
    // Yêu cầu uiService cập nhật tiêu đề và nút active
    if (uiService && uiService.updateMainViewTitleUI) {
        uiService.updateMainViewTitleUI("Tất cả Ghi chú", activeTagFilter);
    }
    if (uiService && uiService.setActiveSidebarButtonUI){ // Cần hàm này trong uiService
         // setActiveTagItem(tagName); // Hàm này hiện đang ở script.js, cần chuyển hoặc gọi callback
    }
    renderNotesListCallback(getFilteredAndSortedNotes());
    displayGlobalUrgentTaskCallback();
}

export function setSearchTermAndRender(term) {
    currentSearchTermFilter = term;
    renderNotesListCallback(getFilteredAndSortedNotes());
    displayGlobalUrgentTaskCallback();
}

export function setSortOptionAndReload(option) {
    currentSortOptionFilter = option;
    if (currentSortOptionFilter === 'deadline_asc') {
        renderNotesListCallback(getFilteredAndSortedNotes()); // Sắp xếp phía client
    } else {
        loadNotesAndTags(); // Tải lại từ Firestore với orderBy mới
    }
}

export function getCurrentSortOption() {
    return currentSortOptionFilter;
}

export function clearNoteDataOnLogout() {
    if (notesUnsubscribe) { notesUnsubscribe(); notesUnsubscribe = null; }
    if (trashUnsubscribe) { trashUnsubscribe(); trashUnsubscribe = null; }
    notesCache = {};
    trashedNotesCache = {};
    allUserTags.clear();
    activeTagFilter = null;
    currentSearchTermFilter = '';
    currentSortOptionFilter = 'updatedAt_desc';
    // currentNoteId sẽ được reset bởi logic view
    console.log("NoteService: Note data cleared on logout.");
}

// Hàm này sẽ được gọi từ script.js khi noteId thay đổi (ví dụ khi mở detail view)
export function setCurrentNoteId(noteId) {
    // currentNoteId được quản lý ở script.js, hàm này chỉ là ví dụ nếu muốn chuyển vào đây
    console.warn("setCurrentNoteId is conceptual and currentNoteId is managed in script.js for now.");
}

export function getCurrentNoteId() {
    // currentNoteId được quản lý ở script.js
    console.warn("getCurrentNoteId is conceptual and currentNoteId is managed in script.js for now.");
    return null; // Trả về null để tránh lỗi nếu script.js chưa cung cấp
}

export function getNotesCache() {
    return { ...notesCache }; // Trả về bản sao
}
