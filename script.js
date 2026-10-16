// =============================================================================
// THEME TOGGLE FUNCTIONALITY
// =============================================================================

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
});

// Theme toggle functionality
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Announce theme change to screen readers (WCAG 4.1.3)
    announceToScreenReader(newTheme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// =============================================================================
// ITEMS DATA STRUCTURE - MODIFY THIS SECTION TO ADD/UPDATE ITEMS
// =============================================================================
// To add new items:
// 1. Add a new object to the items array below (maintain alphabetical order by label)
// 2. Add the corresponding image file to the /images directory
// 3. Ensure the image filename matches the label (e.g., 'apple.png' for 'Apple')
// 4. The image should be in PNG, JPG, or WebP format for best compatibility
// 5. Items can have multiple categories in the categories array (alphabetical order recommended)
// 6. Categories and items will be automatically alphabetized when displayed
// 7. Items are organized alphabetically by label for easy maintenance

const items = [
    {
        label: 'Apple',
        image: 'apple.png',
        categories: ['Food', 'Fruit']
    },
	{
        label: 'Aviary',
        image: 'aviary.png',
        categories: ['Go']
    },
    {
        label: 'Banana',
        image: 'banana.png',
        categories: ['Food', 'Fruit']
    },
    {
        label: 'Bubble Wall',
        image: 'bubblewall.png',
        categories: ['Toys', 'Sensory']
    },
    {
        label: 'Cars',
        image: 'cars.png',
        categories: ['TV']
    },
    {
        label: 'Cars 2',
        image: 'cars2.png',
        categories: ['TV']
    },
    {
        label: 'Cars 3',
        image: 'cars3.png',
        categories: ['TV']
    },
    {
        label: 'Chocolate',
        image: 'chocolate.png',
        categories: ['Food', 'Sweets']
    },
    {
        label: 'Cookies',
        image: 'oreos.png',
        categories: ['Food', 'Sweets']
    },
    {
        label: 'Dairy Queen',
        image: 'dq.png',
        categories: ['Go']
    },
    {
        label: 'Del\'s',
        image: 'dels.png',
        categories: ['Go']
    },
    {
        label: 'Dollar General',
        image: 'dg.png',
        categories: ['Go']
    },
    {
        label: 'Eat n Park',
        image: 'eatnpark.png',
        categories: ['Go']
    },
    {
        label: 'Fruit Snacks',
        image: 'fruitsnacks.png',
        categories: ['Food']
    },
    {
        label: 'Gloves',
        image: 'gloves.png',
        categories: ['Clothes']
    },
    {
        label: 'Grapes',
        image: 'grapes.png',
        categories: ['Food', 'Fruit']
    },
	{
        label: 'Gym',
        image: 'gym.jpg',
        categories: ['Go']
    },
    {
        label: 'Home',
        image: 'home.png',
        categories: ['Go']
    },
    {
        label: 'Hulu',
        image: 'hulu.png',
        categories: ['TV']
    },
    {
        label: 'Ice Cream',
        image: 'icecream.png',
        categories: ['Food', 'Sweets']
    },
    {
        label: 'iPad',
        image: 'ipad.png',
        categories: ['Electronics']
    },
    {
        label: 'iPhone',
        image: 'iphone.png',
        categories: ['Electronics']
    },
    {
        label: 'Kennywood',
        image: 'kennywood.png',
        categories: ['Go']
    },
    {
        label: 'Kit Kat',
        image: 'kitkat.png',
        categories: ['Food', 'Sweets']
    },
    {
        label: 'Marble Maze',
        image: 'marblemaze.png',
        categories: ['Toys']
    },
    {
        label: 'Marble Rush',
        image: 'marblerush.png',
        categories: ['Toys']
    },
    {
        label: 'Mohans',
        image: 'mohans.png',
        categories: ['Go']
    },
    {
        label: 'Pants',
        image: 'pants.png',
        categories: ['Clothes']
    },
    {
        label: 'Peppermint Stick',
        image: 'pstick.png',
        categories: ['Food', 'Sweets']
    },
    {
        label: 'Playground',
        image: 'playground.png',
        categories: ['Go']
    },
    {
        label: 'Sandcastle',
        image: 'wetwillies.png',
        categories: ['Go']
    },
    {
        label: 'School',
        image: 'school.png',
        categories: ['Go']
    },
	{
        label: 'Seabase',
        image: 'seabase.png',
        categories: ['Go']
    },
    {
        label: 'Shorts',
        image: 'shorts.png',
        categories: ['Clothes']
    },
    {
        label: 'Spirit',
        image: 'spirit.png',
        categories: ['TV']
    },
    {
        label: 'Stay',
        image: 'stay.png',
        categories: ['Go']
    },
    {
        label: 'Target',
        image: 'target.png',
        categories: ['Go']
    },
    {
        label: 'Train',
        image: 'train.png',
        categories: ['Toys']
    },
    {
        label: 'TV',
        image: 'tv.png',
        categories: ['Electronics']
    },
    {
        label: 'Strawberry',
        image: 'strawberry.png',
        categories: ['Food', 'Fruit']
    },
    {
        label: 'Yogurt',
        image: 'yogurt.png',
        categories: ['Food']
    },
	{
        label: 'Zoo',
        image: 'zoo.png',
        categories: ['Go']
    }
];

// =============================================================================
// APPLICATION STATE AND UTILITIES
// =============================================================================

let selectedItems = new Set(); // Multi-select items
let selectedResultItem = null; // Single selected result card
let selectedCategory = null;
let currentView = 'categories'; // 'categories', 'items', or 'results'
const imagesBasePath = './images/';
const placeholderImage = 'placeholder.png';

// =============================================================================
// DOM ELEMENTS
// =============================================================================

const form = document.getElementById('item-selection-form');
const submitBtn = document.getElementById('submit-btn');
const resultsSection = document.getElementById('results-section');
const selectedItemsContainer = document.getElementById('selected-items');
const itemsGrid = document.querySelector('.items-grid');
const categorySection = document.getElementById('category-section');
const categoriesGrid = document.getElementById('categories-grid');
const backBtn = document.getElementById('back-btn');

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Creates a safe filename from a label by removing special characters
 * @param {string} label - The item label
 * @returns {string} - Safe filename
 */
function createSafeFilename(label) {
    return label.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Handles image loading errors by showing placeholder
 * @param {HTMLImageElement} img - The image element
 * @param {string} label - The item label for alt text
 */
function handleImageError(img, label) {
    // Prevent infinite loop by checking if we're already showing placeholder
    if (!img.src.includes(placeholderImage)) {
        img.src = imagesBasePath + placeholderImage;
        img.alt = `${label} (placeholder image)`;
        console.warn(`Failed to load image for ${label}, using placeholder`);
    } else {
        // If placeholder also fails, show a data URI placeholder
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjhmYWZjIiBzdHJva2U9IiNlMmU4ZjAiIHN0cm9rZS13aWR0aD0iMiIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yjc1ODUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBVbmF2YWlsYWJsZTwvdGV4dD4KPC9zdmc+';
        img.alt = `${label} (image unavailable)`;
        console.error(`Failed to load both image and placeholder for ${label}`);
    }
}

/**
 * Updates the submit button state based on selection
 */
function updateSubmitButton() {
    const isEmpty = selectedItems.size === 0;
    submitBtn.disabled = isEmpty;
    submitBtn.setAttribute('aria-disabled', String(isEmpty));
    submitBtn.textContent = isEmpty 
        ? 'Select items to continue' 
        : `View ${selectedItems.size} selected item${selectedItems.size === 1 ? '' : 's'}`;
}

/**
 * Gets all unique categories from items, automatically sorted alphabetically
 * @returns {Array} Array of unique category names in alphabetical order
 */
function getAllCategories() {
    const categories = new Set();
    items.forEach(item => {
        if (item.categories) {
            item.categories.forEach(category => categories.add(category));
        }
    });
    return Array.from(categories).sort();
}

/**
 * Gets items filtered by category
 * @param {string} category - The category to filter by
 * @returns {Array} Array of items in the category
 */
function getItemsByCategory(category) {
    if (category === 'All') {
        return items;
    }
    return items.filter(item => 
        item.categories && item.categories.includes(category)
    );
}

/**
 * Switches between category view, items view, and results view
 * @param {string} view - 'categories', 'items', or 'results'
 */
function switchView(view) {
    currentView = view;
    
    if (view === 'categories') {
        categorySection.style.display = 'block';
        document.querySelector('.selection-section').style.display = 'none';
        resultsSection.style.display = 'none';
        selectedItems.clear();
        selectedResultItem = null;
        updateSubmitButton();
        // Move focus to category heading (WCAG 2.4.3)
        requestAnimationFrame(() => {
            const heading = document.getElementById('category-heading');
            if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
        });
        announceToScreenReader('Returned to category selection');
    } else if (view === 'items') {
        categorySection.style.display = 'none';
        document.querySelector('.selection-section').style.display = 'block';
        resultsSection.style.display = 'none';
        selectedItems.clear();
        selectedResultItem = null;
        renderSelectionForm();
        // Move focus to items heading (WCAG 2.4.3)
        requestAnimationFrame(() => {
            const heading = document.getElementById('selection-heading');
            if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
        });
        announceToScreenReader(`Showing items in ${selectedCategory} category`);
    } else if (view === 'results') {
        categorySection.style.display = 'none';
        document.querySelector('.selection-section').style.display = 'none';
        resultsSection.style.display = 'block';
        selectedResultItem = null;
        renderSelectedItems();
        // Move focus to results heading (WCAG 2.4.3)
        requestAnimationFrame(() => {
            const heading = document.getElementById('results-heading');
            if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
        });
        announceToScreenReader(`Showing ${selectedItems.size} selected item${selectedItems.size === 1 ? '' : 's'}`);
    }
}

// =============================================================================
// CATEGORY RENDERING FUNCTIONS
// =============================================================================

/**
 * Renders the category selection interface
 */
function renderCategories() {
    const categories = ['All', ...getAllCategories()];
    categoriesGrid.innerHTML = '';
    
    categories.forEach((category, index) => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-option';
        categoryElement.setAttribute('role', 'button');
        categoryElement.setAttribute('tabindex', '0');
        categoryElement.setAttribute('aria-label', `Select ${category} category`);

        categoryElement.innerHTML = `
            <div class="category-name">${category}</div>
            <div class="category-count">${getItemsByCategory(category).length} items</div>
        `;

        // Add click handler
        categoryElement.addEventListener('click', () => {
            selectCategory(category);
        });

        // Add keyboard support
        categoryElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectCategory(category);
            }
        });

        categoriesGrid.appendChild(categoryElement);
    });
}

/**
 * Handles category selection
 * @param {string} category - The selected category
 */
function selectCategory(category) {
    selectedCategory = category;
    console.log(`Selected category: ${category}`);
    switchView('items');
}

// =============================================================================
// ITEM RENDERING FUNCTIONS
// =============================================================================

/**
 * Renders the selection form with items filtered by selected category
 */
function renderSelectionForm() {
    itemsGrid.innerHTML = '';
    
    const filteredItems = getItemsByCategory(selectedCategory);
    
    // Sort items alphabetically by label
    const sortedItems = filteredItems.sort((a, b) => a.label.localeCompare(b.label));
    
    sortedItems.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'item-option';
        // No redundant ARIA role — the native <input type="checkbox"> provides
        // the correct role and state to assistive technology (WCAG 4.1.2)

        itemElement.innerHTML = `
            <input 
                type="checkbox" 
                id="item-${index}" 
                class="item-checkbox"
                value="${item.label}"
                aria-labelledby="item-label-${index}"
            >
            <label for="item-${index}" class="item-label" id="item-label-${index}">
                <img src="${imagesBasePath}${item.image}" alt="" class="item-preview-image" role="presentation" onerror="this.src='${imagesBasePath}${placeholderImage}'">
                <span class="item-label-text">${item.label}</span>
            </label>
        `;

        // Add click handler for the entire option (excluding checkbox and label)
        itemElement.addEventListener('click', (e) => {
            // Only handle clicks on the container itself, not on checkbox or label elements
            if (e.target === itemElement) {
                const checkbox = itemElement.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                handleItemSelection(checkbox);
            }
        });

        // Add checkbox change handler - this will handle label clicks naturally
        const checkbox = itemElement.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => handleItemSelection(e.target));

        itemsGrid.appendChild(itemElement);
    });
}

/**
 * Handles item selection/deselection (multi-select)
 * @param {HTMLInputElement} checkbox - The checkbox element
 */
function handleItemSelection(checkbox) {
    const itemLabel = checkbox.value;
    
    if (checkbox.checked) {
        selectedItems.add(itemLabel);
    } else {
        selectedItems.delete(itemLabel);
    }
    
    updateSubmitButton();
    announceSelectionChange();
}

/**
 * Renders the selected items in the results section
 */
function renderSelectedItems() {
    console.log('Rendering selected items:', Array.from(selectedItems));
    
    if (!selectedItemsContainer || !resultsSection) {
        console.error('Required DOM elements not found for rendering results');
        return;
    }
    
    selectedItemsContainer.innerHTML = '';
    
    if (selectedItems.size === 0) {
        resultsSection.style.display = 'none';
        return;
    }

    resultsSection.style.display = 'block';
    
    // Scroll to results section
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Sort selected items alphabetically for consistent display
    const sortedSelectedItems = Array.from(selectedItems).sort();

    sortedSelectedItems.forEach(itemLabel => {
        const item = items.find(i => i.label === itemLabel);
        if (!item) return;

        const itemElement = document.createElement('div');
        itemElement.className = 'selected-item';
        itemElement.setAttribute('role', 'listitem');
        itemElement.setAttribute('tabindex', '0');
        itemElement.setAttribute('aria-label', `Selected item: ${item.label}`);
        itemElement.setAttribute('data-item-label', item.label);

        const img = document.createElement('img');
        img.className = 'item-image';
        img.alt = `Image of ${item.label}`;
        img.loading = 'lazy'; // Lazy loading for performance
        
        // Set up error handling
        img.onerror = () => handleImageError(img, item.label);
        
        // Try to load the image
        img.src = imagesBasePath + item.image;

        const nameElement = document.createElement('div');
        nameElement.className = 'item-name';
        
        const checkmarkElement = document.createElement('span');
        checkmarkElement.className = 'checkmark-icon';
        checkmarkElement.setAttribute('aria-hidden', 'true');
        checkmarkElement.textContent = '✓';
        
        const labelElement = document.createElement('span');
        labelElement.textContent = item.label;
        
        nameElement.appendChild(checkmarkElement);
        nameElement.appendChild(labelElement);

        itemElement.appendChild(img);
        itemElement.appendChild(nameElement);

        // Add click handler for single selection highlighting
        itemElement.addEventListener('click', () => {
            handleResultItemSelection(itemElement, item.label);
        });

        // Add keyboard support
        itemElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleResultItemSelection(itemElement, item.label);
            }
        });

        selectedItemsContainer.appendChild(itemElement);
    });
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handles result item selection (single selection highlighting)
 * @param {HTMLElement} itemElement - The result item element
 * @param {string} itemLabel - The item label
 */
function handleResultItemSelection(itemElement, itemLabel) {
    // Clear previous selection styling and ARIA from all result items
    document.querySelectorAll('.selected-item').forEach(element => {
        element.style.borderColor = '';
        element.style.backgroundColor = '';
        element.classList.remove('selected');
        element.setAttribute('aria-pressed', 'false');
    });
    
    // Set new selection
    selectedResultItem = itemLabel;
    itemElement.style.borderColor = 'var(--selected-border)';
    itemElement.style.backgroundColor = 'var(--selected-bg)';
    itemElement.classList.add('selected');
    itemElement.setAttribute('aria-pressed', 'true');
    
    announceToScreenReader(`${itemLabel} selected`);
    console.log('Selected result item:', itemLabel);
}

/**
 * Handles form submission
 * @param {Event} e - The form submit event
 */
function handleFormSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if any items are selected
    if (selectedItems.size === 0) {
        console.log('No items selected, preventing form submission');
        return;
    }
    
    console.log('Form submitted, switching to results view...');
    switchView('results');
}

/**
 * Handles back button click
 * Note: the results view is final — there is no back button there, so a page
 * refresh is the only way to start a new selection.
 */
function handleBackClick() {
    console.log('Back button clicked, current view:', currentView);
    if (currentView === 'items') {
        switchView('categories');
    }
}

// =============================================================================
// ACCESSIBILITY ENHANCEMENTS
// =============================================================================

/**
 * Announces a message to screen readers via the persistent live region
 * @param {string} message - The message to announce
 */
function announceToScreenReader(message) {
    const liveRegion = document.getElementById('live-region');
    if (liveRegion) {
        // Clear then set to ensure repeat announcements are read
        liveRegion.textContent = '';
        requestAnimationFrame(() => {
            liveRegion.textContent = message;
        });
    }
}

/**
 * Announces selection changes to screen readers
 */
function announceSelectionChange() {
    const announcement = selectedItems.size === 0 
        ? 'No items selected' 
        : `${selectedItems.size} item${selectedItems.size === 1 ? '' : 's'} selected`;
    
    announceToScreenReader(announcement);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes the application
 */
function initializeApp() {
    // Check if all required DOM elements exist
    if (!form || !submitBtn || !resultsSection || !selectedItemsContainer || !itemsGrid ||
        !categorySection || !categoriesGrid || !backBtn) {
        console.error('Required DOM elements not found. Make sure the HTML is loaded correctly.');
        return;
    }
    
    // Set up event listeners
    form.addEventListener('submit', handleFormSubmit);
    backBtn.addEventListener('click', handleBackClick);
    
    // Prevent submit button clicks when disabled
    submitBtn.addEventListener('click', (e) => {
        if (submitBtn.disabled || selectedItems.size === 0) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Initialize with category view
    switchView('categories');
    renderCategories();
    
    // Update submit button state
    updateSubmitButton();
    
    // Focus management is handled entirely via CSS :focus-visible
    // (no inline JS focus styles needed — WCAG 2.4.7 / 2.4.13)

    console.log('Item Selection Tool initialized successfully');
    console.log(`Loaded ${items.length} items for selection`);
    console.log(`Available categories: ${getAllCategories().join(', ')}`);
}

// =============================================================================
// START APPLICATION
// =============================================================================

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}