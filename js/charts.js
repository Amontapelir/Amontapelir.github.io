class ChartsManager {
    constructor() {
        this.incomeExpenseChart = null;
        this.objectsChart = null;
        this.initializeCharts();
    }

    initializeCharts() {
        this.createIncomeExpenseChart();
        this.createObjectsChart();
        
        // Обновляем графики при изменении периода
        document.getElementById('analyticsPeriod').addEventListener('change', () => {
            this.updateCharts();
        });
    }

    createIncomeExpenseChart() {
        const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
        this.incomeExpenseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
                datasets: [
                    {
                        label: 'Доходы',
                        data: [0, 0, 0, 0, 0, 0],
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1
                    },
                    {
                        label: 'Расходы',
                        data: [0, 0, 0, 0, 0, 0],
                        backgroundColor: '#ef4444',
                        borderColor: '#dc2626',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Доходы и расходы по месяцам'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return new Intl.NumberFormat('ru-RU', {
                                    style: 'currency',
                                    currency: 'RUB',
                                    minimumFractionDigits: 0
                                }).format(value);
                            }
                        }
                    }
                }
            }
        });
    }

    createObjectsChart() {
        const ctx = document.getElementById('objectsChart').getContext('2d');
        this.objectsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Объект 1', 'Объект 2'],
                datasets: [{
                    data: [1, 1],
                    backgroundColor: [
                        '#3b82f6',
                        '#8b5cf6',
                        '#ef4444',
                        '#f59e0b',
                        '#10b981'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Распределение доходов по объектам'
                    }
                }
            }
        });
    }

    async updateCharts() {
        await this.updateIncomeExpenseChart();
        await this.updateObjectsChart();
    }

    async updateIncomeExpenseChart() {
        // Здесь будет логика получения данных за выбранный период
        // Пока используем тестовые данные
        const payments = await db.getPayments();
        const expenses = await db.getExpenses();
        
        // Группируем по месяцам
        const monthlyData = this.groupByMonth(payments, expenses);
        
        this.incomeExpenseChart.data.labels = monthlyData.labels;
        this.incomeExpenseChart.data.datasets[0].data = monthlyData.income;
        this.incomeExpenseChart.data.datasets[1].data = monthlyData.expenses;
        this.incomeExpenseChart.update();
    }

    async updateObjectsChart() {
        const objects = await db.getObjects();
        const objectRevenues = [];

        for (const object of objects) {
            const calculation = await taxCalculator.calculateForObject(object.id);
            if (calculation.totalIncome > 0) {
                objectRevenues.push({
                    name: object.name,
                    revenue: calculation.totalIncome
                });
            }
        }

        this.objectsChart.data.labels = objectRevenues.map(obj => obj.name);
        this.objectsChart.data.datasets[0].data = objectRevenues.map(obj => obj.revenue);
        this.objectsChart.update();
    }

    groupByMonth(payments, expenses) {
        // Упрощенная группировка по месяцам
        const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        const currentMonth = new Date().getMonth();
        
        const income = new Array(6).fill(0);
        const expensesData = new Array(6).fill(0);
        const labels = [];

        // Заполняем последние 6 месяцев
        for (let i = 5; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            labels.push(months[monthIndex]);
        }

        // Здесь должна быть реальная логика группировки данных
        // Пока используем случайные данные для демонстрации
        income.forEach((_, i) => {
            income[i] = Math.floor(Math.random() * 100000) + 50000;
            expensesData[i] = Math.floor(Math.random() * 30000) + 10000;
        });

        return { labels, income, expenses: expensesData };
    }
}