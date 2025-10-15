class TaxCalculator {
    constructor() {
        this.tenantType = 'physical';
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculate());
        document.querySelectorAll('input[name="tenantType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.tenantType = e.target.value;
                this.updateTaxLabel();
                this.calculate();
            });
        });

        [
            'rentIncome', 'additionalIncome', 'mortgageExpense',
            'utilitiesExpense', 'maintenanceExpense', 'otherExpenses'
        ].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.calculate());
        });

        this.updateTaxLabel();
    }

    updateTaxLabel() {
        const taxLabel = document.getElementById('taxLabel');
        const taxRate = this.tenantType === 'physical' ? '4%' : '6%';
        const tenantTypeText = this.tenantType === 'physical' ? 'физлицу' : 'юрлицу';
        taxLabel.textContent = `Налог (${taxRate}):`;
    }

    calculate() {
        const rentIncome = parseFloat(document.getElementById('rentIncome').value) || 0;
        const additionalIncome = parseFloat(document.getElementById('additionalIncome').value) || 0;

        const mortgageExpense = parseFloat(document.getElementById('mortgageExpense').value) || 0;
        const utilitiesExpense = parseFloat(document.getElementById('utilitiesExpense').value) || 0;
        const maintenanceExpense = parseFloat(document.getElementById('maintenanceExpense').value) || 0;
        const otherExpenses = parseFloat(document.getElementById('otherExpenses').value) || 0;

        const totalIncome = rentIncome + additionalIncome;
        const totalExpenses = mortgageExpense + utilitiesExpense + maintenanceExpense + otherExpenses;

        const taxRate = this.tenantType === 'physical' ? 0.04 : 0.06;
        const taxAmount = totalIncome * taxRate;

        const netProfit = totalIncome - taxAmount - totalExpenses;

        this.displayResults(totalIncome, totalExpenses, taxAmount, netProfit);
    }

    displayResults(totalIncome, totalExpenses, taxAmount, netProfit) {
    const elements = {
        'totalIncome': totalIncome,
        'totalExpenses': totalExpenses,
        'taxAmount': taxAmount,
        'netProfit': netProfit
    };

    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = this.formatCurrency(value);
        } else {
            console.warn(`Элемент с id "${id}" не найден в DOM`);
        }
    }
}

    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount);
    }

    async calculateForObject(objectId, tenantType = 'physical') {
        const contracts = await db.getContractsByObject(objectId);
        const expenses = await db.getExpensesByObject(objectId);

        const activeContracts = contracts.filter(contract => contract.isActive);
        const totalIncome = activeContracts.reduce((sum, contract) => sum + contract.rentAmount, 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

        const taxRate = tenantType === 'physical' ? 0.04 : 0.06;
        const taxAmount = totalIncome * taxRate;
        const netProfit = totalIncome - taxAmount - totalExpenses;

        return {
            totalIncome,
            totalExpenses,
            taxAmount,
            netProfit,
            taxRate: taxRate * 100
        };
    }

    async calculateOverall(tenantType = 'physical') {
        const objects = await db.getObjects();
        let totalIncome = 0;
        let totalExpenses = 0;

        for (const object of objects) {
            const calculation = await this.calculateForObject(object.id, tenantType);
            totalIncome += calculation.totalIncome;
            totalExpenses += calculation.totalExpenses;
        }

        const taxRate = tenantType === 'physical' ? 0.04 : 0.06;
        const taxAmount = totalIncome * taxRate;
        const netProfit = totalIncome - taxAmount - totalExpenses;

        return {
            totalIncome,
            totalExpenses,
            taxAmount,
            netProfit
        };
    }
    getCurrentTaxRate() {
        return this.tenantType === 'physical' ? 4 : 6;
    }
}


const taxCalculator = new TaxCalculator();
