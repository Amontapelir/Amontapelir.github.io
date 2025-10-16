class RentTaxApp {
    constructor() {
        this.db = db;
        this.calculator = taxCalculator;
        this.charts = new ChartsManager();
        this.currentUser = null;

        // Отложенная инициализация
        this.initializeAppWithDB();
    }

    async initializeAppWithDB() {
        try {
            // Ждем инициализации базы данных
            await this.db.waitForInit();

            this.initializeEventListeners();
            this.loadTheme();
            await this.loadInitialData();
        } catch (error) {
            console.error('Ошибка инициализации приложения:', error);
            this.showNotification('Ошибка загрузки приложения', 'error');
        }
    }

    initializeEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.id !== 'themeToggle') {
                btn.addEventListener('click', (e) => this.switchPage(e.target.dataset.page));
            }
        });

        // Тема
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Объекты
        document.getElementById('addObjectBtn').addEventListener('click', () => this.showObjectModal());
        document.getElementById('objectForm').addEventListener('submit', (e) => this.saveObject(e));
        document.getElementById('cancelObjectBtn').addEventListener('click', () => this.hideObjectModal());

        // Договоры
        document.getElementById('addContractBtn').addEventListener('click', () => this.showContractModal());
        document.getElementById('contractForm').addEventListener('submit', (e) => this.saveContract(e));
        document.getElementById('cancelContractBtn').addEventListener('click', () => this.hideContractModal());

        // Калькулятор
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculateTax());

        // Автоматический расчет при изменении значений
        [
            'rentIncome', 'additionalIncome', 'mortgageExpense',
            'utilitiesExpense', 'maintenanceExpense', 'otherExpenses'
        ].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.calculateTax());
        });

        // Расчет при изменении типа арендатора
        document.querySelectorAll('input[name="tenantType"]').forEach(radio => {
            radio.addEventListener('change', () => this.calculateTax());
        });

        // Экспорт
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());

        // Закрытие модальных окон при клике вне их
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.add('hidden');
            }
        });

        this.setInputSteps();
    }

    setInputSteps() {
        // Поля с шагом 1000
        const step1000 = ['rentIncome', 'mortgageExpense'];
        // Поля с шагом 500
        const step500 = ['additionalIncome', 'utilitiesExpense', 'maintenanceExpense', 'otherExpenses'];

        step1000.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.step = '1000';
                element.min = '0';
                this.addInputValidation(element);
            }
        });

        step500.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.step = '500';
                element.min = '0';
                this.addInputValidation(element);
            }
        });
    }

    addInputValidation(inputElement) {
        // Устанавливаем placeholder вместо значения
        inputElement.placeholder = '0';
        inputElement.value = ''; // Очищаем значение, используем только placeholder

        // Обработчик фокуса - выделяем текст
        inputElement.addEventListener('focus', (e) => {
            // Если значение пустое, оставляем пустым для ввода
            e.target.select();
        });

        // Обработчик потери фокуса - если пусто, показываем placeholder
        inputElement.addEventListener('blur', (e) => {
            // Ничего не делаем - placeholder сам покажется
            // Запускаем пересчет
            setTimeout(() => {
                e.target.dispatchEvent(new Event('input'));
            }, 10);
        });

        // Запрещаем ввод нечисловых символов
        inputElement.addEventListener('keydown', (e) => {
            // Разрешаем: цифры, Backspace, Delete, Tab, стрелки, Home, End, Enter
            const allowedKeys = [
                'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
                'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'
            ];

            // Разрешаем Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key)) {
                return;
            }

            // Запрещаем все, кроме цифр и разрешенных клавиш
            if (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key)) {
                e.preventDefault();
            }
        });

        // Улучшенная обработка вставки
        inputElement.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text');

            // Оставляем только цифры
            const numbersOnly = pastedText.replace(/[^\d]/g, '');

            if (numbersOnly) {
                // Вставляем очищенный текст
                const start = inputElement.selectionStart;
                const end = inputElement.selectionEnd;
                const currentValue = inputElement.value;

                // Формируем новое значение
                const newValue = currentValue.substring(0, start) + numbersOnly + currentValue.substring(end);
                inputElement.value = newValue;

                // Устанавливаем курсор после вставленного текста
                const newCursorPos = start + numbersOnly.length;
                inputElement.setSelectionRange(newCursorPos, newCursorPos);

                // Запускаем событие input для пересчета
                inputElement.dispatchEvent(new Event('input'));
            }
        });

        // Дополнительная проверка при изменении значения
        inputElement.addEventListener('input', (e) => {
            // Удаляем любые нечисловые символы, которые могли появиться
            const value = e.target.value;
            const cleanValue = value.replace(/[^\d]/g, '');

            if (value !== cleanValue) {
                const cursorPos = e.target.selectionStart;
                e.target.value = cleanValue;
                // Восстанавливаем позицию курсора
                e.target.setSelectionRange(cursorPos - (value.length - cleanValue.length), cursorPos - (value.length - cleanValue.length));
            }

            // Запускаем расчет
            this.calculator.calculate();
        });

        // Защита от контекстного меню (опционально)
        inputElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    // Переключение темы
    toggleTheme() {
        const body = document.body;
        const themeToggle = document.getElementById('themeToggle');

        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            themeToggle.textContent = '🌙 Тёмная';
            localStorage.setItem('theme', 'light');
        } else {
            body.classList.add('dark-theme');
            themeToggle.textContent = '☀️ Светлая';
            localStorage.setItem('theme', 'dark');
        }
    }

    // Загрузка темы из localStorage
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const themeToggle = document.getElementById('themeToggle');

        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.textContent = '☀️ Светлая';
        } else {
            document.body.classList.remove('dark-theme');
            themeToggle.textContent = '🌙 Тёмная';
        }
    }

    // Метод для расчета налогов и прибыли в калькуляторе
    calculateTax() {
        this.calculator.calculate();
    }

    // Метод для отображения результатов расчета
    displayCalculatorResults(totalIncome, totalExpenses, taxAmount, netProfit, taxInfo) {
        document.getElementById('totalIncome').textContent = this.formatCurrency(totalIncome);
        document.getElementById('totalExpenses').textContent = this.formatCurrency(totalExpenses);
        document.getElementById('taxAmount').textContent = this.formatCurrency(taxAmount);
        document.getElementById('netProfit').textContent = this.formatCurrency(netProfit);

        // Обновляем label налога
        const taxLabel = document.getElementById('taxLabel');
        taxLabel.textContent = `Ставка: ${taxInfo.rate * 100}%`;
    }

    switchPage(pageId) {
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Убираем активный класс у всех кнопок навигации
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Показываем выбранную страницу
        document.getElementById(pageId).classList.add('active');

        // Активируем соответствующую кнопку навигации
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        // Загружаем данные для страницы
        this.loadPageData(pageId);
    }

    async loadPageData(pageId) {
        try {
            switch (pageId) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'objects':
                    await this.loadObjects();
                    break;
                case 'contracts':
                    await this.loadContracts();
                    break;
                case 'analytics':
                    await this.loadAnalytics();
                    break;
            }
        } catch (error) {
            console.error(`Ошибка загрузки страницы ${pageId}:`, error);
            this.showNotification('Ошибка загрузки данных', 'error');
        }
    }

    async loadInitialData() {
        await this.loadDashboard();
    }

    async loadDashboard() {
        const objects = await this.db.getObjects();
        const contracts = await this.db.getContracts();
        const payments = await this.db.getRecentPayments(5);

        // Получаем текущий тип арендатора из калькулятора
        const currentTenantType = this.calculator.tenantType;
        const overallCalculation = await this.calculator.calculateOverall(currentTenantType);

        // Обновляем статистику
        document.getElementById('totalProfit').textContent = this.formatCurrency(overallCalculation.netProfit);
        document.getElementById('activeObjects').textContent = objects.length;
        document.getElementById('totalObjects').textContent = objects.length;
        document.getElementById('nextTax').textContent = this.formatCurrency(overallCalculation.taxAmount);

        const activeContracts = contracts.filter(c => c.isActive);
        document.getElementById('upcomingPayments').textContent = activeContracts.length;

        // Последние операции
        this.displayRecentTransactions(payments);

        // Ближайшие платежи
        this.displayUpcomingPayments(activeContracts);
    }

    async loadObjects() {
        const objects = await this.db.getObjects();
        const container = document.getElementById('objectsList');

        container.innerHTML = '';

        if (objects.length === 0) {
            container.innerHTML = `
                <div class="card text-center">
                    <h3>Объекты недвижимости</h3>
                    <p>У вас пока нет добавленных объектов недвижимости</p>
                    <button class="btn-primary" onclick="app.showObjectModal()">
                        Добавить первый объект
                    </button>
                </div>
            `;
            return;
        }

        for (const object of objects) {
            const calculation = await this.calculator.calculateForObject(object.id);
            const objectCard = this.createObjectCard(object, calculation);
            container.appendChild(objectCard);
        }
    }

    createObjectCard(object, calculation) {
        const card = document.createElement('div');
        card.className = 'object-card';
        card.innerHTML = `
            <h4>${object.name}</h4>
            <div class="object-details">
                <div>${object.address}</div>
                <div>${this.getObjectTypeText(object.type)}</div>
                <div>Базовая ставка: ${this.formatCurrency(object.baseRentRate)}/мес</div>
            </div>
            <div class="object-stats">
                <div>Доход: <strong>${this.formatCurrency(calculation.totalIncome)}</strong></div>
                <div>Прибыль: <strong class="${calculation.netProfit >= 0 ? 'income' : 'expense'}">${this.formatCurrency(calculation.netProfit)}</strong></div>
            </div>
            <div class="object-actions">
                <button class="btn-secondary edit-object" data-id="${object.id}">Редактировать</button>
                <button class="btn-text delete-object" data-id="${object.id}">Удалить</button>
            </div>
        `;

        // Добавляем обработчики событий
        card.querySelector('.edit-object').addEventListener('click', (e) => {
            e.stopPropagation();
            this.editObject(object.id);
        });

        card.querySelector('.delete-object').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteObject(object.id);
        });

        return card;
    }

    async loadContracts() {
        const contracts = await this.db.getContracts();
        const objects = await this.db.getObjects();
        const container = document.getElementById('contractsList');

        container.innerHTML = '';

        if (contracts.length === 0) {
            container.innerHTML = `
                <div class="card text-center">
                    <h3>Договоры аренды</h3>
                    <p>У вас пока нет активных договоров аренды</p>
                    <button class="btn-primary" onclick="app.showContractModal()">
                        Добавить первый договор
                    </button>
                </div>
            `;
            return;
        }

        for (const contract of contracts) {
            const object = objects.find(o => o.id === contract.objectId);
            const contractCard = this.createContractCard(contract, object);
            container.appendChild(contractCard);
        }
    }

    createContractCard(contract, object) {
        const card = document.createElement('div');
        card.className = 'contract-card';
        card.innerHTML = `
            <h4>Договор с ${contract.tenantName}</h4>
            <div class="contract-details">
                <div>Объект: ${object ? object.name : 'Неизвестно'}</div>
                <div>Период: ${this.formatDate(contract.startDate)} - ${this.formatDate(contract.endDate)}</div>
                <div>Сумма: ${this.formatCurrency(contract.rentAmount)}/мес</div>
                <div>Статус: <span class="${contract.isActive ? 'active' : 'inactive'}">${contract.isActive ? 'Активен' : 'Завершен'}</span></div>
            </div>
            <div class="contract-actions">
                <button class="btn-secondary edit-contract" data-id="${contract.id}">Редактировать</button>
                <button class="btn-text delete-contract" data-id="${contract.id}">Удалить</button>
            </div>
        `;

        card.querySelector('.edit-contract').addEventListener('click', (e) => {
            e.stopPropagation();
            this.editContract(contract.id);
        });

        card.querySelector('.delete-contract').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteContract(contract.id);
        });

        return card;
    }

    async loadAnalytics() {
        await this.charts.updateCharts();

        const overallCalculation = await this.calculator.calculateOverall();

        document.getElementById('analyticsIncome').textContent = this.formatCurrency(overallCalculation.totalIncome);
        document.getElementById('analyticsExpenses').textContent = this.formatCurrency(overallCalculation.totalExpenses);
        document.getElementById('analyticsTaxes').textContent = this.formatCurrency(overallCalculation.taxAmount);
        document.getElementById('analyticsProfit').textContent = this.formatCurrency(overallCalculation.netProfit);
    }

    // Модальные окна для объектов
    showObjectModal(objectId = null) {
        const modal = document.getElementById('objectModal');
        const title = document.getElementById('objectModalTitle');

        if (objectId) {
            title.textContent = 'Редактировать объект';
            this.loadObjectData(objectId);
        } else {
            title.textContent = 'Добавить объект';
            document.getElementById('objectForm').reset();
            document.getElementById('objectId').value = '';
        }

        modal.classList.remove('hidden');
    }

    hideObjectModal() {
        document.getElementById('objectModal').classList.add('hidden');
    }

    async loadObjectData(objectId) {
        const object = await this.db.get('objects', objectId);
        if (object) {
            document.getElementById('objectId').value = object.id;
            document.getElementById('objectName').value = object.name;
            document.getElementById('objectAddress').value = object.address;
            document.getElementById('objectType').value = object.type;
            document.getElementById('objectRent').value = object.baseRentRate;
        }
    }

    async saveObject(event) {
        event.preventDefault();

        const objectId = document.getElementById('objectId').value;
        const objectData = {
            name: document.getElementById('objectName').value,
            address: document.getElementById('objectAddress').value,
            type: document.getElementById('objectType').value,
            baseRentRate: parseFloat(document.getElementById('objectRent').value)
        };

        try {
            if (objectId) {
                await this.db.updateObject(parseInt(objectId), objectData);
                this.showNotification('Объект успешно обновлен');
            } else {
                await this.db.addObject(objectData);
                this.showNotification('Объект успешно добавлен');
            }

            this.hideObjectModal();
            await this.loadObjects();
            await this.loadDashboard();
        } catch (error) {
            this.showNotification('Ошибка при сохранении объекта');
            console.error(error);
        }
    }

    async editObject(objectId) {
        this.showObjectModal(objectId);
    }

    async deleteObject(objectId) {
        if (confirm('Вы уверены, что хотите удалить этот объект? Все связанные договоры и расходы также будут удалены.')) {
            try {
                await this.db.deleteObject(objectId);
                this.showNotification('Объект успешно удален');
                await this.loadObjects();
                await this.loadDashboard();
            } catch (error) {
                this.showNotification('Ошибка при удалении объекта');
                console.error(error);
            }
        }
    }

    // Модальные окна для договоров
    async showContractModal(contractId = null) {
        const modal = document.getElementById('contractModal');
        const title = document.getElementById('contractModalTitle');
        const objectSelect = document.getElementById('contractObject');
        const warningMessage = document.getElementById('noObjectsWarning');
        const saveButton = document.getElementById('saveContractBtn');

        // Загружаем объекты для выбора
        const objects = await this.db.getObjects();
        objectSelect.innerHTML = '<option value="">Выберите объект</option>';

        if (objects.length === 0) {
            // Если объектов нет, показать сообщение
            objectSelect.innerHTML = '<option value="" disabled selected>Сначала добавьте объект</option>';
            warningMessage.classList.remove('hidden');
            saveButton.disabled = true;
        } else {
            // Заполнить select объектами
            objects.forEach(object => {
                objectSelect.innerHTML += `<option value="${object.id}">${object.name}</option>`;
            });
            warningMessage.classList.add('hidden');
            saveButton.disabled = false;
        }

        if (contractId) {
            title.textContent = 'Редактировать договор';
            await this.loadContractData(contractId);
        } else {
            title.textContent = 'Новый договор';
            document.getElementById('contractForm').reset();
            document.getElementById('contractId').value = '';

            // Устанавливаем дату начала на сегодня, окончания - через год
            const today = new Date().toISOString().split('T')[0];
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            const nextYearFormatted = nextYear.toISOString().split('T')[0];

            document.getElementById('contractStart').value = today;
            document.getElementById('contractEnd').value = nextYearFormatted;
        }

        modal.classList.remove('hidden');
    }

    hideContractModal() {
        document.getElementById('contractModal').classList.add('hidden');
        // Скрыть предупреждение при закрытии модального окна
        document.getElementById('noObjectsWarning').classList.add('hidden');
    }

    async loadContractData(contractId) {
        const contract = await this.db.get('contracts', contractId);
        if (contract) {
            document.getElementById('contractId').value = contract.id;
            document.getElementById('contractObject').value = contract.objectId;
            document.getElementById('contractTenant').value = contract.tenantName;
            document.getElementById('contractStart').value = contract.startDate;
            document.getElementById('contractEnd').value = contract.endDate;
            document.getElementById('contractAmount').value = contract.rentAmount;
            document.getElementById('contractSchedule').value = contract.paymentSchedule;
        }
    }

    async saveContract(event) {
        event.preventDefault();

        const objects = await this.db.getObjects();
        if (objects.length === 0) {
            this.showNotification('Сначала добавьте объект недвижимости', 'error');
            return;
        }

        const contractId = document.getElementById('contractId').value;
        const contractData = {
            objectId: parseInt(document.getElementById('contractObject').value),
            tenantName: document.getElementById('contractTenant').value,
            startDate: document.getElementById('contractStart').value,
            endDate: document.getElementById('contractEnd').value,
            rentAmount: parseFloat(document.getElementById('contractAmount').value),
            paymentSchedule: document.getElementById('contractSchedule').value
        };

        try {
            if (contractId) {
                await this.db.updateContract(parseInt(contractId), contractData);
                this.showNotification('Договор успешно обновлен');
            } else {
                await this.db.addContract(contractData);
                this.showNotification('Договор успешно добавлен');
            }

            this.hideContractModal();
            await this.loadContracts();
            await this.loadDashboard();
        } catch (error) {
            this.showNotification('Ошибка при сохранении договора');
            console.error(error);
        }
    }

    async editContract(contractId) {
        this.showContractModal(contractId);
    }

    async deleteContract(contractId) {
        if (confirm('Вы уверены, что хотите удалить этот договор? Все связанные платежи также будут удалены.')) {
            try {
                await this.db.deleteContract(contractId);
                this.showNotification('Договор успешно удален');
                await this.loadContracts();
                await this.loadDashboard();
            } catch (error) {
                this.showNotification('Ошибка при удалении договора');
                console.error(error);
            }
        }
    }

    // Вспомогательные методы
    displayRecentTransactions(payments) {
        const container = document.getElementById('recentTransactions');
        container.innerHTML = '';

        if (payments.length === 0) {
            container.innerHTML = '<div class="transaction-item">Нет операций</div>';
            return;
        }

        payments.forEach(payment => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.innerHTML = `
                <div>
                    <div>Платеж по договору</div>
                    <small>${this.formatDate(payment.date)}</small>
                </div>
                <div class="transaction-amount income">
                    +${this.formatCurrency(payment.amount)}
                </div>
            `;
            container.appendChild(item);
        });
    }

    displayUpcomingPayments(contracts) {
        const container = document.getElementById('upcomingList');
        container.innerHTML = '';

        if (contracts.length === 0) {
            container.innerHTML = '<div class="upcoming-item">Нет предстоящих платежей</div>';
            return;
        }

        contracts.slice(0, 5).forEach(contract => {
            const item = document.createElement('div');
            item.className = 'upcoming-item';
            item.innerHTML = `
                <div>
                    <div>${contract.tenantName}</div>
                    <small>Следующий платеж</small>
                </div>
                <div class="transaction-amount">
                    ${this.formatCurrency(contract.rentAmount)}
                </div>
            `;
            container.appendChild(item);
        });
    }

    getObjectTypeText(type) {
        const types = {
            'apartment': 'Квартира',
            'house': 'Дом',
            'room': 'Комната',
            'commercial': 'Коммерческая'
        };
        return types[type] || type;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU');
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    async exportData() {
        const objects = await this.db.getObjects();
        const contracts = await this.db.getContracts();
        const payments = await this.db.getPayments();
        const expenses = await this.db.getExpenses();

        const data = {
            objects,
            contracts,
            payments,
            expenses,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rent-tax-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showNotification('Данные успешно экспортированы');
    }
}

// Создаем глобальный экземпляр приложения
let app;

// Запускаем приложение когда DOM загружен
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Сначала инициализируем базу данных
        await db.waitForInit();
        // Потом создаем приложение
        app = new RentTaxApp();
    } catch (error) {
        console.error('Ошибка запуска приложения:', error);
        // Показываем сообщение об ошибке пользователю
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = 'Не удалось загрузить приложение. Пожалуйста, обновите страницу.';
        document.body.appendChild(notification);
    }
});