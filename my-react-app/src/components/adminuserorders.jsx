import { useEffect, useMemo, useState } from "react";
import getImageUrl from "./imageUrl.js";
import "./adminuserorders.css";

const API_URL = "/api/userdata/admin/orders";
const STATUS_OPTIONS = ["Placed", "Processing", "Shipped", "Out for delivery", "Delivered"];

const formatMoney = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

const formatDateTime = (value) => {
    const date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
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

const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : { message: await response.text() };

    if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
};

function AdminUserOrders() {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [updatingKey, setUpdatingKey] = useState("");
    const [selectedStatuses, setSelectedStatuses] = useState({});

    const loadOrders = async () => {
        setIsLoading(true);
        setErrorMessage("");

        try {
            const response = await fetch(API_URL);
            const data = await parseResponse(response);
            const nextOrders = Array.isArray(data.orders) ? data.orders : [];
            setOrders(nextOrders);
            setSelectedStatuses((previous) => {
                const next = { ...previous };
                nextOrders.forEach((order) => {
                    const orderKey = String(order.orderKey || order.paymentDetails?.paymentId || order.paymentDetails?.orderId || order.orderedAt || "");
                    next[orderKey] = next[orderKey] || order.status || "Placed";
                });
                return next;
            });
        } catch (error) {
            console.error("Load admin orders error:", error);
            setErrorMessage(error.message || "Unable to load user orders");
            setOrders([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const groupedOrders = useMemo(() => {
        return [...orders].sort((left, right) => {
            const leftTime = new Date(left.orderedAt || left.paymentDetails?.paidAt || 0).getTime();
            const rightTime = new Date(right.orderedAt || right.paymentDetails?.paidAt || 0).getTime();
            return rightTime - leftTime;
        });
    }, [orders]);

    const handleStatusChange = (orderKey, value) => {
        setSelectedStatuses((previous) => ({
            ...previous,
            [orderKey]: value,
        }));
    };

    const handleUpdateStatus = async (order) => {
        const orderKey = String(order.orderKey || order.paymentDetails?.paymentId || order.paymentDetails?.orderId || order.orderedAt || "");
        const status = selectedStatuses[orderKey] || order.status || "Placed";

        setUpdatingKey(orderKey);
        setErrorMessage("");

        try {
            const response = await fetch("/api/userdata/admin/orders/status", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: order.userEmail,
                    orderKey,
                    status,
                }),
            });

            await parseResponse(response);
            await loadOrders();
        } catch (error) {
            console.error("Update order status error:", error);
            setErrorMessage(error.message || "Unable to update order status");
        } finally {
            setUpdatingKey("");
        }
    };

    return (
        <section className="adminuserspage">
            <div className="adminuserswrap">
                <header className="adminusersheader">
                    <div>
                        <p className="adminuserseyebrow"></p>
                        <h1>User Orders</h1> 
                    </div>
                    <button type="button" className="refreshbtn" onClick={loadOrders}>
                        Refresh
                    </button>
                </header>

                {errorMessage ? <p className="adminuserserror">{errorMessage}</p> : null}

                {isLoading ? (
                    <div className="adminuserscard emptystate">Loading user orders...</div>
                ) : groupedOrders.length === 0 ? (
                    <div className="adminuserscard emptystate">No orders available.</div>
                ) : (
                    <div className="adminuserscard tablecard">
                        <div className="tablewrap">
                            <table className="ordersdatatable">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Ordered At</th>
                                        <th>Shipping</th>
                                        <th>Products</th>
                                        <th>Payment</th>
                                        <th>Total</th>
                                        <th>Current Status</th>
                                        <th>Update Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedOrders.map((order) => {
                                        const orderKey = String(order.orderKey || order.paymentDetails?.paymentId || order.paymentDetails?.orderId || order.orderedAt || "");
                                        const status = selectedStatuses[orderKey] || order.status || "Placed";
                                        const items = Array.isArray(order.items) ? order.items : [];
                                        const addressLines = formatAddressLines(order.shippingAddress || {});

                                        return (
                                            <tr key={`${order.userEmail}-${orderKey}`}>
                                                <td>
                                                    <div className="cellstack">
                                                        <span className="orderemail">{order.userEmail}</span>
                                                        <span className="cellmeta">Order: {orderKey || "N/A"}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="cellmeta">{formatDateTime(order.orderedAt || order.paymentDetails?.paidAt)}</span>
                                                </td>
                                                <td>
                                                    <div className="cellstack">
                                                        {addressLines.length > 0 ? (
                                                            addressLines.map((line) => (
                                                                <span key={`${orderKey}-${line}`} className="cellmeta">{line}</span>
                                                            ))
                                                        ) : (
                                                            <span className="cellmeta">No shipping address</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="productslist">
                                                        {items.length > 0 ? (
                                                            items.map((item) => (
                                                                <div className="productrow" key={`${orderKey}-${item.productId || item._id || item.name}`}>
                                                                    <img
                                                                        src={getImageUrl(item.image)}
                                                                        alt={item.name}
                                                                        onError={(event) => {
                                                                            event.currentTarget.src = "https://via.placeholder.com/48x48?text=No+Image";
                                                                        }}
                                                                    />
                                                                    <div className="cellstack">
                                                                        <strong>{item.name}</strong>
                                                                        <span className="cellmeta">
                                                                            {item.quantity} x {formatMoney(item.price)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="cellmeta">No products</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="cellstack">
                                                        <span className="cellmeta">{order.paymentDetails?.method || "N/A"}</span>
                                                        <span className="cellmeta">Pay ID: {order.paymentDetails?.paymentId || "N/A"}</span>
                                                        <span className="cellmeta">Order ID: {order.paymentDetails?.orderId || "N/A"}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong>{formatMoney(order.totalAmount)}</strong>
                                                </td>
                                                <td>
                                                    <span className="statuspill">{order.status || "Placed"}</span>
                                                </td>
                                                <td>
                                                    <div className="statusactions">
                                                        <select value={status} onChange={(event) => handleStatusChange(orderKey, event.target.value)}>
                                                            {STATUS_OPTIONS.map((option) => (
                                                                <option key={option} value={option}>{option}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            type="button"
                                                            className="savestatusbtn"
                                                            onClick={() => handleUpdateStatus(order)}
                                                            disabled={updatingKey === orderKey}
                                                        >
                                                            {updatingKey === orderKey ? "Saving..." : "Save"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

export default AdminUserOrders;
