const API_BASE = "https://printshop-q8id.onrender.com";

const state = {
    shopOnline: true,
    bwPrice: 2,
    colorPrice: 10,
    notify: true,
    paymentNotify: true,
    orders: [],
    filter: "all"
};

const $ = id => document.getElementById(id);


// =========================
// TOAST
// =========================

function showToast(message) {
    const el = $("toast");

    el.textContent = message;
    el.classList.add("show");

    setTimeout(() => {
        el.classList.remove("show");
    }, 2500);
}


// =========================
// SHOP STATUS
// =========================

function setShopStatus(online) {
    state.shopOnline = online;

    const btn = $("shopStatusBtn");

    btn.classList.toggle("online", online);
    btn.classList.toggle("offline", !online);

    $("shopStatusText").textContent =
        online ? "ONLINE" : "OFFLINE";

    $("settingsStatus").textContent =
        online ? "🟢 Online" : "🔴 Offline";

    $("settingsToggle").textContent =
        online ? "Turn Offline" : "Turn Online";

    $("quickOnline").innerHTML = online
        ? "🟢<b>Shop Online</b><small>Accept new orders</small>"
        : "🔴<b>Shop Offline</b><small>New orders are paused</small>";
}


// =========================
// SAVE SHOP STATUS
// =========================

async function saveShopStatus() {
    try {
        const response = await fetch(
            API_BASE + "/api/settings",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    shopOnline: state.shopOnline,
                    bwPrice: state.bwPrice,
                    colorPrice: state.colorPrice
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error();
        }

        showToast(
            state.shopOnline
                ? "Shop ONLINE 🟢"
                : "Shop OFFLINE 🔴"
        );

    } catch (error) {
        console.error(error);
        showToast("Shop status save nahi hua ❌");
    }
}


// =========================
// FETCH ORDERS
// =========================

async function fetchOrders(showMessage = false) {
    try {
        const response = await fetch(
            API_BASE + "/api/orders"
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error();
        }

        state.orders = data.orders.map(order => ({
            orderId: order.orderId,
            files: order.files?.length || 0,
            pages: order.totalPages || 0,
            type:
                order.printType === "color"
                    ? "Colour"
                    : "B/W",
            copies: order.copies,
            amount: order.totalAmount,
            status: convertStatus(order.status),
            payment:
                order.status === "CASH_PENDING"
                    ? "CASH"
                    : order.status === "PAID"
                        ? "PAID"
                        : "PENDING"
        }));

        renderOrders(state.filter);

        if (showMessage) {
            showToast("Orders refreshed 🔄");
        }

    } catch (error) {
        console.error(error);
        showToast("Backend se orders load nahi ho paaye");
    }
}


// =========================
// STATUS CONVERTER
// =========================

function convertStatus(status) {
    if (
        status === "CASH_PENDING" ||
        status === "PENDING_PAYMENT"
    ) {
        return "pending";
    }

    if (
        status === "ACCEPTED" ||
        status === "PRINTING"
    ) {
        return "printing";
    }

    if (status === "COMPLETED") {
        return "completed";
    }

    if (status === "REJECTED") {
        return "rejected";
    }

    return "pending";
}


// =========================
// STATS
// =========================

function renderStats() {
    const pending =
        state.orders.filter(
            o => o.status === "pending"
        ).length;

    const printing =
        state.orders.filter(
            o => o.status === "printing"
        ).length;

    const completed =
        state.orders.filter(
            o => o.status === "completed"
        ).length;

    const revenue =
        state.orders
            .filter(o => o.status === "completed")
            .reduce(
                (sum, o) =>
                    sum + Number(o.amount || 0),
                0
            );

    $("pendingCount").textContent = pending;
    $("printingCount").textContent = printing;
    $("completedCount").textContent = completed;
    $("revenue").textContent = "₹" + revenue;

    $("notificationCount").textContent = pending;
}


// =========================
// ORDER HTML
// =========================

function orderHTML(order) {
    const label =
        order.status.charAt(0).toUpperCase() +
        order.status.slice(1);

    let actions = "";

    if (order.status === "pending") {
        actions = `
            <div class="order-actions">
                <button
                    class="primary-btn"
                    onclick="acceptOrder('${order.orderId}')">
                    ✅ Accept
                </button>

                <button
                    class="secondary-btn"
                    onclick="rejectOrder('${order.orderId}')">
                    ❌ Reject
                </button>
            </div>
        `;
    }

    else if (order.status === "printing") {
        actions = `
            <div class="order-actions">
                <button
                    class="secondary-btn"
                    onclick="completeOrder('${order.orderId}')">
                    ✅ Mark Printed
                </button>
            </div>
        `;
    }

    return `
        <div class="order-row">

            <div class="order-main">

                <div class="order-id">
                    ${order.orderId}
                </div>

                <div class="order-meta">
                    📄 ${order.files} file(s)
                    • ${order.pages} pages
                    • ${order.type}
                    • ${order.copies} copies
                </div>

                <span class="badge ${order.status}">
                    ${label} • ${order.payment}
                </span>

            </div>

            <div class="order-price">
                ₹${order.amount}
            </div>

            ${actions}

        </div>
    `;
}


// =========================
// RENDER ORDERS
// =========================

function renderOrders(filter = "all") {
    state.filter = filter;

    const ordersList = $("ordersList");
    const recentOrders = $("recentOrders");

    const filtered =
        filter === "all"
            ? state.orders
            : state.orders.filter(
                order => order.status === filter
            );

    ordersList.innerHTML =
        filtered.length
            ? filtered.map(orderHTML).join("")
            : `<div class="panel">No orders found.</div>`;

    recentOrders.innerHTML =
        state.orders.length
            ? state.orders
                .slice(0, 5)
                .map(orderHTML)
                .join("")
            : `<div class="notifications-empty">
                No orders yet
              </div>`;

    renderStats();
}


// =========================
// ORDER ACTIONS
// =========================

window.acceptOrder = async function (id) {
    await updateOrderStatus(id, "PRINTING");
};

window.rejectOrder = async function (id) {
    await updateOrderStatus(id, "REJECTED");
};

window.completeOrder = async function (id) {
    await updateOrderStatus(id, "COMPLETED");
};


// =========================
// UPDATE ORDER STATUS
// =========================

async function updateOrderStatus(id, status) {
    try {
        const response = await fetch(
            API_BASE +
            "/api/orders/" +
            encodeURIComponent(id) +
            "/status",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    status
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                "Status update failed"
            );
        }

        if (status === "PRINTING") {
            showToast("Order accepted 🖨️");
        }

        if (status === "REJECTED") {
            showToast("Order rejected ❌");
        }

        if (status === "COMPLETED") {
            showToast("Order completed ✅");
        }

        await fetchOrders();

    } catch (error) {
        console.error(error);
        showToast("Order update nahi hua ❌");
    }
}


// =========================
// SECTIONS
// =========================

function openSection(id) {
    document
        .querySelectorAll(".section")
        .forEach(section => {
            section.classList.toggle(
                "active",
                section.id === id
            );
        });

    document
        .querySelectorAll(".nav-item")
        .forEach(nav => {
            nav.classList.toggle(
                "active",
                nav.dataset.section === id
            );
        });

    const titles = {
        overview: "Overview",
        orders: "Orders",
        printer: "Printer",
        settings: "Settings"
    };

    $("pageTitle").textContent =
        titles[id] || "Dashboard";
}


document
    .querySelectorAll(".nav-item")
    .forEach(button => {
        button.addEventListener("click", () => {
            openSection(button.dataset.section);
        });
    });


document
    .querySelectorAll("[data-go]")
    .forEach(button => {
        button.addEventListener("click", () => {
            openSection(button.dataset.go);
        });
    });


// =========================
// SHOP ONLINE/OFFLINE
// =========================

async function toggleShopStatus() {
    setShopStatus(!state.shopOnline);
    await saveShopStatus();
}

$("shopStatusBtn")
    .addEventListener("click", toggleShopStatus);

$("quickOnline")
    .addEventListener("click", toggleShopStatus);

$("settingsToggle")
    .addEventListener("click", toggleShopStatus);


// =========================
// FILTERS
// =========================

document
    .querySelectorAll(".filter")
    .forEach(button => {
        button.addEventListener("click", () => {

            document
                .querySelectorAll(".filter")
                .forEach(b =>
                    b.classList.remove("active")
                );

            button.classList.add("active");

            renderOrders(
                button.dataset.filter
            );
        });
    });


$("refreshOrders")
    .addEventListener(
        "click",
        () => fetchOrders(true)
    );


// =========================
// LOAD SERVER SETTINGS
// =========================

async function loadServerSettings() {
    try {
        const response = await fetch(
            API_BASE + "/api/settings"
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error();
        }

        state.shopOnline =
            data.settings.shopOnline;

        state.bwPrice =
            data.settings.bwPrice;

        state.colorPrice =
            data.settings.colorPrice;

        $("bwPrice").value =
            state.bwPrice;

        $("colorPrice").value =
            state.colorPrice;

        setShopStatus(
            state.shopOnline
        );

    } catch (error) {
        console.error(error);
        showToast(
            "Server settings load nahi hui"
        );
    }
}


// =========================
// SAVE SETTINGS
// =========================

$("saveSettings")
    .addEventListener("click", async () => {

        const bwPrice =
            Math.max(
                0,
                Number($("bwPrice").value) || 0
            );

        const colorPrice =
            Math.max(
                0,
                Number($("colorPrice").value) || 0
            );

        try {

            const response = await fetch(
                API_BASE + "/api/settings",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        shopOnline:
                            state.shopOnline,

                        bwPrice,

                        colorPrice
                    })
                }
            );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {
                throw new Error();
            }

            state.bwPrice =
                data.settings.bwPrice;

            state.colorPrice =
                data.settings.colorPrice;

            $("bwPrice").value =
                state.bwPrice;

            $("colorPrice").value =
                state.colorPrice;

            showToast(
                "Prices saved successfully ✅"
            );

        } catch (error) {
            console.error(error);

            showToast(
                "Settings save nahi hui ❌"
            );
        }
    });


// =========================
// PRINTER
// =========================

$("pairBtn").addEventListener(
    "click",
    () => {
        $("printerStatus").textContent =
            "🟡 Pairing required";

        showToast(
            "Computer pairing next 🔐"
        );
    }
);


$("newPairCode").addEventListener(
    "click",
    () => {

        $("pairCode").textContent =
            String(
                Math.floor(
                    100000 +
                    Math.random() * 900000
                )
            );

        showToast(
            "New pairing code generated"
        );
    }
);


// =========================
// NOTIFICATIONS
// =========================

$("notificationBtn").addEventListener(
    "click",
    () => {
        $("notificationPanel")
            .classList.toggle("open");

        renderNotifications();
    }
);


$("closeNotifications").addEventListener(
    "click",
    () => {
        $("notificationPanel")
            .classList.remove("open");
    }
);


function renderNotifications() {
    const pending =
        state.orders.filter(
            o => o.status === "pending"
        );

    if (!pending.length) {
        $("notifications").innerHTML =
            "No new notifications";

        return;
    }

    $("notifications").innerHTML =
        pending
            .slice(0, 10)
            .map(order => `
                <div class="notification">
                    🖨️ <b>${order.orderId}</b><br>
                    ${order.pages} pages
                    • ${order.type}
                    • ₹${order.amount}
                </div>
            `)
            .join("");
}


// =========================
// BACKEND STATUS
// =========================

async function checkBackend() {
    try {

        const response =
            await fetch(
                API_BASE + "/api/health"
            );

        if (!response.ok) {
            throw new Error();
        }

        $("connectionDot")
            .parentElement
            .classList.add("connected");

        $("connectionText").textContent =
            "Backend connected";

    } catch (error) {

        $("connectionText").textContent =
            "Backend offline";
    }
}


// =========================
// INITIAL LOAD
// =========================

loadServerSettings();
checkBackend();
fetchOrders();


// Refresh orders + settings every 5 sec
setInterval(() => {

    fetchOrders();
    loadServerSettings();

}, 5000);
