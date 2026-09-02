import { useEffect, useState } from "react";
import { getHouseholds, createHousehold, getHouseholdQrImageUrl } from "../api/households";

function Households() {
  const [households, setHouseholds] = useState([]);
  const [wardNumber, setWardNumber] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");

  const loadHouseholds = async () => {
    try {
      const data = await getHouseholds();
      setHouseholds(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadHouseholds();
    // this effect should run ONCE when the page first loads, and call
    // the function defined above that fetches the household list.
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createHousehold(wardNumber, houseNumber, ownerName, phoneNumber);

      // Reset the form fields after a successful submit:
      setWardNumber("");
      setHouseNumber("");
      setOwnerName("");
      setPhoneNumber("");

      loadHouseholds();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Failed to create household");
      // NOTE: err.response.data holds whatever your DRF serializer's validation errors looked like 
    }
  };

  return (
    <div>
      <h2>Households</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <input
          value={wardNumber}
          onChange={(e) => setWardNumber(e.target.value)}
          placeholder="Ward number"
          type="number"
        />
        <input
          value={houseNumber}
          onChange={(e) => setHouseNumber(e.target.value)}
          placeholder="House number"
        />
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Owner name"
        />
        <input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Phone number"
        />
        <button type="submit">Register Household</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {households.map((h) => (
          <li key={h.id} style={{ border: "1px solid #ccc", padding: 12, marginBottom: 8 }}>
            <p>Ward {h.ward_number} — House {h.house_number} ({h.owner_name})</p>
            <img
              src={getHouseholdQrImageUrl(h.id)}
              alt="QR code"
              width={120}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Households;