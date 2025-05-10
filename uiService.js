// uiService.js

// --- Biến trạng thái cục bộ của module ---
let currentViewInternal = 'notes'; // View mặc định khi đăng nhập
let previousViewInternal = 'notes';

// --- Tham chiếu DOM (sẽ được gán trong initUIService) ---
let mobileMenuBtnEl, sidebarEl, sidebarOverlayEl, contentAreaEl,
    notesGridViewEl, calendarViewEl, trashViewEl, noteDetailViewEl, noteEditorViewEl,
    fabAddNoteBtnEl, scrollToTopBtnEl, mainViewTitleEl, activeTagDisplayEl,
    backToGridBtnEl, welcomeMessageEl,
    // Các nút điều hướng sidebar
    showAllNotesBtnEl, showCalendarBtnEl, showTrashBtnEl,
    // Bộ lọc lịch
    calendarFiltersCollapsibleEl, toggleCalendarFiltersBtnEl;


/**
 * Mở mobile sidebar.
 */
function openMobileSidebar() {
    if (sidebarEl) document.body.classList.add('sidebar-open');
}

/**
 * Đóng mobile sidebar.
 */
function closeMobileSidebar() {
    if (sidebarEl) document.body.classList.remove('sidebar-open');
}

/**
 * Xử lý sự kiện cuộn trang để hiển thị/ẩn nút "Scroll to Top".
 */
function handleScroll() {
    if (!scrollToTopBtnEl) return;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    scrollToTopBtnEl.style.display = (scrollTop > 200) ? "block" : "none";
}

/**
 * Cuộn lên đầu trang.
 */
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Đặt trạng thái active cho nút sidebar tương ứng.
 * @param {string | null} activeButtonId - ID của nút cần active, hoặc null để bỏ active tất cả.
 */
export function setActiveSidebarButtonUI(activeButtonId) {
    [showAllNotesBtnEl, showCalendarBtnEl, showTrashBtnEl].forEach(btn => {
        if (btn) {
            btn.classList.toggle('active', btn.id === activeButtonId);
        }
    });
}

/**
 * Cập nhật tiêu đề chính của view và hiển thị tag đang active (nếu có).
 * @param {string} title - Tiêu đề chính.
 * @param {string | null} activeTag - Tag đang được lọc.
 */
export function updateMainViewTitleUI(title, activeTag = null) {
    if (mainViewTitleEl) mainViewTitleEl.textContent = title;
    if (activeTagDisplayEl) {
        activeTagDisplayEl.textContent = activeTag ? `(Tag: ${activeTag})` : '';
    }
}

/**
 * Ẩn tất cả các view chính.
 */
function hideAllMainViews() {
    if (notesGridViewEl) notesGridViewEl.style.display = 'none';
    if (calendarViewEl) calendarViewEl.style.display = 'none';
    if (trashViewEl) trashViewEl.style.display = 'none';
    if (noteDetailViewEl) noteDetailViewEl.style.display = 'none';
    if (noteEditorViewEl) noteEditorViewEl.style.display = 'none';
    if (welcomeMessageEl) welcomeMessageEl.style.display = 'none'; // Ẩn cả welcome message
    if (calendarFiltersCollapsibleEl) calendarFiltersCollapsibleEl.style.display = 'none';
    if (toggleCalendarFiltersBtnEl) toggleCalendarFiltersBtnEl.setAttribute('aria-expanded', 'false');
}

/**
 * Hiển thị view lưới ghi chú chính.
 * @param {string | null} activeTag - Tag đang được lọc (nếu có).
 */
export function showMainNotesViewUI(activeTag = null) {
    hideAllMainViews();
    if (notesGridViewEl) notesGridViewEl.style.display = 'block';
    if (fabAddNoteBtnEl) fabAddNoteBtnEl.style.display = 'flex';
    
    previousViewInternal = currentViewInternal;
    currentViewInternal = 'notes';
    
    updateMainViewTitleUI("Tất cả Ghi chú", activeTag);
    setActiveSidebarButtonUI('show-all-notes-btn');

    // Logic ẩn/hiện các nút điều hướng sidebar
    if (showAllNotesBtnEl) showAllNotesBtnEl.style.display = 'none';
    if (showCalendarBtnEl) showCalendarBtnEl.style.display = 'flex';
    if (showTrashBtnEl) showTrashBtnEl.style.display = 'flex';


    if (contentAreaEl) contentAreaEl.scrollTop = 0;
    console.log("UI Service: Showing Main Notes View");
}

/**
 * Hiển thị view lịch.
 */
export function showCalendarViewUI() {
    hideAllMainViews();
    if (calendarViewEl) calendarViewEl.style.display = 'block';
    if (fabAddNoteBtnEl) fabAddNoteBtnEl.style.display = 'none';

    previousViewInternal = currentViewInternal;
    currentViewInternal = 'calendar';
    
    // Tiêu đề cho view lịch được quản lý bởi FullCalendar hoặc header riêng của nó
    setActiveSidebarButtonUI('show-calendar-btn');

    if (showAllNotesBtnEl) showAllNotesBtnEl.style.display = 'flex';
    if (showCalendarBtnEl) showCalendarBtnEl.style.display = 'none';
    if (showTrashBtnEl) showTrashBtnEl.style.display = 'flex';

    if (contentAreaEl) contentAreaEl.scrollTop = 0;
    console.log("UI Service: Showing Calendar View");
}

/**
 * Hiển thị view thùng rác.
 */
export function showTrashNotesViewUI() {
    hideAllMainViews();
    if (trashViewEl) trashViewEl.style.display = 'block';
    if (fabAddNoteBtnEl) fabAddNoteBtnEl.style.display = 'none';

    previousViewInternal = currentViewInternal;
    currentViewInternal = 'trash';
    
    // Tiêu đề cho view thùng rác thường cố định
    setActiveSidebarButtonUI('show-trash-btn');

    if (showAllNotesBtnEl) showAllNotesBtnEl.style.display = 'flex';
    if (showCalendarBtnEl) showCalendarBtnEl.style.display = 'flex';
    if (showTrashBtnEl) showTrashBtnEl.style.display = 'none';

    if (contentAreaEl) contentAreaEl.scrollTop = 0;
    console.log("UI Service: Showing Trash View");
}

/**
 * Hiển thị view soạn thảo/chỉnh sửa ghi chú.
 * @param {boolean} isEditing - True nếu đang chỉnh sửa, false nếu tạo mới.
 */
export function showEditorUI(isEditing) {
    hideAllMainViews();
    if (noteEditorViewEl) noteEditorViewEl.style.display = 'block';
    if (fabAddNoteBtnEl) fabAddNoteBtnEl.style.display = 'none';

    if (currentViewInternal !== 'editor' && currentViewInternal !== 'detail') {
        previousViewInternal = currentViewInternal;
    }
    currentViewInternal = 'editor';
    
    const editorTitleEl = document.getElementById('editor-title'); // Cần DOM element này
    if (editorTitleEl) editorTitleEl.textContent = isEditing ? "Sửa Ghi chú" : "Tạo Ghi chú Mới";
    
    closeMobileSidebar();
    if (contentAreaEl) contentAreaEl.scrollTop = 0;
    console.log("UI Service: Showing Editor View");
}

/**
 * Hiển thị view chi tiết ghi chú.
 */
export function showDetailViewUI() {
    hideAllMainViews();
    if (noteDetailViewEl) noteDetailViewEl.style.display = 'block';
    if (fabAddNoteBtnEl) fabAddNoteBtnEl.style.display = 'none';

    if (currentViewInternal !== 'editor' && currentViewInternal !== 'detail') {
        previousViewInternal = currentViewInternal;
    }
    currentViewInternal = 'detail';
    
    closeMobileSidebar();
    if (contentAreaEl) contentAreaEl.scrollTop = 0;
    console.log("UI Service: Showing Detail View");
}

/**
 * Xử lý sự kiện click nút "Quay lại".
 * Hàm này sẽ được gọi từ event listener trong script.js (hoặc module quản lý note).
 */
export function handleBackButtonUI() {
    console.log("UI Service: Handling Back Button. Previous view:", previousViewInternal);
    if (fabAddNoteBtnEl) {
        // Hiển thị FAB nếu quay lại view notes và có người dùng đăng nhập
        // (việc kiểm tra người dùng đăng nhập nên ở logic gọi hàm này)
        fabAddNoteBtnEl.style.display = (previousViewInternal === 'notes') ? 'flex' : 'none';
    }

    if (previousViewInternal === 'calendar') {
        showCalendarViewUI();
    } else if (previousViewInternal === 'trash') {
        showTrashNotesViewUI();
    } else { // Mặc định quay về view notes
        showMainNotesViewUI(null); // Truyền null cho activeTag để reset
    }
}

/**
 * Thiết lập UI ban đầu cho trạng thái chưa đăng nhập.
 */
export function setupInitialUIForLoggedOutState() {
    hideAllMainViews();
    if (welcomeMessageEl) welcomeMessageEl.style.display = 'block';
    if (fabAddNoteBtnEl) fabAddNoteBtnEl.style.display = 'none';
    // Các nút trên header và class body (logged-in/out) được quản lý bởi authService
    console.log("UI Service: Setup UI for logged out state.");
}

/**
 * Thiết lập UI ban đầu cho trạng thái đã đăng nhập.
 * @param {string | null} activeTag - Tag đang active (nếu có, từ state).
 */
export function setupInitialUIForLoggedInState(activeTag = null) {
    if (welcomeMessageEl) welcomeMessageEl.style.display = 'none';
    // Mặc định hiển thị view notes khi đăng nhập
    showMainNotesViewUI(activeTag);
    console.log("UI Service: Setup UI for logged in state.");
}


/**
 * Khởi tạo dịch vụ UI.
 * Gán các DOM elements và thiết lập event listeners cho các thành phần UI chung.
 */
export function initUIService() {
    // Gán DOM elements
    mobileMenuBtnEl = document.getElementById('mobile-menu-btn');
    sidebarEl = document.getElementById('sidebar');
    sidebarOverlayEl = document.getElementById('sidebar-overlay');
    contentAreaEl = document.getElementById('content-area');
    notesGridViewEl = document.getElementById('notes-grid-view');
    calendarViewEl = document.getElementById('calendar-view');
    trashViewEl = document.getElementById('trash-view');
    noteDetailViewEl = document.getElementById('note-detail-view');
    noteEditorViewEl = document.getElementById('note-editor-view');
    fabAddNoteBtnEl = document.getElementById('fab-add-note-btn');
    scrollToTopBtnEl = document.getElementById('scrollToTopBtn');
    mainViewTitleEl = document.getElementById('main-view-title');
    activeTagDisplayEl = document.getElementById('active-tag-display');
    backToGridBtnEl = document.getElementById('back-to-grid-btn'); // Sẽ gắn listener ở script.js
    welcomeMessageEl = document.getElementById('welcome-message');
    showAllNotesBtnEl = document.getElementById('show-all-notes-btn');
    showCalendarBtnEl = document.getElementById('show-calendar-btn');
    showTrashBtnEl = document.getElementById('show-trash-btn');
    calendarFiltersCollapsibleEl = document.getElementById('calendar-filters-collapsible');
    toggleCalendarFiltersBtnEl = document.getElementById('toggle-calendar-filters-btn');


    // Event listeners cho Mobile Sidebar
    if (mobileMenuBtnEl) {
        mobileMenuBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            document.body.classList.contains('sidebar-open') ? closeMobileSidebar() : openMobileSidebar();
        });
    }
    if (sidebarOverlayEl) {
        sidebarOverlayEl.addEventListener('click', closeMobileSidebar);
    }
    if (sidebarEl) { // Đóng sidebar khi click vào item trên mobile
        sidebarEl.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && e.target.closest('a, button')) {
                setTimeout(closeMobileSidebar, 150);
            }
        });
    }

    // Event listeners cho Scroll-to-Top button
    if (scrollToTopBtnEl) {
        window.addEventListener('scroll', handleScroll);
        scrollToTopBtnEl.addEventListener('click', scrollToTop);
    } else {
        console.warn("Scroll to top button element not found for UIService.");
    }
    
    // Listener cho các nút điều hướng chính trong sidebar (sẽ được gắn trong script.js)
    // Listener cho backToGridBtn (sẽ được gắn trong script.js)

    console.log("UI service initialized.");
}

// Export các hàm getter cho state nếu cần thiết (ví dụ: cho logic back button)
export function getCurrentUIType() { return currentViewInternal; }
export function getPreviousUIType() { return previousViewInternal; }
