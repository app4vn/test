// themeService.js

// Import các hàm tiện ích cần thiết
import { hexToRgb, darkenColor } from './utils.js';

// Biến trạng thái cục bộ của module
let currentTheme = 'light';
let currentAccentColor = '#007bff';
let currentContentFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

// Tham chiếu DOM (sẽ được gán trong initThemeService)
let themeButtons;
let prismThemeLink;
let accentColorButtons;
let fontSelect;
let noteDetailViewElement; // Để truyền từ script.js
let codeBlockElement;      // Để truyền từ script.js

/**
 * Áp dụng chủ đề cho toàn bộ ứng dụng.
 * @param {string} themeName - Tên của chủ đề (ví dụ: 'light', 'dark').
 */
function applyTheme(themeName) {
    console.log("Applying theme:", themeName);
    document.body.classList.remove('theme-dark', 'theme-gruvbox-light', 'theme-dracula', 'theme-solarized-light');
    if (themeName !== 'light') {
        document.body.classList.add(`theme-${themeName}`);
    }

    if (themeButtons) {
        themeButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.theme === themeName);
        });
    }

    if (prismThemeLink) {
        let prismThemeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css'; // Mặc định cho light, gruvbox-light
        if (themeName === 'dark' || themeName === 'dracula') {
            prismThemeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css';
        } else if (themeName === 'solarized-light') {
            prismThemeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-solarizedlight.min.css';
        }
        prismThemeLink.href = prismThemeUrl;
    }

    try {
        localStorage.setItem('noteAppTheme', themeName);
        currentTheme = themeName;
    } catch (e) {
        console.error("Failed to save theme to localStorage:", e);
    }

    // Re-highlight code nếu đang ở view chi tiết và có code
    if (noteDetailViewElement && codeBlockElement && noteDetailViewElement.style.display === 'block' && codeBlockElement.textContent && window.Prism) {
        Prism.highlightElement(codeBlockElement);
    }
}

/**
 * Tải chủ đề đã lưu từ localStorage.
 */
function loadSavedTheme() {
    try {
        const savedTheme = localStorage.getItem('noteAppTheme');
        if (savedTheme && ['light', 'dark', 'gruvbox-light', 'dracula', 'solarized-light'].includes(savedTheme)) {
            applyTheme(savedTheme);
        } else {
            applyTheme('light'); // Mặc định là 'light'
        }
    } catch (e) {
        console.error("Failed to load theme from localStorage:", e);
        applyTheme('light');
    }
}

/**
 * Áp dụng màu nhấn cho ứng dụng.
 * @param {string} colorHex - Mã màu HEX của màu nhấn.
 */
function applyAccentColor(colorHex) {
    console.log("Applying accent color:", colorHex);
    const root = document.documentElement;
    root.style.setProperty('--accent-color', colorHex);

    const hoverColor = darkenColor(colorHex, 15); // Sử dụng hàm darkenColor từ utils.js
    root.style.setProperty('--accent-color-hover', hoverColor);

    const rgb = hexToRgb(colorHex); // Sử dụng hàm hexToRgb từ utils.js
    if (rgb) {
        root.style.setProperty('--shadow-focus', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
    }

    if (accentColorButtons) {
        accentColorButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.accent === colorHex);
        });
    }

    try {
        localStorage.setItem('noteAppAccentColor', colorHex);
        currentAccentColor = colorHex;
    } catch (e) {
        console.error("Failed to save accent color to localStorage:", e);
    }
}

/**
 * Tải màu nhấn đã lưu từ localStorage.
 */
function loadSavedAccentColor() {
    try {
        const savedAccentColor = localStorage.getItem('noteAppAccentColor');
        if (savedAccentColor) {
            applyAccentColor(savedAccentColor);
        } else {
            applyAccentColor('#007bff'); // Màu mặc định
        }
    } catch (e) {
        console.error("Failed to load accent color from localStorage:", e);
        applyAccentColor('#007bff');
    }
}

/**
 * Áp dụng font chữ cho nội dung.
 * @param {string} fontFamily - Chuỗi CSS cho font-family.
 */
function applyContentFont(fontFamily) {
    console.log("Applying content font:", fontFamily);
    document.documentElement.style.setProperty('--font-content', fontFamily);
    
    // Cập nhật trực tiếp font cho textarea nếu nó tồn tại (sẽ được xử lý bởi module editor sau này)
    const noteContentInputElement = document.getElementById('note-content-input');
    if (noteContentInputElement) {
        noteContentInputElement.style.fontFamily = fontFamily;
    }

    if (fontSelect && fontSelect.value !== fontFamily) {
        fontSelect.value = fontFamily;
    }

    try {
        localStorage.setItem('noteAppContentFont', fontFamily);
        currentContentFont = fontFamily;
    } catch (e) {
        console.error("Failed to save content font to localStorage:", e);
    }
}

/**
 * Tải font chữ đã lưu từ localStorage.
 */
function loadSavedContentFont() {
    try {
        const savedFont = localStorage.getItem('noteAppContentFont');
        const defaultFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";
        if (savedFont) {
            applyContentFont(savedFont);
        } else {
            applyContentFont(defaultFont);
        }
    } catch (e) {
        console.error("Failed to load content font from localStorage:", e);
        const defaultFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";
        applyContentFont(defaultFont);
    }
}

/**
 * Khởi tạo dịch vụ quản lý theme.
 * Gán các DOM elements và thiết lập event listeners.
 * @param {HTMLElement} noteDetailViewEl - Phần tử DOM của view chi tiết ghi chú.
 * @param {HTMLElement} codeBlockEl - Phần tử DOM của khối code trong view chi tiết.
 */
export function initThemeService(noteDetailViewEl, codeBlockEl) {
    themeButtons = document.querySelectorAll('.sidebar-settings .theme-button');
    prismThemeLink = document.getElementById('prism-theme-link');
    accentColorButtons = document.querySelectorAll('.sidebar-settings .accent-color-button');
    fontSelect = document.querySelector('.sidebar-settings #font-select');
    
    noteDetailViewElement = noteDetailViewEl;
    codeBlockElement = codeBlockEl;

    if (themeButtons.length > 0) {
        themeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const selectedTheme = button.dataset.theme;
                if (selectedTheme !== currentTheme) {
                    applyTheme(selectedTheme);
                }
            });
        });
    } else {
        console.warn("Theme buttons not found.");
    }

    if (accentColorButtons.length > 0) {
        accentColorButtons.forEach(button => {
            button.addEventListener('click', () => {
                const selectedAccent = button.dataset.accent;
                if (selectedAccent !== currentAccentColor) {
                    applyAccentColor(selectedAccent);
                }
            });
        });
    } else {
        console.warn("Accent color buttons not found.");
    }
    
    if (fontSelect) {
        fontSelect.addEventListener('change', (e) => {
            const selectedFont = e.target.value;
            if (selectedFont !== currentContentFont) {
                applyContentFont(selectedFont);
            }
        });
    } else {
        console.warn("Font select element not found.");
    }

    // Tải các cài đặt đã lưu khi khởi tạo
    loadSavedTheme();
    loadSavedAccentColor();
    loadSavedContentFont();

    console.log("Theme service initialized.");
}
