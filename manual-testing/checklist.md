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
- [ ] Test page open: `file:///Users/ricardocunha/dev/web3/waillet-mono/extension/test-dapp.html`

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

### Test 10.3: Read-Only Methods (Without Approval)
After connecting, test read-only methods:

1. Click "Get Accounts"

**Expected:**
- [ ] Shows connected account address
- [ ] No approval modal appears
- [ ] Returns immediately

2. Click "Get Chain ID"

**Expected:**
- [ ] Shows current network chain ID (e.g., `0xaa36a7` for Sepolia)
- [ ] No approval modal appears

3. Click "Get Balance"

**Expected:**
- [ ] Shows wallet balance in ETH
- [ ] Works without additional approval
- [ ] Returns within 2 seconds

**Verify Console:**
- [ ] No errors in page console
- [ ] Methods work seamlessly without popup

### Test 10.4: Transaction Interception
1. Click "Send Transaction" on test page

**Expected:**
- [ ] Extension popup opens
- [ ] "Analyzing Transaction Security" message appears
- [ ] Spinner is visible and smooth
- [ ] Modal appears within 3 seconds

---

## Test 10A: Real dApp Testing - Uniswap ❌ MANUAL ONLY

### Prerequisites:
- [ ] Wallet unlocked with Sepolia testnet selected
- [ ] Some Sepolia ETH in wallet for gas

### Test 10A.1: Uniswap Connection
1. Navigate to https://app.uniswap.org/
2. Click "Connect Wallet" on Uniswap
3. Select Waillet from wallet options (if shown) or wait for detection

**Expected:**
- [ ] Waillet extension popup opens
- [ ] ConnectionApprovalModal displays
- [ ] Shows "app.uniswap.org" as requesting site
- [ ] Privacy warnings are clear

4. Click "Approve"

**Expected:**
- [ ] Connection succeeds within 2 seconds
- [ ] Uniswap shows "Connected" status
- [ ] Wallet address displayed on Uniswap UI
- [ ] No errors in console

### Test 10A.2: Uniswap Network Compatibility
**Verify:**
- [ ] Network displayed matches Waillet's current network
- [ ] Can see token balances (if any)
- [ ] Uniswap interface responds to Waillet properly

### Test 10A.3: Uniswap Swap Attempt (Don't Complete)
1. Select tokens for swap (e.g., ETH → USDC)
2. Enter small amount (e.g., 0.001 ETH)
3. Click "Swap" button

**Expected:**
- [ ] Waillet should intercept the transaction
- [ ] DAppTransactionModal appears
- [ ] Shows transaction details (to, value, data)
- [ ] Shows contract interaction badge
- [ ] Transaction origin is "app.uniswap.org"

**Do NOT complete the transaction** (just verify interception works)

---

## Test 10B: Real dApp Testing - OpenSea ❌ MANUAL ONLY

### Prerequisites:
- [ ] Wallet unlocked
- [ ] Sepolia testnet selected

### Test 10B.1: OpenSea Connection
1. Navigate to https://testnets.opensea.io/
2. Click "Connect Wallet" or profile icon
3. Connect with Waillet

**Expected:**
- [ ] Waillet extension popup opens
- [ ] ConnectionApprovalModal appears
- [ ] Shows "testnets.opensea.io" as origin
- [ ] Connection succeeds

### Test 10B.2: OpenSea Signature Request
1. Try to make an offer on any NFT OR try to list an NFT (if you have one)
2. OpenSea will request a signature for authentication

**Expected:**
- [ ] Waillet intercepts signature request
- [ ] SignatureApprovalModal appears (if implemented)
- [ ] OR shows appropriate modal for eth_sign/personal_sign
- [ ] User can approve or reject

**Verify:**
- [ ] Signature methods work (eth_signTypedData_v4, personal_sign)
- [ ] No crashes or hanging states
- [ ] Response is sent back to OpenSea correctly

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

## Test 14A: Transaction Simulation Testing ❌ MANUAL ONLY

**Note**: Tests the transaction simulation feature that previews transaction outcomes before execution.

### Prerequisites:
- [ ] Backend server running on port 8000
- [ ] Wallet unlocked
- [ ] Some Sepolia ETH in wallet

### Test 14A.1: Successful ETH Transfer Simulation
**Steps:**
1. Open Waillet extension
2. Navigate to "Send Transaction" (via AI Agent tab or Send button)
3. Enter transaction details:
   - **To:** `0x0000000000000000000000000000000000000001`
   - **Amount:** `0.001 ETH`
   - **Network:** Sepolia
4. Click "Simulate Transaction" button (if visible)

**Expected:**
- [ ] "Simulating..." status appears
- [ ] Simulation completes in < 2 seconds
- [ ] ✅ Green success box displayed
- [ ] Shows balance changes:
  - [ ] Sender: `-0.001 ETH` (minus amount)
  - [ ] Receiver: `+0.001 ETH` (plus amount)
- [ ] Gas estimate displayed (~21,000 for simple transfer)
- [ ] Can proceed to confirm transaction after simulation

### Test 14A.2: Insufficient Balance Scenario
**Steps:**
1. Try to send more ETH than available in wallet
2. Example: Send `100 ETH` to any address
3. Click "Simulate Transaction"

**Expected:**
- [ ] ❌ Red error box appears
- [ ] Error message: "Insufficient balance for transaction"
- [ ] Gas estimate shows 0 or N/A
- [ ] Cannot proceed with transaction
- [ ] UI clearly indicates why transaction will fail

### Test 14A.3: Invalid Address Handling
**Steps:**
1. Enter invalid recipient address: `0xInvalidAddress` or `not-an-address`
2. Click "Simulate Transaction"

**Expected:**
- [ ] ❌ Error displayed (HTTP 400 or validation error)
- [ ] Error message: "Invalid address format" or similar
- [ ] Simulation does not proceed
- [ ] User is informed before wasting gas

### Test 14A.4: ERC-20 Token Transfer Simulation (If Configured)
**Steps:**
1. Select USDC or USDT token (if available on Sepolia)
2. Enter valid amount and recipient
3. Click "Simulate Transaction"

**Expected:**
- [ ] ✅ Success if token contract is configured
- [ ] Shows Transfer event in simulation results
- [ ] Balance changes show token symbol (not ETH)
- [ ] Gas estimate for ERC-20 transfer (~50,000-65,000)
- [ ] Token decimals handled correctly (6 for USDC/USDT, 18 for others)

### Test 14A.5: Multiple Simulations
**Steps:**
1. Simulate a transaction
2. Don't confirm, just change amount
3. Simulate again
4. Repeat 2-3 times

**Expected:**
- [ ] Each simulation works independently
- [ ] No errors or hanging states
- [ ] Results update correctly each time
- [ ] Extension remains responsive
- [ ] No memory leaks (check DevTools performance)

---

## Test 14B: Backend Simulation API (Alternative Testing) ✅ CAN BE AUTOMATED

**Note**: Direct API testing via curl as alternative to UI testing.

### Test 14B.1: Curl Test - Successful Simulation
```bash
curl -X POST http://localhost:8000/api/simulate/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to": "0x0000000000000000000000000000000000000001",
    "value": "0x16345785d8a0000",
    "chain": "sepolia"
  }' | python3 -m json.tool
```

**Expected Response:**
- [ ] `"success": true`
- [ ] `"balance_changes": [...]` array with sender and receiver
- [ ] `"gas_used": 21000` (or similar)
- [ ] Response in < 2 seconds

### Test 14B.2: Curl Test - Insufficient Balance
```bash
curl -X POST http://localhost:8000/api/simulate/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to": "0x0000000000000000000000000000000000000001",
    "value": "0x56BC75E2D63100000",
    "chain": "sepolia"
  }' | python3 -m json.tool
```

**Expected Response:**
- [ ] `"success": false`
- [ ] Error message about insufficient balance
- [ ] `"gas_used": 0` or not present

### Test 14B.3: Backend Performance Check
**Run multiple simulations and measure:**
- [ ] Average response time < 2 seconds
- [ ] No 504 Gateway Timeout errors (if using public RPC)
- [ ] No 500 Internal Server errors
- [ ] Backend logs show no exceptions

**Troubleshooting Note:**
If you get 504 timeouts, configure Alchemy API key in `/backend/.env`:
```
ALCHEMY_API_KEY=your_alchemy_key_here
```

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
- [ ] Favorites management works (save, use in transactions)
- [ ] AI agent recognizes and uses saved favorites
- [ ] Performance feels snappy
- [ ] Ready to demo to non-technical users

---

## Test 18: Console & Debugging Verification ❌ MANUAL ONLY

**Note**: Verify proper logging and error messages for debugging.

### Test 18.1: Background Script Console
1. Open background script console:
   - Right-click extension icon → "Inspect background page"
   - OR `chrome://extensions/` → Waillet → "service worker" link

**Expected Logs (When dApp Connects):**
- [ ] `[Waillet] dApp request: eth_requestAccounts from https://app.uniswap.org`
- [ ] `[Waillet] Connection request from https://app.uniswap.org (ID: X)`
- [ ] Request/response flow is clear and traceable
- [ ] No unexpected errors or warnings

### Test 18.2: Page Console (dApp)
1. Open test page or real dApp
2. Open DevTools Console (F12)

**Expected Logs (On Load):**
- [ ] `[Waillet] Provider injected successfully`
- [ ] `[Waillet Content] Inpage script injected successfully`
- [ ] `[Waillet Content] Content script loaded for: <origin>`
- [ ] No red errors related to Waillet

### Test 18.3: Extension Popup Console
1. Right-click extension popup → "Inspect"
2. Check console while using wallet features

**Expected:**
- [ ] Clean console with minimal noise
- [ ] Errors are helpful if they occur
- [ ] No sensitive data (private keys, passwords) in logs
- [ ] Component lifecycle logs are reasonable

### Test 18.4: Network Tab Verification
1. Open DevTools → Network tab
2. Perform wallet operations and dApp interactions

**Expected:**
- [ ] Read-only RPC calls go to `http://localhost:8000/api/rpc/proxy`
- [ ] Risk analysis calls go to backend API
- [ ] No unexpected third-party requests
- [ ] No leaking of private data in request headers

---

## Test 19: Troubleshooting Common Issues ❌ MANUAL ONLY

### Test 19.1: Provider Not Detected
**Simulate:**
- Disable extension, reload page, re-enable extension

**Verify Recovery:**
- [ ] Refreshing page (Ctrl/Cmd + R) makes provider available
- [ ] Console shows clear error when provider missing
- [ ] Instructions/error message guide user to solution

### Test 19.2: Extension Popup Doesn't Open
**Simulate:**
- Try to connect while wallet is locked
- Try with no internet connection

**Verify:**
- [ ] Clear error message shown to user
- [ ] Background console shows reason for failure
- [ ] User is guided on how to fix (unlock wallet, check connection)

### Test 19.3: Connection Persistence After Refresh
**Steps:**
1. Connect to a dApp and approve
2. Refresh the page
3. Check if connection persists

**Verify:**
- [ ] dApp automatically reconnects (no approval modal)
- [ ] Connected sites are persisted in storage
- [ ] Can check storage: `chrome.storage.local.get('connectedSites', console.log)`

### Test 19.4: Content Script Not Injecting
**Simulate:**
- Visit a page where content script should load
- Check console for injection message

**Verify:**
- [ ] Console shows: `[Waillet Content] Content script loaded for: <origin>`
- [ ] If missing, manifest.json `content_scripts` config is correct
- [ ] Script injected on all URLs (`<all_urls>` in manifest)

### Test 19.5: Backend Connectivity Issues
**Simulate:**
- Stop backend server
- Try to send transaction or use features requiring backend

**Verify:**
- [ ] Clear error message: "Cannot connect to backend" or similar
- [ ] User is not left in broken state
- [ ] Can retry after backend restarts
- [ ] Helpful instructions provided (check if server is running)

---

## Test 20: Favorites Management ❌ MANUAL ONLY

**Note**: Tests the save, view, and use of favorite addresses feature.

### Prerequisites:
- [ ] Backend server running on port 8000
- [ ] Wallet unlocked
- [ ] Extension loaded and working

### Test 20.1: Manual Save Favorite (Dashboard Button)

**Steps:**
1. Open extension and go to Dashboard
2. Click "Favorite" button (next to "Send")
3. Fill in the form:
   - **Alias:** `johndoe`
   - **Address:** `0xAeDaa5Ade496A54b1A4afE6eb96B3030ea6Df4fE`
   - **Network:** Select `Sepolia`
   - **Asset:** `ETH` (optional)
4. Click "Save Favorite"

**Expected:**
- [ ] All form fields are clearly labeled
- [ ] Validation works (invalid address shows error)
- [ ] Success checkmark animation appears
- [ ] Success message: "Favorite Saved! You can now use 'johndoe' as a shortcut"
- [ ] Modal closes after 1.5 seconds
- [ ] No console errors

**Verify Backend:**
```bash
curl http://localhost:8000/api/favorites/YOUR_WALLET_ADDRESS | python3 -m json.tool
```
- [ ] Favorite appears in response with correct data
- [ ] `alias`, `address`, `chain`, `asset` fields are correct
- [ ] `created_at` and `updated_at` timestamps present

### Test 20.2: AI Agent Save Favorite (Natural Language)

**Steps:**
1. Click "AI Agent" tab
2. Type: `save favorite alice 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb ETH`
3. Wait for AI to parse

**Expected AI Response:**
- [ ] Shows: "Got it! I'll help you save this favorite."
- [ ] Preview displays:
  - Alias: **alice**
  - Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  - Token: ETH
  - Network: (detected automatically)
- [ ] "Save Favorite" button appears below preview
- [ ] Confidence score shown

**Execute Save:**
4. Click "Save Favorite" button

**Expected:**
- [ ] SaveFavoriteModal opens pre-filled with AI-parsed data
- [ ] All fields editable (user can change before saving)
- [ ] Can add/change optional asset field
- [ ] Click "Save Favorite" → Success message
- [ ] AI Agent shows: "✅ Favorite saved successfully! You can now use it in transactions."

### Test 20.3: Various AI Save Favorite Commands

**Test different command formats:**

1. **Command:** `save favorite binance 0x123...abc on ethereum`
   - [ ] Parses correctly with ethereum chain

2. **Command:** `add favorite ricardo.eth USDC`
   - [ ] Accepts ENS name
   - [ ] Sets USDC as asset

3. **Command:** `store address johndoe 0x456...def sepolia`
   - [ ] Recognizes alternative phrasing ("store address")
   - [ ] Sets sepolia network

**Verify Each:**
- [ ] AI correctly extracts alias, address, token, chain
- [ ] Modal opens with correct pre-filled data
- [ ] Can save successfully

### Test 20.4: Duplicate Alias Handling

**Steps:**
1. Try to save a favorite with an alias that already exists (e.g., `johndoe`)
2. Use either Dashboard or AI Agent

**Expected:**
- [ ] Backend returns 400 error
- [ ] Error message shown: "Alias 'johndoe' already exists for this wallet"
- [ ] User stays on modal (can edit alias)
- [ ] Clear guidance to use different alias

### Test 20.5: Invalid Address Validation

**Steps:**
1. Click "Favorite" button on Dashboard
2. Enter:
   - Alias: `test`
   - Address: `not-a-valid-address`
3. Click "Save Favorite"

**Expected:**
- [ ] Error shown: "Invalid Ethereum address format"
- [ ] Cannot save until valid address provided
- [ ] ENS names (*.eth) are accepted and validated

### Test 20.6: Using Favorites in Transactions (AI Agent)

**Prerequisites:**
- [ ] At least one favorite saved (e.g., `johndoe`)

**Steps:**
1. Go to AI Agent tab
2. Type: `send 0.001 ETH to johndoe`
3. Wait for AI to parse

**Expected:**
- [ ] AI recognizes `johndoe` as a saved favorite
- [ ] Shows: "I understand! You want to send **0.001 ETH** to 0xAeD...f4fE (johndoe) on sepolia"
- [ ] `resolved_from` field shows: "johndoe"
- [ ] Transaction preview shows favorite alias
- [ ] "Send Transaction" button appears

**Execute Transaction:**
4. Click "Send Transaction"

**Expected:**
- [ ] TransactionConfirmModal opens
- [ ] Shows resolved address (not alias)
- [ ] Shows "From Favorite: johndoe" somewhere in UI
- [ ] Can proceed to send transaction normally

### Test 20.7: Favorites List Display (Backend API)

**Verify via API:**
```bash
curl http://localhost:8000/api/favorites/YOUR_WALLET_ADDRESS | python3 -m json.tool
```

**Expected:**
- [ ] Returns array of all saved favorites
- [ ] Each favorite has: `id`, `alias`, `address`, `chain`, `asset`, `type`, `created_at`, `updated_at`
- [ ] Response time < 500ms
- [ ] No sensitive data leaked

### Test 20.8: Empty Favorites State

**Steps:**
1. Use a fresh wallet with no favorites saved
2. Try: `send ETH to alice` (non-existent favorite)

**Expected:**
- [ ] AI returns error or "unknown" action
- [ ] Clear message: "I don't recognize 'alice'. Save it as a favorite first or use a full address."
- [ ] Helpful suggestion to save favorite

### Test 20.9: Backend Favorites Context in AI

**Verify AI receives favorites:**
1. Save 2-3 favorites with different aliases
2. In AI Agent, type: `send ETH to <alias>`

**Expected:**
- [ ] AI resolves alias to correct address from saved favorites
- [ ] Works for all saved aliases
- [ ] AI prompt includes favorites list in context (verify in backend logs)

### Test 20.10: Edge Cases & Error Handling

**Test Case A: Very Long Alias**
- Alias: `thisIsAVeryLongAliasThatExceeds100Characters...` (101+ chars)
- [ ] Backend rejects with validation error (max 100 chars)
- [ ] Clear error message shown

**Test Case B: Special Characters in Alias**
- Alias: `john@doe!#$%`
- [ ] Allowed and saved (if backend permits) OR
- [ ] Rejected with clear validation message

**Test Case C: ENS Name as Favorite**
- Address: `vitalik.eth`
- [ ] Accepted and saved
- [ ] Later usage resolves ENS name correctly

**Test Case D: Backend Offline**
- Stop backend server
- Try to save favorite
- [ ] Clear error: "Cannot connect to backend"
- [ ] User not left in broken state
- [ ] Can retry after backend restarts

### Test 20.11: UI/UX Polish

**SaveFavoriteModal Design:**
- [ ] Modal size fits in extension (360px width)
- [ ] Purple theme consistent with rest of app
- [ ] Form labels clear and aligned
- [ ] Required fields marked with asterisk (*)
- [ ] Optional field clearly labeled
- [ ] Success animation smooth and satisfying
- [ ] Cancel button works and closes cleanly

**Button Layout (Dashboard):**
- [ ] "Send" and "Favorite" buttons side by side
- [ ] Equal width, good spacing
- [ ] Icons clear (Send arrow, Star icon)
- [ ] Hover effects smooth
- [ ] Accessible and clickable

**AI Agent Integration:**
- [ ] Preview box shows favorite details clearly
- [ ] Font sizes readable
- [ ] Button hierarchy clear (primary action prominent)
- [ ] Error messages in red, success in green
- [ ] Confidence score displayed appropriately

### Test 20.12: Performance

**Benchmarks:**
- [ ] Save favorite: < 1 second
- [ ] Load favorites (API call): < 500ms
- [ ] AI parse favorite command: < 3 seconds
- [ ] No lag when opening SaveFavoriteModal
- [ ] Extension remains responsive after multiple saves

---

## Known Issues / Notes

### ChainAbuse API
- Returns 302 (redirect) instead of 200 - normal behavior

### Test Automation
- Backend API tests: Fully automated
- Extension unit tests: Partially automated (some require full context)
- E2E browser tests: Not implemented (complex setup, manual testing sufficient for now)

