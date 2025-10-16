class TaxCalculator {
    constructor() {
        this.tenantType = 'physical'; // По умолчанию физлицо
        this.landlordType = 'selfEmployed'; // По умолчанию самозанятый
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculate());

        // Переключатель типа арендатора
        document.querySelectorAll('input[name="tenantType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.tenantType = e.target.value;
                this.updateTaxInfo();
                this.calculate();
            });
        });

        // Переключатель типа арендодателя
        document.querySelectorAll('input[name="landlordType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.landlordType = e.target.value;
                this.updateTaxInfo();
                this.calculate();
            });
        });

        // Авторасчет при изменении значений
        [
            'rentIncome', 'additionalIncome', 'mortgageExpense',
            'utilitiesExpense', 'maintenanceExpense', 'otherExpenses'
        ].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.calculate());
        });

        // Инициализируем интерфейс
        this.updateTaxInfo();
    }

    calculate() {
        // Получаем значения доходов
        const rentIncome = parseFloat(document.getElementById('rentIncome').value) || 0;
        const additionalIncome = parseFloat(document.getElementById('additionalIncome').value) || 0;

        // Получаем значения расходов
        const mortgageExpense = parseFloat(document.getElementById('mortgageExpense').value) || 0;
        const utilitiesExpense = parseFloat(document.getElementById('utilitiesExpense').value) || 0;
        const maintenanceExpense = parseFloat(document.getElementById('maintenanceExpense').value) || 0;
        const otherExpenses = parseFloat(document.getElementById('otherExpenses').value) || 0;

        // Рассчитываем итоги
        const totalIncome = rentIncome + additionalIncome;
        const totalExpenses = mortgageExpense + utilitiesExpense + maintenanceExpense + otherExpenses;

        // Рассчитываем налог в зависимости от типа арендодателя и арендатора
        const taxInfo = this.calculateTax(totalIncome);
        const taxAmount = taxInfo.amount;

        // Чистая прибыль
        const netProfit = totalIncome - taxAmount - totalExpenses;

        this.displayResults(totalIncome, totalExpenses, taxAmount, netProfit, taxInfo);
    }

    calculateTax(totalIncome) {
        let taxRate, taxType, description;

        switch (this.landlordType) {
            case 'selfEmployed':
                // Самозанятый: НПД
                taxRate = this.tenantType === 'physical' ? 0.04 : 0.06;
                taxType = 'НПД';
                description = 'Налог на профессиональный доход';
                break;

            case 'individualEntrepreneur':
                // ИП: УСН 6%
                taxRate = 0.06;
                taxType = 'УСН';
                description = 'Упрощенная система налогообложения';
                break;

            case 'individual':
                // Физлицо: НДФЛ 13%
                taxRate = 0.13;
                taxType = 'НДФЛ';
                description = 'Налог на доходы физических лиц';
                break;

            default:
                taxRate = 0.04;
                taxType = 'НПД';
                description = 'Налог на профессиональный доход';
        }

        return {
            rate: taxRate,
            amount: totalIncome * taxRate,
            type: taxType,
            description: description
        };
    }

    displayResults(totalIncome, totalExpenses, taxAmount, netProfit, taxInfo) {
        document.getElementById('totalIncome').textContent = this.formatCurrency(totalIncome);
        document.getElementById('totalExpenses').textContent = this.formatCurrency(totalExpenses);
        document.getElementById('taxAmount').textContent = this.formatCurrency(taxAmount);
        document.getElementById('netProfit').textContent = this.formatCurrency(netProfit);

        // Обновляем label налога
        const taxLabel = document.getElementById('taxLabel');
        taxLabel.textContent = `${taxInfo.type}: ${(taxInfo.rate * 100)}%`;
    }

    updateTaxInfo() {
        const taxInfo = document.getElementById('taxInfo');
        let content = '';

        switch (this.landlordType) {
            case 'selfEmployed':
                content = `
                    <strong>Налог на профессиональный доход (НПД)</strong><br>
                    • Ставка: 4% при сдаче физлицам<br>
                    • Ставка: 6% при сдаче юрлицам<br>
                    • Расходы не уменьшают налоговую базу<br>
                    • Уплата до 28 числа каждого месяца<br>
                    • Не требуется отчетность
                `;
                break;

            case 'individualEntrepreneur':
                content = `
                    <strong>Упрощенная система налогообложения (УСН)</strong><br>
                    • Ставка: 6% с доходов<br>
                    • Расходы не уменьшают налоговую базу (при УСН "Доходы")<br>
                    • Уплата авансовых платежей до 25 числа<br>
                    • Налоговая декларация раз в год<br>
                    • Обязательное ведение КУДиР
                `;
                break;

            case 'individual':
                content = `
                    <strong>Налог на доходы физических лиц (НДФЛ)</strong><br>
                    • Ставка: 13% с доходов<br>
                    • Можно учитывать подтвержденные расходы<br>
                    • Налоговая декларация 3-НДФЛ до 30 апреля<br>
                    • Уплата налога до 15 июля следующего года<br>
                    • Обязательно подавать декларацию
                `;
                break;
        }

        taxInfo.innerHTML = content;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount);
    }

    // Методы для расчетов по объектам
    async calculateForObject(objectId, tenantType = 'physical', landlordType = 'selfEmployed') {
        const contracts = await db.getContractsByObject(objectId);
        const expenses = await db.getExpensesByObject(objectId);

        const activeContracts = contracts.filter(contract => contract.isActive);
        const totalIncome = activeContracts.reduce((sum, contract) => sum + contract.rentAmount, 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

        const taxInfo = this.calculateTaxForType(totalIncome, tenantType, landlordType);
        const taxAmount = taxInfo.amount;
        const netProfit = totalIncome - taxAmount - totalExpenses;

        return {
            totalIncome,
            totalExpenses,
            taxAmount,
            netProfit,
            taxRate: taxInfo.rate * 100
        };
    }

    calculateTaxForType(totalIncome, tenantType, landlordType) {
        let taxRate;

        switch (landlordType) {
            case 'selfEmployed':
                taxRate = tenantType === 'physical' ? 0.04 : 0.06;
                break;
            case 'individualEntrepreneur':
                taxRate = 0.06;
                break;
            case 'individual':
                taxRate = 0.13;
                break;
            default:
                taxRate = 0.04;
        }

        return {
            rate: taxRate,
            amount: totalIncome * taxRate
        };
    }

    async calculateOverall(tenantType = 'physical', landlordType = 'selfEmployed') {
        const objects = await db.getObjects();
        let totalIncome = 0;
        let totalExpenses = 0;

        for (const object of objects) {
            const calculation = await this.calculateForObject(object.id, tenantType, landlordType);
            totalIncome += calculation.totalIncome;
            totalExpenses += calculation.totalExpenses;
        }

        const taxInfo = this.calculateTaxForType(totalIncome, tenantType, landlordType);
        const taxAmount = taxInfo.amount;
        const netProfit = totalIncome - taxAmount - totalExpenses;

        return {
            totalIncome,
            totalExpenses,
            taxAmount,
            netProfit
        };
    }

    // Метод для получения текущей налоговой ставки
    getCurrentTaxRate() {
        switch (this.landlordType) {
            case 'selfEmployed':
                return this.tenantType === 'physical' ? 4 : 6;
            case 'individualEntrepreneur':
                return 6;
            case 'individual':
                return 13;
            default:
                return 4;
        }
    }
}

const taxCalculator = new TaxCalculator();