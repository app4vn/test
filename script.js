// script.js (Sau Bước 5 - Tách uiService.js)

// Import từ các services
import {
    db, Timestamp,
    collection, addDoc, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, deleteDoc
} from './firebaseService.js';
import {
    linkify,
    highlightText,
    getNearestUpcomingDeadline
} from './utils.js';
import { initThemeService } from './themeService.js';
import { initAuthService, getCurrentUser } from './authService.js';
import { // Các hàm import từ uiService
    initUIService,
    showMainNotesViewUI,
    showCalendarViewUI,
    showTrashNotesViewUI,
    showEditorUI,
    showDetailViewUI,
    handleBackButtonUI,
    // setActiveSidebarButtonUI, // Được gọi nội bộ trong các hàm show...ViewUI của uiService
    updateMainViewTitleUI,
    setupInitialUIForLoggedOutState,
    setupInitialUIForLoggedInState,
    getCurrentUIType,
    getPreviousUIType,
    closeMobileSidebar // Để đóng sidebar khi click item
} from './uiService.js';


// --- Lấy tham chiếu đến các phần tử DOM (chỉ những cái script.js trực tiếp dùng cho logic dữ liệu/editor) ---
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const tagsListContainer = document.getElementById('tags-list-container');
const addNoteBtn = document.getElementById('add-note-btn'); // Nút "Thêm Ghi Chú Mới" trong sidebar

// DOM elements cho bộ lọc lịch
const toggleCalendarFiltersBtn = document.getElementById('toggle-calendar-filters-btn');
const calendarFiltersCollapsible = document.getElementById('calendar-filters-collapsible'); // Cần cho listener
const calendarTagFilter = document.getElementById('calendar-tag-filter');
const calendarStatusFilter = document.getElementById('calendar-status-filter');
const calendarPriorityFilter = document.getElementById('calendar-priority-filter');
const applyCalendarFiltersBtn = document.getElementById('apply-calendar-filters-btn');
const closeCalendarFiltersBtn = document.getElementById('close-calendar-filters-btn');

// DOM elements cho chi tiết ghi chú
const noteDetailView = document.getElementById('note-detail-view'); // Cần cho themeService và logic hiển thị
const noteDetailTitle = document.getElementById('note-detail-title');
const noteDetailTags = document.getElementById('note-detail-tags');
const noteDetailContent = document.getElementById('note-detail-content');
const noteDetailCode = document.getElementById('note-detail-code');
const codeBlock = noteDetailCode.querySelector('code'); // Cần cho themeService
const copyCodeBtn = document.getElementById('copy-code-btn');
const editNoteBtn = document.getElementById('edit-note-btn');
const deleteNoteBtn = document.getElementById('delete-note-btn');
const pinNoteDetailBtn = document.getElementById('pin-note-detail-btn');
const noteDetailTodosContainer = document.getElementById('note-detail-todos-container');
const noteDetailTodosList = document.getElementById('note-detail-todos-list');
const noteDetailTodosProgress = document.getElementById('note-detail-todos-progress');

// DOM elements cho editor
const editorTitle = document.getElementById('editor-title'); // uiService đã set title chung, đây có thể để set cụ thể hơn
const noteIdInput = document.getElementById('note-id-input');
const noteTitleInput = document.getElementById('note-title-input');
const noteContentInput = document.getElementById('note-content-input');
const noteTagsInput = document.getElementById('note-tags-input');
const tagSuggestionsContainer = document.getElementById('tag-suggestions');
const noteEventDateInput = document.getElementById('note-event-date');
const isCodeCheckbox = document.getElementById('note-is-code-checkbox');
const languageSelect = document.getElementById('note-language-select');
const saveNoteBtn = document.getElementById('save-note-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const editorError = document.getElementById('editor-error');
const enableTodoCheckbox = document.getElementById('enable-todo-checkbox');
const noteEditorTodosList = document.getElementById('note-editor-todos-list');
const addTodoEditorItemBtn = document.getElementById('add-todo-editor-item-btn');

// DOM elements cho danh sách ghi chú
const notesListContainer = document.getElementById('notes-list-container');
const trashListContainer = document.getElementById('trash-list-container');
const urgentTaskBanner = document.getElementById('urgent-task-banner');


// --- Biến trạng thái toàn cục (chỉ những gì script.js quản lý trực tiếp) ---
let currentNoteId = null;
let notesUnsubscribe = null;
let trashUnsubscribe = null;
let activeTag = null;
let notesCache = {};
let trashedNotesCache = {};
let currentSearchTerm = '';
let currentSortOption = 'updatedAt_desc';
let allUserTags = new Set();

// Biến state cho các filter lịch
let calendarSelectedTag = null;
let calendarSelectedStatus = '';
let calendarSelectedPriority = '';
let calendar = null;

// --- SVG Paths ---
const pinAngleSVGPath = "M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146zm-3.27 1.96a.5.5 0 0 1 0 .707L2.874 8.874a.5.5 0 1 1-.707-.707l3.687-3.687a.5.5 0 0 1 .707 0z";
const pinAngleFillSVGPath = "M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z";


// --- Các hàm UI Helpers (chỉ những hàm còn lại sau khi tách uiService) ---
function clearEditorFields(prefillData = null) {
    noteTitleInput.value = '';
    noteContentInput.value = '';
    noteTagsInput.value = '';
    noteEventDateInput.value = prefillData?.eventDate || '';
    isCodeCheckbox.checked = false;
    languageSelect.value = 'plaintext';
    languageSelect.style.display = 'none';
    if (editorError) editorError.textContent = '';
    hideTagSuggestions();
    enableTodoCheckbox.checked = false;
    noteEditorTodosList.innerHTML = '';
    toggleTodoEditorVisibility();
}

function clearEditor() {
    clearEditorFields();
    noteIdInput.value = '';
}

function setActiveTagItem(tagName) {
    if (!tagsListContainer) return;
    tagsListContainer.querySelectorAll('.tag-item').forEach(item => {
        const itemTag = item.dataset.tag || (item.textContent === 'Tất cả' ? null : item.textContent);
        item.classList.toggle('active', itemTag === tagName);
    });
}

// --- Logic quản lý Ghi chú (Notes CRUD & Display) ---
isCodeCheckbox.addEventListener('change', (e) => {
    languageSelect.style.display = e.target.checked ? 'inline-block' : 'none';
    if (!e.target.checked) {
        languageSelect.value = 'plaintext';
    }
    toggleTodoEditorVisibility();
});

addNoteBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    if (user) {
        showEditorUI(false); // Gọi hàm từ uiService
        // Logic điền dữ liệu cho editor mới (nếu có) sẽ ở đây hoặc trong showEditorUI
        clearEditor(); // Đảm bảo editor trống
        if (editorTitle) editorTitle.textContent = "Tạo Ghi chú Mới";
        noteContentInput.focus();
    } else {
        console.log("Add note clicked, but user not logged in.");
    }
});

const fabAddNoteBtnEl = document.getElementById('fab-add-note-btn');
if (fabAddNoteBtnEl) {
    fabAddNoteBtnEl.addEventListener('click', () => {
        const user = getCurrentUser();
        if (user) {
            showEditorUI(false);
            clearEditor();
            if (editorTitle) editorTitle.textContent = "Tạo Ghi chú Mới";
            noteContentInput.focus();
        } else {
            console.log("FAB Add note clicked, but user not logged in.");
        }
    });
}


cancelEditBtn.addEventListener('click', () => {
    clearEditor();
    handleBackButtonUI(); // Gọi hàm từ uiService
});

saveNoteBtn.addEventListener('click', async () => {
    const user = getCurrentUser();
    if (!user) {
        alert("Vui lòng đăng nhập để lưu ghi chú.");
        return;
    }

    const id = noteIdInput.value;
    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();
    const tags = [...new Set(noteTagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag))];
    const eventDateValue = noteEventDateInput.value || null;
    const isCode = isCodeCheckbox.checked;
    const language = isCode ? languageSelect.value : 'plaintext';

    if (editorError) editorError.textContent = '';

    let todosToSave = null;
    if (enableTodoCheckbox.checked) {
        todosToSave = collectTodosFromEditor();
    }
    const isMeaningfulTodo = enableTodoCheckbox.checked && todosToSave && todosToSave.length > 0;

    if (id && !title) {
        if(editorError) editorError.textContent = "Tiêu đề không được để trống khi chỉnh sửa!";
        alert("Tiêu đề không được để trống khi chỉnh sửa!");
        saveNoteBtn.disabled = false;
        saveNoteBtn.textContent = 'Lưu Ghi Chú';
        return;
    }
    if (!isCode && !enableTodoCheckbox.checked && !content && !eventDateValue) {
        if(editorError) editorError.textContent = "Ghi chú thường phải có nội dung hoặc ngày sự kiện.";
        alert("Ghi chú thường phải có nội dung hoặc ngày sự kiện.");
        saveNoteBtn.disabled = false;
        saveNoteBtn.textContent = 'Lưu Ghi Chú';
        return;
    }
    if (!isCode && enableTodoCheckbox.checked && !isMeaningfulTodo && !content && !eventDateValue) {
        if(editorError) editorError.textContent = "Danh sách công việc phải có ít nhất một công việc, hoặc nội dung/ngày sự kiện.";
        alert("Danh sách công việc phải có ít nhất một công việc, hoặc nội dung/ngày sự kiện.");
        saveNoteBtn.disabled = false;
        saveNoteBtn.textContent = 'Lưu Ghi Chú';
        return;
    }

    saveNoteBtn.disabled = true;
    saveNoteBtn.textContent = 'Đang lưu...';

    let finalContent = content;
    if (!isCode && !content && (isMeaningfulTodo || eventDateValue) ) {
         finalContent = '';
    }

    const noteData = {
        title,
        content: finalContent,
        tags,
        eventDate: eventDateValue,
        isCode,
        language,
        todos: todosToSave,
        userId: user.uid,
        updatedAt: Timestamp.now(),
        isPinned: id ? (notesCache[id]?.isPinned || false) : false,
        isTrashed: false
    };

    if (!id) {
        noteData.createdAt = Timestamp.now();
    }

    try {
        const prevViewType = getPreviousUIType();
        let targetViewFunction;
        if (prevViewType === 'calendar') {
            targetViewFunction = showCalendarViewUI;
        } else {
            targetViewFunction = () => showMainNotesViewUI(activeTag);
        }

        if (id) {
            console.log("Updating note with ID:", id);
            const noteRef = doc(db, "notes", id);
            await updateDoc(noteRef, noteData);
            console.log("Note updated successfully");
            alert('Ghi chú đã được cập nhật!');
        } else {
            console.log("Adding new note");
            const docRef = await addDoc(collection(db, "notes"), noteData);
            console.log("Note added with ID:", docRef.id);
        }
        clearEditor();
        targetViewFunction();
    } catch (error) {
        console.error("Error saving note: ", error);
        if(editorError) editorError.textContent = `Lỗi lưu ghi chú: ${error.message}`;
        alert(`Lỗi lưu ghi chú: ${error.message}`);
    } finally {
        saveNoteBtn.disabled = false;
        saveNoteBtn.textContent = 'Lưu Ghi Chú';
    }
});

editNoteBtn.addEventListener('click', () => {
    if (!currentNoteId || !notesCache[currentNoteId]) {
        alert("Vui lòng chọn một ghi chú để sửa.");
        showMainNotesViewUI(activeTag);
        return;
    }
    const noteToEdit = notesCache[currentNoteId];
    showEditorUI(true); // Yêu cầu uiService hiển thị editor
    
    // Điền dữ liệu vào editor
    if (editorTitle) editorTitle.textContent = "Sửa Ghi chú"; // uiService đã set, nhưng có thể ghi đè nếu cần
    noteIdInput.value = noteToEdit.id;
    noteTitleInput.value = noteToEdit.title;
    noteContentInput.value = noteToEdit.content;
    noteTagsInput.value = noteToEdit.tags ? noteToEdit.tags.join(', ') : '';
    noteEventDateInput.value = noteToEdit.eventDate || '';
    isCodeCheckbox.checked = noteToEdit.isCode || false;
    languageSelect.value = noteToEdit.language || 'plaintext';
    languageSelect.style.display = noteToEdit.isCode ? 'inline-block' : 'none';
    if (noteToEdit.todos && Array.isArray(noteToEdit.todos)) {
        enableTodoCheckbox.checked = true;
        renderTodosInEditor(noteToEdit.todos);
    } else {
        enableTodoCheckbox.checked = false;
        renderTodosInEditor([]);
    }
    toggleTodoEditorVisibility();
    noteTitleInput.focus();
});

deleteNoteBtn.addEventListener('click', async () => {
    if (!currentNoteId || !notesCache[currentNoteId]) return;
    const noteTitle = notesCache[currentNoteId]?.title || "ghi chú này";
    if (confirm(`Bạn có chắc chắn muốn chuyển ghi chú "${noteTitle}" vào thùng rác không?`)) {
        console.log("Moving note to trash, ID:", currentNoteId);
        const noteRef = doc(db, "notes", currentNoteId);
        try {
            await updateDoc(noteRef, {
                isTrashed: true,
                trashedAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            console.log("Note moved to trash successfully");
            alert(`Đã chuyển ghi chú "${noteTitle}" vào thùng rác.`);
            handleBackButtonUI();
        } catch (error) {
            console.error("Error moving note to trash:", error);
            alert(`Lỗi khi chuyển vào thùng rác: ${error.message}`);
        }
    }
});

copyCodeBtn.addEventListener('click', () => {
    const codeToCopy = codeBlock.textContent;
    if (codeToCopy) {
        navigator.clipboard.writeText(codeToCopy)
            .then(() => {
                alert('Đã sao chép code vào clipboard!');
                copyCodeBtn.textContent = 'Đã chép!';
                setTimeout(() => {
                    copyCodeBtn.textContent = 'Copy Code';
                }, 1500);
            })
            .catch(err => {
                console.error('Clipboard copy failed:', err);
                alert('Lỗi khi sao chép code.');
            });
    }
});

// --- Tải và Hiển thị Dữ liệu từ Firestore ---
function loadNotesAndTags() {
    const user = getCurrentUser();
    if (!user) {
        console.log("loadNotesAndTags: No user, aborting.");
        return;
    }
    console.log(`Loading notes for user: ${user.uid}, Sort: ${currentSortOption}`);
    const [sortField, sortDirection] = currentSortOption.split('_');
    let notesQuery = query(
        collection(db, "notes"),
        where("userId", "==", user.uid),
        where("isTrashed", "==", false)
    );
    if (currentSortOption !== 'deadline_asc') {
        notesQuery = query(notesQuery, orderBy("isPinned", "desc"), orderBy(sortField, sortDirection));
    } else {
        notesQuery = query(notesQuery, orderBy("isPinned", "desc"), orderBy("updatedAt", "desc"));
    }

    if (notesUnsubscribe) notesUnsubscribe();
    notesUnsubscribe = onSnapshot(notesQuery, (querySnapshot) => {
        console.log("Notes data received from Firestore");
        const allNotes = [];
        const newNotesCache = {};
        allUserTags.clear();
        querySnapshot.forEach((doc) => {
            const note = { id: doc.id, ...doc.data() };
            allNotes.push(note);
            newNotesCache[note.id] = note;
            if (note.tags && Array.isArray(note.tags)) {
                note.tags.forEach(tag => allUserTags.add(tag));
            }
        });
        notesCache = newNotesCache;

        const currentUIType = getCurrentUIType();
        if (currentUIType === 'notes') {
            renderNotesList(Object.values(notesCache)); // Render lại danh sách
            displayGlobalUrgentTask();
        } else if (currentUIType === 'calendar') {
            initializeCalendar(); // Cập nhật lịch
        }
        renderTagsList();
        populateCalendarTagFilter();

        if (currentNoteId && !notesCache[currentNoteId] && getCurrentUIType() === 'detail') {
            showMainNotesViewUI(activeTag);
        } else if (currentNoteId && notesCache[currentNoteId] && getCurrentUIType() === 'detail') {
            displayNoteDetailContent(notesCache[currentNoteId]); // Cập nhật chi tiết nếu đang xem
        }
    }, (error) => {
        console.error("Error loading main notes: ", error);
        if (notesListContainer) {
            if (error.code === 'failed-precondition') {
                notesListContainer.innerHTML = `<p class="error-message">Lỗi: Cần tạo chỉ mục (index) trong Firestore. Kiểm tra Console.</p>`;
                console.error("Firestore Index Required:", error.message);
            } else {
                notesListContainer.innerHTML = `<p class="error-message">Lỗi tải ghi chú: ${error.message}</p>`;
            }
        }
    });
}

function loadTrashedNotes() {
    const user = getCurrentUser();
    if (!user) {
        console.log("loadTrashedNotes: No user, aborting.");
        return;
    }
    console.log(`Loading trashed notes for user: ${user.uid}`);
    const trashQuery = query(
        collection(db, "notes"),
        where("userId", "==", user.uid),
        where("isTrashed", "==", true),
        orderBy("trashedAt", "desc")
    );

    if (trashUnsubscribe) trashUnsubscribe();
    trashUnsubscribe = onSnapshot(trashQuery, (querySnapshot) => {
        console.log("Trashed notes data received");
        const allTrashedNotes = [];
        const newTrashedNotesCache = {};
        querySnapshot.forEach((doc) => {
            const note = { id: doc.id, ...doc.data() };
            allTrashedNotes.push(note);
            newTrashedNotesCache[note.id] = note;
        });
        trashedNotesCache = newTrashedNotesCache;
        if (getCurrentUIType() === 'trash') {
            renderTrashedNotesList(Object.values(trashedNotesCache));
        }
    }, (error) => {
        console.error("Error loading trashed notes: ", error);
        if (trashListContainer) {
            if (error.code === 'failed-precondition') {
                trashListContainer.innerHTML = `<p class="error-message">Lỗi: Cần tạo chỉ mục (index) cho thùng rác. Kiểm tra Console.</p>`;
                console.error("Firestore Index Required for trash:", error.message);
            } else {
                trashListContainer.innerHTML = `<p class="error-message">Lỗi tải thùng rác: ${error.message}</p>`;
            }
        }
    });
}


// --- Render Lists ---
function renderNotesList(notesFromCache) {
    if (!notesListContainer) return;
    notesListContainer.innerHTML = '';
    const searchTermLower = currentSearchTerm.toLowerCase();
    let notesToRender = notesFromCache.filter(note => {
        const tagMatch = !activeTag || (note.tags && note.tags.includes(activeTag));
        if (!tagMatch) return false;
        if (searchTermLower) {
            const titleMatch = note.title?.toLowerCase().includes(searchTermLower);
            const contentMatch = note.content?.toLowerCase().includes(searchTermLower);
            const tagsMatch = note.tags?.some(tag => tag.toLowerCase().includes(searchTermLower));
            const todosMatch = note.todos?.some(todo => todo.text?.toLowerCase().includes(searchTermLower));
            return titleMatch || contentMatch || tagsMatch || todosMatch;
        }
        return true;
    });

    if (currentSortOption === 'deadline_asc') {
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

            const [sortField, sortDirection] = currentSortOption.split('_');
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

    if (notesToRender.length === 0) {
        let message = 'Chưa có ghi chú nào.';
        if (activeTag && currentSearchTerm) message = `Không có ghi chú nào với tag "${activeTag}" khớp với "${currentSearchTerm}".`;
        else if (activeTag) message = `Không có ghi chú nào với tag "${activeTag}".`;
        else if (currentSearchTerm) message = `Không có ghi chú nào khớp với "${currentSearchTerm}".`;
        else message = 'Chưa có ghi chú nào. Hãy tạo ghi chú mới!';
        notesListContainer.innerHTML = `<p>${message}</p>`;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    notesToRender.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.classList.add('note-item');
        noteElement.dataset.id = note.id;

        const pinIcon = document.createElement('span');
        pinIcon.classList.add('pin-icon');
        pinIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pin-angle${note.isPinned ? '-fill' : ''}" viewBox="0 0 16 16"><path d="${note.isPinned ? pinAngleFillSVGPath : pinAngleSVGPath}"/></svg>`;
        if (note.isPinned) pinIcon.classList.add('pinned');
        pinIcon.title = note.isPinned ? "Bỏ ghim" : "Ghim ghi chú";
        pinIcon.addEventListener('click', (e) => { e.stopPropagation(); togglePinStatus(note.id); });
        noteElement.appendChild(pinIcon);

        const titleElement = document.createElement('h3');
        titleElement.innerHTML = highlightText(note.title || "Không có tiêu đề", currentSearchTerm);

        const contentPreview = document.createElement('div');
        contentPreview.classList.add('note-item-content-preview');

        if (note.todos && note.todos.length > 0) {
            const completedCount = note.todos.filter(t => t.completed).length;
            const totalCount = note.todos.length;
            let previewHTML = `<div class="todo-preview-summary">📊 (${completedCount}/${totalCount} việc)</div>`;
            const uncompletedTodos = note.todos.filter(t => !t.completed);
            const completedTodos = note.todos.filter(t => t.completed).sort((a,b) => (b.order || 0) - (a.order || 0));
            let itemsToShow = [];
            const MAX_PREVIEW_ITEMS = 3;
            const overdueTodos = uncompletedTodos
                .filter(t => t.deadline && new Date(t.deadline + "T00:00:00") < today)
                .sort((a, b) => new Date(a.deadline + "T00:00:00") - new Date(b.deadline + "T00:00:00"));
            itemsToShow.push(...overdueTodos.slice(0, MAX_PREVIEW_ITEMS));
            if (itemsToShow.length < MAX_PREVIEW_ITEMS) {
                const upcomingDeadlineTodos = uncompletedTodos
                    .filter(t => t.deadline && new Date(t.deadline + "T00:00:00") >= today && !itemsToShow.some(it => it.id === t.id))
                    .sort((a, b) => new Date(a.deadline + "T00:00:00") - new Date(b.deadline + "T00:00:00"));
                itemsToShow.push(...upcomingDeadlineTodos.slice(0, MAX_PREVIEW_ITEMS - itemsToShow.length));
            }
            if (itemsToShow.length < MAX_PREVIEW_ITEMS) {
                const highPriorityTodos = uncompletedTodos
                    .filter(t => t.priority === 'high' && !itemsToShow.some(it => it.id === t.id))
                    .sort((a,b) => (a.order || 0) - (b.order || 0));
                itemsToShow.push(...highPriorityTodos.slice(0, MAX_PREVIEW_ITEMS - itemsToShow.length));
            }
             if (itemsToShow.length < MAX_PREVIEW_ITEMS) {
                const mediumPriorityTodos = uncompletedTodos
                    .filter(t => t.priority === 'medium' && !itemsToShow.some(it => it.id === t.id))
                    .sort((a,b) => (a.order || 0) - (b.order || 0));
                itemsToShow.push(...mediumPriorityTodos.slice(0, MAX_PREVIEW_ITEMS - itemsToShow.length));
            }
            if (itemsToShow.length < MAX_PREVIEW_ITEMS) {
                 const otherUncompleted = uncompletedTodos
                    .filter(t => !itemsToShow.some(it => it.id === t.id))
                    .sort((a,b) => (a.order || 0) - (b.order || 0));
                itemsToShow.push(...otherUncompleted.slice(0, MAX_PREVIEW_ITEMS - itemsToShow.length));
            }
            if (itemsToShow.length < MAX_PREVIEW_ITEMS && completedTodos.length > 0) {
                itemsToShow.push(...completedTodos.slice(0, MAX_PREVIEW_ITEMS - itemsToShow.length));
            }
            itemsToShow = [...new Map(itemsToShow.map(item => [item.id, item])).values()].slice(0, MAX_PREVIEW_ITEMS);
            itemsToShow.forEach(todo => {
                let todoText = todo.text.substring(0, 30) + (todo.text.length > 30 ? '...' : '');
                previewHTML += `<div class="todo-preview-item">`;
                previewHTML += `<span class="todo-status">${todo.completed ? '[x]' : '[ ]'}</span> <span class="todo-text">${highlightText(todoText, currentSearchTerm)}</span>`;
                let metaInfo = [];
                if (todo.deadline && !todo.completed) {
                    try {
                        const deadlineDate = new Date(todo.deadline + "T00:00:00");
                        if (!isNaN(deadlineDate)) {
                            const isOverdue = deadlineDate < today;
                            metaInfo.push(`<span class="todo-deadline-preview ${isOverdue ? 'overdue' : ''}">📅 ${deadlineDate.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}</span>`);
                        }
                    } catch(e){}
                }
                if (todo.priority && todo.priority !== 'medium' && !todo.completed) {
                     metaInfo.push(`<span class="todo-priority-preview priority-${todo.priority}">${todo.priority === 'high' ? '🔥' : (todo.priority === 'low' ? '🟢' : '')}</span>`);
                }
                if (metaInfo.length > 0) {
                    previewHTML += `<span class="todo-meta-preview">(${metaInfo.join(' ')})</span>`;
                }
                previewHTML += `</div>`;
            });

            if (totalCount > 0 && completedCount === totalCount) {
                previewHTML = `<div class="todo-preview-summary">📊 (${completedCount}/${totalCount} việc)</div><div class="todo-preview-item">🎉 Tất cả đã hoàn thành!</div>`;
            } else if (itemsToShow.length === 0 && uncompletedTodos.length > 0) {
                 previewHTML += `<div class="todo-preview-item">${highlightText(`Còn ${uncompletedTodos.length} việc chưa xong...`, currentSearchTerm)}</div>`;
            } else if (totalCount > itemsToShow.length && itemsToShow.length > 0 && itemsToShow.length < MAX_PREVIEW_ITEMS) {
                const remainingTotal = totalCount - itemsToShow.length;
                if (remainingTotal > 0) {
                     previewHTML += `<div class="todo-preview-item" style="font-style: italic; opacity: 0.7;">...và ${remainingTotal} việc khác</div>`;
                }
            }
            contentPreview.innerHTML = previewHTML;
        } else {
            contentPreview.innerHTML = highlightText(note.content || '', currentSearchTerm);
        }

        const dateElement = document.createElement('div');
        dateElement.classList.add('note-item-date');
        if (note.updatedAt && note.updatedAt.toDate) {
             dateElement.textContent = note.updatedAt.toDate().toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'});
        }
        noteElement.appendChild(titleElement);
        noteElement.appendChild(contentPreview);
        noteElement.appendChild(dateElement);
        noteElement.addEventListener('click', () => {
            showDetailViewUI(); // Yêu cầu uiService hiển thị view
            displayNoteDetailContent(note); // Sau đó điền nội dung
        });
        notesListContainer.appendChild(noteElement);
    });
}
function renderTrashedNotesList(trashedNotes) {
    if (!trashListContainer) return;
    trashListContainer.innerHTML = '';
    if (trashedNotes.length === 0) {
        trashListContainer.innerHTML = '<p>Thùng rác trống.</p>';
        return;
    }
    trashedNotes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.classList.add('note-item');
        noteElement.dataset.id = note.id;
        const titleElement = document.createElement('h3');
        titleElement.textContent = note.title || "Không có tiêu đề";
        const contentPreview = document.createElement('div');
        contentPreview.classList.add('note-item-content-preview');
        if (note.todos && note.todos.length > 0) {
            const firstFewTodos = note.todos.slice(0, 3).map(todo => `${todo.completed ? '[x]' : '[ ]'} ${todo.text}`).join('\n');
            contentPreview.textContent = firstFewTodos + (note.todos.length > 3 ? '\n...' : '');
        } else {
            contentPreview.textContent = note.content || '';
        }
        const trashedDateElement = document.createElement('div');
        trashedDateElement.classList.add('note-item-date');
        if (note.trashedAt && note.trashedAt.toDate) {
            trashedDateElement.textContent = `Vào thùng rác: ${note.trashedAt.toDate().toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}`;
        }
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('trashed-note-actions');
        const restoreBtn = document.createElement('button');
        restoreBtn.classList.add('button-secondary');
        restoreBtn.textContent = 'Khôi phục';
        restoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            restoreNoteFromTrash(note.id);
        });
        const deletePermanentlyBtn = document.createElement('button');
        deletePermanentlyBtn.classList.add('button-danger');
        deletePermanentlyBtn.textContent = 'Xóa vĩnh viễn';
        deletePermanentlyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNotePermanently(note.id, note.title);
        });
        actionsDiv.appendChild(restoreBtn);
        actionsDiv.appendChild(deletePermanentlyBtn);
        noteElement.appendChild(titleElement);
        noteElement.appendChild(contentPreview);
        noteElement.appendChild(trashedDateElement);
        noteElement.appendChild(actionsDiv);
        trashListContainer.appendChild(noteElement);
    });
}
function renderTagsList() {
    if (!tagsListContainer) return;
    tagsListContainer.innerHTML = '';
    const allTagElement = document.createElement('span');
    allTagElement.classList.add('tag-item');
    allTagElement.textContent = 'Tất cả';
    if (activeTag === null) allTagElement.classList.add('active');
    allTagElement.addEventListener('click', () => {
        if (activeTag !== null) {
            activeTag = null;
            setActiveTagItem(null);
            renderNotesList(Object.values(notesCache));
            updateMainViewTitleUI("Tất cả Ghi chú", null);
        }
    });
    tagsListContainer.appendChild(allTagElement);

    [...allUserTags].sort().forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.classList.add('tag-item');
        tagElement.textContent = tag;
        tagElement.dataset.tag = tag;
        if (tag === activeTag) tagElement.classList.add('active');
        tagElement.addEventListener('click', () => {
            if (activeTag !== tag) {
                activeTag = tag;
                setActiveTagItem(tag);
                renderNotesList(Object.values(notesCache));
                updateMainViewTitleUI("Tất cả Ghi chú", activeTag);
            }
        });
        tagsListContainer.appendChild(tagElement);
    });
    if (allUserTags.size === 0 && tagsListContainer.children.length <=1) {
        const noTags = document.createElement('p');
        noTags.textContent = 'Chưa có tag nào.';
        noTags.style.fontSize = '0.9em';
        noTags.style.color = 'var(--text-secondary)';
        tagsListContainer.appendChild(noTags);
    }
    populateCalendarTagFilter();
}
function displayNoteDetailContent(note) {
    if (!note) return;
    noteDetailTitle.textContent = note.title || "Không có tiêu đề";
    if (pinNoteDetailBtn) {
        pinNoteDetailBtn.classList.toggle('pinned', !!note.isPinned);
        pinNoteDetailBtn.title = note.isPinned ? "Bỏ ghim ghi chú" : "Ghim ghi chú";
        const svgIcon = pinNoteDetailBtn.querySelector('svg');
        if (svgIcon) {
            const pathElement = svgIcon.querySelector('path');
            if(pathElement){
                pathElement.setAttribute('d', note.isPinned ? pinAngleFillSVGPath : pinAngleSVGPath);
            }
            svgIcon.classList.remove('bi-pin-angle', 'bi-pin-angle-fill');
            svgIcon.classList.add(note.isPinned ? 'bi-pin-angle-fill' : 'bi-pin-angle');
        }
    }
    noteDetailTags.innerHTML = '';
    if (note.tags && note.tags.length > 0) {
        note.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.classList.add('tag');
            tagElement.textContent = tag;
            noteDetailTags.appendChild(tagElement);
        });
    }
    if (note.isCode) {
        noteDetailContent.style.display = 'none';
        noteDetailTodosContainer.style.display = 'none';
        codeBlock.textContent = note.content;
        codeBlock.className = `language-${note.language || 'plaintext'}`;
        noteDetailCode.style.display = 'block';
        copyCodeBtn.style.display = 'inline-block';
        if (window.Prism) Prism.highlightElement(codeBlock);
    } else {
        noteDetailCode.style.display = 'none';
        copyCodeBtn.style.display = 'none';
        if (note.todos && Array.isArray(note.todos) && note.todos.length > 0) {
            noteDetailContent.style.display = 'none';
            noteDetailTodosContainer.style.display = 'block';
            renderTodosInDetailView(note.id, note.todos);
        } else {
            noteDetailTodosContainer.style.display = 'none';
            noteDetailContent.innerHTML = linkify(note.content);
            noteDetailContent.style.display = 'block';
        }
    }
}
async function togglePinStatus(noteId) {
    const user = getCurrentUser();
    if (!user || !notesCache[noteId]) return;
    const noteRef = doc(db, "notes", noteId);
    const currentPinnedStatus = notesCache[noteId].isPinned || false;
    const newPinnedStatus = !currentPinnedStatus;
    try {
        await updateDoc(noteRef, {
            isPinned: newPinnedStatus,
            updatedAt: Timestamp.now()
        });
        console.log(`Note ${noteId} pin status updated to ${newPinnedStatus}`);
    } catch (error) {
        console.error("Error updating pin status:", error);
        alert("Lỗi cập nhật trạng thái ghim.");
    }
}
if (pinNoteDetailBtn) {
    pinNoteDetailBtn.addEventListener('click', () => {
        if (currentNoteId) togglePinStatus(currentNoteId);
    });
}
async function restoreNoteFromTrash(noteId) {
    const user = getCurrentUser();
    if (!user || !trashedNotesCache[noteId]) return;
    const noteRef = doc(db, "notes", noteId);
    try {
        await updateDoc(noteRef, {
            isTrashed: false,
            trashedAt: null,
            updatedAt: Timestamp.now()
        });
        console.log(`Note ${noteId} restored from trash.`);
        alert("Đã khôi phục ghi chú.");
    } catch (error) {
        console.error("Error restoring note:", error);
        alert("Lỗi khôi phục ghi chú.");
    }
}
async function deleteNotePermanently(noteId, noteTitle = "ghi chú này") {
    const user = getCurrentUser();
    if (!user || !trashedNotesCache[noteId]) return;
    if (confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ghi chú "${noteTitle}" không? Hành động này KHÔNG THỂ hoàn tác.`)) {
        const noteRef = doc(db, "notes", noteId);
        try {
            await deleteDoc(noteRef);
            console.log(`Note ${noteId} permanently deleted.`);
            alert("Đã xóa vĩnh viễn ghi chú.");
        } catch (error) {
            console.error("Error permanently deleting note:", error);
            alert("Lỗi xóa vĩnh viễn ghi chú.");
        }
    }
}

// Gắn listener cho các nút điều hướng chính trong sidebar
const showAllNotesBtnEl = document.getElementById('show-all-notes-btn');
const showCalendarBtnEl = document.getElementById('show-calendar-btn');
const showTrashBtnEl = document.getElementById('show-trash-btn');

if (showAllNotesBtnEl) { showAllNotesBtnEl.addEventListener('click', () => showMainNotesViewUI(activeTag)); }
if (showCalendarBtnEl) { showCalendarBtnEl.addEventListener('click', showCalendarViewUI); }
if (showTrashBtnEl) { showTrashBtnEl.addEventListener('click', showTrashNotesViewUI); }


function displayTagSuggestions(suggestions, currentTagValue) {
    if (!tagSuggestionsContainer) return;
    tagSuggestionsContainer.innerHTML = '';
    if (suggestions.length === 0) {
        hideTagSuggestions();
        return;
    }
    suggestions.forEach(tag => {
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('suggestion-item');
        suggestionItem.textContent = tag;
        suggestionItem.addEventListener('click', () => {
            const tagsArray = noteTagsInput.value.split(',').map(t => t.trim());
            tagsArray.pop();
            tagsArray.push(tag);
            noteTagsInput.value = tagsArray.join(', ') + ', ';
            hideTagSuggestions();
            noteTagsInput.focus();
        });
        tagSuggestionsContainer.appendChild(suggestionItem);
    });
    tagSuggestionsContainer.style.display = 'block';
}
function hideTagSuggestions() {
    if (tagSuggestionsContainer) {
        tagSuggestionsContainer.style.display = 'none';
    }
}
if (noteTagsInput) {
    noteTagsInput.addEventListener('input', () => {
        const inputValue = noteTagsInput.value;
        const tagsArray = inputValue.split(',').map(t => t.trim());
        const currentTypingTag = tagsArray[tagsArray.length - 1].toLowerCase();
        if (currentTypingTag) {
            const existingTagsInInput = tagsArray.slice(0, -1).map(t => t.toLowerCase());
            const suggestions = [...allUserTags].filter(
                tag => tag.toLowerCase().startsWith(currentTypingTag) &&
                       !existingTagsInInput.includes(tag.toLowerCase())
            );
            displayTagSuggestions(suggestions, currentTypingTag);
        } else {
            hideTagSuggestions();
        }
    });
    noteTagsInput.addEventListener('blur', () => {
        setTimeout(hideTagSuggestions, 150);
    });
    noteTagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideTagSuggestions();
        }
    });
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim();
        if (getCurrentUIType() === 'notes') {
            renderNotesList(Object.values(notesCache));
            displayGlobalUrgentTask();
        }
    });
} else {
    console.warn("Search input element not found.");
}

if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        const newSortOption = e.target.value;
        if (newSortOption !== currentSortOption) {
            console.log("Sort option changed to:", newSortOption);
            currentSortOption = newSortOption;
            if (getCurrentUIType() === 'notes') {
                if (currentSortOption === 'deadline_asc') {
                    renderNotesList(Object.values(notesCache));
                } else {
                    loadNotesAndTags();
                }
            }
        }
    });
} else {
    console.warn("Sort select element not found.");
}

function toggleTodoEditorVisibility() {
    const isEnabled = enableTodoCheckbox.checked;
    noteEditorTodosList.style.display = isEnabled ? 'block' : 'none';
    addTodoEditorItemBtn.style.display = isEnabled ? 'inline-block' : 'none';

    if (isCodeCheckbox.checked) {
        noteContentInput.style.display = 'block';
    } else {
        noteContentInput.style.display = isEnabled ? 'none' : 'block';
    }
}
if (enableTodoCheckbox) {
    enableTodoCheckbox.addEventListener('change', toggleTodoEditorVisibility);
}
if (isCodeCheckbox) {
    isCodeCheckbox.addEventListener('change', toggleTodoEditorVisibility);
}

function addTodoItemToEditor(todo = { id: '', text: '', completed: false, priority: 'medium', deadline: null }) {
    const listItem = document.createElement('li');
    listItem.classList.add('todo-editor-item');
    const todoId = todo.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    listItem.dataset.todoId = todoId;

    const mainDiv = document.createElement('div');
    mainDiv.classList.add('todo-editor-item-main');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('todo-editor-item-checkbox');
    checkbox.checked = todo.completed;
    checkbox.disabled = true;

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.classList.add('todo-editor-item-text');
    textInput.placeholder = 'Nội dung công việc...';
    textInput.value = todo.text;

    mainDiv.appendChild(checkbox);
    mainDiv.appendChild(textInput);

    const metaDiv = document.createElement('div');
    metaDiv.classList.add('todo-editor-item-meta');

    const prioritySelect = document.createElement('select');
    prioritySelect.classList.add('todo-editor-item-priority');
    ['medium', 'low', 'high'].forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        let priorityText = 'Trung bình';
        if (p === 'low') priorityText = 'Thấp';
        else if (p === 'high') priorityText = 'Cao';
        option.textContent = `Ưu tiên: ${priorityText}`;
        if (p === (todo.priority || 'medium')) option.selected = true;
        prioritySelect.appendChild(option);
    });

    const deadlineInput = document.createElement('input');
    deadlineInput.type = 'date';
    deadlineInput.classList.add('todo-editor-item-deadline');
    deadlineInput.value = todo.deadline || '';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.classList.add('todo-editor-item-delete-btn');
    deleteButton.textContent = 'Xóa';
    deleteButton.addEventListener('click', () => {
        listItem.remove();
    });

    metaDiv.appendChild(prioritySelect);
    metaDiv.appendChild(deadlineInput);
    metaDiv.appendChild(deleteButton);

    listItem.appendChild(mainDiv);
    listItem.appendChild(metaDiv);
    noteEditorTodosList.appendChild(listItem);
    textInput.focus();
}

if (addTodoEditorItemBtn) {
    addTodoEditorItemBtn.addEventListener('click', () => addTodoItemToEditor());
}

function renderTodosInEditor(todosArray = []) {
    noteEditorTodosList.innerHTML = '';
    if (todosArray && todosArray.length > 0) {
        todosArray.forEach(todo => addTodoItemToEditor(todo));
    }
}

function collectTodosFromEditor() {
    const collectedTodos = [];
    const todoItems = noteEditorTodosList.querySelectorAll('.todo-editor-item');
    todoItems.forEach((item, index) => {
        const textInput = item.querySelector('.todo-editor-item-text');
        const prioritySelect = item.querySelector('.todo-editor-item-priority');
        const deadlineInput = item.querySelector('.todo-editor-item-deadline');
        
        if (textInput && textInput.value.trim() !== '') {
            collectedTodos.push({
                id: item.dataset.todoId.startsWith('temp-') ? `todo-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 3)}` : item.dataset.todoId,
                text: textInput.value.trim(),
                completed: false,
                priority: prioritySelect ? prioritySelect.value : 'medium',
                deadline: deadlineInput && deadlineInput.value ? deadlineInput.value : null,
                order: index
            });
        }
    });
    return collectedTodos;
}

function renderTodosInDetailView(noteId, todosArray = []) {
    noteDetailTodosList.innerHTML = '';
    if (!todosArray || todosArray.length === 0) {
        if (noteDetailTodosProgress) noteDetailTodosProgress.innerHTML = '';
        return;
    }
    todosArray.sort((a, b) => (a.order || 0) - (b.order || 0));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    todosArray.forEach(todo => {
        const listItem = document.createElement('li');
        listItem.classList.add('todo-detail-item');
        listItem.dataset.todoId = todo.id;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('todo-detail-item-checkbox');
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', async (e) => {
            await toggleTodoItemStatus(noteId, todo.id, e.target.checked);
        });

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('todo-detail-item-content');

        const textSpan = document.createElement('span');
        textSpan.classList.add('todo-detail-item-text');
        textSpan.textContent = todo.text;
        if (todo.completed) {
            textSpan.classList.add('completed');
        }
        contentDiv.appendChild(textSpan);

        const metaDisplayDiv = document.createElement('div');
        metaDisplayDiv.classList.add('todo-detail-item-meta-display');

        if (todo.priority) {
            const prioritySpan = document.createElement('span');
            prioritySpan.classList.add('todo-detail-item-priority', `priority-${todo.priority}`);
            let priorityText = 'Trung bình';
            if (todo.priority === 'low') priorityText = 'Thấp';
            else if (todo.priority === 'high') priorityText = 'Cao';
            prioritySpan.textContent = `Ưu tiên: ${priorityText}`;
            metaDisplayDiv.appendChild(prioritySpan);
        }
        if (todo.deadline) {
            const deadlineSpan = document.createElement('span');
            deadlineSpan.classList.add('todo-detail-item-deadline');
            try {
                const deadlineDate = new Date(todo.deadline + "T00:00:00");
                if (!isNaN(deadlineDate)) {
                    deadlineSpan.textContent = `Hạn: ${deadlineDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                    if (!todo.completed && deadlineDate < today) {
                        deadlineSpan.classList.add('overdue');
                        deadlineSpan.title = "Quá hạn!";
                    }
                } else {
                    deadlineSpan.textContent = `Hạn: (không hợp lệ)`;
                }
            } catch (e) {
                deadlineSpan.textContent = `Hạn: (lỗi định dạng)`;
                console.warn("Error parsing deadline date:", todo.deadline, e);
            }
            metaDisplayDiv.appendChild(deadlineSpan);
        }
        if(metaDisplayDiv.hasChildNodes()){
            contentDiv.appendChild(metaDisplayDiv);
        }

        listItem.appendChild(checkbox);
        listItem.appendChild(contentDiv);
        noteDetailTodosList.appendChild(listItem);
    });
    updateTodoProgress(todosArray);
}

async function toggleTodoItemStatus(noteId, todoId, isCompleted) {
    const user = getCurrentUser();
    if (!user || !notesCache[noteId]) return;

    const noteRef = doc(db, "notes", noteId);
    let currentTodos = [];
    const noteInCache = notesCache[noteId];

    if (noteInCache && noteInCache.todos && Array.isArray(noteInCache.todos)) {
        currentTodos = JSON.parse(JSON.stringify(noteInCache.todos));
    } else {
        try {
            const serverNoteSnap = await getDoc(noteRef);
            if (serverNoteSnap.exists() && serverNoteSnap.data().todos && Array.isArray(serverNoteSnap.data().todos)) {
                currentTodos = serverNoteSnap.data().todos;
            } else {
                console.error("Note or todos not found on server for update:", noteId);
                alert("Lỗi: Không tìm thấy danh sách công việc để cập nhật.");
                return;
            }
        } catch (error) {
            console.error("Error fetching note before update:", error);
            alert("Lỗi khi lấy dữ liệu ghi chú để cập nhật.");
            return;
        }
    }

    const updatedTodos = currentTodos.map(t => {
        if (t.id === todoId) {
            return { ...t, completed: isCompleted };
        }
        return t;
    });

    try {
        await updateDoc(noteRef, {
            todos: updatedTodos,
            updatedAt: Timestamp.now()
        });
        console.log(`Todo ${todoId} in note ${noteId} status updated to ${isCompleted} on server.`);
    } catch (error) {
        console.error("Error updating todo status on server:", error);
        alert("Lỗi cập nhật trạng thái công việc.");
    }
}

function updateTodoProgress(todosArray = []) {
    if (!noteDetailTodosProgress) return;
    const totalTasks = todosArray.length;
    if (totalTasks === 0) {
        noteDetailTodosProgress.innerHTML = '';
        return;
    }
    const completedTasks = todosArray.filter(todo => todo.completed).length;
    const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    noteDetailTodosProgress.innerHTML = `
        <span>Hoàn thành: ${completedTasks}/${totalTasks} công việc</span>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${percentage}%;"></div>
        </div>
    `;
}


// --- LOGIC CHO CALENDAR VIEW ---
if (toggleCalendarFiltersBtn && calendarFiltersCollapsible) {
    toggleCalendarFiltersBtn.addEventListener('click', () => {
        const isOpen = calendarFiltersCollapsible.style.display === 'block';
        calendarFiltersCollapsible.style.display = isOpen ? 'none' : 'block';
        toggleCalendarFiltersBtn.setAttribute('aria-expanded', String(!isOpen));
        if (!isOpen) {
            syncFilterDropdownsToState();
        }
    });
}
function updateCalendarFilterIndicator() {
    const calendarFilterIndicatorEl = document.getElementById('calendar-filter-indicator');
    if (!calendarFilterIndicatorEl) return;
    let activeFilterCount = 0;
    if (calendarSelectedTag) activeFilterCount++;
    if (calendarSelectedStatus) activeFilterCount++;
    if (calendarSelectedPriority) activeFilterCount++;

    if (activeFilterCount > 0) {
        calendarFilterIndicatorEl.textContent = `(${activeFilterCount} đang áp dụng)`;
        calendarFilterIndicatorEl.style.display = 'inline';
    } else {
        calendarFilterIndicatorEl.style.display = 'none';
    }
}
if (applyCalendarFiltersBtn) {
    applyCalendarFiltersBtn.addEventListener('click', () => {
        if(calendarTagFilter) calendarSelectedTag = calendarTagFilter.value || null;
        if(calendarStatusFilter) calendarSelectedStatus = calendarStatusFilter.value || '';
        if(calendarPriorityFilter) calendarPriorityFilter = calendarPriorityFilter.value || '';

        initializeCalendar();
        if (calendarFiltersCollapsible) {
            calendarFiltersCollapsible.style.display = 'none';
            if (toggleCalendarFiltersBtn) toggleCalendarFiltersBtn.setAttribute('aria-expanded', 'false');
        }
        updateCalendarFilterIndicator();
    });
}
if (closeCalendarFiltersBtn && calendarFiltersCollapsible) {
    closeCalendarFiltersBtn.addEventListener('click', () => {
        calendarFiltersCollapsible.style.display = 'none';
        if (toggleCalendarFiltersBtn) toggleCalendarFiltersBtn.setAttribute('aria-expanded', 'false');
        syncFilterDropdownsToState();
    });
}
function syncFilterDropdownsToState() {
    if(calendarTagFilter) calendarTagFilter.value = calendarSelectedTag || "";
    if(calendarStatusFilter) calendarStatusFilter.value = calendarSelectedStatus || "";
    if(calendarPriorityFilter) calendarPriorityFilter.value = calendarSelectedPriority || "";
    updateCalendarFilterIndicator();
}
function populateCalendarTagFilter() {
    if (!calendarTagFilter) return;
    const currentFilterValue = calendarTagFilter.value;
    while (calendarTagFilter.options.length > 1) {
        calendarTagFilter.remove(1);
    }
    [...allUserTags].sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        calendarTagFilter.appendChild(option);
    });
    if ([...calendarTagFilter.options].some(opt => opt.value === (calendarSelectedTag || ""))) {
        calendarTagFilter.value = calendarSelectedTag || "";
    } else if (currentFilterValue && [...calendarTagFilter.options].some(opt => opt.value === currentFilterValue)) {
        calendarTagFilter.value = currentFilterValue;
    } else {
         calendarTagFilter.value = "";
    }
}
function initializeCalendar() {
    const user = getCurrentUser();
    const calendarContainerEl = document.getElementById('calendar-container');
    if (!calendarContainerEl) { console.error("Calendar container not found!"); return; }
    if (!user) return;
    syncFilterDropdownsToState();
    console.log(`Initializing calendar... Tag: ${calendarSelectedTag || 'All'}, Status: ${calendarSelectedStatus || 'All'}, Priority: ${calendarSelectedPriority || 'All'}`);
    const events = [];
    const todayStr = new Date().toISOString().split('T')[0];
    Object.values(notesCache).forEach(note => {
        const noteTags = note.tags || [];
        if (calendarSelectedTag && !noteTags.includes(calendarSelectedTag)) {
            return;
        }
        if (note.eventDate) {
            try {
                const eventDate = new Date(note.eventDate + "T00:00:00");
                if (!isNaN(eventDate)) {
                    events.push({
                        title: `📌 ${note.title || 'Ghi chú không tiêu đề'}`,
                        start: note.eventDate,
                        allDay: true,
                        extendedProps: { noteId: note.id, type: 'event', tags: noteTags },
                        color: '#6f42c1',
                        borderColor: '#6f42c1'
                    });
                } else { console.warn(`Invalid eventDate format "${note.eventDate}" in note "${note.title}"`); }
            } catch (e) { console.warn(`Error parsing eventDate "${note.eventDate}" in note "${note.title}":`, e); }
        }
        if (note.todos && Array.isArray(note.todos)) {
            note.todos.forEach(todo => {
                if (calendarSelectedStatus) {
                    if (calendarSelectedStatus === 'completed' && !todo.completed) return;
                    if (calendarSelectedStatus === 'uncompleted' && todo.completed) return;
                }
                if (calendarSelectedPriority && todo.priority !== calendarSelectedPriority) {
                    return;
                }
                if (todo.deadline) {
                    try {
                        const deadlineDate = new Date(todo.deadline + "T00:00:00");
                        if (!isNaN(deadlineDate)) {
                            let eventColor = document.documentElement.style.getPropertyValue('--accent-color') || '#007bff';
                            let titlePrefix = todo.completed ? '✅ ' : '⏳ ';
                            if (todo.completed) {
                                eventColor = '#6c757d';
                            } else if (todo.priority === 'high') {
                                eventColor = '#dc3545';
                                titlePrefix = '🔥 ';
                            } else if (todo.priority === 'low') {
                                eventColor = '#198754';
                                titlePrefix = '🟢 ';
                            }
                            if (!todo.completed && todo.deadline < todayStr) {
                                titlePrefix = '❌ ';
                                eventColor = '#8b0000';
                            }
                            events.push({
                                title: `${titlePrefix}${note.title || 'Ghi chú'}: ${todo.text}`,
                                start: todo.deadline,
                                allDay: true,
                                extendedProps: { noteId: note.id, todoId: todo.id, type: 'todo', tags: noteTags, todoText: todo.text, priority: todo.priority, completed: todo.completed, deadline: todo.deadline },
                                color: eventColor,
                                borderColor: eventColor,
                                classNames: todo.completed ? ['event-completed'] : (todo.deadline < todayStr && !todo.completed ? ['event-overdue'] : [])
                            });
                        } else { console.warn(`Invalid deadline format "${todo.deadline}" in note "${note.title}", todo "${todo.text}"`); }
                    } catch (e) { console.warn(`Error parsing deadline "${todo.deadline}" in note "${note.title}", todo "${todo.text}":`, e); }
                }
            });
        }
    });

    if (calendar) {
        calendar.destroy();
        calendar = null;
        console.log("Previous calendar instance destroyed.");
    }
    const isMobile = window.innerWidth <= 768;
    calendar = new FullCalendar.Calendar(calendarContainerEl, {
        initialView: 'dayGridMonth',
        locale: 'vi',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        },
        buttonText: {
            today: 'Hôm nay',
            month: 'Tháng',
            week: 'Tuần',
            day: 'Ngày',
            list: 'Danh sách'
        },
        events: events,
        dayMaxEvents: isMobile ? 2 : true,
        moreLinkClick: isMobile ? 'popover' : 'popover',
        moreLinkText: function(num) {
            return '+ ' + num + ' mục nữa';
        },
        eventClick: function(info) {
            const noteId = info.event.extendedProps.noteId;
            console.log("Event clicked:", info.event.title, "Note ID:", noteId);
            if (noteId && notesCache[noteId]) {
                showDetailViewUI();
                displayNoteDetailContent(notesCache[noteId]);
            } else {
                console.warn("Note not found in cache for event click:", noteId);
                alert("Không tìm thấy ghi chú tương ứng.");
            }
        },
        dateClick: function(info) {
            console.log('Date clicked: ' + info.dateStr);
            const isMobileWidth = window.innerWidth <= 768;
            if (isMobileWidth) {
                if (confirm(`Tạo ghi chú mới cho ngày ${new Date(info.dateStr + "T00:00:00").toLocaleDateString('vi-VN')}?`)) {
                    showEditorUI(false);
                    clearEditorFields({ eventDate: info.dateStr });
                }
            } else {
                showEditorUI(false);
                clearEditorFields({ eventDate: info.dateStr });
            }
        },
        eventDidMount: function(info) {
            if (info.event.extendedProps) {
                let tooltipContent = `<strong>${info.event.title.replace(/^[📌✅⏳🔥🟢❌\s]+/, '')}</strong>`;
                if (info.event.extendedProps.type === 'todo') {
                    tooltipContent += `<br>Công việc: ${info.event.extendedProps.todoText || 'N/A'}`;
                    if (info.event.extendedProps.priority) {
                        let priorityText = 'Trung bình';
                        if (info.event.extendedProps.priority === 'low') priorityText = 'Thấp';
                        else if (info.event.extendedProps.priority === 'high') priorityText = 'Cao';
                        tooltipContent += `<br>Ưu tiên: ${priorityText}`;
                    }
                    if (info.event.extendedProps.deadline) {
                        try { tooltipContent += `<br>Hạn: ${new Date(info.event.extendedProps.deadline + "T00:00:00").toLocaleDateString('vi-VN')}`; } catch(e){}
                    }
                    tooltipContent += `<br>Trạng thái: ${info.event.extendedProps.completed ? 'Đã hoàn thành' : 'Chưa hoàn thành'}`;
                } else if (info.event.extendedProps.type === 'event') {
                    const note = notesCache[info.event.extendedProps.noteId];
                    if (note && note.content) {
                        tooltipContent += `<br><small>${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}</small>`;
                    }
                }
                if (tippy && typeof tippy === 'function') {
                    tippy(info.el, {
                        content: tooltipContent,
                        allowHTML: true,
                        theme: 'light-border',
                        placement: 'top',
                        arrow: true,
                        animation: 'shift-away',
                    });
                }
            }
        },
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false
        },
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false
        },
    });
    calendar.render();
    console.log("Calendar rendered/updated.");
}

// --- Banner Việc Gấp ---
function displayGlobalUrgentTask() {
    const user = getCurrentUser();
    const urgentTaskBannerEl = document.getElementById('urgent-task-banner');
    if (!user || !urgentTaskBannerEl) return;
    let mostUrgentTodo = null;
    let urgentNoteDetails = null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Object.values(notesCache).forEach(note => {
        if (note.todos && Array.isArray(note.todos)) {
            note.todos.forEach(todo => {
                if (!todo.completed && todo.deadline) {
                    try {
                        const deadlineDate = new Date(todo.deadline + "T00:00:00");
                        if (!isNaN(deadlineDate)) {
                            if (mostUrgentTodo === null) {
                                mostUrgentTodo = todo;
                                urgentNoteDetails = note;
                            } else {
                                const currentMostUrgentDeadline = new Date(mostUrgentTodo.deadline + "T00:00:00");
                                const isCurrentOverdue = currentMostUrgentDeadline < today;
                                const isNewOverdue = deadlineDate < today;
                                const priorityOrder = { 'high': 2, 'medium': 1, 'low': 0 };

                                if (isNewOverdue && !isCurrentOverdue) {
                                    mostUrgentTodo = todo; urgentNoteDetails = note;
                                } else if (isNewOverdue === isCurrentOverdue) {
                                    if (deadlineDate < currentMostUrgentDeadline) {
                                        mostUrgentTodo = todo; urgentNoteDetails = note;
                                    } else if (deadlineDate.getTime() === currentMostUrgentDeadline.getTime()) {
                                        if ((priorityOrder[todo.priority] || 0) > (priorityOrder[mostUrgentTodo.priority] || 0)) {
                                            mostUrgentTodo = todo; urgentNoteDetails = note;
                                        }
                                    }
                                } else if (!isNewOverdue && isCurrentOverdue) {
                                    // Giữ lại việc đã quá hạn (current)
                                }
                            }
                        }
                    } catch (e) { console.warn("Error parsing deadline for urgent task banner:", e); }
                }
            });
        }
    });

    if (mostUrgentTodo && urgentNoteDetails) {
        let fullDeadlineStatusText = '';
        let deadlineStatusClass = '';
        const deadlineDate = new Date(mostUrgentTodo.deadline + "T00:00:00");
        const diffTime = deadlineDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            fullDeadlineStatusText = `(🔴 QUÁ HẠN ${Math.abs(diffDays)} ngày)`;
            deadlineStatusClass = 'overdue';
        } else if (diffDays === 0) {
            fullDeadlineStatusText = `(🔵 HÔM NAY)`;
            deadlineStatusClass = 'today';
        } else if (diffDays === 1) {
            fullDeadlineStatusText = `(🟡 NGÀY MAI)`;
            deadlineStatusClass = 'tomorrow';
        } else if (diffDays > 1) {
            fullDeadlineStatusText = `(⏳ Còn ${diffDays} ngày)`;
            deadlineStatusClass = 'upcoming';
        }

        let fullPriorityText = '';
        if (mostUrgentTodo.priority && mostUrgentTodo.priority !== 'medium') {
            if (mostUrgentTodo.priority === 'high') {
                fullPriorityText = '🔥 Cao';
            } else if (mostUrgentTodo.priority === 'low') {
                fullPriorityText = '🟢 Thấp';
            }
        }

        const taskContent = mostUrgentTodo.text.substring(0, 40) + (mostUrgentTodo.text.length > 40 ? '...' : '');
        const noteTitleText = (urgentNoteDetails.title || 'Ghi chú không tiêu đề').substring(0, 25) + ((urgentNoteDetails.title || '').length > 25 ? '...' : '');
        
        urgentTaskBannerEl.innerHTML = `
            <div class="urgent-task-banner-line1">
                <span class="urgent-task-banner-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16" style="vertical-align: middle; margin-right: 5px;">
                        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                    </svg>
                    VIỆC GẤP:
                </span>
                <span class="urgent-task-content">${highlightText(taskContent, currentSearchTerm)}</span>
            </div>
            <div class="urgent-task-banner-line2">
                <span class="urgent-task-deadline">
                    Hạn: ${new Date(mostUrgentTodo.deadline + "T00:00:00").toLocaleDateString('vi-VN')}
                    ${fullDeadlineStatusText ? `<span class="deadline-status ${deadlineStatusClass}">${fullDeadlineStatusText}</span>` : ''}
                </span>
                ${fullPriorityText ? `<span class="urgent-task-priority-banner priority-${mostUrgentTodo.priority}">${fullPriorityText}</span>` : ''}
                <span class="urgent-task-note-link-container">
                    (Note: <span class="urgent-task-note-link" data-note-id="${urgentNoteDetails.id}">${highlightText(noteTitleText, currentSearchTerm)}</span>)
                </span>
            </div>
        `;
        const noteLink = urgentTaskBannerEl.querySelector('.urgent-task-note-link');
        if (noteLink) {
            noteLink.addEventListener('click', () => {
                if (notesCache[urgentNoteDetails.id]) {
                    showDetailViewUI();
                    displayNoteDetailContent(notesCache[urgentNoteDetails.id]);
                }
            });
        }
        urgentTaskBannerEl.style.display = 'block';
    } else {
        urgentTaskBannerEl.style.display = 'none';
    }
}


// --- Callbacks cho AuthService ---
function handleUserLogin(user) {
    console.log("Main script: User logged in, preparing UI and data...", user ? user.email : 'N/A');
    
    setupInitialUIForLoggedInState(activeTag);
    
    loadNotesAndTags();
    loadTrashedNotes();
    
    syncFilterDropdownsToState();
    // closeMobileSidebar(); // uiService.showMainNotesViewUI đã gọi
}

function handleUserLogout() {
    console.log("Main script: User logged out, cleaning up UI and data...");
    
    if (notesUnsubscribe) { notesUnsubscribe(); notesUnsubscribe = null; }
    if (trashUnsubscribe) { trashUnsubscribe(); trashUnsubscribe = null; }
    notesCache = {};
    trashedNotesCache = {};
    allUserTags.clear();
    
    activeTag = null;
    currentNoteId = null;
    currentSearchTerm = '';
    currentSortOption = 'updatedAt_desc';
    calendarSelectedTag = null;
    calendarSelectedStatus = '';
    calendarSelectedPriority = '';

    clearEditor();
    if (notesListContainer) notesListContainer.innerHTML = '';
    if (trashListContainer) trashListContainer.innerHTML = '<p>Thùng rác trống.</p>';
    if (tagsListContainer) tagsListContainer.innerHTML = '';
    
    if(searchInput) {
        searchInput.value = '';
        // searchInput.disabled = true; // Việc này được quản lý bởi class logged-out trên body
    }
    if(sortSelect) {
        sortSelect.value = currentSortOption;
        // sortSelect.disabled = true; // Việc này được quản lý bởi class logged-out trên body
    }
    // if(addNoteBtn) addNoteBtn.disabled = true; // Việc này được quản lý bởi class logged-out trên body
    
    setupInitialUIForLoggedOutState();
    syncFilterDropdownsToState();
    // closeMobileSidebar(); // uiService.setupInitialUIForLoggedOutState đã gọi
}


// --- Khởi chạy ---
document.addEventListener('DOMContentLoaded', () => {
    if (noteDetailView && codeBlock) {
        initThemeService(noteDetailView, codeBlock);
    } else {
        console.error("Lỗi: Không tìm thấy noteDetailView hoặc codeBlock để khởi tạo ThemeService.");
    }

    initUIService();

    const backButton = document.getElementById('back-to-grid-btn');
    if (backButton) {
        backButton.addEventListener('click', handleBackButtonUI);
    }

    // Gắn listener cho các nút điều hướng sidebar chính
    const showAllNotesBtnElRef = document.getElementById('show-all-notes-btn');
    const showCalendarBtnElRef = document.getElementById('show-calendar-btn');
    const showTrashBtnElRef = document.getElementById('show-trash-btn');

    if (showAllNotesBtnElRef) { showAllNotesBtnElRef.addEventListener('click', () => showMainNotesViewUI(activeTag)); }
    if (showCalendarBtnElRef) { showCalendarBtnElRef.addEventListener('click', showCalendarViewUI); }
    if (showTrashBtnElRef) { showTrashBtnElRef.addEventListener('click', showTrashNotesViewUI); }


    initAuthService({
        onLogin: handleUserLogin,
        onLogout: handleUserLogout
    });
    
    toggleTodoEditorVisibility(); 
    if(sortSelect) sortSelect.value = currentSortOption; 
    syncFilterDropdownsToState(); 
});

console.log("Main script (script.js) loaded. Waiting for Auth state change or DOMContentLoaded events...");
