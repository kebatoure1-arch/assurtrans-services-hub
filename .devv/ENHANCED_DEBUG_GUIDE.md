# 🔧 Enhanced Debugging Guide - Role Selection Dialog

## 🎯 Problem: Role Selection Dialog Not Appearing After OTP

This guide provides comprehensive debugging steps to diagnose and fix the issue where the RoleSelectionDialog doesn't appear after OTP verification.

---

## ✨ Latest Improvements (Just Applied)

### 1. **Extended Auth State Sync Delay**
- **Changed from**: 500ms delay
- **Changed to**: 1000ms (1 second) delay
- **Why**: Ensures localStorage and React state are fully synchronized before profile check
- **Location**: `LoginPage.tsx` line 76

### 2. **Comprehensive Console Logging**
- **Step-by-step flow tracking** with numbered steps (1-6)
- **Visual separators** for easy log reading (═══)
- **Emoji indicators** for quick identification
- **Detailed data inspection** at each step

### 3. **Enhanced Profile Check Service**
- **Full API response logging** with JSON.stringify
- **Clear NEW USER vs EXISTING USER detection**
- **Error handling** with fallback to "new user" assumption

---

## 🔍 Step-by-Step Testing Instructions

### Test 1: Fresh Login with New Email

1. **Open browser DevTools** (F12 or right-click → Inspect)
2. **Go to Console tab**
3. **Clear console** (to see only new logs)
4. **Navigate to login page**: `/login`
5. **Enter a NEW email** (never used before): `test.new.user@example.com`
6. **Click "Recevoir le code"**
7. **Check your email** for OTP code
8. **Enter the 6-digit code**
9. **Click "Se connecter"**

### Expected Console Output (Step by Step)

```
🔐 Step 1: Starting OTP verification...
✅ Step 2: OTP verified successfully
⏳ Step 3: Waiting for auth state sync (1 second)...
🔍 Step 4: Retrieving user ID from auth storage...
📦 Auth storage content: Found
🆔 User UID extracted: abc123xyz...
👤 User object: {uid: "abc123xyz...", email: "test.new.user@example.com"}
🔍 Step 5: Checking if profile exists for UID: abc123xyz...

═══════════════════════════════════════
🔎 PROFILE CHECK STARTING
═══════════════════════════════════════
📝 UID to check: abc123xyz...
📊 Table ID: f4eyoj5l0wzk
🔍 Query parameters: {_uid: "abc123xyz...", limit: 1}
📦 Raw API response: {"items": []}
📋 Items array: []
📊 Items count: 0
🆕 NO PROFILE FOUND - NEW USER!
💡 User needs to select a role
═══════════════════════════════════════

📊 Step 6: Profile exists result: false
🎉 NEW USER DETECTED! Showing role selection dialog...
🔔 Setting showRoleSelection to TRUE
✨ Role selection dialog should now be visible

🎭 RoleSelectionDialog rendered with: {open: true, selectedRole: "", isLoading: false}
```

### What Should Happen

1. **Toast notification**: "✅ Code vérifié !" → "Vérification du profil..."
2. **After 1 second**: Role Selection Dialog appears
3. **Dialog content**:
   - Beautiful header with Sparkles icon
   - Title: "Bienvenue sur Assur'Trans !"
   - 6 role cards with icons and descriptions
   - "Continuer" button (disabled until role selected)

---

## 🚨 Troubleshooting Scenarios

### Scenario 1: Dialog Still Not Appearing

**Check Console Logs:**

1. **If you see**: `❌ Auth storage not found in localStorage`
   - **Problem**: Auth state not saved properly
   - **Fix**: Check `auth-store.ts` persist configuration
   - **Verify**: `localStorage.getItem('auth-storage')` should have data

2. **If you see**: `❌ UID not found in auth storage`
   - **Problem**: User object missing `uid` property
   - **Fix**: Check `verifyOTP` function in `auth-store.ts`
   - **Verify**: Auth response should include `user.uid`

3. **If you see**: `✅ PROFILE FOUND!` but you're a new user
   - **Problem**: Profile already exists from previous test
   - **Solution**: Use a different email OR delete the profile from database
   - **How to check**: Look at the logged user data

### Scenario 2: Dialog Appears but Closes Immediately

**Check Console Logs:**

1. **Look for**: `🚫 Dialog close prevented (non-closable)`
   - This confirms the dialog is trying to close
2. **Check**: `open` prop in console logs
   - Should remain `true` until role selected
3. **Verify**: No navigation happening prematurely

### Scenario 3: "Continuer" Button Doesn't Work

**Check Console Logs:**

1. **Look for**: `⚠️ No role selected, cannot proceed`
   - You need to select a role first
2. **If you see**: `🚀 Creating profile with role: [role_name]`
   - Profile creation is starting (good!)
3. **If you see**: `❌ Failed to create profile:`
   - Check the error message
   - Verify table IDs are correct

---

## 🎯 Key Variables to Check

### In Browser DevTools Console

```javascript
// Check auth storage
JSON.parse(localStorage.getItem('auth-storage'))

// Check user UID
JSON.parse(localStorage.getItem('auth-storage')).state.user.uid

// Check user email
JSON.parse(localStorage.getItem('auth-storage')).state.user.email
```

### Expected Structure

```json
{
  "state": {
    "user": {
      "uid": "abc123xyz...",
      "email": "user@example.com"
    },
    "isAuthenticated": true,
    "isLoading": false
  },
  "version": 0
}
```

---

## 📊 Database Verification

### Check if Profile Exists (Admin Panel)

1. Go to **Settings** → **Données démo** tab
2. Check **users** table for your UID
3. If entry exists: You're an existing user
4. If no entry: You're a new user (dialog should appear)

### Manual Profile Check Query

```javascript
// In browser console after login
const uid = JSON.parse(localStorage.getItem('auth-storage')).state.user.uid;
console.log('Checking profile for UID:', uid);
```

---

## ✅ Success Checklist

- [ ] Console shows "Step 1" through "Step 6" logs
- [ ] Console shows "🆕 NO PROFILE FOUND - NEW USER!"
- [ ] Console shows "🎉 NEW USER DETECTED! Showing role selection dialog..."
- [ ] Console shows "🎭 RoleSelectionDialog rendered with: {open: true, ...}"
- [ ] Dialog appears on screen with 6 role options
- [ ] Clicking a role card shows check icon
- [ ] "Continuer" button is enabled after selection
- [ ] Profile is created after clicking "Continuer"
- [ ] Redirected to dashboard with proper role

---

## 🆘 Still Having Issues?

### Advanced Debugging Steps

1. **Check React DevTools**:
   - Install React DevTools extension
   - Inspect `<LoginPage>` component
   - Check `showRoleSelection` state (should be `true`)
   - Check `isNewUser` state (should be `true`)

2. **Check Dialog Component**:
   - Inspect `<RoleSelectionDialog>` component
   - Verify `open` prop is `true`
   - Check if component is in DOM tree

3. **Network Tab**:
   - Check if table.getItems API call succeeds
   - Verify response contains `items: []` for new users

4. **Clear Everything and Retry**:
   ```javascript
   // In browser console
   localStorage.clear();
   location.reload();
   ```

5. **Test with Different Browser**:
   - Try in Incognito/Private mode
   - Rules out extension conflicts

---

## 📝 Important Notes

1. **1-second delay is intentional**: Don't worry if there's a brief pause after OTP verification
2. **Console logs are verbose**: This is for debugging - they help track the exact flow
3. **Non-closable dialog**: You MUST select a role to proceed (by design)
4. **Email-based names**: First/last name extracted from email automatically
5. **Automatic wallet creation**: Created automatically for non-admin users
6. **Loyalty points**: Initialized automatically for driver role

---

## 🎉 Expected Result

After successful OTP verification with a **new email**:

1. ✅ Console logs show complete flow
2. ✅ "🆕 NO PROFILE FOUND - NEW USER!" message
3. ✅ Beautiful dialog appears with 6 roles
4. ✅ User selects role → Profile created
5. ✅ Redirected to role-specific dashboard
6. ✅ No "Utilisateur non trouvé" error
7. ✅ User can access all features immediately

---

**Need more help?** Check the detailed logs in your console and compare them to the expected output above. Every step is logged with clear indicators!
