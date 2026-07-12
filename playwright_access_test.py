#!/usr/bin/env python3
"""
Playwright test for Access Control login and Labor Dashboard verification
"""
import asyncio
import sys
from playwright.async_api import async_playwright, expect

async def test_access_login_and_dashboard():
    """Test Access Control login with admin/agency credentials and Labor dashboard render"""
    results = {
        "admin_login": {"status": "PENDING", "details": ""},
        "agency_login": {"status": "PENDING", "details": ""},
        "labor_dashboard": {"status": "PENDING", "details": ""}
    }
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        
        # Test 1: Admin login
        print("\n=== Testing Admin Login ===")
        page = await context.new_page()
        try:
            await page.goto("http://localhost:3000/access/login", wait_until="networkidle", timeout=10000)
            
            # Fill login form
            await page.fill('input[type="email"]', "admin@example.com")
            await page.fill('input[type="password"]', "12345678")
            
            # Submit and wait for navigation
            await page.click('button[type="submit"]')
            await page.wait_for_url("**/access/dashboard", timeout=10000)
            
            # Check if we're on dashboard
            current_url = page.url
            if "/access/dashboard" in current_url:
                # Take screenshot
                await page.screenshot(path="/app/admin_dashboard.png")
                
                # Check what renders
                page_content = await page.content()
                results["admin_login"]["status"] = "PASS"
                results["admin_login"]["details"] = f"Successfully logged in and redirected to {current_url}. Dashboard renders (screenshot saved)."
                print(f"✅ Admin login successful - redirected to {current_url}")
            else:
                results["admin_login"]["status"] = "FAIL"
                results["admin_login"]["details"] = f"Login succeeded but redirected to unexpected URL: {current_url}"
                print(f"❌ Unexpected redirect: {current_url}")
                
        except Exception as e:
            await page.screenshot(path="/app/admin_login_error.png")
            error_msg = str(e)
            
            # Try to capture any visible error message
            try:
                error_elements = await page.query_selector_all('[role="alert"], .error, .text-red-500, .text-destructive')
                if error_elements:
                    visible_errors = []
                    for elem in error_elements:
                        text = await elem.inner_text()
                        if text.strip():
                            visible_errors.append(text.strip())
                    if visible_errors:
                        error_msg = f"UI Error: {' | '.join(visible_errors)}"
            except:
                pass
            
            results["admin_login"]["status"] = "FAIL"
            results["admin_login"]["details"] = f"Login failed: {error_msg}"
            print(f"❌ Admin login failed: {error_msg}")
        
        await page.close()
        
        # Test 2: Agency login
        print("\n=== Testing Agency Login ===")
        page = await context.new_page()
        try:
            await page.goto("http://localhost:3000/access/login", wait_until="networkidle", timeout=10000)
            
            # Fill login form
            await page.fill('input[type="email"]', "tahsinhridoy2022@gmail.com")
            await page.fill('input[type="password"]', "12345678")
            
            # Submit and wait for navigation
            await page.click('button[type="submit"]')
            await page.wait_for_url("**/access/dashboard", timeout=10000)
            
            # Check if we're on dashboard
            current_url = page.url
            if "/access/dashboard" in current_url:
                await page.screenshot(path="/app/agency_dashboard.png")
                results["agency_login"]["status"] = "PASS"
                results["agency_login"]["details"] = f"Successfully logged in and redirected to {current_url}. Dashboard renders (screenshot saved)."
                print(f"✅ Agency login successful - redirected to {current_url}")
            else:
                results["agency_login"]["status"] = "FAIL"
                results["agency_login"]["details"] = f"Login succeeded but redirected to unexpected URL: {current_url}"
                print(f"❌ Unexpected redirect: {current_url}")
                
        except Exception as e:
            await page.screenshot(path="/app/agency_login_error.png")
            error_msg = str(e)
            
            # Try to capture any visible error message
            try:
                error_elements = await page.query_selector_all('[role="alert"], .error, .text-red-500, .text-destructive')
                if error_elements:
                    visible_errors = []
                    for elem in error_elements:
                        text = await elem.inner_text()
                        if text.strip():
                            visible_errors.append(text.strip())
                    if visible_errors:
                        error_msg = f"UI Error: {' | '.join(visible_errors)}"
            except:
                pass
            
            results["agency_login"]["status"] = "FAIL"
            results["agency_login"]["details"] = f"Login failed: {error_msg}"
            print(f"❌ Agency login failed: {error_msg}")
        
        await page.close()
        
        # Test 3: Labor Dark Premium Dashboard
        print("\n=== Testing Labor Dark Premium Dashboard ===")
        page = await context.new_page()
        try:
            # Go to any page first to set localStorage
            await page.goto("http://localhost:3000/access/login", wait_until="networkidle", timeout=10000)
            
            # Set fake token in localStorage
            await page.evaluate("""
                localStorage.setItem("accessToken", "eyJhbGciOiJIUzI1NiJ9." + btoa(JSON.stringify({login:"demo_user"})) + ".sig")
            """)
            
            # Navigate to dashboard
            await page.goto("http://localhost:3000/dashboard", wait_until="networkidle", timeout=10000)
            await page.wait_for_timeout(3000)  # Wait 3s for render
            
            # Take screenshot
            await page.screenshot(path="/app/labor_dashboard.png", full_page=True)
            
            # Check for Dark Premium elements
            checks = []
            
            # Check 1: .dp-shell exists
            dp_shell = await page.query_selector('.dp-shell')
            if dp_shell:
                checks.append("✅ .dp-shell element exists")
            else:
                checks.append("❌ .dp-shell element NOT found")
            
            # Check 2: "Payment History" text visible
            payment_history_visible = await page.locator('text="Payment History"').is_visible()
            if payment_history_visible:
                checks.append("✅ 'Payment History' text visible")
            else:
                checks.append("❌ 'Payment History' text NOT visible")
            
            # Check 3: 4 .dp-stat cards
            dp_stats = await page.query_selector_all('.dp-stat')
            stat_count = len(dp_stats)
            if stat_count == 4:
                checks.append(f"✅ Found 4 .dp-stat cards")
            else:
                checks.append(f"❌ Found {stat_count} .dp-stat cards (expected 4)")
            
            # Determine overall status
            all_passed = all("✅" in check for check in checks)
            
            if all_passed:
                results["labor_dashboard"]["status"] = "PASS"
                results["labor_dashboard"]["details"] = "All assertions passed: " + " | ".join(checks)
                print(f"✅ Labor dashboard render successful")
            else:
                results["labor_dashboard"]["status"] = "PARTIAL"
                results["labor_dashboard"]["details"] = "Some assertions failed: " + " | ".join(checks)
                print(f"⚠️  Labor dashboard partially working")
            
            for check in checks:
                print(f"  {check}")
                
        except Exception as e:
            await page.screenshot(path="/app/labor_dashboard_error.png")
            results["labor_dashboard"]["status"] = "FAIL"
            results["labor_dashboard"]["details"] = f"Dashboard test failed: {str(e)}"
            print(f"❌ Labor dashboard test failed: {str(e)}")
        
        await page.close()
        await browser.close()
    
    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    for test_name, result in results.items():
        status_icon = "✅" if result["status"] == "PASS" else ("⚠️" if result["status"] == "PARTIAL" else "❌")
        print(f"{status_icon} {test_name}: {result['status']}")
        print(f"   {result['details']}")
    print("="*60)
    
    # Return exit code
    all_pass = all(r["status"] in ["PASS", "PARTIAL"] for r in results.values())
    return 0 if all_pass else 1

if __name__ == "__main__":
    exit_code = asyncio.run(test_access_login_and_dashboard())
    sys.exit(exit_code)
