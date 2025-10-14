class Database {
    constructor() {
        this.dbName = 'RentTaxDB';
        this.version = 1;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Таблица объектов недвижимости
                if (!db.objectStoreNames.contains('objects')) {
                    const objectsStore = db.createObjectStore('objects', { keyPath: 'id', autoIncrement: true });
                    objectsStore.createIndex('name', 'name', { unique: false });
                }

                // Таблица договоров
                if (!db.objectStoreNames.contains('contracts')) {
                    const contractsStore = db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
                    contractsStore.createIndex('objectId', 'objectId', { unique: false });
                    contractsStore.createIndex('endDate', 'endDate', { unique: false });
                }

                // Таблица платежей
                if (!db.objectStoreNames.contains('payments')) {
                    const paymentsStore = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
                    paymentsStore.createIndex('contractId', 'contractId', { unique: false });
                    paymentsStore.createIndex('date', 'date', { unique: false });
                }

                // Таблица расходов
                if (!db.objectStoreNames.contains('expenses')) {
                    const expensesStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
                    expensesStore.createIndex('objectId', 'objectId', { unique: false });
                    expensesStore.createIndex('date', 'date', { unique: false });
                }

                // Таблица настроек
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    // Общие методы для работы с хранилищами
    async add(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, indexName = null) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const target = indexName ? store.index(indexName) : store;
        
        return new Promise((resolve, reject) => {
            const request = target.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, id, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.put({ ...data, id });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Специфические методы для объектов
    async addObject(object) {
        return this.add('objects', {
            ...object,
            createdAt: new Date().toISOString()
        });
    }

    async getObjects() {
        return this.getAll('objects');
    }

    async updateObject(id, object) {
        return this.update('objects', id, object);
    }

    async deleteObject(id) {
        // Удаляем связанные договоры и расходы
        const contracts = await this.getContractsByObject(id);
        for (const contract of contracts) {
            await this.deleteContract(contract.id);
        }
        
        const expenses = await this.getExpensesByObject(id);
        for (const expense of expenses) {
            await this.deleteExpense(expense.id);
        }
        
        return this.delete('objects', id);
    }

    // Специфические методы для договоров
    async addContract(contract) {
        return this.add('contracts', {
            ...contract,
            createdAt: new Date().toISOString(),
            isActive: true
        });
    }

    async getContracts() {
        return this.getAll('contracts');
    }

    async getContractsByObject(objectId) {
        const allContracts = await this.getContracts();
        return allContracts.filter(contract => contract.objectId == objectId);
    }

    async getActiveContracts() {
        const allContracts = await this.getContracts();
        return allContracts.filter(contract => contract.isActive);
    }

    async updateContract(id, contract) {
        return this.update('contracts', id, contract);
    }

    async deleteContract(id) {
        // Удаляем связанные платежи
        const payments = await this.getPaymentsByContract(id);
        for (const payment of payments) {
            await this.deletePayment(payment.id);
        }
        
        return this.delete('contracts', id);
    }

    // Специфические методы для платежей
    async addPayment(payment) {
        return this.add('payments', {
            ...payment,
            createdAt: new Date().toISOString()
        });
    }

    async getPayments() {
        return this.getAll('payments');
    }

    async getPaymentsByContract(contractId) {
        const allPayments = await this.getPayments();
        return allPayments.filter(payment => payment.contractId == contractId);
    }

    async getRecentPayments(limit = 10) {
        const allPayments = await this.getPayments();
        return allPayments
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    }

    async deletePayment(id) {
        return this.delete('payments', id);
    }

    // Специфические методы для расходов
    async addExpense(expense) {
        return this.add('expenses', {
            ...expense,
            createdAt: new Date().toISOString()
        });
    }

    async getExpenses() {
        return this.getAll('expenses');
    }

    async getExpensesByObject(objectId) {
        const allExpenses = await this.getExpenses();
        return allExpenses.filter(expense => expense.objectId == objectId);
    }

    async deleteExpense(id) {
        return this.delete('expenses', id);
    }
}

// Создаем глобальный экземпляр базы данных
const db = new Database();