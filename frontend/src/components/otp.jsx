import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./otp.css";
import { setLoggedInUser } from "./authStorage.js";

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/auth`;

function Otp() {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [timer, setTimer] = useState(30);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const inputsRef = useRef([]);
    const location = useLocation();
    const navigate = useNavigate();

    const email = location.state?.email || sessionStorage.getItem("pendingLoginEmail") || "";
    const returnTo = location.state?.from || "/";

    const handleClose = () => {
        sessionStorage.removeItem("pendingLoginEmail");
        navigate("/login");
    };

     
    useEffect(() => {
        if (!email) {
            navigate("/login");
        }
    }, [email, navigate]);

    
    useEffect(() => {
        if (timer === 0) return;

        const interval = setInterval(() => {
            setTimer((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [timer]);

    
    const handleChange = (value, index) => {

        if (!/^[0-9]?$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputsRef.current[index + 1].focus();
        }
    };

    
    const handleKeyDown = (e, index) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputsRef.current[index - 1].focus();
        }
    };

    const handleResendOtp = async () => {
        if (!email || timer > 0 || isResending) {
            return;
        }

        setIsResending(true);

        try {
            const response = await fetch(`${API_BASE_URL}/sendotp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const contentType = response.headers.get("content-type") || "";
            const data = contentType.includes("application/json")
                ? await response.json()
                : { message: await response.text() };

            if (response.ok) {
                setOtp(["", "", "", "", "", ""]);
                setTimer(30);
                inputsRef.current[0]?.focus();
                if (data.devOtp) {
                    alert(`Dev OTP: ${data.devOtp}`);
                } else {
                    alert("OTP resent successfully");
                }
            } else {
                alert(data.message || "Failed to resend OTP");
            }
        } catch (error) {
            console.error("Resend OTP Error:", error);
            alert("Could not resend OTP. Check backend is running.");
        } finally {
            setIsResending(false);
        }
    };

     
    const handleVerify = async () => {
        const finalOtp = otp.join("");

        if (finalOtp.length !== 6) {
            alert("Please enter complete 6 digit OTP");
            return;
        }

        setIsVerifying(true);

        try {
            const response = await fetch(`${API_BASE_URL}/verifyotp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp: finalOtp }),
            });

            const contentType = response.headers.get("content-type") || "";
            const data = contentType.includes("application/json")
                ? await response.json()
                : { message: await response.text() };

            if (response.ok) {
                sessionStorage.removeItem("pendingLoginEmail");
                setLoggedInUser(email, data.user || null);
                alert("Login Successful!");
                navigate(returnTo, { replace: true });
            } else {
                alert(data.message || "Failed to verify OTP");
            }
        } catch (error) {
            console.error("OTP Error:", error);
            alert("Could not reach OTP server. Check backend is running and CORS origin is allowed.");
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="otp">
            <div className="otpcont">

                <div className="otpleft">
                    <h1>OTP Verification</h1>
                    <p>OTP sent to {email}</p>

                    <div className="otpin">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                type="text"
                                maxLength="1"
                                value={digit}
                                ref={(el) => {
                                    inputsRef.current[index] = el;
                                }}
                                onChange={(e) => handleChange(e.target.value, index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                className="otpinput"
                            />
                        ))}
                    </div>

                    <div className="otptimer">
                        00:{timer < 10 ? `0${timer}` : timer}
                    </div>

                    <button
                        type="button"
                        className="resend"
                        onClick={handleResendOtp}
                        disabled={timer > 0 || isResending}
                    >
                        {isResending ? "Resending..." : "Resend OTP"}
                    </button>

                    <button className="otpbtn" onClick={handleVerify} disabled={isVerifying}>
                        {isVerifying ? "Verifying..." : "Verify OTP"}
                    </button>
                </div>

                <div className="otpright">
                    <span className="otpclose" onClick={handleClose}>X</span>
                    <div className="otpphone">
                        <img
                            src="https://cdn.zeptonow.com/web-static-assets-prod/artifacts/14.11.1/tr:w-100,ar-100-100,pr-true,f-auto,q-40/images/get-the-app/get-the-app-phone.png"
                            alt="phone"
                        />
                    </div>

                    <h2 className="otpheading">
                        Order faster & <br /> easier <br /> everytime
                    </h2>

                    <p>with zepto app</p>

                    <div className="otpappbtn">
                        <img
                            src="https://cdn.zeptonow.com/web-static-assets-prod/artifacts/14.11.1/tr:w-180,ar-180-46,pr-true,f-auto,q-40/images/app-stores/download-play-store.svg"
                            className="otpimg"
                            alt="playstore"
                        />
                    </div>

                    <div className="otpappbtn">
                        <img
                            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ0eOmm8lR_dgM2e5hko5IWEPgFeG5HtLYU1A&s"
                            className="otpimg"
                            alt="appstore"
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}

export default Otp;