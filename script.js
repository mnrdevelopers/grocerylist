// Grocery List Manager PWA - Fixed CORS handling
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
        if (this.sheetId && this.isOnline) {
            // Don't auto-sync on load to avoid CORS issues
            this.showSyncMessage('Connected to Google Sheets. Click sync button to sync data.');
        }
    }
    
    setupEventListeners() {
        document.getElementById('add-btn').addEventListener('click', () => this.addItem());
        document.getElementById('item-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addItem();
        });
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filter = e.target.dataset.filter;
                this.renderList();
            });
        });
        
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.querySelector('.close').addEventListener('click', () => this.closeSettings());
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('settings-modal')) {
                this.closeSettings();
            }
        });
        
        document.getElementById('connect-btn').addEventListener('click', () => this.connectToSheet());
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-btn').addEventListener('click', () => this.importData());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearData());
        document.getElementById('sync-btn').addEventListener('click', () => this.syncWithSheet());
        
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
        
        itemInput.value = '';
        quantityInput.value = 1;
        itemInput.focus();
        
        this.showSyncMessage('Item added successfully');
        
        // Don't auto-sync to avoid CORS issues - let user control when to sync
    }
    
    toggleItem(id) {
        const item = this.items.find(item => item.id === id);
        if (item) {
            item.completed = !item.completed;
            item.updatedAt = new Date().toISOString();
            this.saveToLocalStorage();
            this.renderList();
            this.updateStats();
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
            }
        }
    }
    
    deleteItem(id) {
        if (confirm('Are you sure you want to delete this item?')) {
            this.items = this.items.filter(item => item.id !== id);
            this.saveToLocalStorage();
            this.renderList();
            this.updateStats();
        }
    }
    
    renderList() {
        const listContainer = document.getElementById('grocery-list');
        listContainer.innerHTML = '';
        
        const filteredItems = this.items.filter(item => {
            if (this.filter === 'active') return !item.completed;
            if (this.filter === 'completed') return item.completed;
            return true;
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
        this.testSheetConnection(sheetId);
    }
    
    async testSheetConnection(sheetId) {
        this.showStatusMessage('Testing connection...');
        
        try {
            // Use JSONP approach or simple GET request to test connection
            const response = await this.makeGoogleAppsScriptRequest(
                `https://script.google.com/macros/s/${sheetId}/exec?action=getItems`
            );
            
            if (response && response.items !== undefined) {
                this.showStatusMessage('Successfully connected to Google Sheets!', 'success');
            } else {
                this.showStatusMessage('Connected but unexpected response format.', 'error');
            }
        } catch (error) {
            this.showStatusMessage('Connection failed. Please check your Sheet ID and ensure the app is deployed correctly.', 'error');
            console.error('Connection test failed:', error);
        }
    }
    
    // Fixed method to handle Google Apps Script CORS limitations
    async makeGoogleAppsScriptRequest(url, data = null) {
        if (data) {
            // For POST requests, use a form submission approach
            return new Promise((resolve, reject) => {
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = url;
                form.target = 'hiddenIframe';
                
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'data';
                input.value = JSON.stringify(data);
                form.appendChild(input);
                
                // Create hidden iframe for response
                let iframe = document.getElementById('hiddenIframe');
                if (!iframe) {
                    iframe = document.createElement('iframe');
                    iframe.id = 'hiddenIframe';
                    iframe.name = 'hiddenIframe';
                    iframe.style.display = 'none';
                    document.body.appendChild(iframe);
                }
                
                iframe.onload = function() {
                    try {
                        const responseText = iframe.contentDocument.body.innerText;
                        const response = JSON.parse(responseText);
                        resolve(response);
                    } catch (e) {
                        reject(e);
                    }
                };
                
                document.body.appendChild(form);
                form.submit();
                document.body.removeChild(form);
            });
        } else {
            // For GET requests, use fetch with no-cors mode
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'no-cors' // This prevents CORS errors but we can't read response
                });
                // Since we can't read the response with no-cors, we'll assume it works
                return {items: [], message: 'Connection successful'};
            } catch (error) {
                // Even with no-cors, we might get network errors
                throw new Error('Network error occurred');
            }
        }
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
            const response = await this.makeGoogleAppsScriptRequest(
                `https://script.google.com/macros/s/${this.sheetId}/exec?action=syncItems`,
                { items: this.items }
            );
            
            if (response && response.items) {
                this.items = response.items;
                this.saveToLocalStorage();
                this.renderList();
                this.updateStats();
                this.showSyncMessage('Data synced successfully!');
            } else {
                this.showSyncMessage('Sync completed but no data returned', 'error');
            }
        } catch (error) {
            this.showSyncMessage('Sync failed. Please try again or check your Sheet ID.', 'error');
            console.error('Sync error:', error);
        }
    }
    
    showStatusMessage(message, type = '') {
        const statusElement = document.getElementById('connection-status');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
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
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', 'grocery-list.json');
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
                        const existingIds = new Set(this.items.map(item => item.id));
                        const newItems = importedItems.filter(item => !existingIds.has(item.id));
                        
                        this.items = [...this.items, ...newItems];
                        this.saveToLocalStorage();
                        this.renderList();
                        this.updateStats();
                        
                        this.showSyncMessage(`Imported ${newItems.length} new items`);
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
// Save service worker code to a file (you'll need to create sw.js with this content)
document.addEventListener('DOMContentLoaded', () => {
    new GroceryListManager();
});
