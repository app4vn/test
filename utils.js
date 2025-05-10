// utils.js

/**
 * Chuyển đổi các URL trong một chuỗi văn bản thành thẻ <a> HTML.
 * @param {string} text - Chuỗi văn bản đầu vào.
 * @returns {string} Chuỗi HTML với các URL đã được chuyển đổi hoặc chuỗi rỗng nếu đầu vào rỗng.
 */
export function linkify(text) {
    if (!text) return '';
    const urlRegex = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%?=~_|])/ig;
    // Thay thế URL bằng thẻ <a>
    let linkedText = text.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Thay thế ký tự xuống dòng bằng <br>
    return linkedText.replace(/\n/g, '<br>');
}

/**
 * Tô sáng các từ khóa tìm kiếm trong một chuỗi văn bản.
 * @param {string} text - Chuỗi văn bản gốc.
 * @param {string} searchTerm - Từ khóa tìm kiếm.
 * @returns {string} Chuỗi HTML với từ khóa đã được tô sáng hoặc văn bản gốc (đã thoát HTML) nếu không có từ khóa.
 */
export function highlightText(text, searchTerm) {
    if (!text) return ''; // Trả về chuỗi rỗng nếu text đầu vào là null hoặc undefined

    // Nếu không có searchTerm, chỉ cần thoát HTML và thay thế newline
    if (!searchTerm) {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = text; // Gán textContent để tự động thoát HTML
        return tempDiv.innerHTML.replace(/\n/g, '<br>');
    }

    // Thoát các ký tự đặc biệt trong searchTerm để sử dụng trong regex
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');

    // Sử dụng textContent để lấy phiên bản đã thoát HTML của text gốc
    // rồi mới thay thế newline và highlight
    const tempDiv = document.createElement('div');
    tempDiv.textContent = text;
    const escapedText = tempDiv.innerHTML.replace(/\n/g, '<br>');

    return escapedText.replace(regex, '<span class="search-highlight">$1</span>');
}

/**
 * Chuyển đổi mã màu HEX sang đối tượng RGB.
 * @param {string} hex - Mã màu HEX (ví dụ: "#RRGGBB" hoặc "RRGGBB").
 * @returns {{r: number, g: number, b: number} | null} Đối tượng RGB hoặc null nếu HEX không hợp lệ.
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Làm tối một mã màu HEX theo một tỷ lệ phần trăm.
 * @param {string} hexColor - Mã màu HEX gốc.
 * @param {number} percent - Tỷ lệ phần trăm làm tối (0-100).
 * @returns {string} Mã màu HEX đã được làm tối.
 */
export function darkenColor(hexColor, percent) {
    const rgbColor = hexToRgb(hexColor);
    if (!rgbColor) return hexColor; // Trả về màu gốc nếu không parse được

    let { r, g, b } = rgbColor;
    const factor = 1 - percent / 100;

    r = Math.max(0, Math.min(255, Math.round(r * factor)));
    g = Math.max(0, Math.min(255, Math.round(g * factor)));
    b = Math.max(0, Math.min(255, Math.round(b * factor)));

    // Chuyển đổi lại sang HEX
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Tìm deadline sắp tới gần nhất từ danh sách todos của một note.
 * Chỉ xem xét các todos chưa hoàn thành và có deadline từ hôm nay trở đi.
 * @param {object} note - Đối tượng ghi chú, chứa mảng `todos`.
 * @returns {Date | null} Đối tượng Date của deadline gần nhất, hoặc null nếu không có.
 */
export function getNearestUpcomingDeadline(note) {
    if (!note || !note.todos || !note.todos.length === 0) {
        return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Đặt về đầu ngày để so sánh chính xác

    let nearestDeadline = null;

    note.todos.forEach(todo => {
        if (!todo.completed && todo.deadline) {
            try {
                // Đảm bảo deadline được phân tích là ngày địa phương, không bị ảnh hưởng bởi múi giờ
                const deadlineDate = new Date(todo.deadline + "T00:00:00");
                if (!isNaN(deadlineDate) && deadlineDate >= today) {
                    if (nearestDeadline === null || deadlineDate < nearestDeadline) {
                        nearestDeadline = deadlineDate;
                    }
                }
            } catch (e) {
                console.warn("Invalid date format in todo for getNearestUpcomingDeadline:", todo, e);
            }
        }
    });
    return nearestDeadline;
}

console.log("Utility functions module (utils.js) loaded.");
