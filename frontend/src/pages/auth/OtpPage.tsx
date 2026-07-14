import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, LockKeyhole, Mail, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { apiAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { clearPendingAuth, getPendingAuth, setPendingAuth } from "@/lib/pending-auth";
import "@/styles/auth-premium.css";

type MessageType = "info" | "ok" | "error";
type AuthError = {
  data?: {
    message?: string;
    details?: { errors?: { otp_attempt_invalid?: { en?: string } } };
  };
  message?: string;
};

export default function OtpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: authLogin } = useAuth();
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [otpMethod, setOtpMethod] = useState("email");
  const [otpAttempt, setOtpAttempt] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<MessageType>("info");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const pending = getPendingAuth();
    const queryLogin = searchParams.get("login");
    const queryOtpMethod = searchParams.get("otpMethod");
    setLogin(queryLogin || pending?.login || "");
    setPassword(pending?.password || "");
    setOtpMethod(queryOtpMethod || pending?.otpMethod || "email");
    otpInputRef.current?.focus();
  }, [searchParams]);

  function getErrorMessage(err: unknown) {
    const error = err as AuthError;
    const otpInvalidMessage = error?.data?.details?.errors?.otp_attempt_invalid?.en;
    if (otpInvalidMessage) {
      return `${otpInvalidMessage} Please resend and use only the newest code.`;
    }

    return error?.data?.message || error?.message || "OTP verification failed";
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();

    if (!login || !password) {
      setMsg("Your sign-in session has expired. Return to sign in and request a new code.");
      setMsgType("error");
      return;
    }

    setVerifying(true);
    setMsg("Checking your verification code…");
    setMsgType("info");

    try {
      const res = await apiAuth("/otp-verify", {
        login,
        password,
        otp_attempt: otpAttempt,
        otp_method: otpMethod,
      });
      authLogin(res.accessToken, res.user || res);
      clearPendingAuth();
      setMsg("Verified. Taking you to your dashboard…");
      setMsgType("ok");
      navigate("/dashboard");
    } catch (err: unknown) {
      setMsg(getErrorMessage(err));
      setMsgType("error");
    } finally {
      setVerifying(false);
    }
  }

  async function resendOtp() {
    if (!login || !password) {
      setMsg("Your sign-in session has expired. Return to sign in and request a new code.");
      setMsgType("error");
      return;
    }

    setResending(true);
    setMsg("Sending a fresh verification code…");
    setMsgType("info");

    try {
      await apiAuth("/login", { login, password, otp_method: otpMethod });
      setPendingAuth({ login, password, otpMethod });
      setOtpAttempt("");
      setMsg(`A new code was sent by ${otpMethod === "sms" ? "SMS" : "email"}. Use the latest code only.`);
      setMsgType("ok");
      otpInputRef.current?.focus();
    } catch (err: unknown) {
      const error = err as AuthError;
      setMsg(error?.data?.message || error?.message || "Could not resend the verification code");
      setMsgType("error");
    } finally {
      setResending(false);
    }
  }

  const DeliveryIcon = otpMethod === "sms" ? Smartphone : Mail;
  const deliveryLabel = otpMethod === "sms" ? "SMS" : "Email";
  const sessionReady = Boolean(login && password);

  return (
    <main className="ap-shell ap-otp-shell">
      <aside className="ap-brand-panel ap-otp-brand">
        <div className="ap-brand-head">
          <div className="ap-brand-mark">S</div>
          <div className="ap-brand-title">
            <strong>SVP Accreditation</strong>
            <span>Labor exam portal</span>
          </div>
        </div>

        <div className="ap-brand-copy">
          <span className="ap-brand-eyebrow">Secure verification</span>
          <h2>One quick step to <em>protect your account</em></h2>
          <p>Your one-time code confirms it is really you before we open your accreditation workspace.</p>

          <div className="ap-otp-steps" aria-label="Sign-in progress">
            <div className="ap-otp-step is-complete">
              <span><ShieldCheck size={18} /></span>
              <div><strong>Credentials accepted</strong><small>Your account details were confirmed</small></div>
            </div>
            <div className="ap-otp-step is-current">
              <span><LockKeyhole size={18} /></span>
              <div><strong>Verify one-time code</strong><small>Enter the newest code you received</small></div>
            </div>
            <div className="ap-otp-step">
              <span>3</span>
              <div><strong>Open dashboard</strong><small>Continue to bookings and payments</small></div>
            </div>
          </div>
        </div>

        <div className="ap-brand-foot">
          <span>© {new Date().getFullYear()} Accreditation Suite</span>
          <span>Official SVP flow</span>
        </div>
      </aside>

      <section className="ap-form-panel">
        <div className="ap-form-card ap-otp-card">
          <Link className="ap-otp-back" to="/auth/login">
            <ArrowLeft size={16} /> Back to sign in
          </Link>

          <div className="ap-otp-icon" aria-hidden="true">
            <DeliveryIcon size={26} />
          </div>

          <div className="ap-form-header ap-otp-header">
            <h1>Check your {deliveryLabel.toLowerCase()}</h1>
            <p>Enter the one-time verification code sent to your selected {deliveryLabel.toLowerCase()} contact.</p>
          </div>

          <div className="ap-otp-account">
            <div>
              <span>Account</span>
              <strong>{login || "No account found"}</strong>
            </div>
            <span className="ap-otp-method"><DeliveryIcon size={14} /> {deliveryLabel}</span>
          </div>

          <form className="ap-form" onSubmit={verify}>
            <div className="ap-field ap-otp-field">
              <label htmlFor="otp-code">Verification code</label>
              <input
                ref={otpInputRef}
                id="otp-code"
                value={otpAttempt}
                onChange={(e) => setOtpAttempt(e.target.value.replace(/\s/g, ""))}
                placeholder="Enter your code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                required
                aria-describedby="otp-help"
              />
              <small id="otp-help">Codes expire quickly. If you requested more than one, use the newest code.</small>
            </div>

            <button type="submit" className="ap-submit" disabled={verifying || resending || !otpAttempt.trim()}>
              {verifying ? "Verifying…" : "Verify and continue"}
            </button>

            <button
              type="button"
              className="ap-otp-resend"
              onClick={resendOtp}
              disabled={verifying || resending || !sessionReady}
            >
              <RefreshCw size={15} className={resending ? "is-spinning" : ""} />
              {resending ? "Sending a new code…" : "Didn't receive it? Resend code"}
            </button>

            {msg ? (
              <div role="status" className={`ap-message${msgType === "error" ? " ap-message--error" : msgType === "ok" ? " ap-message--ok" : ""}`}>
                {msg}
              </div>
            ) : null}
          </form>

          {!sessionReady ? (
            <p className="ap-hint ap-otp-expired">
              This page needs an active sign-in session. <Link to="/auth/login">Request another code</Link>.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
