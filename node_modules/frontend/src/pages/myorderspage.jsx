import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getLoggedInEmail, isUserLoggedIn } from "../utils/authStorage.js";
import { getOrders } from "../utils/cartStorage.js";
import "./placedorderpage.css";

const PLACED_ORDER_SESSION_KEY = "recent-placed-order";

const formatMoney = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

const formatDateTime = (value) => {
    const date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) {
        return "Just now";
    }

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
};

const normalizeStatus = (status) => {
    const value = String(status || "Placed").trim().toLowerCase();

    if (value.includes("deliver")) {
        return value.includes("out") ? "Out for delivery" : "Delivered";
    }

    if (value.includes("process")) {
        return "Placed";
    }

    if (value.includes("ship")) {
        return "Shipped";
    }

    if (value.includes("out")) {
        return "Out for delivery";
    }

    if (value.includes("place")) {
        return "Placed";
    }

    return "Placed";
};

const getOrderKey = (order) => {
    return String(
        order?.paymentDetails?.paymentId
        || order?.paymentDetails?.orderId
        || order?.orderedAt
        || ""
    ).trim();
};

const getOrderSortTime = (order) => {
    const sources = [order?.orderedAt, order?.paymentDetails?.paidAt];

    for (const value of sources) {
        const timestamp = value ? new Date(value).getTime() : NaN;
        if (!Number.isNaN(timestamp)) {
            return timestamp;
        }
    }

    return 0;
};

const normalizeOrder = (order) => {
    if (!order) {
        return null;
    }

    const normalizedItems = Array.isArray(order.items)
        ? order.items.map((item) => ({
            ...item,
            quantity: Number(item.quantity ?? item.cartQuantity ?? 0),
            price: Number(item.price || 0),
        }))
        : [];

    return {
        ...order,
        items: normalizedItems,
        status: normalizeStatus(order.status),
    };
};

const getOrderProductNames = (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const names = items
        .map((item) => String(item?.name || item?.productName || item?.title || "").trim())
        .filter(Boolean);

    if (names.length === 0) {
        return "N/A";
    }

    return names.join(", ");
};

function MyOrdersPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const loggedIn = isUserLoggedIn();
    const email = getLoggedInEmail();

    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!loggedIn) {
            navigate("/login", { replace: true, state: { from: location } });
        }
    }, [loggedIn, location, navigate]);

    useEffect(() => {
        let isActive = true;

        const loadOrders = async () => {
            if (!email) {
                if (isActive) {
                    setOrders([]);
                    setIsLoading(false);
                }
                return;
            }

            setIsLoading(true);
            setErrorMessage("");

            try {
                const userOrders = await getOrders(email);
                const normalizedOrders = (Array.isArray(userOrders) ? userOrders : [])
                    .map((item) => normalizeOrder(item))
                    .filter(Boolean)
                    .sort((left, right) => getOrderSortTime(right) - getOrderSortTime(left));

                if (!isActive) {
                    return;
                }

                setOrders(normalizedOrders);
            } catch (error) {
                console.error("Fetch my orders error:", error);
                if (!isActive) {
                    return;
                }
                setErrorMessage(error.message || "Unable to load your orders");
                setOrders([]);
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        loadOrders();

        return () => {
            isActive = false;
        };
    }, [email]);

    const openOrderSuccess = (order) => {
        sessionStorage.setItem(PLACED_ORDER_SESSION_KEY, JSON.stringify(order));
        navigate("/order-success", { state: { order } });
    };

    return (
        <section className="placedorderpage">
            <div className="placedorderwrap">
                <header className="placedorderhero">
                    <div>
                        <p className="placedordersubtitle">My Orders</p>
                        <h1>Track all your purchases</h1>
                    </div>
                </header>

                {errorMessage ? <p className="placedordererror">{errorMessage}</p> : null}

                {isLoading ? (
                    <section className="placedordercard loadingcard">
                        <h2>Loading your orders</h2>
                        <p>Please wait while we fetch your latest orders.</p>
                    </section>
                ) : orders.length === 0 ? (
                    <section className="placedordercard loadingcard">
                        <h2>No orders found</h2>
                        <p>Your placed orders will appear here.</p>
                    </section>
                ) : (
                    <section className="placedordercard">
                        <div className="placedordersectionheader">
                            <h2>Order List</h2>
                            <span>{orders.length} order{orders.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="myorderslist" role="list">
                            {orders.map((item) => {
                                const orderKey = getOrderKey(item);
                                return (
                                    <button
                                        type="button"
                                        key={orderKey || `${item.orderedAt}-${item.totalAmount}`}
                                        className="myorderitem"
                                        onClick={() => openOrderSuccess(item)}
                                    >
                                        <div>
                                            <strong>Order {orderKey || "N/A"}</strong>
                                             <p className="myorderproducts">
                                                <span className="myorderproductslabel"></span>
                                                <strong className="myorderproductsnames">{getOrderProductNames(item)}</strong>
                                            </p>
                                            <p>{formatDateTime(item.orderedAt || item.paymentDetails?.paidAt)}</p>
                                            <p>{(Array.isArray(item.items) ? item.items.length : 0)} item(s)</p>
                                           
                                        </div>
                                        <div className="myordermeta">
                                            <span>{item.status || "Placed"}</span>
                                            <strong>{formatMoney(item.totalAmount)}</strong>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                <div className="placedorderactions">
                    <button type="button" className="placedorderprimary" onClick={() => navigate("/all")}>Continue Shopping</button>
                </div>
            </div>
        </section>
    );
}

export default MyOrdersPage;
