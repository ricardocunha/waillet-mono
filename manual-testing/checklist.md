# Manual Testing Checklist

## Test Environment Setup
- [ ] Chrome browser installed
- [ ] Extension built (`npm run build`)
- [ ] Extension loaded in Chrome (`chrome://extensions/`)
- [ ] Backend server running: `cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

---

## Test 1-5, 7: Wallet Operations ⚠️ PARTIALLY AUTOMATED

**Note**: Basic functionality is covered by unit tests in `/extension/testing/`. Manual testing recommended for visual verification and edge cases.

### Manual Test: Create Wallet Flow

**Steps:**
1. Open extension
2. Click "Create New Wallet"
3. Enter password: `TestPassword123`
4. Click "Create Wallet"
5. Verify recovery phrase screen (12 words)
6. Click "I've Saved It"

**Verify**:
- [ ] UI looks professional
- [ ] Recovery phrase is clearly visible
- [ ] Warning messages are prominent
- [ ] Transitions are smooth

### Manual Test: Lock/Unlock

**Steps:**
1. Close and reopen extension
2. Enter wrong password → Should show error
3. Enter correct password → Should unlock

**Verify**:
- [ ] Error messages are clear
- [ ] Unlock animation is smooth

---

## Test 6: UI/UX Visual Checks ❌ MANUAL ONLY

### Visual Quality:
- [ ] Purple theme is consistent throughout
- [ ] All buttons have proper hover effects
- [ ] Text is readable with good contrast
- [ ] Extension size is 360x600px
- [ ] No layout overflow or broken elements
- [ ] Icons display correctly and are sharp
- [ ] Font sizes are appropriate
- [ ] Spacing and alignment look professional

### Copy Address Feature:
1. Unlock wallet and go to dashboard
2. Click the copy icon next to your address

**Expected:**
- [ ] Icon changes to checkmark smoothly
- [ ] Address is copied to clipboard (paste to verify)
- [ ] Icon returns to copy icon after 2 seconds
- [ ] Animation is smooth

---

## Test 8: Security Checks ❌ MANUAL ONLY

### Network Privacy Check:
1. Open DevTools → Network tab
2. Create/unlock wallet
3. Perform wallet operations

**Expected:**
- [ ] **No network requests** are made for wallet operations
- [ ] All cryptographic operations are local-only
- [ ] Only backend API calls when explicitly triggered (transactions, risk analysis)

---

## Test 9: Native Token Transfers ❌ MANUAL ONLY

### Send ETH on Sepolia

**Steps:**
1. [ ] Open extension
2. [ ] Click "AI Agent" tab
3. [ ] Type: `send 0.001 ETH to 0xAeDaa5Ade496A54b1A4afE6eb96B3030ea6Df4fE on sepolia`
4. [ ] AI should parse the intent correctly
5. [ ] Click "Send Transaction" button
6. [ ] Confirmation modal should open

**Verify Confirmation Modal:**
- [ ] Shows correct recipient address
- [ ] Shows correct amount (0.001 ETH)
- [ ] Shows network (Ethereum)
- [ ] Shows gas estimate
- [ ] Shows current balance
- [ ] UI is clear and professional

**Execute Transaction:**
7. [ ] Click "Confirm"
8. [ ] Status changes smoothly: Confirming → Sending → Success
9. [ ] Transaction hash is displayed
10. [ ] Explorer link is clickable

**Verify on Blockchain:**
11. [ ] Click explorer link
12. [ ] Transaction shows on Etherscan
13. [ ] From address matches your wallet
14. [ ] To address matches input
15. [ ] Amount is correct

---

## Test 10: dApp Interception Flow ❌ MANUAL ONLY

### Prerequisites:
- [ ] Wallet unlocked
- [ ] Test page open: `file:///path/to/test-dapp.html`

### Test 10.1: Provider Detection
1. Click "Detect Provider"

**Expected:**
- [ ] Shows `isWaillet: true` immediately
- [ ] Shows `isMetaMask: false`
- [ ] No console errors

### Test 10.2: Connection Flow
1. Click "Connect Wallet"

**Expected:**
- [ ] Extension popup opens automatically
- [ ] ConnectionApprovalModal appears quickly
- [ ] Shows requesting origin clearly
- [ ] Privacy warnings are visible
- [ ] Buttons are clear and accessible

2. Click "Approve"

**Expected:**
- [ ] Modal closes smoothly
- [ ] Test page shows: "✅ Connected! Account: 0x..."
- [ ] Connection happens within 2 seconds

### Test 10.3: Transaction Interception
1. Click "Send Transaction" on test page

**Expected:**
- [ ] Extension popup opens
- [ ] "Analyzing Transaction Security" message appears
- [ ] Spinner is visible and smooth
- [ ] Modal appears within 3 seconds

---

## Test 11-14: Risk Analysis Visual Verification ❌ MANUAL ONLY

**Note**: Backend risk analysis logic is tested automatically. These tests verify the **user experience**.

### Test 11: LOW Risk Scenario
**Setup:** Send 0 ETH to EOA address

**Verify RiskAnalysisModal:**
- [ ] Risk badge is GREEN with "LOW" text
- [ ] Risk score displayed (5-10/100)
- [ ] AI summary is clear and non-technical
- [ ] Factor shows "✅ Simple Transfer"
- [ ] "Proceed" button is GREEN and prominent
- [ ] No red warning banner
- [ ] Modal layout looks professional
- [ ] All text is readable

### Test 12: MEDIUM Risk Scenario
**Setup:** Send to unverified contract with data

**Expected:**
- [ ] Risk badge is YELLOW with "MEDIUM" text
- [ ] Risk score 20-40/100
- [ ] Shows "🆕 First-Time Contract" factor
- [ ] Shows "❓ Unverified Contract" factor
- [ ] Recommendations are helpful
- [ ] "Proceed" button is YELLOW
- [ ] Warning tone is balanced (not too alarming)

### Test 13: HIGH Risk Scenario
**Setup:** Unlimited approval transaction

**Data for testing**:
```
To: <ERC20_address>
Data: 0x095ea7b3<spender_address_32bytes>ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
```

**Expected:**
- [ ] Risk badge is RED with "HIGH" text
- [ ] **HIGH RISK WARNING BANNER** at top is very visible
- [ ] Shows "⚠️ Unlimited Token Approval"
- [ ] AI summary mentions "blank check" analogy
- [ ] "Set Limited Approval" button visible (yellow)
- [ ] "Proceed" button is GRAY (de-emphasized)
- [ ] "Block" button is RED and prominent
- [ ] User clearly understands the danger

### Test 14: UI/UX Details

**Expand/Collapse:**
1. Click "Why is this X risk?"

**Expected:**
- [ ] Factors expand smoothly with animation
- [ ] Each factor clearly shows title, description, points
- [ ] Icon changes (chevron down → up)
- [ ] Layout doesn't jump or break

**Modal Sizing:**
- [ ] Modal fits perfectly in 360px popup width
- [ ] No horizontal scrollbars
- [ ] All buttons are accessible (not cut off)
- [ ] Text doesn't overflow

**Close Actions:**
- [ ] X button closes and rejects transaction
- [ ] "Block" button rejects with confirmation
- [ ] Both actions are clear in their consequence

---

## Test 15: Backend API Tests ✅ FULLY AUTOMATED

**Run tests:**
```bash
cd backend
uv run python3 tests/run_tests.py
```

**Expected output:**
```
============================================================
Backend API Tests (Test 15 from checklist.md)
============================================================
[TEST] Risk Analysis Endpoint Structure...
✅ PASS - Score=X, Level=Y
[TEST] LOW Risk Scenario...
✅ PASS - Score=X
[TEST] Risk Decision Endpoint...
✅ PASS - Decision recorded for risk_log_id=X
[TEST] Performance (<3s)...
✅ PASS - Completed in X.XXs
[TEST] External API Connectivity...
  CoinGecko: ✅ ETH=$XXXX.XX
  ChainAbuse: ✅ Status 302 (302 is normal)
✅ PASS
============================================================
Results: 5 passed, 0 failed
============================================================
```

**Manual Verification** (if tests fail):
- [ ] Check backend server is running on port 8000
- [ ] Check database connection
- [ ] Check OpenAI API key in `.env`

---

## Test 16-17: End-to-End Experience ❌ MANUAL ONLY

### Complete Transaction Flow:
1. Open test page
2. Connect wallet (approve)
3. Send simple transaction (0 ETH to EOA)
4. Wait for risk analysis
5. Review modal
6. Click "Proceed"
7. Wait for execution

**Overall Experience Check:**
- [ ] No errors or broken states
- [ ] Flow feels fast (<5 seconds total)
- [ ] Each step provides clear feedback
- [ ] User always knows what's happening
- [ ] Success state is satisfying
- [ ] Could explain to non-technical user

### Error Handling:
1. Stop backend server
2. Try to send transaction

**Expected:**
- [ ] Error message is clear and helpful
- [ ] User can still reject transaction
- [ ] No browser crash or broken state
- [ ] Recovery options are clear

### Performance & Feel:
- [ ] Provider injection: Instant (no delay)
- [ ] Connection approval: Opens within 500ms
- [ ] Risk analysis: Completes within 3 seconds
- [ ] Transaction execution: Shows progress clearly
- [ ] No UI freezing during operations
- [ ] Loading animations are smooth (60fps feel)
- [ ] Modal transitions are polished
- [ ] No janky scrolling or layout shifts

### Memory/Stability:
1. Send 5 transactions in a row

**Expected:**
- [ ] Extension remains responsive
- [ ] No slowdown over time
- [ ] DevTools shows no memory leaks
- [ ] All modals close cleanly

---

## Summary Checklist

**Automated Coverage:**
- ✅ Backend API tests passing
- ⚠️ Extension unit tests passing (some skipped)

**Manual Verification Required:**
- [ ] Visual quality & UX polish
- [ ] Real blockchain transactions work
- [ ] dApp integration feels smooth
- [ ] Risk warnings are effective
- [ ] Performance feels snappy
- [ ] Ready to demo to non-technical users

---

## Known Issues / Notes

### ChainAbuse API
- Returns 302 (redirect) instead of 200 - normal behavior

### Test Automation
- Backend API tests: Fully automated
- Extension unit tests: Partially automated (some require full context)
- E2E browser tests: Not implemented (complex setup, manual testing sufficient for now)

---
