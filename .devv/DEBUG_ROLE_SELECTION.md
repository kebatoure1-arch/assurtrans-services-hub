# 🔍 Debug: Role Selection Dialog Not Appearing

## Problem
After successful OTP verification, the `RoleSelectionDialog` with 6 role options does not appear for new users.

## Solution Applied

### 1. Enhanced Logging
Added comprehensive console logs to track the entire flow:

**In LoginPage.tsx (handleVerifyOTP):**
```typescript
console.log('🔍 Checking profile for UID:', uid);
console.log('📋 Profile exists:', profileExists);
console.log('🆕 New user detected - showing role selection');
console.log('👤 Existing user - redirecting to dashboard');
```

**In profile-creation-service.ts (checkProfileExists):**
```typescript
console.log('🔎 Checking profile for UID:', uid);
console.log('📊 Using table ID:', USERS_TABLE_ID);
console.log('📦 Query response:', response);
console.log('📋 Items found:', response.items?.length || 0);
console.log('✅ Profile exists:', exists);
```

### 2. Added Small Delay
Added 500ms delay after OTP verification to ensure auth state is fully updated:
```typescript
await new Promise(resolve => setTimeout(resolve, 500));
```

### 3. Improved Error Handling
- All errors are logged to console with emoji prefixes for easy tracking
- Query failures default to "profile doesn't exist" (shows role selection for new users)

## How to Test

### Test 1: New User Flow
1. Open browser console (F12 → Console tab)
2. Navigate to login page
3. Enter a **NEW** email address (never used before)
4. Click "Recevoir le code"
5. Check your email for OTP code
6. Enter the 6-digit code
7. Click "Se connecter"

**Expected Console Output:**
```
✅ Code vérifié !
🔍 Checking profile for UID: xxx...
🔎 Checking profile for UID: xxx...
📊 Using table ID: f4eyoj5l0wzk
📦 Query response: { items: [] }
📋 Items found: 0
✅ Profile exists: false
📋 Profile exists: false
🆕 New user detected - showing role selection
```

**Expected UI:**
- ✅ Beautiful dialog appears with title "Bienvenue sur Assur'Trans !"
- ✅ 6 role options displayed with icons and descriptions
- ✅ Radio buttons for selection
- ✅ "Continuer" button at bottom
- ✅ No close button (dialog is non-closable)

### Test 2: Existing User Flow
1. Use an email that has already been registered
2. Complete OTP verification
3. Should redirect directly to dashboard (no role selection)

**Expected Console Output:**
```
✅ Code vérifié !
🔍 Checking profile for UID: xxx...
📋 Profile exists: true
👤 Existing user - redirecting to dashboard
```

## Troubleshooting

### Issue 1: Dialog Never Appears
**Symptoms:**
- Console shows "🆕 New user detected"
- But dialog doesn't render

**Solution:**
Check React state in console:
```javascript
// Check if showRoleSelection is true
console.log(showRoleSelection); // Should be true
```

**Possible Causes:**
- Z-index issue (dialog might be behind overlay)
- Dialog component not rendering
- CSS issue hiding the dialog

**Fix:**
Inspect the DOM for dialog element:
```javascript
document.querySelector('[role="dialog"]');
```

### Issue 2: Profile Check Always Returns True
**Symptoms:**
- Console shows "✅ Profile exists: true" for new emails
- Always redirects to dashboard

**Solution:**
Check table query manually:
```javascript
// In browser console after login
const { table } = await import('@devvai/devv-code-backend');
const uid = 'YOUR_UID_HERE';
const response = await table.getItems('f4eyoj5l0wzk', {
  query: { _uid: uid },
  limit: 1
});
console.log('Manual query:', response);
```

### Issue 3: Auth State Not Updated
**Symptoms:**
- Error: "User ID not found"
- Console shows undefined UID

**Solution:**
Check auth storage:
```javascript
const authStorage = localStorage.getItem('auth-storage');
const parsed = JSON.parse(authStorage);
console.log('Auth state:', parsed?.state?.user);
```

## Quick Fixes

### If Dialog Doesn't Show
1. Clear browser cache and localStorage
2. Try in incognito/private window
3. Check browser console for errors
4. Verify network tab shows successful API calls

### If Always Shows "Profile Exists"
1. Check if you're using a previously registered email
2. Try a completely new email address
3. Verify table ID is correct: `f4eyoj5l0wzk`

### If OTP Fails
1. Check email spam folder
2. Wait 30 seconds and try "Renvoyer le code"
3. Verify email address is correctly typed

## Technical Implementation

### Component Flow
```
LoginPage
  ├── Email input → Send OTP
  ├── OTP input → Verify OTP
  ├── Check profile exists
  │   ├── YES → Navigate to /dashboard
  │   └── NO → Show RoleSelectionDialog
  └── RoleSelectionDialog
      ├── Select role (6 options)
      ├── Create profile (users + user_profiles tables)
      ├── Create wallet (if not admin)
      ├── Create loyalty points (if driver)
      └── Navigate to /dashboard
```

### State Management
- `step`: 'email' | 'otp' - Current login step
- `showRoleSelection`: boolean - Controls dialog visibility
- `isNewUser`: boolean - Tracks if user is new
- `email`: string - User's email address
- `otp`: string - OTP code entered

### Database Tables Used
- `users` (f4eyoj5l0wzk) - Main user accounts
- `user_profiles` (f4eyoj561clc) - Extended profiles
- `wallets` (f4f186q7i03k) - Prepaid balances
- `loyalty_points` (f4fb4hcl1vvk) - Driver loyalty points

## Success Criteria

✅ **New User:**
1. Enter new email → Receive OTP
2. Enter OTP code → See "Vérification du profil..." toast
3. Dialog appears with 6 role options
4. Select role → See "Profil créé avec succès !" toast
5. Redirected to role-specific dashboard

✅ **Existing User:**
1. Enter existing email → Receive OTP
2. Enter OTP code → See "Connexion réussie !" toast
3. Immediately redirected to dashboard (no dialog)

## Contact Support
If issue persists after following this guide:
1. Share browser console logs
2. Share network tab (API calls)
3. Confirm email address used for testing
4. Confirm browser and version
