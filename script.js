const API = "https://open.er-api.com/v6/latest/ETB";
const STORAGE_KEY = "birr-budget-data-v3";

// The user creates their own income and budget categories during first setup.
// No default income, transactions, or category budgets are pre-filled.
const defaultTransactions = [];
const defaultCategoryBudgets = {};

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
    totalIncome: 0,
    setupComplete: false,
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
            totalIncome: state.totalIncome,
            setupComplete: state.setupComplete,
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
            state.transactions = Array.isArray(data.transactions) ? data.transactions : [];
            state.categoryBudgets = data.categoryBudgets && typeof data.categoryBudgets === "object"
                ? data.categoryBudgets
                : {};
            state.totalIncome = Number(data.totalIncome || 0);
            state.setupComplete = Boolean(data.setupComplete);
            state.currency = data.currency || "ETB";
            state.watchlist = Array.isArray(data.watchlist) ? data.watchlist : ["USD", "EUR"];
            return;
        }
    } catch (err) {
        console.warn("Could not parse saved data, initializing defaults:", err);
    }

    state.transactions = [];
    state.categoryBudgets = {};
    state.totalIncome = 0;
    state.setupComplete = false;
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
    return Number(state.totalIncome || 0);
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

// How much income is still free to allocate to budgets.
// Pass a category name to ignore its current budget (used when editing it).
function getAvailableBudgetRoom(excludeCategory = null) {
    const allocated = Object.entries(state.categoryBudgets)
        .filter(([name]) => name.toLowerCase() !== String(excludeCategory || "").toLowerCase())
        .reduce((sum, [, budget]) => sum + Number(budget || 0), 0);
    return Math.max(0, calculateIncome() - allocated);
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

const rawPercentage =
    income > 0
        ? (expenses / income) * 100
        : 0;

// Never show more than 100%
const expensePercentage = Math.min(rawPercentage, 100);

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
        const deg = (expensePercentage / 100) * 360;
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

    const expenseList = state.transactions.filter(t => t.type === "expense");

    if (expenseList.length === 0) {
        transactionList.innerHTML = `<p class="empty-message">No transactions yet.</p>`;
        return;
    }

    const itemsHtml = expenseList.map(t => {
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
    const transaction = state.transactions.find(t => String(t.id) === String(id));

    if (transaction && transaction.type === "income") {
        const newIncome = state.totalIncome - Number(transaction.amount || 0);

        // Removing income must not push spending or budgets above total income.
        if (newIncome < calculateTotalExpenses() || newIncome < calculateTotalBudget()) {
            alert("Removing this income would put your spending or budgets above your total income. Lower those first.");
            return;
        }

        state.totalIncome = Math.max(0, newIncome);
    }

    state.transactions = state.transactions.filter(t => String(t.id) !== String(id));
    saveState();
    updateAppView();
}

function updateCategoryBudgets() {
    if (!categoryList) return;

    const categories = Object.keys(state.categoryBudgets);

    if (categories.length === 0) {
        categoryList.innerHTML = `
            <p class="empty-message">
                No budget categories yet. Add your own category and budget.
            </p>
        `;
        return;
    }

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

                <div class="budget-actions">
                    <button type="button" class="edit-budget-btn" data-category="${escapeHtml(category)}">
                        Edit
                    </button>
                    <button type="button" class="delete-budget-btn" data-category="${escapeHtml(category)}">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join("");

    categoryList.innerHTML = categoriesHtml;
}

function editBudgetCategory(category) {
    if (!(category in state.categoryBudgets)) return;

    const currentBudget = Number(state.categoryBudgets[category] || 0);
    const room = getAvailableBudgetRoom(category);

    const newBudget = Number(
        prompt(
            `Enter the new budget for "${category}" (max ${room.toLocaleString()} ETB):`,
            currentBudget
        )
    );

    if (!Number.isFinite(newBudget) || newBudget <= 0) {
        alert("Please enter a valid budget greater than 0.");
        return;
    }

    if (newBudget > room) {
        alert(
            `Total budgets can't exceed your income. You can allocate at most ${room.toLocaleString()} ETB to "${category}".`
        );
        return;
    }

    state.categoryBudgets[category] = newBudget;
    saveState();
    updateAppView();
}

function deleteBudgetCategory(category) {
    if (!(category in state.categoryBudgets)) return;

    const hasTransactions = state.transactions.some(
        t => t.type === "expense" &&
            String(t.category).toLowerCase() === String(category).toLowerCase()
    );

    if (hasTransactions) {
        alert(
            `"${category}" has expense transactions. Delete or move those transactions first.`
        );
        return;
    }

    if (!confirm(`Delete the "${category}" budget category?`)) return;

    delete state.categoryBudgets[category];
    delete categoryIcons[category];

    saveState();
    updateAppView();
}

function promptAddNewCategory() {
    const existingModal = document.querySelector(".modal-overlay");
    if (existingModal) existingModal.remove();

    const room = getAvailableBudgetRoom();

    if (room <= 0) {
        alert("All of your income is already allocated to budgets. Lower another category's budget first.");
        return;
    }

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add Budget Category</h3>
                <button type="button" class="modal-close">×</button>
            </div>
            <form id="newCategoryForm" novalidate>
                <div class="form-group">
                    <label for="newCatName">Category Name</label>
                    <input type="text" id="newCatName" placeholder="e.g. Education, Travel" required>
                </div>
                <div class="form-group">
                    <label for="newCatBudget">Monthly Budget (ETB) — up to ${room.toLocaleString()}</label>
                    <input type="number" id="newCatBudget" placeholder="e.g. 500" min="0" step="any">
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

        if (!catName || !Number.isFinite(catBudget) || catBudget <= 0) return;

        // Prevent duplicate category names (case-insensitive)
        const duplicate = Object.keys(state.categoryBudgets)
            .some(name => name.toLowerCase() === catName.toLowerCase());
        if (duplicate) {
            alert(`The category "${catName}" already exists.`);
            return;
        }

        // Budgets can't exceed total income
        const availableRoom = getAvailableBudgetRoom();
        if (catBudget > availableRoom) {
            alert(
                `Not enough income left. You can budget at most ${availableRoom.toLocaleString()} ETB for this category.`
            );
            return;
        }

        state.categoryBudgets[catName] = catBudget;
        categoryIcons[catName] = catIcon;

        saveState();
        renderCategoryButtons();
        updateCategoryBudgets();
        updateDashboard();
        closeModal();
    });
}

function renderCategoryButtons() {
    const categoriesSelect = document.querySelector(".categories-select");
    if (!categoriesSelect) return;

    // Remove old category buttons so the user's categories are the source of truth.
    categoriesSelect.querySelectorAll(".category-btn").forEach(btn => btn.remove());

    const addButton = categoriesSelect.querySelector(".add-category");

    Object.keys(state.categoryBudgets).forEach(category => {
        const icon = categoryIcons[category] || "📁";
        const button = document.createElement("button");

        button.type = "button";
        button.className = "category-btn";
        button.dataset.category = category;
        button.innerHTML = `${icon} <span>${escapeHtml(category)}</span>`;

        attachCategoryBtnEvent(button);

        if (addButton) {
            categoriesSelect.insertBefore(button, addButton);
        } else {
            categoriesSelect.appendChild(button);
        }
    });

    const firstCategoryBtn = categoriesSelect.querySelector(".category-btn");

    if (firstCategoryBtn && categoryInput) {
        document.querySelectorAll(".category-btn").forEach(btn => btn.classList.remove("active"));
        firstCategoryBtn.classList.add("active");
        categoryInput.value = firstCategoryBtn.dataset.category;
    }
}

function showInitialSetupModal() {
    if (state.setupComplete) return;

    const existingModal = document.querySelector(".modal-overlay.setup-modal");
    if (existingModal) return;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay setup-modal";
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Set Up Your Budget</h3>
            </div>

            <p style="margin-bottom: 16px; color: #666;">
                Start by entering your total income and deciding how much you want
                to budget for each category. Your category budgets can't add up to
                more than your income.
            </p>

            <form id="budgetSetupForm">
                <div class="form-group">
                    <label for="setupIncome">Total Income (ETB)</label>
                    <input
                        type="number"
                        id="setupIncome"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 20000"
                        required
                    >
                </div>

                <div class="form-group">
                    <label>Your Budget Categories</label>
                    <div id="setupCategories"></div>
                    <p id="setupRemaining" style="font-size: 12px; color: #777; margin: 6px 0;"></p>
                    <button type="button" class="modal-btn-cancel" id="addSetupCategory">
                        + Add Category
                    </button>
                </div>

                <div class="modal-actions">
                    <button type="submit" class="modal-btn-submit">
                        Start Budget
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    const categoriesContainer = overlay.querySelector("#setupCategories");
    const incomeInput = overlay.querySelector("#setupIncome");
    const remainingText = overlay.querySelector("#setupRemaining");

    // Live "remaining to allocate" hint
    function updateRemainingHint() {
        const income = Number(incomeInput.value) || 0;
        const total = [...categoriesContainer.querySelectorAll(".setup-category-budget")]
            .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
        const remaining = income - total;

        remainingText.textContent = `Remaining to allocate: ${remaining.toLocaleString()} ETB`;
        remainingText.style.color = remaining < 0 ? "#e63946" : "#777";
    }

    function addSetupRow() {
        const row = document.createElement("div");
        row.className = "setup-category-row";
        row.style.cssText = "display:grid;grid-template-columns:1fr 140px auto;gap:8px;margin-bottom:8px;";

        row.innerHTML = `
            <input type="text" class="setup-category-name" placeholder="Category name" required>
            <input type="number" class="setup-category-budget" placeholder="Budget" min="0" step="0.01" required>
            <button type="button" class="modal-btn-cancel remove-setup-category">×</button>
        `;

        row.querySelector(".remove-setup-category").addEventListener("click", () => {
            if (categoriesContainer.children.length > 1) {
                row.remove();
                updateRemainingHint();
            }
        });

        row.querySelector(".setup-category-budget").addEventListener("input", updateRemainingHint);

        categoriesContainer.appendChild(row);
    }

    addSetupRow();
    updateRemainingHint();

    incomeInput.addEventListener("input", updateRemainingHint);
    overlay.querySelector("#addSetupCategory").addEventListener("click", addSetupRow);

    overlay.querySelector("#budgetSetupForm").addEventListener("submit", event => {
        event.preventDefault();

        const income = Number(incomeInput.value);
        const rows = [...categoriesContainer.querySelectorAll(".setup-category-row")];

        if (!Number.isFinite(income) || income <= 0) {
            alert("Please enter your total income greater than 0.");
            return;
        }

        const budgets = {};
        const usedNames = new Set();
        let totalBudgeted = 0;

        for (const row of rows) {
            const name = row.querySelector(".setup-category-name").value.trim();
            const budget = Number(row.querySelector(".setup-category-budget").value);

            if (!name || !Number.isFinite(budget) || budget < 0) {
                alert("Please enter a valid category name and budget for every row.");
                return;
            }

            const normalizedName = name.toLowerCase();

            if (usedNames.has(normalizedName)) {
                alert(`The category "${name}" was entered more than once.`);
                return;
            }

            usedNames.add(normalizedName);
            budgets[name] = budget;
            totalBudgeted += budget;
        }

        // Budgets can't exceed total income
        if (totalBudgeted > income) {
            alert(
                `Your category budgets total ${totalBudgeted.toLocaleString()} ETB, which is more than your income (${income.toLocaleString()} ETB). Please lower them.`
            );
            return;
        }

        Object.keys(budgets).forEach(name => {
            if (!categoryIcons[name]) {
                categoryIcons[name] = "📁";
            }
        });

        state.totalIncome = income;
        state.categoryBudgets = budgets;
        state.setupComplete = true;

        saveState();
        updateAppView();
        overlay.remove();
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

        // Spending can't go beyond the remaining balance (total income).
        if (type === "expense" && amount > calculateBalance()) {
            alert(
                `This expense is more than your remaining balance (${calculateBalance().toLocaleString()} ETB).`
            );
            return;
        }

        const newTransaction = {
            id: Date.now(),
            title: notes ? notes.slice(0, 25) : category,
            amount: amount,
            type: type,
            category: category,
            date: date,
            notes: notes
        };

        if (type === "income") {
            // Income raises total income (and so the remaining balance),
            // but is not listed as a transaction.
            state.totalIncome += amount;
        } else {
            state.transactions.unshift(newTransaction);
        }

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

if (categoryList) {
    categoryList.addEventListener("click", function (event) {
        const editBtn = event.target.closest(".edit-budget-btn");
        const deleteBtn = event.target.closest(".delete-budget-btn");

        if (editBtn) {
            editBudgetCategory(editBtn.dataset.category);
            return;
        }

        if (deleteBtn) {
            deleteBudgetCategory(deleteBtn.dataset.category);
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
    renderCategoryButtons();
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

    if (!state.setupComplete) {
        showInitialSetupModal();
    }

    await loadRates();
}

init();