#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Imported GitHub repo: remix-of-svp-booking-crate (SVP Booking Crate, Lovable-style React + Supabase edge-function proxy app).
  Bug reported: "svp api server update — exam_session system — test center name not showing on the booking page".
  User's SVP API now returns the new shape:
    "test_center": {
      "test_center_id": 70,
      "site_id": null,
      "test_center_city": "Mymensingh",
      "test_center_name": "Mymensingh Technical Training Centre",
      ...
    }
  User also asked that:
    - Within a selected city, ALL exam_sessions for that city must show (not other cities).
    - Within that city, MULTIPLE test_centers must show, each with real test_center_name + test_center_id.
    - Each exam_session shown must be a REAL session of the selected city/center (no leakage).
    - Edge-function / svp-proxy setup should stay as-is.

frontend:
  - task: "BookingPage city filter + test center display for new SVP API shape"
    implemented: true
    working: true
    file: "frontend/src/lib/booking-utils.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: false
          agent: "user"
          comment: "After SVP API update to new shape (test_center.test_center_city / test_center_name / test_center_id, site_id=null), test center name does not show on booking page and city filter returns nothing."
        - working: true
          agent: "main"
          comment: |
            Root cause: getSessionSiteCity() and getAvailableDateCity() in booking-utils.ts
            only read legacy fields (test_center.city, item.test_center_city). They missed
            the NEW SVP field test_center.test_center_city, so city resolution returned ""
            and cityFilteredSessions became empty.

            Fix (surgical, 2 functions):
              - getSessionSiteCity now also reads item.test_center.test_center_city.
              - getAvailableDateCity now also reads item.test_center.test_center_city.

            Other resolvers (getSessionSiteId, getExplicitSessionCenterName, extractTestCenterId)
            already supported the new field names, so no other changes were needed.

            Verification:
              - Added new regression test suite booking-new-svp-shape.test.ts (8 tests) covering:
                  * city resolution from test_center.test_center_city
                  * site_id resolution from test_center.test_center_id when site_id is null
                  * explicit center name from test_center.test_center_name
                  * multiple test centers within one city -> separate options
                  * multiple sessions within one test center -> collapsed under one option
                  * resolveSessionCenter preserves new fields + stamps resolved values
                  * city filter excludes other-city sessions
                  * available_dates city options use the new field
              - All 35 tests pass (8 new + 27 existing) -> no regressions.
              - tsc --noEmit clean.

            Also fixed a pre-existing supervisor/frontend gap:
              - package.json had no "start" script; supervisor was running `yarn start`.
              - Added "start": "vite --host 0.0.0.0 --port 3000".
              - Frontend supervisor is now RUNNING.

            svp-proxy / edge-function setup left untouched (per user instruction).
        - working: false
          agent: "user"
          comment: |
            "exam_session অনুযায়ী সঠিক test_center name show করে না বুকিং পেজে কারন প্রতিটা
             টেস্ট সেন্টার জন্য আলাদা id আছে... যেকোনো সেশন আলাদা আলাদা হক কিন্তু যেটা
             available আছে অই অই সেশন test center name show করবে"
            i.e. multiple sessions in the same city belong to different test centers but
            the booking page collapses them to one wrong name.
        - working: true
          agent: "main"
          comment: |
            Second-level root cause: resolveSessionCenter priority was:
                resolvedName = adminName || ruleName || explicit || mappedName || ""
            So any admin override (exam_session_centers) or section_center_rules row
            for the city would MASK the real per-session test_center_name that SVP now
            returns. Result: multiple sessions in one city, with different real
            test_center_ids, all rendered the same (wrong) center name.

            Fix: SVP-first priority. When SVP gives BOTH test_center.test_center_name
            AND test_center.test_center_id (the new shape), trust it. Admin overrides /
            section rules only apply for legacy SVP responses (no name + no id), keeping
            backwards compatibility for old data.

            Files:
              - /app/frontend/src/lib/booking-utils.ts (resolveSessionCenter)
              - /app/frontend/src/pages/exam/BookingPage.tsx (getResolvedSessionCenterName)

            Verification:
              - Added booking-svp-first-priority.test.ts (6 tests):
                  * admin override no longer masks SVP name when SVP has name+id
                  * section rule no longer masks SVP name when SVP has name+id
                  * two sessions in same city with different test_center_ids resolve to
                    DIFFERENT names + DIFFERENT site_ids (the exact user-reported bug)
                  * legacy session (no name, no id) STILL uses admin override
                  * legacy session STILL uses section rule
                  * session with name but NO id falls back to admin override (correct)
              - All 41 tests pass (14 new + 27 existing).
              - tsc --noEmit clean. Frontend RUNNING.

            Also fixed Vite "host not allowed" error for the preview domain:
              - vite.config.ts now sets `server.allowedHosts: true`.

  - task: "Access Control (Admin + Agency) Dashboard redesign + account system check"
    implemented: true
    working: true
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          Live verification completed against Supabase project qdlqrsvkenalwhmfdbaf.

          Vitest: 80/81 tests passed. The only failure was the pre-existing
          src/pages/exam/BookingPage.integration.test.tsx Supabase mock failure
          (`.eq is not a function`), which is unrelated to this redesign.

          Build: `yarn build` completed successfully with exit code 0, generated
          dist/, and reported no TypeScript errors.

          Admin dashboard: all 10 assertions passed. Live login redirected to
          /access/dashboard; all admin navigation links, ADMIN role chip, Super Admin
          identity, adaptive hero copy, 4 stat cards, 3 infrastructure cards, and real
          account rows rendered. Hero height was 316.69px (< 400px), confirming the
          ring-inflation fix. No console errors referenced access-dashboard-premium.css
          or AccessDashboardPage.tsx.

          Agency dashboard: all 7 assertions passed. Live login redirected to
          /access/dashboard; only Dashboard and My Users were shown, admin-only links
          remained hidden, the AGENCY role chip and adaptive hero copy rendered, and
          4 stat cards plus 2 real agency-user rows loaded. No console errors occurred.

          Account system: /access/accounts loaded successfully with 14 real rows.
          The legacy light theme on that sub-page remains intentional.

          Low-priority labor dashboard check did not detect `.dp-shell`; this belongs
          to a separate previous feature and does not block the Access Control release.

          Conclusion: Access Control dashboard redesign and account system are ready
          for production. No source files were changed during verification.

  - task: "SVP registration payload — date format + contact_to_confirm enum + country_code dialing-code fix"
    implemented: true
    working: true
    file: "frontend/src/lib/registration-payload.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: false
          agent: "user"
          comment: |
            Postman capture of a real SVP registration submission revealed 3 payload bugs:
              1. date_of_birth / passport_expiration_date sent as YYYY-MM-DD (HTML default),
                 but SVP wants DD/MM/YYYY (capture: 28/02/1991, 04/03/2032).
              2. contact_to_confirm was the user's actual email — must be enum "email".
              3. country_code was ISO 2-letter ("BD") — capture showed dialing code ("+880").
        - working: "NA"
          agent: "main"
          comment: |
            Fix applied via new /app/frontend/src/lib/registration-payload.ts (toApiDate +
            resolveCountryDialingCode). RegisterPage.tsx imports them; contact_to_confirm is
            now the literal "email". 11 new vitest tests + 76 pre-existing all green (87/87).
            tsc --noEmit clean. Awaiting testing_agent confirmation.
        - working: true
          agent: "testing"
          comment: |
            Verified: 11/11 registration-payload.test.ts pass, full suite 87/87 across 14
            files, no regressions. Static greps confirm contact_to_confirm is the literal
            "email" (not form.email), toApiDate wraps both date fields in appendCommon, and
            resolveCountryDialingCode is used in both the Country onChange handler and the
            country_code data.set line. Module exports only the two named helpers, no default
            export, no side effects. No TS errors, no missing files. Live browser E2E
            skipped by design (SVP token expired per PRD backlog). Fix production-ready.
        - working: true
          agent: "testing"
          comment: |
            Unit-test-driven verification completed successfully. All 3 payload bugs confirmed fixed.

            Step A — Regression suite: 11/11 tests passed in registration-payload.test.ts
              ✓ toApiDate converts YYYY-MM-DD → DD/MM/YYYY (28/02/1991, 04/03/2032 per Postman capture)
              ✓ Empty input handling, manual-typed values pass-through, malformed ISO guards
              ✓ resolveCountryDialingCode prefers phone_code/dialing_code/calling_code/etc with "+" prefix
              ✓ Bangladesh case: phone_code "880" → "+880" (not ISO "BD")
              ✓ Fallback to legacy .code/.country_code when no dialing field present
              ✓ Null/undefined/non-object safety, blank field skipping, numeric code handling

            Step B — Full suite: 87/87 tests passed across 14 test files (no regressions)

            Step C — Static verification (grep):
              ✓ contact_to_confirm set to literal "email" (line 74, NOT form.email)
              ✓ toApiDate() routes both date_of_birth and passport_expiration_date (line 50 in appendCommon)
              ✓ resolveCountryDialingCode() used in Country select onChange (line 85) AND appendCommon country_code (line 53)
              ✓ registration-payload.ts exports exactly toApiDate + resolveCountryDialingCode (no default, no side effects)

            No browser E2E attempted (SVP API token expired per PRD backlog P2; 401 expected for live calls).
            No TypeScript errors, no missing files, no test regressions. Fix is production-ready.

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Surgical fix to booking-utils.ts (2 helper functions) to support the new SVP API
      `test_center.test_center_city / test_center_name / test_center_id` shape.
      Confirmed by 35 vitest tests (8 new regression tests + 27 pre-existing all passing).
      No changes to svp-proxy / Supabase edge functions / UI layout.
      Frontend supervisor was failing pre-existing because of missing `start` script in
      package.json — added it; service is now RUNNING.
  - agent: "main"
    message: |
      New task ready for testing: SVP registration payload — 3 fixes driven by a Postman
      capture of a real submission.

      Files:
        - /app/frontend/src/lib/registration-payload.ts   (NEW: toApiDate, resolveCountryDialingCode)
        - /app/frontend/src/lib/registration-payload.test.ts (NEW: 11 vitest tests)
        - /app/frontend/src/pages/auth/RegisterPage.tsx   (imports the two helpers + contact_to_confirm="email")

      Fix 1 — Date format: <input type="date"> emits YYYY-MM-DD but SVP wants DD/MM/YYYY
              (capture: 28/02/1991 for date_of_birth, 04/03/2032 for passport_expiration_date).
              appendCommon() now routes date_of_birth and passport_expiration_date through
              toApiDate() before FormData.append.

      Fix 2 — contact_to_confirm enum: was sending user's actual email (form.email); capture
              proved this is a method enum like preferable_contact — literal string "email".

      Fix 3 — country_code dialing code: capture showed "+880" for Bangladesh, not "BD".
              resolveCountryDialingCode() prefers phone_code / dialing_code / calling_code /
              dial_code / phone_prefix / international_code / phonecode (with "+" prepend),
              then falls back to legacy `.code` / `.country_code` ISO fields.

      Pre-testing verification:
        - 87/87 vitest tests pass across 14 suites (11 new + 76 pre-existing).
        - tsc --noEmit clean.

      Testing scope for the testing_agent:
        - Run `npx vitest run src/lib/registration-payload.test.ts` in /app/frontend and
          confirm all 11 tests pass. This is the authoritative check — payload-shape unit tests.
        - Then run the full suite `npx vitest run` and confirm 87/87.
        - No live SVP call is required (SVP API token is expired per PRD backlog).
        - No backend / MongoDB touch needed; this is pure frontend payload shaping.
  - agent: "testing"
    message: |
      SVP registration payload fix verified and confirmed working via unit tests.
      
      All 3 bugs fixed:
        1. Date format: toApiDate() converts YYYY-MM-DD → DD/MM/YYYY ✓
        2. contact_to_confirm: literal "email" enum (not user's email address) ✓
        3. country_code: dialing code "+880" (not ISO "BD") ✓
      
      Test results:
        - 11/11 regression tests passed (registration-payload.test.ts)
        - 87/87 full suite passed (no regressions)
        - All static verification checks passed (grep confirmed correct usage)
      
      No browser E2E needed (SVP token expired). Fix is production-ready.
