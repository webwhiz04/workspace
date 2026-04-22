import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./paymentpage.css";
import { getLoggedInEmail, isUserLoggedIn } from "./authStorage.js";
import { createRazorpayOrder, getRazorpayConfig, verifyRazorpayPayment } from "./paymentStorage.js";

const PAYMENT_SESSION_KEY = "pending-payment-details";
const PLACED_ORDER_SESSION_KEY = "recent-placed-order";

const loadRazorpayScript = () => {
    if (window.Razorpay) {
        return Promise.resolve(true);
    }

    return new Promise((resolve) => {
        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');

        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(true), { once: true });
            existingScript.addEventListener("error", () => resolve(false), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
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

function PaymentPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const loggedIn = isUserLoggedIn();
    const email = getLoggedInEmail();

    const [paymentDetails, setPaymentDetails] = useState(null);
    const [paymentConfig, setPaymentConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!loggedIn) {
            navigate("/login", { replace: true, state: { from: location } });
            return;
        }

        const persistedPayment = sessionStorage.getItem(PAYMENT_SESSION_KEY);
        const locationPayment = location.state || null;

        let parsedPayment = null;

        if (locationPayment) {
            parsedPayment = locationPayment;
            sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(locationPayment));
        } else if (persistedPayment) {
            try {
                parsedPayment = JSON.parse(persistedPayment);
            } catch (error) {
                console.error("Parse payment session error:", error);
                sessionStorage.removeItem(PAYMENT_SESSION_KEY);
            }
        }

        if (!parsedPayment || !parsedPayment.shippingAddress || !Number.isFinite(Number(parsedPayment.totalToPay))) {
            navigate("/order", { replace: true });
            return;
        }

        setPaymentDetails(parsedPayment);

        const loadPaymentConfig = async () => {
            try {
                const config = await getRazorpayConfig();
                setPaymentConfig(config);
            } catch (error) {
                console.error("Load payment config error:", error);
                setErrorMessage(error.message || "Unable to load payment gateway");
            } finally {
                setIsLoading(false);
            }
        };

        loadPaymentConfig();
    }, [loggedIn, location, navigate]);

    const totalInPaise = useMemo(() => {
        return Math.round(Number(paymentDetails?.totalToPay || 0) * 100);
    }, [paymentDetails]);

    const handlePayment = async () => {
        if (!email) {
            setErrorMessage("Please login first");
            return;
        }

        if (!paymentDetails || !paymentDetails.shippingAddress) {
            setErrorMessage("Missing payment details");
            return;
        }

        setErrorMessage("");
        setIsPaying(true);

        try {
            const scriptLoaded = await loadRazorpayScript();

            if (!scriptLoaded) {
                throw new Error("Unable to load Razorpay checkout");
            }

            if (!paymentConfig?.keyId) {
                throw new Error("Payment gateway is not configured");
            }

            const orderResponse = await createRazorpayOrder({
                email,
                receipt: `receipt_${Date.now()}`,
            });

            if (!orderResponse?.order?.id) {
                throw new Error("Unable to create Razorpay order");
            }

            const backendAmountInPaise = Number(orderResponse?.order?.amount || 0);
            if (!Number.isFinite(backendAmountInPaise) || backendAmountInPaise < 1) {
                throw new Error("Invalid checkout amount received from the server");
            }

            if (backendAmountInPaise !== totalInPaise) {
                console.warn("Checkout amount mismatch between frontend and backend", {
                    frontendAmountInPaise: totalInPaise,
                    backendAmountInPaise,
                });
            }

            const razorpay = new window.Razorpay({
                key: paymentConfig.keyId,
                amount: backendAmountInPaise,
                currency: orderResponse.order.currency || paymentConfig.currency || "INR",
                name: "My React App",
                description: "Order payment",
                order_id: orderResponse.order.id,
                prefill: {
                    email,
                },
                theme: {
                    color: "#1f7a4f",
                },
                handler: async (response) => {
                    try {
                        const verificationResult = await verifyRazorpayPayment({
                            email,
                            shippingAddress: paymentDetails.shippingAddress,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        const confirmedOrder = verificationResult?.order || {
                            ...paymentDetails,
                            status: "Placed",
                            paymentDetails: {
                                orderId: response.razorpay_order_id,
                                paymentId: response.razorpay_payment_id,
                                signature: response.razorpay_signature,
                                status: "captured",
                                paidAt: new Date().toISOString(),
                            },
                        };
                        sessionStorage.setItem(PLACED_ORDER_SESSION_KEY, JSON.stringify(confirmedOrder));
                        sessionStorage.removeItem(PAYMENT_SESSION_KEY);
                        navigate("/order-success", { replace: true, state: { order: confirmedOrder } });
                    } catch (paymentError) {
                        console.error("Payment verification error:", paymentError);
                        setErrorMessage(paymentError.message || "Payment verification failed");
                    } finally {
                        setIsPaying(false);
                    }
                },
                modal: {
                    ondismiss: () => {
                        setIsPaying(false);
                    },
                },
            });

            razorpay.open();
        } catch (paymentError) {
            console.error("Start payment error:", paymentError);
            setErrorMessage(paymentError.message || "Unable to start payment");
            setIsPaying(false);
        }
    };

    if (isLoading || !paymentDetails) {
        return (
            <section className="paymentpage">
                <div className="payment">
                    <div className="paymentstatus">
                        <h2>Loading payment page...</h2>
                        <p>Please wait while we prepare your Razorpay checkout.</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="paymentpage">
            <div className="payment">
                <header className="paymentheader">
                    <div>
                        <h1>Payment</h1>
                    </div>
                    <button type="button" className="backbtn" onClick={() => navigate("/order")} disabled={isPaying}>
                        Back to Order
                    </button>
                </header>

                <section className="paymentsummary">
                    <h2>Order Summary</h2>
                    <div className="paymentmeta">
                        <span>Email</span>
                        <span>{email}</span>
                    </div>
                    <div className="paymentmeta">
                        <span>Items</span>
                        <span>{Array.isArray(paymentDetails.items) ? paymentDetails.items.length : 0}</span>
                    </div>
                    <div className="paymentitems">
                        {Array.isArray(paymentDetails.items) && paymentDetails.items.map((item) => (
                            <div className="paymentitem" key={item._id}>
                                <span>{item.name}</span>
                                <span>{item.cartQuantity} x Rs {Number(item.price || 0).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="paymentbill">
                        <span>Total Payable</span>
                        <span>Rs {Number(paymentDetails.totalToPay || 0).toFixed(2)}</span>
                    </div>
                </section>

                <section className="paymentaddress">
                    <h2>Shipping Address</h2>
                    <div className="shippingaddresslines">
                        {formatAddressLines(paymentDetails.shippingAddress).map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>
                </section>

                <section className="paymentstatus">
                    <h2>Pay Now</h2>
                    {errorMessage ? <p className="paymenterror">{errorMessage}</p> : null}
                    <div className="paymentactions">
                        <button type="button" className="paybtn" onClick={handlePayment} disabled={isPaying}>
                            {isPaying ? "Opening Payment..." : "Pay with Razorpay"}
                        </button>
                    </div>
                </section>
            </div>
        </section>
    );
}

export default PaymentPage;