# 🧪 How to Test Role Selection Dialog

## Quick Test (2 minutes)

### Step 1: Open Browser Console
- Press **F12** on your keyboard
- Click on **Console** tab
- Keep it open during testing

### Step 2: Go to Login Page
Navigate to: `http://localhost:5173/login` (or your app URL)

### Step 3: Enter a NEW Email
**Important:** Use an email you've NEVER used before on this app.

Examples:
- `test.user123@example.com`
- `new.driver@test.com`
- `my.unique.email@mail.com`

Click **"Recevoir le code"**

### Step 4: Check Email
- Open your email inbox
- Find the OTP code (6 digits)
- Copy the code

### Step 5: Enter OTP Code
- Paste or type the 6-digit code
- Click **"Se connecter"**

### Step 6: Watch Console Logs
You should see these logs in order:
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

### Step 7: Dialog Should Appear
You should now see:
- ✅ Beautiful dialog with "Bienvenue sur Assur'Trans !" title
- ✅ 6 role options with icons:
  1. 👑 Administrateur (purple)
  2. 👥 Agent (blue)
  3. 🏢 Pétrolier (emerald)
  4. 🏪 Station-service (orange)
  5. 🚛 Chef de flotte (indigo)
  6. 👤 Chauffeur (teal)
- ✅ Radio buttons to select a role
- ✅ "Continuer" button at the bottom
- ✅ No close button (dialog is non-closable)

### Step 8: Select a Role
- Click on any role card
- The card should highlight with primary color
- ✅ Check badge appears next to role name
- "Continuer" button becomes enabled

### Step 9: Click "Continuer"
- Click the "Continuer" button
- Console should show:
```
✅ User profile created in users table
✅ User profile created in user_profiles table
✅ Wallet created for user (if not admin)
✅ Loyalty points created for driver (if driver role)
```
- Toast notification: "✨ Profil créé avec succès !"
- Automatically redirects to dashboard

## If Dialog Doesn't Appear

### Check 1: Console Logs
Look for errors in console. Common issues:
- ❌ "Auth data not found" → Clear cache and try again
- ❌ "User ID not found" → Wait 5 seconds and retry
- ❌ Network error → Check internet connection

### Check 2: Profile Already Exists
If console shows:
```
✅ Profile exists: true
👤 Existing user - redirecting to dashboard
```

This means the email was already used. Solutions:
- Try a completely different email
- Or check if you can access your profile in the dashboard

### Check 3: Clear Browser Cache
1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Clear site data**
4. Refresh page and try again

### Check 4: Incognito Mode
Test in private/incognito window to rule out cache issues:
- Chrome: Ctrl + Shift + N
- Firefox: Ctrl + Shift + P
- Edge: Ctrl + Shift + N

## Expected vs Actual Behavior

### ✅ Expected (NEW user):
```
Email → OTP → Dialog with 6 roles → Select role → Dashboard
```

### ✅ Expected (EXISTING user):
```
Email → OTP → Directly to Dashboard (no dialog)
```

### ❌ Unexpected:
```
Email → OTP → Error message or stuck loading
```

If you see unexpected behavior:
1. Check console logs
2. Share screenshots
3. Follow DEBUG_ROLE_SELECTION.md guide

## Test Multiple Roles

Want to test different role dashboards?

### Method 1: Use Different Emails
```
admin@test.com → Select "Administrateur"
agent@test.com → Select "Agent"
station@test.com → Select "Station-service"
driver@test.com → Select "Chauffeur"
```

### Method 2: Use Seed Data
1. Login as admin
2. Go to Settings
3. Click "Données démo" tab
4. Click "Générer les données"
5. Now you have:
   - admin@assurtrans.com
   - agent@assurtrans.com
   - petrolier@assurtrans.com
   - station@assurtrans.com
   - fleet@assurtrans.com
   - driver@assurtrans.com

## Success Checklist

After completing the test, you should have:
- ✅ Seen the role selection dialog
- ✅ Selected a role successfully
- ✅ Received "Profil créé" confirmation
- ✅ Been redirected to dashboard
- ✅ Dashboard shows your selected role
- ✅ "Mon Profil" works (no "Utilisateur non trouvé" error)

## Need Help?

If dialog still doesn't appear after following this guide:
1. Read **DEBUG_ROLE_SELECTION.md** for detailed troubleshooting
2. Check **TEST_LOGIN_FLOW.md** for all test scenarios
3. Share console logs and screenshots for support

## Pro Tips

### Tip 1: Use Email with Name Pattern
Email like `jean.dupont@test.com` will auto-create:
- First Name: Jean
- Last Name: Dupont

### Tip 2: Test in Multiple Browsers
Try Chrome, Firefox, and Edge to ensure compatibility

### Tip 3: Use Real Email
If using a real email, you'll get actual OTP codes (more reliable than test emails)

### Tip 4: Don't Close Console
Keep console open during entire test to catch all logs

---

**Happy Testing! 🎉**
