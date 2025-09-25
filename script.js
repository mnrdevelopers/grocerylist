// Grocery List Manager PWA
class GroceryListManager {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('groceryItems')) || [];
        this.filter = 'all';
        this.sheetId = localStorage.getItem('sheetId') || '';
        this.isOnline = navigator.onLine;
        
        this.initializeApp();
        this.setupEventListeners();
        this.renderList();
        this.updateStats();
        
        // Register service worker for PWA functionality
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => console.log('SW registered'))
                .catch(error => console.log('SW registration failed'));
        }
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showSyncMessage('Back online. Sync available.');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showSyncMessage('You are offline. Changes will sync when back online.');
        });
    }
    
    initializeApp() {
        // Check if we have a sheet ID and try to sync if online
        if (this.sheetId && this.isOnline) {
            this.syncWithSheet();
        }
    }
    
    setupEventListeners() {
        // Add item
        document.getElementById('add-btn').addEventListener('click', () => this.addItem());
        document.getElementById('item-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addItem();
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filter = e.target.dataset.filter;
                this.renderList();
            });
        });
        
        // Settings modal
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.querySelector('.close').addEventListener('click', () => this.closeSettings());
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('settings-modal')) {
                this.closeSettings();
            }
        });
        
        // Settings actions
        document.getElementById('connect-btn').addEventListener('click', () => this.connectToSheet());
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-btn').addEventListener('click', () => this.importData());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearData());
        
        // Sync button
        document.getElementById('sync-btn').addEventListener('click', () => this.syncWithSheet());
        
        // Initialize sheet ID input if we have one
        if (this.sheetId) {
            document.getElementById('sheet-id').value = this.sheetId;
        }
    }
    
    addItem() {
        const itemInput = document.getElementById('item-input');
        const categorySelect = document.getElementById('category-select');
        const quantityInput = document.getElementById('quantity-input');
        
        const name = itemInput.value.trim();
        const category = categorySelect.value;
        const quantity = parseInt(quantityInput.value) || 1;
        
        if (name === '') {
            this.showSyncMessage('Please enter an item name', 'error');
            return;
        }
        
        const newItem = {
            id: Date.now(),
            name,
            category,
            quantity,
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.items.unshift(newItem);
        this.saveToLocalStorage();
        this.renderList();
        this.updateStats();
        
        // Reset form
        itemInput.value = '';
        quantityInput.value = 1;
        itemInput.focus();
        
        this.showSyncMessage('Item added successfully');
        
        // Sync with Google Sheets if online and connected
        if (this.isOnline && this.sheetId) {
            this.syncWithSheet();
        }
    }
    
    toggleItem(id) {
        const item = this.items.find(item => item.id === id);
        if (item) {
            item.completed = !item.completed;
            item.updatedAt = new Date().toISOString();
            this.saveToLocalStorage();
            this.renderList();
            this.updateStats();
            
            // Sync with Google Sheets if online and connected
            if (this.isOnline && this.sheetId) {
                this.syncWithSheet();
            }
        }
    }
    
    editItem(id) {
        const item = this.items.find(item => item.id === id);
        if (item) {
            const newName = prompt('Edit item name:', item.name);
            if (newName !== null && newName.trim() !== '') {
                item.name = newName.trim();
                item.updatedAt = new Date().toISOString();
                this.saveToLocalStorage();
                this.renderList();
                
                // Sync with Google Sheets if online and connected
                if (this.isOnline && this.sheetId) {
                    this.syncWithSheet();
                }
            }
        }
    }
    
    deleteItem(id) {
        if (confirm('Are you sure you want to delete this item?')) {
            this.items = this.items.filter(item => item.id !== id);
            this.saveToLocalStorage();
            this.renderList();
            this.updateStats();
            
            // Sync with Google Sheets if online and connected
            if (this.isOnline && this.sheetId) {
                this.syncWithSheet();
            }
        }
    }
    
    renderList() {
        const listContainer = document.getElementById('grocery-list');
        listContainer.innerHTML = '';
        
        const filteredItems = this.items.filter(item => {
            if (this.filter === 'active') return !item.completed;
            if (this.filter === 'completed') return item.completed;
            return true; // 'all'
        });
        
        if (filteredItems.length === 0) {
            listContainer.innerHTML = '<p class="empty-message">No items found. Add some groceries to your list!</p>';
            return;
        }
        
        filteredItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = `grocery-item ${item.completed ? 'completed' : ''}`;
            itemElement.innerHTML = `
                <input type="checkbox" class="item-checkbox" ${item.completed ? 'checked' : ''}>
                <div class="item-details">
                    <span class="item-name">${this.escapeHtml(item.name)}</span>
                    <div class="item-meta">
                        <span class="item-quantity">Qty: ${item.quantity}</span>
                        <span class="item-category">${item.category}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-edit" title="Edit item"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete" title="Delete item"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            // Add event listeners to the buttons
            const checkbox = itemElement.querySelector('.item-checkbox');
            checkbox.addEventListener('change', () => this.toggleItem(item.id));
            
            const editBtn = itemElement.querySelector('.btn-edit');
            editBtn.addEventListener('click', () => this.editItem(item.id));
            
            const deleteBtn = itemElement.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', () => this.deleteItem(item.id));
            
            listContainer.appendChild(itemElement);
        });
    }
    
    updateStats() {
        const totalCount = this.items.length;
        const activeCount = this.items.filter(item => !item.completed).length;
        
        document.getElementById('total-count').textContent = totalCount;
        document.getElementById('active-count').textContent = activeCount;
    }
    
    saveToLocalStorage() {
        localStorage.setItem('groceryItems', JSON.stringify(this.items));
    }
    
    openSettings() {
        document.getElementById('settings-modal').style.display = 'block';
    }
    
    closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }
    
    connectToSheet() {
        const sheetId = document.getElementById('sheet-id').value.trim();
        
        if (sheetId === '') {
            this.showStatusMessage('Please enter a Google Sheet ID', 'error');
            return;
        }
        
        this.sheetId = sheetId;
        localStorage.setItem('sheetId', sheetId);
        
        // Test connection by trying to read from the sheet
        this.testSheetConnection(sheetId);
    }
    
    async testSheetConnection(sheetId) {
        this.showStatusMessage('Testing connection...');
        
        try {
            const response = await fetch(`https://script.google.com/macros/s/AKfycbyv2BhuJGaNiBQz8uNST4XzYh-XkVpmKpwiFwHssFlh5GRh9IS4yqVMw8Nsn_JeQYE/exec?action=getItems`);
            
            if (response.ok) {
                this.showStatusMessage('Successfully connected to Google Sheets!', 'success');
                
                // Sync data after successful connection
                this.syncWithSheet();
            } else {
                this.showStatusMessage('Failed to connect. Please check your Sheet ID and make sure the Apps Script is deployed.', 'error');
            }
        } catch (error) {
            this.showStatusMessage('Connection failed. Please check your internet connection and Sheet ID.', 'error');
            console.error('Connection test failed:', error);
        }
    }
    
    showStatusMessage(message, type = '') {
        const statusElement = document.getElementById('connection-status');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
    }
    
    async syncWithSheet() {
        if (!this.sheetId) {
            this.showSyncMessage('Please connect to a Google Sheet first', 'error');
            return;
        }
        
        if (!this.isOnline) {
            this.showSyncMessage('Cannot sync while offline', 'error');
            return;
        }
        
        this.showSyncMessage('Syncing with Google Sheets...');
        
        try {
            // Send our local data to the sheet
            const response = await fetch(`https://script.google.com/macros/s/${this.sheetId}/exec`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'syncItems',
                    items: this.items
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // If the server has newer data, use it
                if (data.items && data.items.length > 0) {
                    // Simple conflict resolution: use server data if it's newer
                    const serverLatest = new Date(Math.max(...data.items.map(item => new Date(item.updatedAt))));
                    const localLatest = new Date(Math.max(...this.items.map(item => new Date(item.updatedAt))));
                    
                    if (serverLatest > localLatest) {
                        this.items = data.items;
                        this.saveToLocalStorage();
                        this.renderList();
                        this.updateStats();
                        this.showSyncMessage('Data synced from Google Sheets');
                    } else {
                        this.showSyncMessage('Data synced to Google Sheets');
                    }
                } else {
                    this.showSyncMessage('Data synced to Google Sheets');
                }
            } else {
                this.showSyncMessage('Sync failed. Please check your connection.', 'error');
            }
        } catch (error) {
            this.showSyncMessage('Sync failed. Please try again.', 'error');
            console.error('Sync error:', error);
        }
    }
    
    showSyncMessage(message, type = '') {
        const toast = document.getElementById('sync-toast');
        const messageElement = document.getElementById('sync-message');
        
        messageElement.textContent = message;
        toast.className = `toast ${type === 'error' ? 'error' : ''} show`;
        
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }
    
    exportData() {
        const dataStr = JSON.stringify(this.items, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'grocery-list.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showSyncMessage('Data exported successfully');
    }
    
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = event => {
                try {
                    const importedItems = JSON.parse(event.target.result);
                    
                    if (Array.isArray(importedItems)) {
                        // Merge imported items with existing ones
                        const existingIds = new Set(this.items.map(item => item.id));
                        const newItems = importedItems.filter(item => !existingIds.has(item.id));
                        
                        this.items = [...this.items, ...newItems];
                        this.saveToLocalStorage();
                        this.renderList();
                        this.updateStats();
                        
                        this.showSyncMessage(`Imported ${newItems.length} new items`);
                        
                        // Sync with Google Sheets if online and connected
                        if (this.isOnline && this.sheetId) {
                            this.syncWithSheet();
                        }
                    } else {
                        this.showSyncMessage('Invalid file format', 'error');
                    }
                } catch (error) {
                    this.showSyncMessage('Error reading file', 'error');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    clearData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            this.items = [];
            this.saveToLocalStorage();
            this.renderList();
            this.updateStats();
            
            this.showSyncMessage('All data cleared');
            
            // Sync with Google Sheets if online and connected
            if (this.isOnline && this.sheetId) {
                this.syncWithSheet();
            }
        }
    }
    
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Service Worker for PWA functionality
const serviceWorkerCode = `
// Simple service worker for caching
const CACHE_NAME = 'grocery-list-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
        )
    );
});
`;

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GroceryListManager();
});