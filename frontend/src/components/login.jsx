import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TiDeleteOutline } from "react-icons/ti";


import "./login.css";

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

function Login() {
    const [email, setEmail] = useState("");
    const [isSending, setIsSending] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const returnTo = location.state?.from?.pathname || "/";

    const handleClose = () => {
        navigate("/");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail) {
            alert("Enter email");
            return;
        }

        if (!isValidEmail(trimmedEmail)) {
            alert("Enter a valid email address");
            return;
        }

        setIsSending(true);

        try {
            const response = await fetch(`${API_BASE_URL}/sendotp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email: trimmedEmail }),
            });

            const contentType = response.headers.get("content-type") || "";
            const data = contentType.includes("application/json")
                ? await response.json()
                : { message: await response.text() };

            if (response.ok) {
                sessionStorage.setItem("pendingLoginEmail", trimmedEmail);
                if (data.devOtp) {
                    alert(`Dev OTP: ${data.devOtp}`);
                } else {
                    alert("OTP Sent!");
                }
                navigate("/otp", { state: { email: trimmedEmail, from: returnTo } });
            } else {
                alert(data.message || "Failed to send OTP");
            }
        } catch (error) {
            console.error("Send OTP Error:", error);
            alert("Could not reach OTP server. Check backend is running and CORS origin is allowed.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="overlay">
            <div className="container">
                <div className="leftside">
                    <div className="logo">
                        <img
                            src="https://cdn.zeptonow.com/web-static-assets-prod/artifacts/14.11.1/tr:w-0.2,ar-0.2-0.2,pr-true,f-auto,q-40/images/logo.svg"
                            alt="logo"
                        />
                    </div>

                    <h2>Lowest price Everyday</h2>
                    <h2>in minutes</h2>

                    <form onSubmit={handleSubmit}>
                        <input
                            type="email"
                            placeholder="Enter your email..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <button className="btn" type="submit" disabled={isSending}>
                            {isSending ? "Sending..." : "Continue"}
                        </button>
                    </form>

                    <p className="con">
                        By continuing, you agree to our <br />
                        Terms of Services and Privacy Policy
                    </p>
                </div>

                <div className="rightside">
                   <TiDeleteOutline  className="close" onClick={handleClose}/>
                    <div className="phone">
                        <img
                            src="https://cdn.zeptonow.com/web-static-assets-prod/artifacts/14.11.1/tr:w-100,ar-100-100,pr-true,f-auto,q-40/images/get-the-app/get-the-app-phone.png"
                            alt="phone"
                        />
                    </div>

                    <h2 className="lh2">
                        Order faster & <br /> easier <br /> everytime
                    </h2>

                    <p>with zepto app</p>

                    <div className="appbtn">
                        <img
                            src="https://cdn.zeptonow.com/web-static-assets-prod/artifacts/14.11.1/tr:w-180,ar-180-46,pr-true,f-auto,q-40/images/app-stores/download-play-store.svg"
                            className="img"
                            alt="playstore"
                        />
                    </div>

                    <div className="appbtn">
                        <img
                            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ0eOmm8lR_dgM2e5hko5IWEPgFeG5HtLYU1A&s"
                            className="img"
                            alt="appstore"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;