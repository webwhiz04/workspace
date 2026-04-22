import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getLoggedInEmail, isUserLoggedIn } from "./authStorage.js";
import { getOrders } from "./cartStorage.js";
import getImageUrl from "./imageUrl.js";
import "./placedorderpage.css";

const PLACED_ORDER_SESSION_KEY = "recent-placed-order";

const statusSteps = ["Placed", "Shipped", "Out for delivery", "Delivered"];

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

const getStoredOrder = () => {
    const persisted = sessionStorage.getItem(PLACED_ORDER_SESSION_KEY);

    if (!persisted) {
        return null;
    }

    try {
        return JSON.parse(persisted);
    } catch (error) {
        console.error("Parse placed order session error:", error);
        sessionStorage.removeItem(PLACED_ORDER_SESSION_KEY);
        return null;
    }
};

const formatAddressLines = (shippingAddress = {}) => {
    return [
        shippingAddress.name,
        shippingAddress.phone,
        shippingAddress.address,
        [shippingAddress.city, shippingAddress.postalCode].filter(Boolean).join(" "),
        shippingAddress.country,
    ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
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

function PlacedOrderPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const loggedIn = isUserLoggedIn();
    const email = getLoggedInEmail();

    const [order, setOrder] = useState(() => normalizeOrder(location.state?.order || getStoredOrder()));
    const [isLoading, setIsLoading] = useState(!location.state?.order && !getStoredOrder());
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!loggedIn) {
            navigate("/login", { replace: true, state: { from: location } });
        }
    }, [loggedIn, location, navigate]);

    useEffect(() => {
        const initialOrder = normalizeOrder(location.state?.order || getStoredOrder());
        let isActive = true;

        const preferredOrderKey = getOrderKey(initialOrder);

        if (initialOrder) {
            setOrder(initialOrder);
            sessionStorage.setItem(PLACED_ORDER_SESSION_KEY, JSON.stringify(initialOrder));
            setIsLoading(false);
        }

        const loadOrder = async () => {
            if (!isActive) {
                return;
            }

            if (!email) {
                setIsLoading(false);
                return;
            }

            try {
                const userOrders = await getOrders(email);
                const normalizedOrders = (Array.isArray(userOrders) ? userOrders : [])
                    .map((item) => normalizeOrder(item))
                    .filter(Boolean)
                    .sort((left, right) => getOrderSortTime(right) - getOrderSortTime(left));

                if (normalizedOrders.length > 0) {
                    const matchedOrder = preferredOrderKey
                        ? normalizedOrders.find((item) => getOrderKey(item) === preferredOrderKey)
                        : null;
                    const selectedOrder = matchedOrder || normalizedOrders[0];

                    setOrder(selectedOrder);
                    sessionStorage.setItem(PLACED_ORDER_SESSION_KEY, JSON.stringify(selectedOrder));
                } else if (!initialOrder) {
                    setErrorMessage("No placed order was found for this account.");
                    setOrder(null);
                }
            } catch (error) {
                console.error("Fetch placed order error:", error);
                if (!initialOrder) {
                    setErrorMessage(error.message || "Unable to load your placed order");
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadOrder();

        const refreshTimer = window.setInterval(() => {
            loadOrder();
        }, 15000);

        return () => {
            isActive = false;
            window.clearInterval(refreshTimer);
        };
    }, [email, location.state, navigate]);

    const currentStatus = order?.status || "Placed";
    const currentStatusIndex = Math.max(0, statusSteps.indexOf(currentStatus));
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    const shippingLines = formatAddressLines(order?.shippingAddress || {});

    if (isLoading && !order) {
        return (
            <section className="placedorderpage">
                <div className="placedorderwrap">
                    <div className="placedordercard loadingcard">
                        <h1>Loading your order</h1>
                        <p>We are fetching the latest order details.</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="placedorderpage">
            <div className="placedorderwrap">
                <header className="placedorderhero">
                    <div>
                        <p className="placedordersubtitle">Order placed successfully</p>
                        <h1>Your order is on the way</h1>
                    </div>
                    <div className="placedorderbadge">
                        <span>Current status</span>
                        <strong>{currentStatus}</strong>
                    </div>
                </header>

                {errorMessage ? <p className="placedordererror">{errorMessage}</p> : null}

                {order ? (
                    <>
                        <section className="placedordercard placedordergrid">
                            <div className="placedordersection">
                                <h2>Order Summary</h2>
                                <div className="placedordermeta">
                                    <span>Ordered at</span>
                                    <strong>{formatDateTime(order.orderedAt || order.paymentDetails?.paidAt)}</strong>
                                </div>
                                <div className="placedordermeta">
                                    <span>Order ID</span>
                                    <strong>{order.paymentDetails?.orderId || "N/A"}</strong>
                                </div>
                                <div className="placedordermeta">
                                    <span>Payment ID</span>
                                    <strong>{order.paymentDetails?.paymentId || "N/A"}</strong>
                                </div>
                                <div className="placedordermeta">
                                    <span>Payment Method</span>
                                    <strong>{order.paymentDetails?.method || "Cash on Delivery"}</strong>
                                </div>
                                <div className="placedordermeta">
                                    <span>Payment Status</span>
                                    <strong>{order.paymentDetails?.status || order.status || "Placed"}</strong>
                                </div>
                                <div className="placedordermeta">
                                    <span>Total paid</span>
                                    <strong>{formatMoney(order.totalAmount)}</strong>
                                </div>
                            </div>

                            <div className="placedordersection">
                                <h2>Shipping Address</h2>
                                <div className="placedorderaddress">
                                    {shippingLines.length > 0 ? (
                                        shippingLines.map((line) => <p key={line}>{line}</p>)
                                    ) : (
                                        <p>No shipping address available.</p>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="placedordercard">
                            <h2>Delivery Progress</h2>
                            <div className="orderline" aria-label="Order status progress">
                                {statusSteps.map((step, index) => {
                                    const isComplete = index <= currentStatusIndex;
                                    const isActive = index === currentStatusIndex;
                                    return (
                                        <div className="orderlineitem" key={step}>
                                            <div className={`orderdot ${isComplete ? "complete" : ""} ${isActive ? "active" : ""}`} />
                                            <strong className={isComplete ? "completetext" : ""}>{step}</strong>
                                            {index < statusSteps.length - 1 ? (
                                                <span className={`orderconnector ${index < currentStatusIndex ? "complete" : ""}`} />
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="orderlinecopy">
                                {currentStatus === "Placed" && "Order placed successfully. We will update you when it ships."}
                                {currentStatus === "Shipped" && "Your package is shipped and moving to your nearest hub."}
                                {currentStatus === "Out for delivery" && "Your package is out for delivery and should arrive soon."}
                                {currentStatus === "Delivered" && "Order delivered. Thank you for shopping with us."}
                            </p>
                        </section>

                        <section className="placedordercard">
                            <div className="placedordersectionheader">
                                <h2>Ordered Items</h2>
                                <span>{orderItems.length} item{orderItems.length === 1 ? "" : "s"}</span>
                            </div>
                            <div className="placedorderitems">
                                {orderItems.map((item) => (
                                    <article className="placedorderitem" key={`${item.productId || item._id || item.name}-${item.name}`}>
                                        <img
                                            src={getImageUrl(item.image)}
                                            alt={item.name}
                                            onError={(event) => {
                                                event.currentTarget.src = "https://via.placeholder.com/80x80?text=No+Image";
                                            }}
                                        />
                                        <div className="placedorderitemdetails">
                                            <div>
                                                <h3>{item.name}</h3>
                                                <p>{item.quantity} x {formatMoney(item.price)}</p>
                                            </div>
                                            <strong>{formatMoney(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
                                        </div>
                                    </article>
                                ))}
                            </div>
                            <div className="placedorderbreakdown">
                                <span>Item Total</span>
                                <strong>{formatMoney(order.itemTotal)}</strong>
                            </div>
                            <div className="placedorderbreakdown">
                                <span>Handling Fee</span>
                                <strong>{formatMoney(order.handlingFee)}</strong>
                            </div>
                            <div className="placedorderbreakdown">
                                <span>Delivery Fee</span>
                                <strong>{formatMoney(order.deliveryFee)}</strong>
                            </div>
                            <div className="placedordertotal">
                                <span>Total</span>
                                <strong>{formatMoney(order.totalAmount)}</strong>
                            </div>
                        </section>
                    </>
                ) : (
                    <section className="placedordercard loadingcard">
                        <h2>No order found</h2>
                        <p>Please place an order first.</p>
                    </section>
                )}

                <div className="placedorderactions">
                    <button type="button" className="placedordersecondary" onClick={() => navigate("/my-orders")}>My Orders</button>
                    <button type="button" className="placedorderprimary" onClick={() => navigate("/all")}>Continue Shopping</button>
                    <button type="button" className="placedordersecondary" onClick={() => navigate("/cart")}>View Cart</button>
                </div>
            </div>
        </section>
    );
}

export default PlacedOrderPage;
