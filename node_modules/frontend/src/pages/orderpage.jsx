import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./orderpage.css";
import { getLoggedInEmail, isUserLoggedIn } from "../utils/authStorage.js";
import { getCartItems, getShippingAddresses, placeOrder, saveShippingAddress } from "../utils/cartStorage.js";
import getImageUrl from "../utils/imageUrl.js";

const HANDLING_FEE = 30;
const DELIVERY_FEE = 10;
const PAYMENT_SESSION_KEY = "pending-payment-details";
const PLACED_ORDER_SESSION_KEY = "recent-placed-order";

const emptyAddress = {
    name: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
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

const getAddressId = (shippingAddress = {}) => {
    return [
        shippingAddress.name,
        shippingAddress.phone,
        shippingAddress.address,
        shippingAddress.city,
        shippingAddress.postalCode,
        shippingAddress.country,
    ]
        .map((value) => String(value || "").trim().toLowerCase())
        .join("|");
};

function OrderPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const loggedIn = isUserLoggedIn();
    const email = getLoggedInEmail();

    const [items, setItems] = useState([]);
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState("");
    const [showAddAddressForm, setShowAddAddressForm] = useState(false);
    const [newAddress, setNewAddress] = useState(emptyAddress);
    const [paymentMethod, setPaymentMethod] = useState("online");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingAddress, setIsSavingAddress] = useState(false);

    useEffect(() => {
        if (!loggedIn) {
            navigate("/login", { replace: true, state: { from: location } });
        }
    }, [loggedIn, navigate, location]);

    useEffect(() => {
        const loadOrderData = async () => {
            if (!loggedIn || !email) {
                setItems([]);
                setSavedAddresses([]);
                return;
            }

            setIsLoading(true);
            try {
                const [cartItems, addresses] = await Promise.all([
                    getCartItems(email),
                    getShippingAddresses(email),
                ]);

                const normalizedAddresses = Array.isArray(addresses) ? addresses : [];
                setItems(Array.isArray(cartItems) ? cartItems : []);
                setSavedAddresses(normalizedAddresses);

                if (normalizedAddresses.length > 0) {
                    setSelectedAddressId(getAddressId(normalizedAddresses[0]));
                } else {
                    setSelectedAddressId("");
                }
            } catch (error) {
                console.error("Load order data error:", error);
                setItems([]);
                setSavedAddresses([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadOrderData();
    }, [loggedIn, email]);

    const handleAddressInput = (event) => {
        const { name, value } = event.target;
        setNewAddress((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const openAddressForm = () => {
        setShowAddAddressForm(true);
    };

    const closeAddressForm = () => {
        setShowAddAddressForm(false);
        setNewAddress(emptyAddress);
    };

    const handleSaveAddress = async () => {
        if (!email) {
            alert("Please login first");
            return;
        }

        if (!hasCompleteNewAddress) {
            alert("Please fill all address fields");
            return;
        }

        setIsSavingAddress(true);
        try {
            const result = await saveShippingAddress(email, newAddress);
            const refreshedAddresses = Array.isArray(result.shippingAddresses) ? result.shippingAddresses : [];
            setSavedAddresses(refreshedAddresses);

            const savedAddress = result.shippingAddress || newAddress;
            const savedAddressId = getAddressId(savedAddress);
            setSelectedAddressId(savedAddressId);
            setShowAddAddressForm(false);
            setNewAddress(emptyAddress);
        } catch (error) {
            console.error("Save address error:", error);
            alert(error.message || "Unable to save address");
        } finally {
            setIsSavingAddress(false);
        }
    };

    const selectedSavedAddress = useMemo(() => {
        return savedAddresses.find((address) => getAddressId(address) === selectedAddressId) || null;
    }, [savedAddresses, selectedAddressId]);

    const itemTotal = useMemo(() => {
        return items.reduce((total, item) => total + Number(item.price || 0) * Number(item.cartQuantity || 0), 0);
    }, [items]);

    const handlingFee = items.length > 0 ? HANDLING_FEE : 0;
    const deliveryFee = items.length > 0 ? DELIVERY_FEE : 0;
    const totalToPay = itemTotal + handlingFee + deliveryFee;

    const hasCompleteNewAddress = Boolean(
        newAddress.name.trim() &&
        newAddress.phone.trim() &&
        newAddress.address.trim() &&
        newAddress.city.trim() &&
        newAddress.postalCode.trim() &&
        newAddress.country.trim()
    );

    const handleFinalOrder = async () => {
        if (!email) {
            alert("Please login first");
            return;
        }

        if (items.length === 0) {
            alert("Your cart is empty");
            return;
        }

        const chosenAddress = selectedSavedAddress;

        if (!chosenAddress || formatAddressLines(chosenAddress).length === 0) {
            alert("Please select or add a shipping address");
            return;
        }

        const paymentDetails = {
            email,
            shippingAddress: chosenAddress,
            items,
            itemTotal,
            handlingFee,
            deliveryFee,
            totalToPay,
        };

        if (paymentMethod === "cod") {
            setIsSubmitting(true);
            try {
                const placedOrder = await placeOrder(email, chosenAddress);
                const order = placedOrder?.order || {
                    ...paymentDetails,
                    status: "Processing",
                    paymentDetails: {
                        method: "Cash on Delivery",
                        status: "pending",
                    },
                };

                sessionStorage.setItem(PLACED_ORDER_SESSION_KEY, JSON.stringify(order));
                navigate("/placed-order", { replace: true, state: { order } });
            } catch (error) {
                console.error("Cash on delivery order error:", error);
                alert(error.message || "Unable to place cash on delivery order");
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(paymentDetails));
        navigate("/payment", { state: paymentDetails });
    };

    return (
        <section className="orderpage">
            <div className="order">
                <div className="orderheader">
                    <h1>Order Page</h1>
                    <button
                        type="button"
                        className="addaddress"
                        onClick={openAddressForm}
                    >
                        Add Address
                    </button>
                </div>

                {isLoading ? (
                    <p className="loading">Loading order details...</p>
                ) : (
                    <>
                        <div className="address">
                            <h2>Shipping Address</h2>

                            {savedAddresses.length > 0 && (
                                <div className="savedaddress">
                                    {savedAddresses.map((address) => {
                                        const id = getAddressId(address);
                                        const addressLines = formatAddressLines(address);
                                        return (
                                            <label className="radio" key={id}>
                                                <input
                                                    type="radio"
                                                    name="shippingAddress"
                                                    checked={selectedAddressId === id}
                                                    onChange={() => {
                                                        setSelectedAddressId(id);
                                                        setShowAddAddressForm(false);
                                                    }}
                                                />
                                                <span className="addresscard">
                                                    {addressLines.map((line) => (
                                                        <span key={line}>{line}</span>
                                                    ))}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {showAddAddressForm && (
                                <div className="addressform">
                                    <input
                                        type="text"
                                        name="name"
                                        value={newAddress.name}
                                        onChange={handleAddressInput}
                                        placeholder="Full Name"
                                    />
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={newAddress.phone}
                                        onChange={handleAddressInput}
                                        placeholder="Phone Number"
                                        inputMode="tel"
                                    />
                                    <input
                                        type="text"
                                        name="address"
                                        value={newAddress.address}
                                        onChange={handleAddressInput}
                                        placeholder="Address"
                                    />
                                    <input
                                        type="text"
                                        name="city"
                                        value={newAddress.city}
                                        onChange={handleAddressInput}
                                        placeholder="City"
                                    />
                                    <input
                                        type="text"
                                        name="postalCode"
                                        value={newAddress.postalCode}
                                        onChange={handleAddressInput}
                                        placeholder="Postal Code"
                                    />
                                    <input
                                        type="text"
                                        name="country"
                                        value={newAddress.country}
                                        onChange={handleAddressInput}
                                        placeholder="Country"
                                    />
                                    <div className="addressformbutton">
                                        <button type="button" className="cancel" onClick={closeAddressForm} disabled={isSavingAddress}>
                                            Cancel
                                        </button>
                                        <button type="button" className="save" onClick={handleSaveAddress} disabled={isSavingAddress}>
                                            {isSavingAddress ? "Saving..." : "Save Address"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {savedAddresses.length === 0 && !showAddAddressForm && (
                                <p className="emptyaddress">No saved address found. Add one to continue.</p>
                            )}
                        </div>

                        <div className="ordersummary">
                            <h2>Order Details</h2>
                            <div className="orderitems">
                                {items.length === 0 ? (
                                    <p>Your cart is empty.</p>
                                ) : (
                                    items.map((item) => (
                                        <div className="itemrow" key={item._id}>
                                            <img
                                                className="itemimage"
                                                src={getImageUrl(item.image)}
                                                alt={item.name}
                                                onError={(event) => {
                                                    event.currentTarget.src = "https://via.placeholder.com/64x64?text=No+Image";
                                                }}
                                            />
                                            <div className="itemdetails">
                                                <span className="itemname">{item.name}</span>
                                                <span className="itemmeta">
                                                    {item.cartQuantity} x Rs {Number(item.price || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="orderbill">
                                <span>Item Total</span>
                                <span>Rs {itemTotal.toFixed(2)}</span>
                            </div>
                            <div className="orderbill">
                                <span>Handling Fee</span>
                                <span>Rs {handlingFee.toFixed(2)}</span>
                            </div>
                            <div className="orderbill">
                                <span>Delivery Fee</span>
                                <span>Rs {deliveryFee.toFixed(2)}</span>
                            </div>
                            <div className="ordertotal">
                                <span>Total</span>
                                <span>Rs {totalToPay.toFixed(2)}</span>
                            </div>

                            <div className="paymentchoice">
                                <h3>Payment Option</h3>
                                <label className={`paymentoption ${paymentMethod === "cod" ? "selected" : ""}`}>
                                    <input
                                        type="radio"
                                        name="paymentMethod"
                                        value="cod"
                                        checked={paymentMethod === "cod"}
                                        onChange={() => setPaymentMethod("cod")}
                                    />
                                    <span>
                                        <strong>Cash on Delivery</strong>
                                        <small>Pay when the order reaches you.</small>
                                    </span>
                                </label>
                                <label className={`paymentoption ${paymentMethod === "online" ? "selected" : ""}`}>
                                    <input
                                        type="radio"
                                        name="paymentMethod"
                                        value="online"
                                        checked={paymentMethod === "online"}
                                        onChange={() => setPaymentMethod("online")}
                                    />
                                    <span>
                                        <strong>Online Payment</strong>
                                        <small>Pay securely with Razorpay.</small>
                                    </span>
                                </label>
                            </div>

                            <button
                                type="button"
                                className="orderfinal"
                                onClick={handleFinalOrder}
                                disabled={isSubmitting || items.length === 0 || savedAddresses.length === 0}
                            >
                                {isSubmitting ? "Preparing..." : paymentMethod === "cod" ? "Place Cash on Delivery Order" : "Proceed to Payment"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

export default OrderPage;
