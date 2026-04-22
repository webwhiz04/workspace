import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaUserCircle, FaShoppingCart } from "react-icons/fa";
import { RiAdminFill } from "react-icons/ri";
import { BsBagHeart } from "react-icons/bs";
import { SiBuymeacoffee } from "react-icons/si";
import { FaHome } from "react-icons/fa";
import { TbHorseToy } from "react-icons/tb";
import { SiCodefresh } from "react-icons/si";
import { FaHeadphonesAlt } from "react-icons/fa";
import { CiMobile3 } from "react-icons/ci";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { GiLargeDress } from "react-icons/gi";
import { IoIosSearch } from "react-icons/io";
import { TfiLocationPin } from "react-icons/tfi";
import "./nav.css";
import {
    clearLoggedInUser,
    getLoggedInEmail,
    getLoggedInUserDetails,
    isUserLoggedIn,
} from "./authStorage.js";

function Nav() {
    const navigate = useNavigate();
    const loggedIn = isUserLoggedIn();
    const email = getLoggedInEmail();
    const userDetails = getLoggedInUserDetails();
    const displayEmail = userDetails?.email || email;
    const userName = displayEmail ? displayEmail.split("@")[0] : "User";
    const [showUserPopup, setShowUserPopup] = useState(false);
    const userAreaRef = useRef(null);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (userAreaRef.current && !userAreaRef.current.contains(event.target)) {
                setShowUserPopup(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, []);

    const handleUserIconClick = () => {
        setShowUserPopup((prev) => !prev);
    };

    const handleLogout = () => {
        clearLoggedInUser();
        setShowUserPopup(false);
        navigate("/login", { replace: true });
    };

    return (
        <header className="navbar">
            <div className="leftnav">
                <div className="logo-area">
                    <img
                        src="https://cdn.zeptonow.com/web-static-assets-prod/artifacts/14.12.1/images/header/primary-logo.svg"
                        alt="Zepto logo"
                    />
                </div>
                <div className="loc"><TfiLocationPin />Select your location</div>
            
            </div>

            <div className="centernav">
                <div className="search-wrapper">
                    <div className="icon"><IoIosSearch /></div>
                    <input type="text" placeholder="Search for products..." className="searchinput"/>
                </div>
            </div>

            <div className="rightnav">
                {loggedIn ? (
                    <div className="user-area" ref={userAreaRef}>
                        <button type="button" className="user-trigger" onClick={handleUserIconClick}>
                            <FaUserCircle />
                        </button>
                        {showUserPopup ? (
                            <div className="user-popup" role="menu" aria-label="User menu">
                                <div className="popup-user-name"><FaUserCircle /> {userName}</div>
                                <div className="popup-orders" role="menuitem" onClick={() => { navigate("/my-orders"); setShowUserPopup(false); }}>
                                    My Orders  
                                </div>
                                <div ClassName="popup-info" role="menuitem" onClick={() => { navigate("/profile"); setShowUserPopup(false); }}>
                                    My Profile
                                </div>  
                                <button type="button" className="logout-btn" onClick={handleLogout}>Logout</button>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <Link to="/login" className="login-link"><FaUserCircle />Login</Link>
                )}
                {loggedIn ? (
                    <Link to="/cart"><FaShoppingCart />Cart</Link>
                ) : (
                    <Link to="/login" state={{ from: { pathname: "/cart" } }}><FaShoppingCart />Cart</Link>
                )}
                <Link to="/admin"><RiAdminFill />Admin</Link>
            </div>
            <div className="categories">
                <Link to="/all"><BsBagHeart />All</Link>
                <Link to="/cafe"><SiBuymeacoffee />Cafe</Link>
                <Link to="/home"><FaHome />Home</Link>
                <Link to="/toys"><TbHorseToy />Toys</Link>
                <Link to="/fresh"><SiCodefresh />Fresh</Link>
                <Link to="/electronics"><FaHeadphonesAlt />Electronics</Link>
                <Link to="/mobile"> <CiMobile3 />Mobile</Link>
                <Link to="/beauty"><FaWandMagicSparkles />Beauty</Link>
                <Link to="/fashion"><GiLargeDress />Fashion</Link>
 
            </div>
        </header>
    );
}

export default Nav;