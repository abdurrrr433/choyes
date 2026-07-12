import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiAuthForm, apiAuthGet } from "@/lib/api";
import "@/styles/registration-premium.css";

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState<any[]>([]);
  const [nationalities, setNationalities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmationId, setConfirmationId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({ country_id:"", country_code:"", nationality_id:"", national_id:"", first_name:"", last_name:"", date_of_birth:"", passport_number:"", passport_expiration_date:"", sex:"male", email:"", phone_number:"", password:"", password_confirmation:"", otp_attempt:"", education_level:"middle", experience_level:"between_3_and_5", knowledge_level:"erudite,experienced,certificated", institute_name:"", recaptcha_response:"" });
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const selectedCountry = useMemo(() => countries.find((item) => String(item.id) === form.country_id), [countries, form.country_id]);

  useEffect(() => { apiAuthGet("/registration/countries").then((data) => setCountries(pickArray(data))).catch((err) => setMessage(err.message)); }, []);
  useEffect(() => {
    if (!form.country_id) { setNationalities([]); return; }
    apiAuthGet<any>(`/registration/countries/${encodeURIComponent(form.country_id)}`)
      .then((data) => setNationalities(data?.nationalities || data?.data?.nationalities || []))
      .catch((err) => { setNationalities([]); setMessage(err.message); });
  }, [form.country_id]);
  function update(key: string, value: string) { setForm((old) => ({ ...old, [key]: value })); }
  function appendCommon(data: FormData) {
    Object.entries(form).forEach(([key, value]) => { if (value) data.append(key, value); });
    data.set("country_code", form.country_code || selectedCountry?.code || selectedCountry?.country_code || "");
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
      data.set("terms_and_privacy_accepted", "true"); data.set("data_accuracy_acknowledged", "true"); data.set("onboarding_video_seen", "false"); data.set("step", "contact_confirmation");
      await apiAuthForm("/registration", data);
      sessionStorage.setItem("portal_login", form.email); sessionStorage.setItem("portal_password", form.password);
      setStep(3); setMessage("Registration completed. Continue to login and OTP verification.");
    } catch (err: any) { setMessage(err?.data?.details?.message || err?.message || "Registration failed"); }
    finally { setLoading(false); }
  }

  return <main className="rg-shell"><section className="rg-panel"><header><span>SVP LABOR ONBOARDING</span><h1>Create your accreditation account</h1><p>Live registration, identity validation and OTP handoff through the official SVP APIs.</p></header><div className="rg-progress"><b className={step>=1?"on":""}>1 <small>Identity</small></b><i/><b className={step>=2?"on":""}>2 <small>Account</small></b><i/><b className={step>=3?"on":""}>3 <small>Complete</small></b></div>
    {step===1 && <form onSubmit={validateIdentity} className="rg-form"><h2>Personal & passport information</h2><div className="rg-grid">
      <label>Country<select required value={form.country_id} onChange={(e)=>{const c=countries.find(x=>String(x.id)===e.target.value);setForm((old)=>({...old,country_id:e.target.value,country_code:c?.code||c?.country_code||"",nationality_id:""}));}}><option value="">Select country</option>{countries.map(c=><option key={c.id} value={c.id}>{c.name||c.english_name}</option>)}</select></label>
      <label>Nationality<select required disabled={!form.country_id} value={form.nationality_id} onChange={(e)=>update("nationality_id",e.target.value)}><option value="">{form.country_id?"Select nationality":"Select country first"}</option>{nationalities.map(n=><option key={n.id} value={n.id}>{n.english_name||n.arabic_name}</option>)}</select></label>
      <label>First name<input required value={form.first_name} onChange={(e)=>update("first_name",e.target.value)}/></label><label>Last name<input required value={form.last_name} onChange={(e)=>update("last_name",e.target.value)}/></label>
      <label>Date of birth<input required type="date" value={form.date_of_birth} onChange={(e)=>update("date_of_birth",e.target.value)}/></label><label>Sex<select value={form.sex} onChange={(e)=>update("sex",e.target.value)}><option value="male">Male</option><option value="female">Female</option></select></label>
      <label>Passport number<input required value={form.passport_number} onChange={(e)=>update("passport_number",e.target.value)}/></label><label>Passport expiration<input required type="date" value={form.passport_expiration_date} onChange={(e)=>update("passport_expiration_date",e.target.value)}/></label>
      <label>Passport document<input required type="file" accept="image/*,.pdf" onChange={(e)=>setPassportFile(e.target.files?.[0]||null)}/></label><label>Profile image<input type="file" accept="image/*" onChange={(e)=>setProfileImage(e.target.files?.[0]||null)}/></label>
    </div><button disabled={loading}>{loading?"Validating…":"Validate and continue"}</button></form>}
    {step===2 && <form onSubmit={register} className="rg-form"><h2>Account & professional details</h2><div className="rg-grid"><label>National ID<input required value={form.national_id} onChange={(e)=>update("national_id",e.target.value)} placeholder="Enter your national identity number"/></label><label>Email<input required type="email" value={form.email} onChange={(e)=>update("email",e.target.value)}/></label><label>Phone number<input required value={form.phone_number} onChange={(e)=>update("phone_number",e.target.value)}/></label><label>Password<input required minLength={8} type="password" value={form.password} onChange={(e)=>update("password",e.target.value)}/></label><label>Confirm password<input required minLength={8} type="password" value={form.password_confirmation} onChange={(e)=>update("password_confirmation",e.target.value)}/></label><label>OTP code (if sent)<input value={form.otp_attempt} onChange={(e)=>update("otp_attempt",e.target.value)}/></label><label>Education level<select required value={form.education_level} onChange={(e)=>update("education_level",e.target.value)}><option value="middle">Middle school</option></select></label><label>Experience level<select required value={form.experience_level} onChange={(e)=>update("experience_level",e.target.value)}><option value="between_3_and_5">Between 3 and 5 years</option></select></label><label>Institute name<input required value={form.institute_name} onChange={(e)=>update("institute_name",e.target.value)} placeholder="Enter your actual institute name"/><small>This is your own institute/employer name; SVP does not auto-fill it.</small></label><label className="rg-wide">reCAPTCHA response (when required by SVP)<textarea value={form.recaptcha_response} onChange={(e)=>update("recaptcha_response",e.target.value)}/></label></div><div className="rg-actions"><button type="button" onClick={()=>setStep(1)}>Back</button><button disabled={loading}>{loading?"Creating…":"Complete registration"}</button></div></form>}
    {step===3 && <div className="rg-complete"><strong>✓</strong><h2>Registration submitted</h2><p>Your account is ready for the official login and OTP verification flow.</p><button onClick={()=>navigate("/auth/login")}>Continue to login</button></div>}
    {message&&<div className="rg-message">{message}</div>}<footer>Already registered? <Link to="/auth/login">Sign in</Link></footer></section></main>;
}
