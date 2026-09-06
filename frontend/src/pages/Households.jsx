import { useEffect, useState } from "react";
import {
  getMyHousehold,
  getHouseholds,
  createHousehold,
  getHouseholdQrImageUrl,
} from "../api/households";
import { getMyPoints } from "../api/rewards";
import { isLoggedIn } from "../auth";

function Households({ isStaff }) {
  const [myHousehold, setMyHousehold] = useState(null);
  const [allHouseholds, setAllHouseholds] = useState([]);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wardNumber, setWardNumber] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      if (isStaff) {
        // TODO: this is the prop this component now receives — use it
        // directly as the condition (it's already true/false, no need
        // to call a function or compare it to anything).
        const data = await getHouseholds();
        setAllHouseholds(data);
      } else {
        const household = await getMyHousehold();
        setMyHousehold(household);
        if (household) {
          const pointsData = await getMyPoints();
          setPoints(pointsData);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn()) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isStaff]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createHousehold(wardNumber, houseNumber, ownerName, phoneNumber);
      loadData();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Failed to create household");
    }
  };

  if (!isLoggedIn()) {
    return <p>Please log in or register an account to manage your household.</p>;
  }
  if (loading) {
    return <p>Loading...</p>;
  }

  if (isStaff) {
    return (
      <div>
        <h2>All Registered Households</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {allHouseholds.map((h) => (
            <li key={h.id} style={{ border: "1px solid #ccc", padding: 12, marginBottom: 8 }}>
              <p>Ward {h.ward_number} — House {h.house_number} ({h.owner_name}) — owner: {h.owner_username}</p>
              <img src={getHouseholdQrImageUrl(h.id)} alt="QR code" width={100} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const totalPoints = points.reduce((sum, entry) => sum + entry.points, 0);

  return (
    <div>
      <h2>My Household</h2>
      {myHousehold ? (
        <div style={{ border: "1px solid #ccc", padding: 12 }}>
          <p>Ward {myHousehold.ward_number} — House {myHousehold.house_number} ({myHousehold.owner_name})</p>
          <img src={getHouseholdQrImageUrl(myHousehold.id)} alt="QR code" width={150} />
          <h3>Green Points: {totalPoints}</h3>
          <ul>
            {points.map((p) => (
              <li key={p.id}>
                {p.points > 0 ? "+" : ""}{p.points} — {new Date(p.created_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p>You haven't registered a household yet.</p>
          <form onSubmit={handleSubmit}>
            <input value={wardNumber} onChange={(e) => setWardNumber(e.target.value)} placeholder="Ward number" type="number" />
            <input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="House number" />
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner name" />
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone number" />
            <button type="submit">Register Household</button>
          </form>
        </>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default Households;