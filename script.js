const API = "https://open.er-api.com/v6/latest/ETB";
const STORAGE_KEY = "birr-budget-data-v2";

const defaultTransactions = [
    {
        id: 1,
        title: "Groceries",
        amount: 550,
        type: "expense",
        category: "Food",
        date: "2026-08-30",
        notes: "Weekly shopping"
    },
    {
        id: 2,
        title: "Salary",
        amount: 20000,
        type: "income",
        category: "Income",
        date: "2026-08-29",
        notes: "Monthly salary"
    },
    {
        id: 3,
        title: "Transport",
        amount: 200,
        type: "expense",
        category: "Transport",
        date: "2026-08-28",
        notes: "Taxi"
    }
];

const defaultCategoryBudgets = {
    "Food": 500,
    "Utilities": 200,
    "Rent": 1200,
    "Transport": 100,
    "Entertainment": 150,
    "Shopping": 300,
    "Health": 200
};

const categoryIcons = {
    Food: "🍔",
    Transport: "🚌",
    Utilities: "💡",
    Entertainment: "🎮",
    Shopping: "🛒",
    Health: "❤️",
    Rent: "🏠",
    Income: "💰"
};

const priorityCurrencies = [
    "ETB", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "KES", "CNY", "JPY", "INR", "AUD", "CHF"
];

const fallbackRates = {
    ETB: 1,
    USD: 0.0079,
    EUR: 0.0073,
    GBP: 0.0062,
    AED: 0.029,
    SAR: 0.030,
    CAD: 0.011,
    KES: 1.02
};

const state = {
    transactions: [],
    categoryBudgets: { ...defaultCategoryBudgets },
    rates: { ...fallbackRates },
    currency: "ETB",
    watchlist: ["USD", "EUR"]
};

const transactionList = document.querySelector("#transactionList");
const transactionForm = document.querySelector("#transactionForm");
const balance = document.querySelector("#balance");
const incomeDisplay = document.querySelector("#incomeDisplay");
const spentPercentage = document.querySelector("#spentPercentage");
const budgetCircle = document.querySelector(".budget-circle");
const categoryButtons = document.querySelectorAll(".category-btn");
const categoryInput = document.querySelector("#category");
const categoryList = document.querySelector("#categoryList");
const currencySelect = document.querySelector("#currencySelect");
const currencyWatch = document.querySelector("#currencyWatch");
const showTransactionBtn = document.querySelector("#showTransactionBtn");
const addCategoryBtn = document.querySelector(".add-category");

function saveState() {
    try {
        const payload = {
            transactions: state.transactions,
            categoryBudgets: state.categoryBudgets,
            currency: state.currency,
            watchlist: state.watchlist
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
        console.error("Could not save to localStorage:", err);
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            state.transactions = Array.isArray(data.transactions) ? data.transactions : defaultTransactions;
            state.categoryBudgets = (data.categoryBudgets && Object.keys(data.categoryBudgets).length > 0)
                ? data.categoryBudgets
                : { ...defaultCategoryBudgets };
            state.currency = data.currency || "ETB";
            state.watchlist = Array.isArray(data.watchlist) ? data.watchlist : ["USD", "EUR"];
            return;
        }
    } catch (err) {
        console.warn("Could not parse saved data, initializing defaults:", err);
    }

    state.transactions = [...defaultTransactions];
    state.categoryBudgets = { ...defaultCategoryBudgets };
    state.currency = "ETB";
    state.watchlist = ["USD", "EUR"];
}

async function loadRates() {
    try {
        const response = await fetch(API);
        if (!response.ok) {
            throw new Error(`Rates API HTTP error: ${response.status}`);
        }
        const data = await response.json();
        if (data && data.rates) {
            state.rates = { ...data.rates, ETB: 1 };
        }
    } catch (err) {
        console.warn("Could not fetch latest rates from API, using fallback rates:", err);
    }

    renderCurrencyOptions();
    updateAppView();
}

function convertFromETB(amountInETB, targetCurrency = state.currency) {
    if (targetCurrency === "ETB") return amountInETB;
    const rate = state.rates[targetCurrency] || 1;
    return amountInETB * rate;
}

function formatCurrency(amountInETB, currency = state.currency) {
    const converted = convertFromETB(amountInETB, currency);
    const formattedNumber = Number(converted).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${formattedNumber} ${currency}`;
}

function renderCurrencyOptions() {
    if (!currencySelect) return;

    const availableCurrencies = Object.keys(state.rates);
    const sorted = [
        ...priorityCurrencies.filter(c => availableCurrencies.includes(c)),
        ...availableCurrencies.filter(c => !priorityCurrencies.includes(c)).sort()
    ];

    const optionsHtml = sorted.map(curr => {
        const isDefault = curr === "ETB" ? " (Default)" : "";
        return `<option value="${curr}">${curr}${isDefault}</option>`;
    }).join("");

    currencySelect.innerHTML = optionsHtml;
    currencySelect.value = state.currency;
}

function calculateIncome() {
    return state.transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function calculateTotalExpenses() {
    return state.transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function calculateBalance() {
    return calculateIncome() - calculateTotalExpenses();
}

function calculateTotalBudget() {
    return Object.values(state.categoryBudgets)
        .reduce((sum, budget) => sum + Number(budget || 0), 0);
}

function getCategorySpent(category) {
    return state.transactions
        .filter(t => t.category.toLowerCase() === category.toLowerCase() && t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function updateDashboard() {
    const income = calculateIncome();
    const expenses = calculateTotalExpenses();
    const currentBalance = calculateBalance();
    const totalBudget = calculateTotalBudget();

    const expensePercentage = totalBudget > 0
        ? (expenses / totalBudget) * 100
        : (income > 0 ? (expenses / income) * 100 : 0);

    if (balance) {
        balance.textContent = formatCurrency(currentBalance, state.currency);
        balance.style.color = currentBalance < 0 ? "#e63946" : "#2e9b57";
    }

    if (incomeDisplay) {
        incomeDisplay.textContent = `+ ${formatCurrency(income, state.currency)}`;
    }

    if (spentPercentage) {
        spentPercentage.textContent = `${Math.round(expensePercentage)}%`;
    }

    if (budgetCircle) {
        const deg = Math.min((expensePercentage / 100) * 360, 360);
        budgetCircle.style.setProperty("--spent-deg", `${deg}deg`);
    }

    renderCurrencyWatch(currentBalance, expenses);
}

function renderCurrencyWatch(currentBalance, totalExpenses) {
    if (!currencyWatch) return;

    let html = "";

    if (state.currency !== "ETB") {
        const rate = state.rates[state.currency] || 0;
        html += `
            <div class="converted-info">
                <div>
                    <span>Base ETB: <strong>${formatCurrency(currentBalance, "ETB")}</strong></span>
                    <span style="margin-left: 10px; color: #777;">Spent: ${formatCurrency(totalExpenses, "ETB")}</span>
                </div>
                <span class="rate-text">1 ETB = ${rate > 0 ? rate.toFixed(4) : "—"} ${state.currency}</span>
            </div>
        `;
    }

    const activeWatchlist = state.watchlist.filter(c => c !== state.currency);

    html += `
        <div class="watchlist-container">
            <span class="watchlist-label">Watchlist:</span>
    `;

    if (activeWatchlist.length === 0) {
        html += `<span style="font-size: 11px; color: #888;">No extra currencies pinned.</span>`;
    } else {
        activeWatchlist.forEach(curr => {
            const convertedBal = formatCurrency(currentBalance, curr);
            const convertedSpent = formatCurrency(totalExpenses, curr);
            html += `
                <div class="watch-chip" title="Spent: ${convertedSpent}">
                    <span>${curr}: <strong>${convertedBal}</strong></span>
                    <button type="button" class="chip-remove" data-currency="${curr}" title="Remove ${curr}">×</button>
                </div>
            `;
        });
    }

    if (state.currency !== "ETB" && !state.watchlist.includes(state.currency)) {
        html += `
            <button type="button" class="add-watch-chip-btn" id="pinCurrentCurrencyBtn">
                + Pin ${state.currency} to Watch
            </button>
        `;
    }

    html += `</div>`;

    currencyWatch.innerHTML = html;
}

function renderTransactions() {
    if (!transactionList) return;

    if (state.transactions.length === 0) {
        transactionList.innerHTML = `<p class="empty-message">No transactions yet.</p>`;
        return;
    }

    const itemsHtml = state.transactions.map(t => {
        const isIncome = t.type === "income";
        const sign = isIncome ? "+" : "−";
        const typeClass = isIncome ? "income" : "expense";
        const icon = categoryIcons[t.category] || (isIncome ? "💰" : "💸");
        const formattedAmount = `${sign} ${formatCurrency(t.amount, state.currency)}`;

        const subAmount = state.currency !== "ETB"
            ? `<span class="transaction-converted">(${t.amount} ETB)</span>`
            : "";

        const formattedDate = t.date ? new Date(t.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
        }) : "";

        return `
            <div class="transaction-item" data-id="${t.id}">
                <div class="transaction-left">
                    <div class="transaction-icon">${icon}</div>
                    <div class="transaction-meta">
                        <span class="transaction-title">${escapeHtml(t.title || t.category)}</span>
                        <span class="transaction-sub">${formattedDate}${t.notes ? ` • ${escapeHtml(t.notes)}` : ""}</span>
                    </div>
                </div>
                <div class="transaction-right">
                    <div class="transaction-amount-block">
                        <strong class="transaction-amount ${typeClass}">${formattedAmount}</strong>
                        ${subAmount}
                    </div>
                    <button type="button" class="delete-btn" data-id="${t.id}" title="Delete transaction">×</button>
                </div>
            </div>
        `;
    }).join("");

    transactionList.innerHTML = itemsHtml;
}

function deleteTransaction(id) {
    state.transactions = state.transactions.filter(t => String(t.id) !== String(id));
    saveState();
    updateAppView();
}

function updateCategoryBudgets() {
    if (!categoryList) return;

    const categories = Object.keys(state.categoryBudgets);

    const categoriesHtml = categories.map(category => {
        const budget = Number(state.categoryBudgets[category] || 0);
        const spent = getCategorySpent(category);
        const percentage = budget > 0 ? (spent / budget) * 100 : 0;
        const icon = categoryIcons[category] || "📁";
        const isOverBudget = spent > budget;

        const spentFormatted = Math.round(convertFromETB(spent, state.currency));
        const budgetFormatted = Math.round(convertFromETB(budget, state.currency));

        return `
            <div class="budget-category" data-category="${escapeHtml(category)}">
                <div class="category-info">
                    <span>${icon} ${escapeHtml(category)}</span>
                    <strong>
                        <span class="category-spent">${spentFormatted}</span>
                        /
                        <span class="category-budget">${budgetFormatted}</span>
                        ${state.currency}
                    </strong>
                </div>
                <div class="progress">
                    <div
                        class="progress-bar ${isOverBudget ? "over-budget" : ""}"
                        style="width: ${Math.min(percentage, 100)}%"
                        title="${Math.round(percentage)}% of budget used"
                    ></div>
                </div>
            </div>
        `;
    }).join("");

    categoryList.innerHTML = categoriesHtml;
}

function promptAddNewCategory() {
    const existingModal = document.querySelector(".modal-overlay");
    if (existingModal) existingModal.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add Budget Category</h3>
                <button type="button" class="modal-close">×</button>
            </div>
            <form id="newCategoryForm">
                <div class="form-group">
                    <label for="newCatName">Category Name</label>
                    <input type="text" id="newCatName" placeholder="e.g. Education, Travel" required>
                </div>
                <div class="form-group">
                    <label for="newCatBudget">Monthly Budget (ETB)</label>
                    <input type="number" id="newCatBudget" placeholder="e.g. 500" min="1" step="10" required>
                </div>
                <div class="form-group">
                    <label for="newCatIcon">Emoji Icon</label>
                    <input type="text" id="newCatIcon" placeholder="e.g. 📚, ✈️, 🛒" maxlength="2" value="📁">
                </div>
                <div class="modal-actions">
                    <button type="button" class="modal-btn-cancel">Cancel</button>
                    <button type="submit" class="modal-btn-submit">Add Category</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".modal-close");
    const cancelBtn = overlay.querySelector(".modal-btn-cancel");
    const form = overlay.querySelector("#newCategoryForm");
    const nameInput = overlay.querySelector("#newCatName");

    setTimeout(() => nameInput.focus(), 50);

    function closeModal() {
        overlay.remove();
    }

    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", e => {
        if (e.target === overlay) closeModal();
    });

    form.addEventListener("submit", e => {
        e.preventDefault();
        const catName = nameInput.value.trim();
        const catBudget = Number(overlay.querySelector("#newCatBudget").value);
        const catIcon = overlay.querySelector("#newCatIcon").value.trim() || "📁";

        if (!catName || catBudget <= 0) return;

        state.categoryBudgets[catName] = catBudget;
        categoryIcons[catName] = catIcon;

        const categoriesSelect = document.querySelector(".categories-select");
        if (categoriesSelect && !categoriesSelect.querySelector(`[data-category="${catName}"]`)) {
            const newBtn = document.createElement("button");
            newBtn.type = "button";
            newBtn.className = "category-btn";
            newBtn.dataset.category = catName;
            newBtn.innerHTML = `${catIcon} <span>${escapeHtml(catName)}</span>`;
            attachCategoryBtnEvent(newBtn);
            categoriesSelect.appendChild(newBtn);
        }

        saveState();
        updateCategoryBudgets();
        updateDashboard();
        closeModal();
    });
}

function attachCategoryBtnEvent(button) {
    button.addEventListener("click", function () {
        document.querySelectorAll(".category-btn").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        if (categoryInput) {
            categoryInput.value = button.dataset.category;
        }
    });
}

categoryButtons.forEach(attachCategoryBtnEvent);

if (transactionForm) {
    transactionForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const amountInput = document.querySelector("#amount");
        const typeInput = document.querySelector("#type");
        const dateInput = document.querySelector("#date");
        const notesInput = document.querySelector("#notes");

        const amount = Number(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid amount greater than 0.");
            return;
        }

        const type = typeInput ? typeInput.value : "expense";
        const category = categoryInput ? categoryInput.value : "Food";
        const date = dateInput ? dateInput.value : new Date().toISOString().split("T")[0];
        const notes = notesInput ? notesInput.value.trim() : "";

        const newTransaction = {
            id: Date.now(),
            title: notes ? notes.slice(0, 25) : category,
            amount: amount,
            type: type,
            category: category,
            date: date,
            notes: notes
        };

        state.transactions.unshift(newTransaction);
        saveState();
        updateAppView();

        transactionForm.reset();
        if (dateInput) {
            dateInput.value = new Date().toISOString().split("T")[0];
        }

        const firstCategoryBtn = document.querySelector(".category-btn");
        if (firstCategoryBtn) {
            document.querySelectorAll(".category-btn").forEach(btn => btn.classList.remove("active"));
            firstCategoryBtn.classList.add("active");
            if (categoryInput) categoryInput.value = firstCategoryBtn.dataset.category;
        }

        const dashboardSection = document.querySelector("#dashboard");
        if (dashboardSection && window.innerWidth <= 1000) {
            dashboardSection.scrollIntoView({ behavior: "smooth" });
        }
    });
}

if (currencySelect) {
    currencySelect.addEventListener("change", function () {
        state.currency = currencySelect.value;
        saveState();
        updateAppView();
    });
}

if (transactionList) {
    transactionList.addEventListener("click", function (event) {
        const deleteBtn = event.target.closest(".delete-btn");
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            deleteTransaction(id);
        }
    });
}

if (currencyWatch) {
    currencyWatch.addEventListener("click", function (event) {
        const removeBtn = event.target.closest(".chip-remove");
        if (removeBtn) {
            const curr = removeBtn.dataset.currency;
            state.watchlist = state.watchlist.filter(c => c !== curr);
            saveState();
            renderCurrencyWatch(calculateBalance(), calculateTotalExpenses());
            return;
        }

        const pinBtn = event.target.closest("#pinCurrentCurrencyBtn");
        if (pinBtn) {
            if (!state.watchlist.includes(state.currency)) {
                state.watchlist.push(state.currency);
                saveState();
                renderCurrencyWatch(calculateBalance(), calculateTotalExpenses());
            }
        }
    });
}

if (addCategoryBtn) {
    addCategoryBtn.addEventListener("click", promptAddNewCategory);
}

if (showTransactionBtn) {
    showTransactionBtn.addEventListener("click", function () {
        const transactionSection = document.querySelector("#transaction");
        const amountInput = document.querySelector("#amount");
        if (transactionSection) {
            transactionSection.scrollIntoView({ behavior: "smooth" });
        }
        if (amountInput) {
            setTimeout(() => amountInput.focus(), 300);
        }
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function updateAppView() {
    updateDashboard();
    renderTransactions();
    updateCategoryBudgets();
}

async function init() {
    loadState();

    const dateInput = document.querySelector("#date");
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    renderCurrencyOptions();
    updateAppView();

    await loadRates();
}

init();