import { useState, useEffect } from "react";
import { apiAuthGet } from "@/lib/api";
import "@/styles/auth-premium.css";
import "@/styles/result-verification.css";

interface LaborRow {
  id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  passport_number?: string;
  nationality_id?: string;
  occupation_key?: string;
  occupation_name?: string;
  status?: string;
  [key: string]: any;
}

export default function ResultVerificationPage() {
  const [passportNumber, setPassportNumber] = useState("");
  const [occupationKey, setOccupationKey] = useState("");
  const [nationalityId, setNationalityId] = useState("BGD");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LaborRow[]>([]);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // Pre-fill occupation_key from login page selection if available
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("selected_occupation");
      if (saved) {
        const occ = JSON.parse(saved);
        setOccupationKey(occ.occupation_key || "");
      }
    } catch { /* ignore */ }
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResults([]);
    setSearched(false);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        passport_number: passportNumber.trim(),
        occupation_key: occupationKey.trim(),
        nationality_id: nationalityId.trim(),
        locale: "en",
      });
      const data = await apiAuthGet<any>(`/registration/labors?${qs.toString()}`);
      const list = Array.isArray(data) ? data : (data?.data ?? data?.labors ?? data?.items ?? []);
      setResults(list);
      setSearched(true);
      if (list.length === 0) setError("No labor records found for the given criteria.");
    } catch (err: any) {
      setError(err?.message || err?.data?.message || "Search failed");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function renderCell(key: string, value: any, row: LaborRow, idx: number) {
    if (value === null || value === undefined || value === "") return <span key={key} className="rv-cell rv-cell--empty">—</span>;
    // Highlight passport number
    if (key === "passport_number") return <code key={key} className="rv-cell rv-cell--highlight">{String(value)}</code>;
    if (key === "id") return <code key={key} className="rv-cell rv-cell--muted">{String(value)}</code>;
    return <span key={key} className="rv-cell">{String(value)}</span>;
  }

  return (
    <main className="rv-shell">
      <div className="rv-card">
        <header className="rv-header">
          <h1>Result Verification</h1>
          <p>Look up a labor record by passport number, occupation key and nationality.</p>
        </header>

        <form onSubmit={handleSearch} className="rv-form">
          <div className="rv-grid">
            <div className="rv-field">
              <label htmlFor="rv-passport">Passport Number</label>
              <input
                id="rv-passport"
                type="text"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                placeholder="e.g. A14746895"
                required
                autoComplete="off"
              />
            </div>
            <div className="rv-field">
              <label htmlFor="rv-occ">Occupation Key</label>
              <input
                id="rv-occ"
                type="text"
                value={occupationKey}
                onChange={(e) => setOccupationKey(e.target.value)}
                placeholder="e.g. 933301"
                required
                autoComplete="off"
              />
              {occupationKey && <small>Pre-filled from your login page selection.</small>}
            </div>
            <div className="rv-field">
              <label htmlFor="rv-nat">Nationality ID</label>
              <input
                id="rv-nat"
                type="text"
                value={nationalityId}
                onChange={(e) => setNationalityId(e.target.value)}
                placeholder="e.g. BGD"
                required
                autoComplete="off"
              />
            </div>
          </div>
          <button type="submit" className="rv-submit" disabled={loading}>
            {loading ? "Searching…" : "Search labor record"}
          </button>
        </form>

        {error && <div className="rv-message rv-message--error">{error}</div>}

        {results.length > 0 && (
          <div className="rv-results">
            <h2 className="rv-results-title">{results.length} record{results.length !== 1 ? "s" : ""} found</h2>
            <div className="rv-table-wrap">
              <table className="rv-table">
                <thead>
                  <tr>
                    {Object.keys(results[0]).map((key) => (
                      <th key={key}>{key.replace(/_/g, " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i}>
                      {Object.entries(row).map(([key, value]) => renderCell(key, value, row, i))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {searched && results.length === 0 && !error && !loading && (
          <div className="rv-message rv-message--info">
            No records matched your search criteria. Verify the passport number, occupation key and nationality.
          </div>
        )}
      </div>
    </main>
  );
}
