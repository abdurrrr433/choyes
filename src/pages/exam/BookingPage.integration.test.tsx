import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ---------------------------------------------------------------

// Mock the SVP/api gateway. Drive responses based on the URL.
vi.mock("@/lib/api", () => {
  const api = vi.fn(async (path: string) => {
    if (path.startsWith("/occupations")) {
      return {
        data: [
          {
            id: 555,
            name: "Welder",
            category_id: 42,
            methodology_type: "in_person",
            prometric_codes: [{ code: "en", english_name: "English" }],
          },
        ],
      };
    }
    if (path.startsWith("/available-dates")) {
      return { data: [{ date: "2026-06-15", city: "Bogura" }] };
    }
    if (path.startsWith("/exam-sessions/")) {
      // detail fetch returns the real test_center.name but no site_id (null)
      return {
        exam_session: {
          id: 9001,
          test_center: {
            name: "Technical Training Centre (TTC), Bogura",
            city: "Bogura",
            site_id: null,
          },
        },
      };
    }
    if (path.startsWith("/exam-sessions")) {
      // list returns sessions with site_id null (the SVP gap we are filling in)
      return {
        exam_sessions: [
          { id: 9001, site_id: null, site_city: "Bogura", available_seats: 5 },
        ],
      };
    }
    if (path.startsWith("/user-balance")) {
      return { reservation_credits: 1, free_certificates_total: 0 };
    }
    return null;
  });
  return {
    api,
    getSession: () => ({ accessToken: "t", refreshToken: "r", sessionId: "s" }),
    getBackendUrl: () => "http://localhost",
  };
});

// Mock Supabase: respond to test_centers DB queries.
vi.mock("@/integrations/supabase/client", () => {
  const rows = [
    { site_id: 107, name: "Technical Training Centre (TTC), Bogura", city: "Bogura" },
  ];
  const from = () => {
    const chain: any = {
      select() {
        return chain;
      },
      in(col: string, vals: any[]) {
        return Promise.resolve({
          data: rows.filter((row: any) =>
            vals.map(String).includes(String(row[col as keyof typeof row]))
          ),
          error: null,
        });
      },
    };
    return chain;
  };
  return { supabase: { from } };
});

import BookingPage from "./BookingPage";

describe("BookingPage integration: sessionsWithResolvedCenters → UI", () => {
  it("stamps site_id via DB name→site_id lookup and renders the resolved center in both dropdowns", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/booking?occupationId=555&siteCity=Bogura&examDate=2026-06-15&languageCode=en",
        ]}
      >
        <BookingPage />
      </MemoryRouter>
    );

    // Center dropdown shows resolved name + the site_id stamped from the DB lookup.
    await waitFor(
      () => {
        const opts = Array.from(document.querySelectorAll("option")) as HTMLOptionElement[];
        const match = opts.find(
          (o) =>
            o.value === "107" &&
            o.textContent?.includes("Technical Training Centre (TTC), Bogura") &&
            o.textContent?.includes("Site #107")
        );
        expect(match).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Session dropdown reflects the same resolved name + stamped site_id,
    // proving resolveSessionCenter wrote site_id onto the session object.
    const opts = Array.from(document.querySelectorAll("option")) as HTMLOptionElement[];
    const sessionOpt = opts.find(
      (o) =>
        o.textContent?.includes("Session #9001") &&
        o.textContent?.includes("Site #107") &&
        o.textContent?.includes("Technical Training Centre (TTC), Bogura")
    );
    expect(sessionOpt).toBeTruthy();
  });
});
