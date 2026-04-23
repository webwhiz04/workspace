import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";


function Admin() {
    const [email, setEmail] = useState("");
    const [password, setPassword ]= useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const navigate = useNavigate();

    const handleSubmit = (event) => {
        event.preventDefault();
        const adminemail = "admin@gmail.com";
        const adpassword = "admin@123";

        if (email === adminemail && password === adpassword) {
            navigate("/admindashboard");
        } else {
            setErrorMsg("invalid admin credentials");
        }
    }
 const handleClose = () => {
        navigate("/");
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

                    
                    <h2>Admin Login page</h2>
                     <span className="close" onClick={handleClose}>X</span>

                    <form onSubmit={handleSubmit}>
                        <input
                            type="email"
                            placeholder="Enter admin email..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Enter the password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <button className="btn" type="submit">
                            Login
                        </button>
                    </form>
                    {errorMsg&&<div style={{
                        color:"#fa0101",
                        font:"12px"}}>{errorMsg}</div>}
 
                </div>

                {/* <div className="rightside">
                    <span className="close" onClick={handleClose}>X</span>
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
                </div> */}

            </div>
        </div>
    );
}

export default Admin;
