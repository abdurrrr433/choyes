import { Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";

declare global {
  interface Window {
    wpwlOptions?: Record<string, unknown>;
  }
}

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const checkoutId = searchParams.get("checkoutId") || "";
  const reservationId = searchParams.get("reservationId") || "";
  const resultUrl =
    searchParams.get("resultUrl") ||
    `${window.location.origin}/exam/payment/result?reservationId=${encodeURIComponent(reservationId)}`;

  useEffect(() => {
    if (
      window.location.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ) {
      window.location.replace(`https://${window.location.host}${window.location.pathname}${window.location.search}`);
      return;
    }
  }, []);

  useEffect(() => {
    if (window.location.protocol !== "https:") return;
    if (!checkoutId) return;
    window.wpwlOptions = {
      locale: "en",
      paymentTarget: "_top",
      disableSubmitOnEnter: true,
      brandDetection: true,
      brandDetectionType: "binlist",
      brandDetectionPriority: ["VISA", "MASTER"],
      style: "card",
      spinner: { color: "black", className: "pay-spinner" },
    };

    const script = document.createElement("script");
    script.src = `https://eu-prod.oppwa.com/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(checkoutId)}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      delete window.wpwlOptions;
    };
  }, [checkoutId]);

  return (
    <div className="booking-shell">
      <div className="booking-modal payment-modal">
        <div className="modal-head">
          <h1>Payment</h1>
          <Link to="/exam/reservations" className="close-link" aria-label="Close">x</Link>
        </div>

        {reservationId ? <div className="notice notice--ok">Reservation #{reservationId}</div> : null}

        {!checkoutId ? (
          <div className="notice notice--error">Missing payment checkout ID.</div>
        ) : (
          <form
            action={resultUrl}
            className="paymentWidgets"
            data-brands="VISA MASTER"
          />
        )}
      </div>
    </div>
  );
}
