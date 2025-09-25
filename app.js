// PocketBase configuration
const POCKETBASE_URL = 'http://127.0.0.1:8090'; // Change to your PocketBase instance
let pocketbase = null;

// App state
let groceryItems = [];
let currentFilter = 'all';
let searchQuery = '';

// DOM elements
const itemInput = document.getElementById('item-input');
const quantityInput = document.getElementById('quantity-input');
const categorySelect = document.getElementById('category-select');
const addItemBtn = document.getElementById('add-item-btn');
const groceryList = document.getElementById('grocery-list');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('search-input');
const totalCount = document.getElementById('total-count');
const completedCount = document.getElementById('completed-count');
const clearCompletedBtn = document.getElementById('clear-completed');
const syncStatus = document.getElementById('sync-status');
const themeToggle = document.getElementById('theme-toggle');

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    // Initialize PocketBase
    try {
        pocketbase = new PocketBase(POCKETBASE_URL);
        
        // Check if we have a valid user session
        if (pocketbase.authStore.isValid) {
            await loadItems();
        } else {
            // Try to authenticate as a guest or create a new user
            await authenticateUser();
        }
    } catch (error) {
        console.error('Failed to initialize PocketBase:', error);
        syncStatus.textContent = 'Offline - using local storage';
        loadItemsFromLocalStorage();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Update statistics
    updateStats();
    
    // Check if the app is installed
    checkInstallPrompt();
}

// Authentication
async function authenticateUser() {
    try {
        // Try to sign in as a guest (you might need to adjust this based on your auth setup)
        await pocketbase.collection('users').authWithPassword('guest@example.com', 'guestpassword');
    } catch (error) {
        // If guest auth fails, create a new anonymous user
        try {
            const randomId = Math.random().toString(36).substring(2, 15);
            await pocketbase.collection('users').create({
                username: `user_${randomId}`,
                email: `user_${randomId}@example.com`,
                password: 'password',
                passwordConfirm: 'password'
            });
            await pocketbase.collection('users').authWithPassword(`user_${randomId}@example.com`, 'password');
        } catch (createError) {
            console.error('Failed to create user:', createError);
            syncStatus.textContent = 'Offline - using local storage';
            loadItemsFromLocalStorage();
        }
    }
}

// Load items from PocketBase
async function loadItems() {
    try {
        const records = await pocketbase.collection('grocery_items').getFullList({
            sort: '-created'
        });
        groceryItems = records;
        renderItems();
        saveItemsToLocalStorage();
        syncStatus.textContent = 'Synced';
    } catch (error) {
        console.error('Failed to load items:', error);
        syncStatus.textContent = 'Sync failed - using local storage';
        loadItemsFromLocalStorage();
    }
}

// Save items to PocketBase
async function saveItems() {
    try {
        for (const item of groceryItems) {
            if (item.id) {
                // Update existing item
                await pocketbase.collection('grocery_items').update(item.id, item);
            } else {
                // Create new item
                const record = await pocketbase.collection('grocery_items').create(item);
                item.id = record.id;
            }
        }
        syncStatus.textContent = 'Synced';
    } catch (error) {
        console.error('Failed to save items:', error);
        syncStatus.textContent = 'Sync failed - changes saved locally';
        saveItemsToLocalStorage();
    }
}

// Local storage fallback
function saveItemsToLocalStorage() {
    localStorage.setItem('groceryItems', JSON.stringify(groceryItems));
}

function loadItemsFromLocalStorage() {
    const storedItems = localStorage.getItem('groceryItems');
    if (storedItems) {
        groceryItems = JSON.parse(storedItems);
        renderItems();
    }
}

// Event listeners
function setupEventListeners() {
    addItemBtn.addEventListener('click', addItem);
    itemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem();
    });
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderItems();
        });
    });
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderItems();
    });
    
    clearCompletedBtn.addEventListener('click', clearCompleted);
    
    themeToggle.addEventListener('click', toggleTheme);
    
    // Set up service worker for PWA functionality
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    }
}

// Add new item
async function addItem() {
    const name = itemInput.value.trim();
    const quantity = parseInt(quantityInput.value) || 1;
    const category = categorySelect.value;
    
    if (name === '') return;
    
    const newItem = {
        name,
        quantity,
        category,
        completed: false,
        created: new Date().toISOString()
    };
    
    groceryItems.unshift(newItem);
    
    // Clear input fields
    itemInput.value = '';
    quantityInput.value = '1';
    
    // Save to backend and update UI
    await saveItems();
    renderItems();
    updateStats();
}

// Render items based on filter and search
function renderItems() {
    groceryList.innerHTML = '';
    
    const filteredItems = groceryItems.filter(item => {
        const matchesFilter = currentFilter === 'all' || item.category === currentFilter;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery);
        return matchesFilter && matchesSearch;
    });
    
    if (filteredItems.length === 0) {
        groceryList.innerHTML = '<p class="no-items">No items found</p>';
        return;
    }
    
    filteredItems.forEach(item => {
        const li = document.createElement('li');
        li.className = `grocery-item ${item.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <input type="checkbox" class="item-checkbox" ${item.completed ? 'checked' : ''}>
            <span class="item-name">${item.name}</span>
            <span class="item-quantity">${item.quantity}</span>
            <span class="item-category">${item.category}</span>
            <button class="delete-btn">Delete</button>
        `;
        
        const checkbox = li.querySelector('.item-checkbox');
        const deleteBtn = li.querySelector('.delete-btn');
        
        checkbox.addEventListener('change', () => toggleComplete(item));
        deleteBtn.addEventListener('click', () => deleteItem(item));
        
        groceryList.appendChild(li);
    });
}

// Toggle item completion
async function toggleComplete(item) {
    item.completed = !item.completed;
    await saveItems();
    renderItems();
    updateStats();
}

// Delete item
async function deleteItem(item) {
    if (confirm('Are you sure you want to delete this item?')) {
        groceryItems = groceryItems.filter(i => i !== item);
        
        // If the item has an ID, delete it from the backend too
        if (item.id && pocketbase) {
            try {
                await pocketbase.collection('grocery_items').delete(item.id);
            } catch (error) {
                console.error('Failed to delete item from backend:', error);
            }
        }
        
        await saveItems();
        renderItems();
        updateStats();
    }
}

// Clear completed items
async function clearCompleted() {
    if (confirm('Are you sure you want to clear all completed items?')) {
        const itemsToDelete = groceryItems.filter(item => item.completed);
        
        // Delete from backend
        if (pocketbase) {
            for (const item of itemsToDelete) {
                if (item.id) {
                    try {
                        await pocketbase.collection('grocery_items').delete(item.id);
                    } catch (error) {
                        console.error('Failed to delete item from backend:', error);
                    }
                }
            }
        }
        
        groceryItems = groceryItems.filter(item => !item.completed);
        saveItemsToLocalStorage();
        renderItems();
        updateStats();
    }
}

// Update statistics
function updateStats() {
    const total = groceryItems.length;
    const completed = groceryItems.filter(item => item.completed).length;
    
    totalCount.textContent = total;
    completedCount.textContent = completed;
}

// Theme toggle
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', newTheme);
}

// Check for install prompt
let deferredPrompt;

function checkInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button (you could add this to your UI)
        showInstallPromotion();
    });
}

function showInstallPromotion() {
    // You could add an install button to your UI here
    console.log('App can be installed');
}

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
