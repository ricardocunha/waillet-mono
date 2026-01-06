# Manual Testing Checklist

## Test Environment Setup
- [ ] Chrome browser installed
- [ ] Extension built (`npm run build`)
- [ ] Extension loaded in Chrome (`chrome://extensions/`)

---

## Test 1: Create New Wallet

### Steps:
1. Click the Waillet extension icon
2. Click "Create New Wallet"
3. Enter password: `TestPassword123`
4. Confirm password: `TestPassword123`
5. Click "Create Wallet"

### Expected Results:
- [ ] Recovery phrase screen appears
- [ ] Recovery phrase has 12 words
- [ ] Each word is numbered (1-12)
- [ ] Warning message about saving phrase is visible
- [ ] "I've Saved It" button is present

### Steps (continued):
6. **Write down the recovery phrase on paper**
7. Click "I've Saved It"

### Expected Results:
- [ ] Dashboard appears
- [ ] Wallet address is displayed (0x...)
- [ ] Balance shows $0.00
- [ ] "Send" and "Receive" buttons are visible
- [ ] Address can be copied by clicking the copy icon

---

## Test 2: Lock and Unlock Wallet

### Steps:
1. Close the extension popup (click outside)
2. Click the extension icon again

### Expected Results:
- [ ] Unlock screen appears
- [ ] "Welcome Back" message is shown
- [ ] Password input field is present

### Steps (continued):
3. Enter wrong password: `WrongPassword`
4. Click "Unlock Wallet"

### Expected Results:
- [ ] Error message appears: "Wrong password. Please try again."
- [ ] Wallet remains locked

### Steps (continued):
5. Enter correct password: `TestPassword123`
6. Click "Unlock Wallet"

### Expected Results:
- [ ] Dashboard appears
- [ ] Same wallet address as before
- [ ] No errors

---

## Test 3: Import Existing Wallet

### Steps:
1. Remove the extension from Chrome
2. Reload the extension
3. Click extension icon
4. Click "Import Existing Wallet"
5. Enter the recovery phrase you saved earlier
6. Enter password: `NewPassword456`
7. Click "Import Wallet"

### Expected Results:
- [ ] Dashboard appears
- [ ] **Same wallet address** as the created wallet
- [ ] No errors

---

## Test 4: Password Validation

### Setup:
- Remove extension and reload it
- Click "Create New Wallet"

### Test 4.1: Short Password
**Steps:**
1. Enter password: `short`
2. Confirm password: `short`
3. Click "Create Wallet"

**Expected:**
- [ ] Error: "Password must be at least 8 characters"

### Test 4.2: Mismatched Passwords
**Steps:**
1. Enter password: `Password123`
2. Confirm password: `Password456`
3. Click "Create Wallet"

**Expected:**
- [ ] Error: "Passwords do not match"

### Test 4.3: Valid Password
**Steps:**
1. Enter password: `ValidPass123`
2. Confirm password: `ValidPass123`
3. Click "Create Wallet"

**Expected:**
- [ ] Recovery phrase screen appears
- [ ] No errors

---

## Test 5: Recovery Phrase Validation

### Setup:
- Remove extension and reload it
- Click "Import Existing Wallet"

### Test 5.1: Empty Recovery Phrase
**Steps:**
1. Leave recovery phrase empty
2. Enter password: `Password123`
3. Click "Import Wallet"

**Expected:**
- [ ] Error: "Please enter your recovery phrase"

### Test 5.2: Invalid Recovery Phrase
**Steps:**
1. Enter: `invalid words that are not valid`
2. Enter password: `Password123`
3. Click "Import Wallet"

**Expected:**
- [ ] Error: "Invalid recovery phrase"

---

## Test 6: UI/UX Tests

### Visual Checks:
- [ ] Purple theme is consistent
- [ ] All buttons are clickable and have hover effects
- [ ] Text is readable (good contrast)
- [ ] Extension size is 360x600px
- [ ] No layout overflow or broken elements
- [ ] Icons display correctly

### Copy Address Feature:
**Steps:**
1. Unlock wallet and go to dashboard
2. Click the copy icon next to your address

**Expected:**
- [ ] Icon changes to checkmark
- [ ] Address is copied to clipboard (paste to verify)
- [ ] Icon returns to copy icon after 2 seconds

---

## Test 7: Storage Persistence

### Steps:
1. Create a wallet with password `TestPass123`
2. Close Chrome completely
3. Reopen Chrome
4. Click the extension icon
5. Enter password and unlock

### Expected Results:
- [ ] Wallet data persists
- [ ] Same address appears
- [ ] No data loss

---

## Test 8: Security Checks

### Manual Code Review:
- [ ] Open browser DevTools → Application → Local Storage
- [ ] Verify wallet data is encrypted (not readable text)
- [ ] Verify no password is stored
- [ ] Verify no plain text mnemonic is stored

### Network Check:
- [ ] Open DevTools → Network tab
- [ ] Create/unlock wallet
- [ ] Verify **no network requests** are made
- [ ] All operations are local-only

---

## Test 9: Native Token Transfers

### Send ETH on Ethereum

**Steps:**
1. [ ] Open extension
2. [ ] Click "AI Agent" tab
3. [ ] Type: `send 0.001 ETH to 0xAeDaa5Ade496A54b1A4afE6eb96B3030ea6Df4fE on sepolia`
4. [ ] AI should parse the intent
5. [ ] Click "Send Transaction" button
6. [ ] Confirmation modal should open

**Verify Confirmation Modal:**
- [ ] Shows correct recipient address
- [ ] Shows correct amount (0.001 ETH)
- [ ] Shows network (Ethereum)
- [ ] Shows gas estimate
- [ ] Shows current balance
- [ ] "Confirm" button is enabled (if balance sufficient)

**Execute Transaction:**
7. [ ] Click "Confirm"
8. [ ] Status should change: Confirming → Sending → Success
9. [ ] Transaction hash should be displayed
10. [ ] Explorer link should be clickable

**Verify on Blockchain:**
11. [ ] Click explorer link
12. [ ] Transaction should show on Etherscan
13. [ ] From address matches your wallet
14. [ ] To address matches input
15. [ ] Amount is correct

---

## Summary Checklist

After completing all tests above:

- [ ] Wallet creation works correctly
- [ ] Password protection works
- [ ] Wallet unlock works
- [ ] Import wallet works
- [ ] Password validation works
- [ ] Recovery phrase validation works
- [ ] UI is functional and polished
- [ ] Data persists after browser restart
- [ ] Encryption is working (data not readable in storage)
- [ ] No security leaks (no network calls, no plain text storage)

---




