import { useNavigate } from "react-router-dom";
import "./admin-dashboard.css";

function AdminDashboard() {
    const navigate = useNavigate();

    return (
        <div className="admindashboard">
            <div className="admincont">
                <h2>Admin Dashboard</h2>
                <div className="admin">
                    <button
                        className="adminbtn"
                        type="button"
                        onClick={() => navigate("/admindashboard/addproduct")}>

                        Add Product
                    </button>
                    <button
                        className="adminbtn"
                        type="button"
                        onClick={() => navigate("/admindashboard/viewproduct")}>
                        View Product
                    </button> 
                    <button
                        className="adminbtn"
                        type="button"
                        onClick={() => navigate("/admindashboard/user")}>
                        User
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;
