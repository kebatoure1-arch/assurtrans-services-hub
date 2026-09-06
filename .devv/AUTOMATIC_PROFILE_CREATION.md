# Automatic Profile Creation - User Guide

## 🎉 What's New?

**You no longer need to manually create profiles after login!**

After entering your OTP code for the first time, the platform will automatically:
1. ✅ Detect that you're a new user
2. ✅ Show you a beautiful role selection dialog
3. ✅ Create your complete profile automatically
4. ✅ Set up your wallet (for non-admin users)
5. ✅ Initialize loyalty points (for drivers)
6. ✅ Take you directly to your personalized dashboard

---

## 🚀 First-Time Login Flow

### Step 1: Enter Your Email
- Navigate to the login page
- Enter your email address
- Click "Recevoir le code"

### Step 2: Verify OTP
- Check your email for the 6-digit code
- Enter the code in the verification screen
- Click "Se connecter"

### Step 3: Select Your Role (NEW!)
After successful OTP verification, you'll see a beautiful dialog with 6 role options:

1. **Administrateur** 🛡️
   - Full platform management
   - Access to all features and settings
   - User management capabilities

2. **Agent** 👥
   - Manage petroleum distributors
   - Track commissions and revenue
   - Regional oversight

3. **Pétrolier** 🏢
   - Manage station network
   - Product catalog management
   - Order dispatch and fulfillment

4. **Station-service** 🏪
   - Track deliveries and orders
   - Manage station operations
   - Revenue tracking

5. **Chef de flotte** 🚛
   - Vehicle and driver management
   - Fuel ordering for fleet
   - Maintenance tracking

6. **Chauffeur** 👤
   - Personal fuel orders
   - Insurance enrollment
   - Loyalty rewards tracking

**Simply click on your role and hit "Continuer"!**

### Step 4: Profile Created! ✨
Your profile is automatically created with:
- ✅ Your email address
- ✅ Your name (extracted from email)
- ✅ Your selected role
- ✅ Active status
- ✅ Wallet (for transactions)
- ✅ Loyalty points (for drivers)

You're immediately taken to your personalized dashboard!

---

## 🎨 What Gets Created Automatically?

### For All Users:
1. **User Account** (`users` table)
   - Email, name, role, status
   - Creation timestamp
   - Parent-child hierarchy setup

2. **Extended Profile** (`user_profiles` table)
   - Bio and profile picture fields
   - Emergency contact information
   - Role-specific fields (license, vehicle, station, etc.)

### For Non-Admin Users:
3. **Prepaid Wallet** (`wallets` table)
   - Initial balance: 0 XOF
   - Ready for deposits
   - Active status

### For Drivers:
4. **Loyalty Points** (`loyalty_points` table)
   - Starting tier: Bronze
   - Initial points: 0
   - Ready to earn rewards

---

## 📝 Name Extraction from Email

The platform intelligently extracts your name from your email:

**Examples:**
- `john.doe@example.com` → John Doe
- `marie_dupont@example.com` → Marie Dupont
- `ali-diallo@example.com` → Ali Diallo
- `fatou123@example.com` → Fatou

You can always edit your name later in your profile!

---

## ❓ Frequently Asked Questions

### Q: What if I choose the wrong role?
**A:** Contact your administrator to update your role, or use the seed data functionality to create a test account with a different role.

### Q: Can I have multiple accounts?
**A:** Each email can only have one account. Use different email addresses for testing different roles.

### Q: What happened to the "Utilisateur non trouvé" error?
**A:** That error is now history! With automatic profile creation, every new user gets a profile immediately after their first login.

### Q: Do I still need to use seed data?
**A:** Seed data is now optional and mainly used for:
- Creating demo accounts for testing
- Populating initial product catalogs
- Setting up demo stations and insurance plans
- Testing the platform with sample data

### Q: Can I skip the role selection?
**A:** No, role selection is required to personalize your experience and unlock the right features for you.

---

## 🔒 Security & Privacy

- ✅ Your email is never shared with third parties
- ✅ Profile data is encrypted in transit
- ✅ Only you (and administrators) can see your profile
- ✅ You can update your information anytime
- ✅ Bank-level security standards

---

## 💡 Pro Tips

1. **Use a real email**: You'll need it for OTP codes and important notifications
2. **Choose the right role**: Your dashboard and features depend on your role
3. **Complete your profile**: Add your phone number, address, and other details
4. **Upload a photo**: Make your profile more personal and professional
5. **Set emergency contacts**: Important for insurance and safety features

---

## 🎯 Next Steps After Registration

### For Admins:
1. ⚙️ Configure system settings
2. 👥 Create accounts for agents and other users
3. 📊 Review platform analytics
4. 🎲 Use seed data to populate demo content

### For Agents:
1. 👥 View your assigned petroleum distributors
2. 💰 Track commissions and revenue
3. 📈 Review performance metrics

### For Pétroliers:
1. 🏪 Set up your station network
2. 📦 Add products to your catalog
3. 📋 Process fuel orders

### For Stations:
1. 📦 Check pending deliveries
2. ✅ Update order statuses
3. 💰 Track daily revenue

### For Fleet Managers:
1. 🚗 Add your vehicles
2. 👥 Register your drivers
3. ⛽ Order fuel for your fleet

### For Drivers:
1. 🚗 Check your assigned vehicle
2. ⛽ Order fuel using prepaid balance
3. 🏥 Enroll in health insurance
4. 🎁 Start earning loyalty rewards

---

## 🆘 Need Help?

If you encounter any issues during registration:
1. Check your email spam folder for OTP codes
2. Ensure you have a stable internet connection
3. Try refreshing the page and starting over
4. Contact support if the problem persists

---

**Welcome to Assur'Trans! 🚀**
