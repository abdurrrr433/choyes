import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiAuthForm, apiAuthGet } from "@/lib/api";
import { setPendingAuth } from "@/lib/pending-auth";
import { resolveCountryDialingCode, toApiDate } from "@/lib/registration-payload";
import { isSupportedPassportImage, scanPassport, type PassportScanData } from "@/lib/passport-scan-client";
import "@/styles/registration-premium.css";
import "@/styles/registration-fixes.css";

function pickArray(payload: any): any[] {
  for (const value of [payload, payload?.data, payload?.countries, payload?.data?.countries, payload?.items]) if (Array.isArray(value)) return value;
  return [];
}
function deepValue(payload: any, keys: string[]): string {
  const wanted = new Set(keys);
  const queue = [payload];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(key) && value !== null && value !== "") return String(value);
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return "";
}

// Match a country from the SVP dropdown against a Gemini-extracted country/nationality code
// or an English country name. Returns the matched country object or undefined.
function matchCountry(countries: any[], scan: PassportScanData): any | undefined {
  if (!countries.length) return undefined;
  const isoAlpha2 = (scan.country_code || "").toUpperCase();
  const isoAlpha3 = (scan.nationality_code || "").toUpperCase();
  const englishName = (scan.issuing_country || "").toUpperCase();
  return countries.find((c) => {
    const fields = [c.code, c.country_code, c.iso_code, c.iso2, c.alpha2].map((x) => String(x || "").toUpperCase());
    const three = [c.iso3, c.alpha3, c.iso_alpha3].map((x) => String(x || "").toUpperCase());
    const names = [c.name, c.english_name, c.arabic_name].map((x) => String(x || "").toUpperCase());
    if (isoAlpha2 && fields.includes(isoAlpha2)) return true;
    if (isoAlpha3 && three.includes(isoAlpha3)) return true;
    if (englishName && names.some((n) => n && (n === englishName || n.includes(englishName) || englishName.includes(n)))) return true;
    return false;
  });
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState<any[]>([]);
  const [nationalities, setNationalities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmationId, setConfirmationId] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [accuracyAcknowledged, setAccuracyAcknowledged] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ country_id:"", country_code:"", nationality_id:"", national_id:"", first_name:"", last_name:"", date_of_birth:"", passport_number:"", passport_expiration_date:"", sex:"male", email:"", phone_number:"", password:"", password_confirmation:"", otp_attempt:"", education_level:"middle", experience_level:"between_3_and_5", knowledge_level:"erudite,experienced,certificated", institute_name:"", recaptcha_response:"", onboarding_video_language:"en" });
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState<string>("");
  const [scanState, setScanState] = useState<{ status: "idle" | "scanning" | "ok" | "err"; message: string; filled: string[]; confidence?: string; dragOver?: boolean }>({ status: "idle", message: "", filled: [] });
  const dzInputRef = useRef<HTMLInputElement>(null);
  const selectedCountry = useMemo(() => countries.find((item) => String(item.id) === form.country_id), [countries, form.country_id]);

  useEffect(() => { apiAuthGet("/registration/countries").then((data) => setCountries(pickArray(data))).catch((err) => setMessage(err.message)); }, []);
  useEffect(() => {
    if (!form.country_id) { setNationalities([]); return; }
    apiAuthGet<any>(`/registration/countries/${encodeURIComponent(form.country_id)}`)
      .then((data) => setNationalities(data?.nationalities || data?.data?.nationalities || []))
      .catch((err) => { setNationalities([]); setMessage(err.message); });
  }, [form.country_id]);
  useEffect(() => () => { if (passportPreview) URL.revokeObjectURL(passportPreview); }, [passportPreview]);

  function update(key: string, value: string) { setForm((old) => ({ ...old, [key]: value })); }

  function applyScan(scan: PassportScanData): string[] {
    // Auto-fill everything the SVP form asks for; skip empty values so we don't clobber
    // whatever the user has already typed for a field Gemini couldn't read.
    const next: Record<string, string> = {};
    const filled: string[] = [];
    if (scan.passport_number) { next.passport_number = scan.passport_number; filled.push("Passport number"); }
    if (scan.first_name) { next.first_name = scan.first_name; filled.push("First name"); }
    if (scan.last_name) { next.last_name = scan.last_name; filled.push("Last name"); }
    if (scan.date_of_birth) { next.date_of_birth = scan.date_of_birth; filled.push("Date of birth"); }
    if (scan.passport_expiration_date) { next.passport_expiration_date = scan.passport_expiration_date; filled.push("Passport expiration"); }
    if (scan.sex === "male" || scan.sex === "female") { next.sex = scan.sex; filled.push("Sex"); }
    // Try to auto-select the country dropdown from the passport's issuing country.
    const matched = matchCountry(countries, scan);
    if (matched) {
      next.country_id = String(matched.id);
      next.country_code = resolveCountryDialingCode(matched);
      // Nationality dropdown loads via a separate effect once country_id changes;
      // it can be matched only after that. Not auto-selected here.
      filled.push("Country");
    }
    if (Object.keys(next).length) setForm((old) => ({ ...old, ...next }));
    return filled;
  }

  async function runScan(file: File) {
    setScanState({ status: "scanning", message: "Reading your passport…", filled: [] });
    try {
      const data = await scanPassport(file);
      const filled = applyScan(data);
      if (!filled.length) {
        setScanState({ status: "err", message: "Could not read passport details. Please enter them manually.", filled: [], confidence: data.confidence });
        return;
      }
      const conf = data.confidence === "high" ? "" : ` (confidence: ${data.confidence})`;
      setScanState({ status: "ok", message: `Auto-filled ${filled.length} field${filled.length > 1 ? "s" : ""}${conf}. Please verify before submitting.`, filled, confidence: data.confidence });
    } catch (err: any) {
      setScanState({ status: "err", message: err?.message || "Passport scan failed. Please enter your details manually.", filled: [] });
    }
  }

  function attachPassport(file: File | null) {
    if (passportPreview) URL.revokeObjectURL(passportPreview);
    if (!file) {
      setPassportFile(null); setPassportPreview("");
      setScanState({ status: "idle", message: "", filled: [] });
      return;
    }
    setPassportFile(file);
    setPassportPreview(URL.createObjectURL(file));
    if (isSupportedPassportImage(file)) {
      void runScan(file);
    } else {
      setScanState({ status: "err", message: "PDF or unsupported image — auto-fill only works with JPEG / PNG / WEBP photos. You can still submit the file; please fill the fields manually.", filled: [] });
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation();
    setScanState((s) => ({ ...s, dragOver: false }));
    const file = e.dataTransfer.files?.[0];
    if (file) attachPassport(file);
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation();
    if (!scanState.dragOver) setScanState((s) => ({ ...s, dragOver: true }));
  }
  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation();
    setScanState((s) => ({ ...s, dragOver: false }));
  }

  function appendCommon(data: FormData) {
    Object.entries(form).forEach(([key, value]) => {
      if (!value) return;
      if (key === "date_of_birth" || key === "passport_expiration_date") data.append(key, toApiDate(value));
      else data.append(key, value);
    });
    data.set("country_code", form.country_code || resolveCountryDialingCode(selectedCountry));
    data.set("first_name_not_specified", "false"); data.set("last_name_not_specified", "false");
    if (passportFile) data.set("file", passportFile); if (profileImage) data.set("image", profileImage);
  }
  async function validateIdentity(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("Validating identity with live SVP…");
    try {
      const data = new FormData(); appendCommon(data); data.set("step", "passport_info");
      const result = await apiAuthForm<any>("/registration/validate", data);
      setConfirmationId(deepValue(result, ["confirmation_id", "confirmationId", "id"]));
      setStep(2); setMessage("Identity accepted. Complete your account and verification details.");
    } catch (err: any) { setMessage(err?.data?.details?.message || err?.message || "Validation failed"); }
    finally { setLoading(false); }
  }
  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.password_confirmation) { setMessage("Passwords do not match."); return; }
    setLoading(true); setMessage("Creating your labor account in live SVP…");
    try {
      const data = new FormData(); appendCommon(data);
      if (confirmationId) data.set("confirmation_id", confirmationId);
      data.set("contact_to_confirm", form.email || form.phone_number); data.set("preferable_contact", "email");
      data.set("terms_and_privacy_accepted", String(acceptedTerms)); data.set("data_accuracy_acknowledged", String(accuracyAcknowledged)); data.set("onboarding_video_seen", "true"); data.set("step", "contact_confirmation");
      await apiAuthForm("/registration", data);
      setPendingAuth({ login: form.email, password: form.password, otpMethod: "email" });
      sessionStorage.setItem("portal_login", form.email);
      setStep(3); setMessage("Registration completed. Continue to login and OTP verification.");
    } catch (err: any) { setMessage(err?.data?.details?.message || err?.message || "Registration failed"); }
    finally { setLoading(false); }
  }

  const dzBusy = scanState.status === "scanning";
  const dzClass = ["rg-dropzone", scanState.dragOver ? "drag" : "", dzBusy ? "busy" : "", scanState.status === "ok" ? "ok" : "", scanState.status === "err" ? "err" : ""].filter(Boolean).join(" ");

  return <main className="rg-shell"><section className="rg-panel"><header><span>SVP LABOR ONBOARDING</span><h1>Create your accreditation account</h1><p>Live registration, identity validation and OTP handoff through the official SVP APIs.</p></header><div className="rg-progress"><b className={step>=1?"on":""}>1 <small>Identity</small></b><i/><b className={step>=2?"on":""}>2 <small>Account</small></b><i/><b className={step>=3?"on":""}>3 <small>Complete</small></b></div>
    {step===1 && <form onSubmit={validateIdentity} className="rg-form"><h2>Personal & passport information</h2><div className="rg-grid">
      <div
        className={dzClass}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !dzBusy && dzInputRef.current?.click()}
        role="button"
        aria-label="Upload passport for auto-fill"
      >
        <span className="rg-dz-badge">AI passport auto-fill · powered by Gemini</span>
        {passportFile ? (
          <div className="rg-dz-preview">
            {passportPreview && <img src={passportPreview} alt="Passport preview" />}
            <div style={{textAlign:"left"}}>
              <div style={{color:"#f4f8fb",fontWeight:700,fontSize:13}}>{passportFile.name}</div>
              <div>{(passportFile.size/1024).toFixed(0)} KB · {passportFile.type || "unknown"}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="rg-dz-title">Drop your passport photo here to auto-fill</div>
            <div className="rg-dz-sub">Drag & drop a clear photo of the passport data page, or click to browse. JPEG, PNG or WEBP · up to 8 MB. Your name, passport number, date of birth, expiration, sex and country will be filled automatically — please double-check before submitting.</div>
          </>
        )}
        <div className="rg-dz-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="rg-dz-btn primary" disabled={dzBusy} onClick={() => dzInputRef.current?.click()}>{passportFile ? "Choose different file" : "Choose file"}</button>
          {passportFile && <button type="button" className="rg-dz-btn" disabled={dzBusy} onClick={() => passportFile && isSupportedPassportImage(passportFile) && runScan(passportFile)}>Rescan</button>}
          {passportFile && <button type="button" className="rg-dz-btn" disabled={dzBusy} onClick={() => attachPassport(null)}>Remove</button>}
        </div>
        <div className={`rg-dz-status ${scanState.status === "err" ? "err" : ""} ${scanState.status === "ok" ? "ok" : ""}`}>
          {dzBusy && <span className="rg-dz-spinner" aria-hidden="true" />}
          {scanState.message ? <span>{scanState.message}</span> : (!passportFile && <span>Tip: a clear, straight-on photo of the passport data page works best.</span>)}
        </div>
        <input
          ref={dzInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*,.pdf"
          style={{display:"none"}}
          onChange={(e) => attachPassport(e.target.files?.[0] || null)}
        />
      </div>
      <label>Country<select required value={form.country_id} onChange={(e)=>{const c=countries.find(x=>String(x.id)===e.target.value);setForm((old)=>({...old,country_id:e.target.value,country_code:resolveCountryDialingCode(c),nationality_id:""}));}}><option value="">Select country</option>{countries.map(c=><option key={c.id} value={c.id}>{c.name||c.english_name}</option>)}</select></label>
      <label>Nationality<select required disabled={!form.country_id} value={form.nationality_id} onChange={(e)=>update("nationality_id",e.target.value)}><option value="">{form.country_id?"Select nationality":"Select country first"}</option>{nationalities.map(n=><option key={n.id} value={n.id}>{n.english_name||n.arabic_name}</option>)}</select></label>
      <label>First name<input required value={form.first_name} onChange={(e)=>update("first_name",e.target.value)}/></label><label>Last name<input required value={form.last_name} onChange={(e)=>update("last_name",e.target.value)}/></label>
      <label>Date of birth<input required type="date" value={form.date_of_birth} onChange={(e)=>update("date_of_birth",e.target.value)}/></label><label>Sex<select value={form.sex} onChange={(e)=>update("sex",e.target.value)}><option value="male">Male</option><option value="female">Female</option></select></label>
      <label>Passport number<input required value={form.passport_number} onChange={(e)=>update("passport_number",e.target.value)}/></label><label>Passport expiration<input required type="date" value={form.passport_expiration_date} onChange={(e)=>update("passport_expiration_date",e.target.value)}/></label>
      <label>Profile image<input type="file" accept="image/*" onChange={(e)=>setProfileImage(e.target.files?.[0]||null)}/></label>
    </div><button disabled={loading}>{loading?"Validating…":"Validate and continue"}</button></form>}
    {step===2 && <form onSubmit={register} className="rg-form"><h2>Account & professional details</h2><div className="rg-grid"><label>National ID<input required value={form.national_id} onChange={(e)=>update("national_id",e.target.value)} placeholder="Enter your national identity number"/></label><label>Email<input required type="email" value={form.email} onChange={(e)=>update("email",e.target.value)}/></label><label>Phone number<input required value={form.phone_number} onChange={(e)=>update("phone_number",e.target.value)}/></label><label>Password<input required minLength={8} type="password" value={form.password} onChange={(e)=>update("password",e.target.value)}/></label><label>Confirm password<input required minLength={8} type="password" value={form.password_confirmation} onChange={(e)=>update("password_confirmation",e.target.value)}/></label><label>OTP code (if sent)<input value={form.otp_attempt} onChange={(e)=>update("otp_attempt",e.target.value)}/></label><label>Onboarding language<select required value={form.onboarding_video_language} onChange={(e)=>update("onboarding_video_language",e.target.value)}><option value="en">English</option><option value="bn">Bengali</option><option value="hi">Hindi</option><option value="ur">Urdu</option><option value="ar">Arabic</option></select></label><label>Education level<select required value={form.education_level} onChange={(e)=>update("education_level",e.target.value)}><option value="middle">Middle school</option></select></label><label>Experience level<select required value={form.experience_level} onChange={(e)=>update("experience_level",e.target.value)}><option value="between_3_and_5">Between 3 and 5 years</option></select></label><label>Institute name<input required value={form.institute_name} onChange={(e)=>update("institute_name",e.target.value)} placeholder="Enter your actual institute name"/><small>This is your own institute/employer name; SVP does not auto-fill it.</small></label><label className="rg-wide">reCAPTCHA response (when required by SVP)<textarea value={form.recaptcha_response} onChange={(e)=>update("recaptcha_response",e.target.value)}/></label><label className="rg-check rg-wide"><input required type="checkbox" checked={accuracyAcknowledged} onChange={(e)=>setAccuracyAcknowledged(e.target.checked)}/>I confirm that the registration information and documents are accurate.</label><label className="rg-check rg-wide"><input required type="checkbox" checked={acceptedTerms} onChange={(e)=>setAcceptedTerms(e.target.checked)}/>I accept the SVP terms of use and privacy policy.</label></div><div className="rg-actions"><button type="button" onClick={()=>setStep(1)}>Back</button><button disabled={loading}>{loading?"Creating…":"Complete registration"}</button></div></form>}
    {step===3 && <div className="rg-complete"><strong>✓</strong><h2>Registration submitted</h2><p>Your account is ready for the official login and OTP verification flow.</p><button onClick={()=>navigate("/auth/login")}>Continue to login</button></div>}
    {message&&<div className="rg-message">{message}</div>}<footer>Already registered? <Link to="/auth/login">Sign in</Link></footer></section></main>;
}
