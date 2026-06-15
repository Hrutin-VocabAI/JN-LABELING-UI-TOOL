// --- State Management ---
let state = {
    images_dir: "",
    output_dir: "",
    images: [],       // list of filenames
    labeled: {},      // filename -> category (string)
    current_index: 0,
    has_history: false,
    initialized: false
};

// Zoom and Pan state
let zoomState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
};

// Category details
const CATEGORIES = [
    { id: "1", key: "1", label: "Category 1" },
    { id: "2", key: "2", label: "Category 2" },
    { id: "3", key: "3", label: "Category 3" },
    { id: "4", key: "4", label: "Category 4" },
    { id: "5", key: "5", label: "Category 5" },
    { id: "6", key: "6", label: "Category 6" },
    { id: "7", key: "7", label: "Category 7" },
    { id: "8", key: "8", label: "Category 8" },
    { id: "9", key: "9", label: "Category 9" },
    { id: "10", key: "0", label: "Category 10" },
    { id: "11", key: "q", label: "Category 11" },
    { id: "12", key: "w", label: "Category 12" },
    { id: "13", key: "e", label: "Category 13" }
];

// --- DOM Elements ---
const configForm = document.getElementById('config-form');
const imagesDirInput = document.getElementById('images-dir-input');
const outputDirInput = document.getElementById('output-dir-input');
const btnInitialize = document.getElementById('btn-initialize');
const statusIndicator = document.getElementById('active-session-indicator');
const pathDisplay = document.getElementById('session-path-display');

const statTotal = document.getElementById('stat-total');
const statLabeled = document.getElementById('stat-labeled');
const statProgressPct = document.getElementById('stat-progress-pct');
const progressBarFill = document.getElementById('progress-bar-fill');

const fileList = document.getElementById('file-list');
const fileListCounter = document.getElementById('file-list-counter');

const currentFilename = document.getElementById('current-filename');
const imageViewerContainer = document.getElementById('image-viewer-container');
const zoomPanWrapper = document.getElementById('zoom-pan-wrapper');
const activeImage = document.getElementById('active-image');
const viewerPlaceholder = document.getElementById('viewer-placeholder');
const viewerLoader = document.getElementById('viewer-loader');
const zoomLevelHud = document.getElementById('zoom-level-hud');
const imgNavProgress = document.getElementById('image-navigation-progress');

const btnPrev = document.getElementById('btn-prev');
const btnSkip = document.getElementById('btn-skip');
const btnUndo = document.getElementById('btn-undo');
const btnResetZoom = document.getElementById('btn-reset-zoom');

const categoriesGrid = document.getElementById('categories-grid');
const toastContainer = document.getElementById('toast-container');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    renderCategories();
    fetchStatus();
    setupEventListeners();
    setupZoomPan();
});

// --- API Calls ---

async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.images_dir) {
            imagesDirInput.value = data.images_dir;
        }
        if (data.output_dir) {
            outputDirInput.value = data.output_dir;
        }

        if (data.images && data.images.length > 0) {
            updateAppState(data);
            state.initialized = true;
            showToast("Session recovered successfully!", "info");
        }
    } catch (err) {
        console.error("Failed to fetch status:", err);
    }
}

async function initializeDataset(e) {
    e.preventDefault();
    const imagesDir = imagesDirInput.value.trim();
    const outputDir = outputDirInput.value.trim();

    if (!imagesDir || !outputDir) {
        showToast("Please enter both images and output directory paths.", "error");
        return;
    }

    btnInitialize.disabled = true;
    btnInitialize.textContent = "Loading...";

    try {
        const response = await fetch('/api/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images_dir: imagesDir, output_dir: outputDir })
        });
        const data = await response.json();

        if (response.ok) {
            updateAppState(data);
            state.initialized = true;
            showToast(`Loaded ${data.images.length} images. Ready for labeling!`, "success");
        } else {
            showToast(data.error || "Initialization failed.", "error");
        }
    } catch (err) {
        showToast("Server error during initialization.", "error");
        console.error(err);
    } finally {
        btnInitialize.disabled = false;
        btnInitialize.textContent = "Load Dataset";
    }
}

async function labelImage(category) {
    if (!state.initialized || state.images.length === 0) return;
    const filename = state.images[state.current_index];
    if (!filename) return;

    // Visual feedback for clicked/selected key
    highlightCategoryCard(category);

    try {
        const response = await fetch('/api/label', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, category })
        });
        const data = await response.json();

        if (response.ok) {
            state.labeled = data.labeled;
            state.current_index = data.current_index;
            state.has_history = data.has_history;
            
            showToast(`Labeled "${filename}" as Category ${category}`, "success");
            updateUI();
        } else {
            showToast(data.error || "Failed to label image.", "error");
        }
    } catch (err) {
        showToast("Server error while labeling.", "error");
        console.error(err);
    }
}

async function undoLabel() {
    if (!state.initialized || !state.has_history) return;

    try {
        const response = await fetch('/api/undo', { method: 'POST' });
        const data = await response.json();

        if (response.ok) {
            state.labeled = data.labeled;
            state.current_index = data.current_index;
            state.has_history = data.has_history;

            showToast("Annotation undone.", "info");
            updateUI();
        } else {
            showToast(data.error || "Failed to undo.", "error");
        }
    } catch (err) {
        showToast("Server error during undo.", "error");
        console.error(err);
    }
}

async function skipImage() {
    if (!state.initialized || state.images.length === 0) return;

    try {
        const response = await fetch('/api/skip', { method: 'POST' });
        const data = await response.json();

        if (response.ok) {
            state.current_index = data.current_index;
            updateUI();
        }
    } catch (err) {
        console.error(err);
    }
}

async function prevImage() {
    if (!state.initialized || state.images.length === 0) return;

    try {
        const response = await fetch('/api/prev', { method: 'POST' });
        const data = await response.json();

        if (response.ok) {
            state.current_index = data.current_index;
            updateUI();
        }
    } catch (err) {
        console.error(err);
    }
}

async function jumpToImage(index) {
    if (!state.initialized || state.images.length === 0) return;

    try {
        const response = await fetch('/api/jump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index })
        });
        const data = await response.json();

        if (response.ok) {
            state.current_index = data.current_index;
            updateUI();
        }
    } catch (err) {
        console.error(err);
    }
}

// --- UI Updates ---

function updateAppState(data) {
    state.images_dir = data.images_dir || imagesDirInput.value.trim();
    state.output_dir = data.output_dir || outputDirInput.value.trim();
    state.images = data.images || [];
    state.labeled = data.labeled || {};
    state.current_index = data.current_index || 0;
    state.has_history = data.has_history || false;
    
    updateUI();
}

function updateUI() {
    // Header & session indicator
    if (state.images.length > 0) {
        statusIndicator.textContent = "Connected";
        statusIndicator.className = "status-indicator active";
        pathDisplay.textContent = `Input: ${state.images_dir} ➔ Output: ${state.output_dir}`;
    } else {
        statusIndicator.textContent = "Disconnected";
        statusIndicator.className = "status-indicator inactive";
        pathDisplay.textContent = "No directories loaded";
    }

    // Navigation buttons
    btnPrev.disabled = state.current_index === 0;
    btnSkip.disabled = state.current_index === state.images.length - 1 && state.images.length > 0;
    btnUndo.disabled = !state.has_history;
    btnResetZoom.disabled = state.images.length === 0;

    // Stats
    const total = state.images.length;
    const labeledCount = Object.keys(state.labeled).length;
    const pct = total > 0 ? Math.round((labeledCount / total) * 100) : 0;

    statTotal.textContent = total;
    statLabeled.textContent = labeledCount;
    statProgressPct.textContent = `${pct}%`;
    progressBarFill.style.width = `${pct}%`;

    // File list counter
    fileListCounter.textContent = `${total} images`;

    // Render file list
    renderFileList();

    // Render active image
    renderActiveImage();

    // Refresh categories count highlights
    updateCategoryGridStatus();
}

function renderCategories() {
    categoriesGrid.innerHTML = "";
    CATEGORIES.forEach(cat => {
        const card = document.createElement('div');
        card.className = "category-card";
        card.id = `cat-card-${cat.id}`;
        card.dataset.id = cat.id;

        card.innerHTML = `
            <div class="category-header">
                <span class="category-num">${cat.id}</span>
                <kbd>${cat.key}</kbd>
            </div>
            <div class="category-name">${cat.label}</div>
            <span class="category-count" id="cat-count-${cat.id}">0</span>
        `;

        card.addEventListener('click', () => labelImage(cat.id));
        categoriesGrid.appendChild(card);
    });
}

function updateCategoryGridStatus() {
    // Calculate counts per category
    const counts = {};
    CATEGORIES.forEach(c => counts[c.id] = 0);
    
    Object.values(state.labeled).forEach(catId => {
        if (counts[catId] !== undefined) {
            counts[catId]++;
        }
    });

    // Update counts in DOM
    CATEGORIES.forEach(cat => {
        const countSpan = document.getElementById(`cat-count-${cat.id}`);
        const card = document.getElementById(`cat-card-${cat.id}`);
        
        countSpan.textContent = counts[cat.id];
        
        if (counts[cat.id] > 0) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
        
        // Highlight active image's label if already labeled
        const currentFilenameText = state.images[state.current_index];
        const assignedLabel = state.labeled[currentFilenameText];
        if (assignedLabel === cat.id) {
            card.classList.add('selected-active');
        } else {
            card.classList.remove('selected-active');
        }
    });
}

function renderFileList() {
    fileList.innerHTML = "";
    if (state.images.length === 0) {
        fileList.innerHTML = `<li class="file-list-empty">Load a dataset to view images</li>`;
        return;
    }

    state.images.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = `file-item ${index === state.current_index ? 'active' : ''}`;
        li.dataset.index = index;

        const isLabeled = state.labeled[file] !== undefined;
        const badgeClass = isLabeled ? 'badge-labeled' : 'badge-unlabeled';
        const badgeText = isLabeled ? `Cat ${state.labeled[file]}` : 'Unlabeled';

        li.innerHTML = `
            <span class="file-name" title="${file}">${file}</span>
            <span class="badge ${badgeClass}">${badgeText}</span>
        `;

        li.addEventListener('click', () => jumpToImage(index));
        fileList.appendChild(li);

        // Scroll active item into view
        if (index === state.current_index) {
            setTimeout(() => {
                li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    });
}

function renderActiveImage() {
    if (state.images.length === 0) {
        activeImage.classList.add('hidden');
        viewerPlaceholder.classList.remove('hidden');
        viewerLoader.classList.add('hidden');
        currentFilename.textContent = "No image loaded";
        imgNavProgress.textContent = "0 of 0 images";
        return;
    }

    const filename = state.images[state.current_index];
    currentFilename.textContent = filename;
    imgNavProgress.textContent = `${state.current_index + 1} of ${state.images.length} images`;

    // Show spinner
    viewerLoader.classList.remove('hidden');
    viewerPlaceholder.classList.add('hidden');
    activeImage.classList.add('hidden');

    // Load image with cache buster to bypass browser cache
    activeImage.src = `/api/image?filename=${encodeURIComponent(filename)}&t=${Date.now()}`;
    
    activeImage.onload = () => {
        viewerLoader.classList.add('hidden');
        activeImage.classList.remove('hidden');
        resetZoom();
    };

    activeImage.onerror = () => {
        viewerLoader.classList.add('hidden');
        viewerPlaceholder.classList.remove('hidden');
        viewerPlaceholder.querySelector('p').textContent = `Failed to load image: ${filename}`;
    };
}

function highlightCategoryCard(catId) {
    const card = document.getElementById(`cat-card-${catId}`);
    if (card) {
        card.style.transform = "scale(0.95)";
        setTimeout(() => {
            card.style.transform = "";
        }, 100);
    }
}

// --- Zoom and Pan Engine ---

function setupZoomPan() {
    // Zoom by wheel
    imageViewerContainer.addEventListener('wheel', (e) => {
        if (!state.initialized || state.images.length === 0) return;
        e.preventDefault();

        const zoomIntensity = 0.12;
        const mouseX = e.clientX - imageViewerContainer.getBoundingClientRect().left;
        const mouseY = e.clientY - imageViewerContainer.getBoundingClientRect().top;

        // Save position of mouse before zooming relative to zoom-pan-wrapper center
        const prevScale = zoomState.scale;
        
        // Zoom factor
        if (e.deltaY < 0) {
            zoomState.scale = Math.min(zoomState.scale * (1 + zoomIntensity), 15);
        } else {
            zoomState.scale = Math.max(zoomState.scale * (1 - zoomIntensity), 0.5);
        }

        // Adjust translation to center zoom on mouse cursor
        const containerWidth = imageViewerContainer.clientWidth;
        const containerHeight = imageViewerContainer.clientHeight;
        const originX = mouseX - containerWidth / 2;
        const originY = mouseY - containerHeight / 2;

        zoomState.translateX = originX - (originX - zoomState.translateX) * (zoomState.scale / prevScale);
        zoomState.translateY = originY - (originY - zoomState.translateY) * (zoomState.scale / prevScale);

        applyZoomTransform();
    }, { passive: false });

    // Drag-to-pan mouse events
    zoomPanWrapper.addEventListener('mousedown', (e) => {
        if (!state.initialized || state.images.length === 0) return;
        zoomState.isDragging = true;
        zoomState.startX = e.clientX - zoomState.translateX;
        zoomState.startY = e.clientY - zoomState.translateY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!zoomState.isDragging) return;
        zoomState.translateX = e.clientX - zoomState.startX;
        zoomState.translateY = e.clientY - zoomState.startY;
        applyZoomTransform();
    });

    window.addEventListener('mouseup', () => {
        zoomState.isDragging = false;
    });

    // Double click to reset
    zoomPanWrapper.addEventListener('dblclick', () => {
        resetZoom();
    });
}

function applyZoomTransform() {
    // Translate active image inside wrapper
    activeImage.style.transform = `translate(${zoomState.translateX}px, ${zoomState.translateY}px) scale(${zoomState.scale})`;
    
    // Update HUD
    zoomLevelHud.classList.remove('hidden');
    zoomLevelHud.textContent = `Zoom: ${Math.round(zoomState.scale * 100)}%`;
}

function resetZoom() {
    zoomState.scale = 1;
    zoomState.translateX = 0;
    zoomState.translateY = 0;
    applyZoomTransform();
    zoomLevelHud.classList.add('hidden'); // Hide HUD on reset
}

// --- Event Listeners & Hotkeys ---

function setupEventListeners() {
    configForm.addEventListener('submit', initializeDataset);
    btnPrev.addEventListener('click', prevImage);
    btnSkip.addEventListener('click', skipImage);
    btnUndo.addEventListener('click', undoLabel);
    btnResetZoom.addEventListener('click', resetZoom);

    // Keyboard Shortcuts handler
    window.addEventListener('keydown', (e) => {
        // Prevent shortcuts if user is typing in directory text inputs
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }

        const key = e.key.toLowerCase();

        // 1-9 shortcuts
        if (key >= '1' && key <= '9') {
            e.preventDefault();
            labelImage(key);
            return;
        }

        // 0 shortcut for category 10
        if (key === '0') {
            e.preventDefault();
            labelImage("10");
            return;
        }

        // Custom keyboard bindings for categories 11-13
        if (key === 'q') {
            e.preventDefault();
            labelImage("11");
            return;
        }
        if (key === 'w') {
            e.preventDefault();
            labelImage("12");
            return;
        }
        if (key === 'e') {
            e.preventDefault();
            labelImage("13");
            return;
        }

        // Navigation controls
        if (e.key === 'ArrowRight' || e.key === ' ') {
            e.preventDefault();
            skipImage();
            return;
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevImage();
            return;
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            undoLabel();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            resetZoom();
            return;
        }
    });
}

// --- Toast System ---

function showToast(message, type = "info", duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "❌";

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
    `;

    // Handle manual close
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.9)';
        setTimeout(() => toast.remove(), 300);
    });

    toastContainer.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px) scale(0.9)';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}
