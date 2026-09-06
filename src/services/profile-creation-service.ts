import { table } from '@devvai/devv-code-backend';
import { UserRole } from '@/features/users/types';

// Table IDs
const USERS_TABLE_ID = 'f4eyoj5l0wzk';
const USER_PROFILES_TABLE_ID = 'f4eyoj561clc';

interface CreateProfileData {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

class ProfileCreationService {
  /**
   * Check if user profile exists
   */
  async checkProfileExists(uid: string): Promise<boolean> {
    try {
      console.log('═══════════════════════════════════════');
      console.log('🔎 PROFILE CHECK STARTING');
      console.log('═══════════════════════════════════════');
      console.log('📝 UID to check:', uid);
      console.log('📊 Table ID:', USERS_TABLE_ID);
      console.log('🔍 Query parameters:', { _uid: uid, limit: 1 });
      
      const response = await table.getItems(USERS_TABLE_ID, {
        query: {
          _uid: uid,
        },
        limit: 1,
      });

      console.log('📦 Raw API response:', JSON.stringify(response, null, 2));
      console.log('📋 Items array:', response.items);
      console.log('📊 Items count:', response.items?.length || 0);

      if (response.items && response.items.length > 0) {
        console.log('✅ PROFILE FOUND!');
        console.log('👤 User data:', response.items[0]);
        console.log('═══════════════════════════════════════');
        return true;
      } else {
        console.log('🆕 NO PROFILE FOUND - NEW USER!');
        console.log('💡 User needs to select a role');
        console.log('═══════════════════════════════════════');
        return false;
      }
    } catch (error) {
      console.log('═══════════════════════════════════════');
      console.error('❌ PROFILE CHECK FAILED WITH ERROR');
      console.error('Error details:', error);
      console.log('💡 Assuming NEW USER (query error)');
      console.log('═══════════════════════════════════════');
      // If query fails, assume profile doesn't exist (new user)
      return false;
    }
  }

  /**
   * Create user profile after first login
   */
  async createProfile(data: CreateProfileData): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      // 1. Create entry in users table
      const userData = {
        _uid: data.uid,
        email: data.email,
        phone: '',
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        status: 'active',
        companyName: '',
        address: '',
        city: '',
        country: 'Sénégal',
        parentId: '',
        createdBy: data.uid, // Self-created
        createdAt: timestamp,
        lastLogin: timestamp,
      };

      await table.addItem(USERS_TABLE_ID, userData);
      console.log('✅ User profile created in users table');

      // 2. Create extended profile in user_profiles table
      const profileData = {
        _uid: data.uid,
        userId: data.uid, // Reference to user
        bio: '',
        profilePicture: '',
        emergencyContact: '',
        emergencyPhone: '',
        
        // Role-specific fields (empty by default)
        licenseNumber: '',
        licenseExpiry: '',
        vehicleId: '',
        fleetId: '',
        stationId: '',
        petrolierLicense: '',
        agentRegion: '',
        
        updatedAt: timestamp,
      };

      await table.addItem(USER_PROFILES_TABLE_ID, profileData);
      console.log('✅ User profile created in user_profiles table');

      // 3. Create wallet for non-admin users
      if (data.role !== 'admin') {
        try {
          const WALLETS_TABLE_ID = 'f4f186q7i03k';
          const walletData = {
            _uid: data.uid,
            userId: data.uid,
            balance: 0,
            currency: 'XOF',
            status: 'active',
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await table.addItem(WALLETS_TABLE_ID, walletData);
          console.log('✅ Wallet created for user');
        } catch (error) {
          console.error('Failed to create wallet:', error);
          // Non-critical error, continue
        }
      }

      // 4. Create loyalty account for drivers
      if (data.role === 'driver') {
        try {
          const LOYALTY_ACCOUNTS_TABLE_ID = 'f4f6sysp3gn4';
          const loyaltyData = {
            _uid: data.uid,
            user_id: data.uid,
            total_points: 0,
            available_points: 0,
            lifetime_points: 0,
            tier: 'bronze',
            tier_progress: 0,
            next_tier: 'silver',
            points_to_next_tier: 1000,
            created_at: timestamp,
            updated_at: timestamp,
          };
          await table.addItem(LOYALTY_ACCOUNTS_TABLE_ID, loyaltyData);
          console.log('✅ Loyalty account created for driver');
        } catch (error) {
          console.error('Failed to create loyalty account:', error);
          // Non-critical error, continue
        }
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
      throw new Error('Échec de la création du profil. Veuillez réessayer.');
    }
  }

  /**
   * Extract first and last name from email
   */
  extractNameFromEmail(email: string): { firstName: string; lastName: string } {
    const username = email.split('@')[0];
    const parts = username.split(/[._-]/);

    if (parts.length >= 2) {
      return {
        firstName: this.capitalizeFirstLetter(parts[0]),
        lastName: this.capitalizeFirstLetter(parts.slice(1).join(' ')),
      };
    }

    return {
      firstName: this.capitalizeFirstLetter(username),
      lastName: '',
    };
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirstLetter(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

export const profileCreationService = new ProfileCreationService();
