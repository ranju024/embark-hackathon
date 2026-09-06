import { useEffect, useState } from "react";
import { getMyHousehold, createHousehold, getHouseholdQrImageUrl } from "../api/households";
import { isLoggedIn } from "../auth";

function Households() {
  const [myHousehold, setMyHousehold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wardNumber, setWardNumber] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");

  const loadMyHousehold = async () => {
    setLoading(true);
    try {
      const data = await getMyHousehold();
      setMyHousehold(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn()) {
      loadMyHousehold();
    } else {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createHousehold(wardNumber, houseNumber, ownerName, phoneNumber);
      loadMyHousehold();
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
 
  return (
    <div>
      <h2>My Household</h2>
 
      {myHousehold ? (
        <div style={{ border: "1px solid #ccc", padding: 12 }}>
          <p>Ward {myHousehold.ward_number} — House {myHousehold.house_number} ({myHousehold.owner_name})</p>
          <img src={getHouseholdQrImageUrl(myHousehold.id)} alt="QR code" width={150} />
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