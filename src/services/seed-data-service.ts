import { table } from '@devvai/devv-code-backend';

const USERS_TABLE_ID = 'f4eyoj5l0wzk';
const USER_PROFILES_TABLE_ID = 'f4eyoj561clc';
const PRODUCTS_TABLE_ID = 'f4f186q7i03m';
const STATIONS_TABLE_ID = 'f4f5fpwkqagg';
const INSURANCE_PLANS_TABLE_ID = 'f4f4hkygf56o';
const HEALTH_PROVIDERS_TABLE_ID = 'f4f4hkyix7uo';
const LOYALTY_TIERS_TABLE_ID = 'f4fb4hcprsvk';

interface SeedResult {
  success: boolean;
  message: string;
  details?: string[];
}

class SeedDataService {
  /**
   * Create demo admin account with current user's _uid
   */
  async seedDemoAdmin(currentUserId: string): Promise<SeedResult> {
    const results: string[] = [];
    
    try {
      // Check if admin already exists
      const usersResult = await table.getItems(USERS_TABLE_ID);
      const users = (usersResult.items || []) as any[];
      const existingAdmin = users.find((u: any) => u.email === 'admin@assurtrans.com');
      
      if (existingAdmin) {
        return {
          success: false,
          message: 'Un compte admin existe déjà',
          details: ['Email: admin@assurtrans.com', 'Utilisez cet email pour vous connecter'],
        };
      }

      const timestamp = new Date().toISOString();

      // Create admin user
      await table.addItem(USERS_TABLE_ID, {
        _uid: currentUserId,
        email: 'admin@assurtrans.com',
        role: 'admin',
        status: 'active',
        created_at: timestamp,
      });
      results.push('✓ Compte admin créé dans la table users');

      // Create admin profile
      await table.addItem(USER_PROFILES_TABLE_ID, {
        _uid: currentUserId,
        full_name: 'Administrateur Assur\'Trans',
        phone: '+221 77 123 45 67',
        address: 'Plateau, Dakar',
        city: 'Dakar',
        bio: 'Administrateur principal de la plateforme Assur\'Trans',
      });
      results.push('✓ Profil admin créé dans user_profiles');

      return {
        success: true,
        message: 'Compte administrateur créé avec succès !',
        details: [
          ...results,
          '',
          '🎉 Votre compte a maintenant le rôle Admin !',
          '📧 Email: admin@assurtrans.com',
          '🔐 Connexion: Utilisez le code OTP envoyé par email',
          '',
          '⚠️ IMPORTANT: Pour utiliser ce compte, vous devez:',
          '1. Vous déconnecter',
          '2. Vous reconnecter avec admin@assurtrans.com',
          '3. Entrer le code OTP reçu par email',
        ],
      };
    } catch (error: any) {
      console.error('Failed to seed demo admin:', error);
      return {
        success: false,
        message: 'Erreur lors de la création du compte admin',
        details: [error.message],
      };
    }
  }

  /**
   * Seed product catalog
   */
  async seedProducts(currentUserId: string): Promise<SeedResult> {
    const results: string[] = [];
    
    try {
      const products = [
        {
          _uid: currentUserId,
          name: 'Essence Super 91',
          category: 'fuel',
          unit_price: 850,
          unit: 'litre',
          description: 'Essence sans plomb 91 octane',
          stock_quantity: 10000,
          min_stock_level: 2000,
          is_available: true,
        },
        {
          _uid: currentUserId,
          name: 'Gasoil',
          category: 'fuel',
          unit_price: 720,
          unit: 'litre',
          description: 'Gasoil pour véhicules diesel',
          stock_quantity: 15000,
          min_stock_level: 3000,
          is_available: true,
        },
        {
          _uid: currentUserId,
          name: 'Huile Moteur 10W40',
          category: 'oil',
          unit_price: 4500,
          unit: 'litre',
          description: 'Huile moteur semi-synthétique',
          stock_quantity: 500,
          min_stock_level: 100,
          is_available: true,
        },
        {
          _uid: currentUserId,
          name: 'Huile Transmission',
          category: 'oil',
          unit_price: 3800,
          unit: 'litre',
          description: 'Huile de transmission automatique',
          stock_quantity: 300,
          min_stock_level: 50,
          is_available: true,
        },
        {
          _uid: currentUserId,
          name: 'Liquide de Refroidissement',
          category: 'fluid',
          unit_price: 2500,
          unit: 'litre',
          description: 'Liquide de refroidissement moteur',
          stock_quantity: 400,
          min_stock_level: 80,
          is_available: true,
        },
      ];

      for (const product of products) {
        await table.addItem(PRODUCTS_TABLE_ID, product);
        results.push(`✓ Produit créé: ${product.name}`);
      }

      return {
        success: true,
        message: `${products.length} produits créés avec succès`,
        details: results,
      };
    } catch (error: any) {
      console.error('Failed to seed products:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des produits',
        details: [error.message],
      };
    }
  }

  /**
   * Seed station network
   */
  async seedStations(currentUserId: string): Promise<SeedResult> {
    const results: string[] = [];
    
    try {
      const stations = [
        {
          _uid: currentUserId,
          name: 'Station Total Plateau',
          address: 'Avenue Léopold Sédar Senghor',
          city: 'Dakar',
          phone: '+221 33 821 12 34',
          capacity_fuel: 50000,
          capacity_oil: 2000,
          current_stock_fuel: 35000,
          current_stock_oil: 1200,
          status: 'active',
          latitude: 14.6937,
          longitude: -17.4441,
        },
        {
          _uid: currentUserId,
          name: 'Station Shell Almadies',
          address: 'Route des Almadies',
          city: 'Dakar',
          phone: '+221 33 820 45 67',
          capacity_fuel: 40000,
          capacity_oil: 1500,
          current_stock_fuel: 28000,
          current_stock_oil: 900,
          status: 'active',
          latitude: 14.7444,
          longitude: -17.4961,
        },
        {
          _uid: currentUserId,
          name: 'Station Elton Ouakam',
          address: 'Boulevard de la République',
          city: 'Dakar',
          phone: '+221 33 824 78 90',
          capacity_fuel: 35000,
          capacity_oil: 1200,
          current_stock_fuel: 20000,
          current_stock_oil: 600,
          status: 'active',
          latitude: 14.7167,
          longitude: -17.4833,
        },
      ];

      for (const station of stations) {
        await table.addItem(STATIONS_TABLE_ID, station);
        results.push(`✓ Station créée: ${station.name}`);
      }

      return {
        success: true,
        message: `${stations.length} stations créées avec succès`,
        details: results,
      };
    } catch (error: any) {
      console.error('Failed to seed stations:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des stations',
        details: [error.message],
      };
    }
  }

  /**
   * Seed insurance plans
   */
  async seedInsurancePlans(currentUserId: string): Promise<SeedResult> {
    const results: string[] = [];
    
    try {
      const plans = [
        {
          _uid: currentUserId,
          name: 'Plan Basique',
          tier: 'basic',
          monthly_premium: 15000,
          coverage_amount: 500000,
          benefits: JSON.stringify([
            'Consultations médicales générales',
            'Médicaments essentiels',
            'Analyses de laboratoire basiques',
          ]),
          is_active: true,
        },
        {
          _uid: currentUserId,
          name: 'Plan Standard',
          tier: 'standard',
          monthly_premium: 25000,
          coverage_amount: 1000000,
          benefits: JSON.stringify([
            'Consultations spécialisées',
            'Hospitalisation (jusqu\'à 7 jours)',
            'Médicaments prescrits',
            'Examens radiologiques',
            'Analyses de laboratoire complètes',
          ]),
          is_active: true,
        },
        {
          _uid: currentUserId,
          name: 'Plan Premium',
          tier: 'premium',
          monthly_premium: 40000,
          coverage_amount: 2000000,
          benefits: JSON.stringify([
            'Consultations illimitées',
            'Hospitalisation complète',
            'Chirurgies programmées',
            'Soins dentaires',
            'Optique',
            'Évacuation sanitaire',
          ]),
          is_active: true,
        },
        {
          _uid: currentUserId,
          name: 'Plan Famille',
          tier: 'family',
          monthly_premium: 60000,
          coverage_amount: 5000000,
          benefits: JSON.stringify([
            'Couverture pour 4 personnes',
            'Consultations illimitées',
            'Hospitalisation complète',
            'Chirurgies',
            'Maternité',
            'Pédiatrie',
            'Soins dentaires et optique',
          ]),
          is_active: true,
        },
      ];

      for (const plan of plans) {
        await table.addItem(INSURANCE_PLANS_TABLE_ID, plan);
        results.push(`✓ Plan créé: ${plan.name}`);
      }

      return {
        success: true,
        message: `${plans.length} plans d'assurance créés avec succès`,
        details: results,
      };
    } catch (error: any) {
      console.error('Failed to seed insurance plans:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des plans',
        details: [error.message],
      };
    }
  }

  /**
   * Seed health providers
   */
  async seedHealthProviders(currentUserId: string): Promise<SeedResult> {
    const results: string[] = [];
    
    try {
      const providers = [
        {
          _uid: currentUserId,
          name: 'Hôpital Principal de Dakar',
          type: 'hospital',
          address: 'Avenue Nelson Mandela',
          city: 'Dakar',
          phone: '+221 33 821 20 00',
          services: JSON.stringify(['Urgences', 'Chirurgie', 'Maternité', 'Pédiatrie']),
          is_partner: true,
        },
        {
          _uid: currentUserId,
          name: 'Clinique Madeleine',
          type: 'clinic',
          address: 'Rue Madeleine',
          city: 'Dakar',
          phone: '+221 33 821 56 78',
          services: JSON.stringify(['Consultations', 'Analyses', 'Imagerie']),
          is_partner: true,
        },
        {
          _uid: currentUserId,
          name: 'Pharmacie du Point E',
          type: 'pharmacy',
          address: 'Point E',
          city: 'Dakar',
          phone: '+221 33 824 12 34',
          services: JSON.stringify(['Médicaments', 'Parapharmacie', 'Garde de nuit']),
          is_partner: true,
        },
        {
          _uid: currentUserId,
          name: 'Laboratoire BioPharma',
          type: 'laboratory',
          address: 'Sacré-Cœur 3',
          city: 'Dakar',
          phone: '+221 33 825 45 67',
          services: JSON.stringify(['Analyses sanguines', 'Biologie moléculaire', 'Imagerie']),
          is_partner: true,
        },
        {
          _uid: currentUserId,
          name: 'Cabinet Dr. Diop',
          type: 'doctor',
          address: 'Plateau',
          city: 'Dakar',
          phone: '+221 77 123 45 67',
          services: JSON.stringify(['Médecine générale', 'Consultations à domicile']),
          is_partner: true,
        },
        {
          _uid: currentUserId,
          name: 'Centre Dentaire Sourire',
          type: 'dentist',
          address: 'Mermoz',
          city: 'Dakar',
          phone: '+221 33 860 12 34',
          services: JSON.stringify(['Soins dentaires', 'Orthodontie', 'Implants']),
          is_partner: true,
        },
      ];

      for (const provider of providers) {
        await table.addItem(HEALTH_PROVIDERS_TABLE_ID, provider);
        results.push(`✓ Prestataire créé: ${provider.name}`);
      }

      return {
        success: true,
        message: `${providers.length} prestataires de santé créés avec succès`,
        details: results,
      };
    } catch (error: any) {
      console.error('Failed to seed health providers:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des prestataires',
        details: [error.message],
      };
    }
  }

  /**
   * Seed loyalty tiers
   */
  async seedLoyaltyTiers(currentUserId: string): Promise<SeedResult> {
    const results: string[] = [];
    
    try {
      const tiers = [
        {
          _uid: currentUserId,
          name: 'Bronze',
          min_points: 0,
          benefits: JSON.stringify(['1 point par 1000 FCFA', 'Réductions de base']),
          discount_percentage: 2,
          priority_level: 1,
        },
        {
          _uid: currentUserId,
          name: 'Argent',
          min_points: 1000,
          benefits: JSON.stringify(['1.5 points par 1000 FCFA', 'Réductions améliorées', 'Support prioritaire']),
          discount_percentage: 5,
          priority_level: 2,
        },
        {
          _uid: currentUserId,
          name: 'Or',
          min_points: 5000,
          benefits: JSON.stringify(['2 points par 1000 FCFA', 'Réductions premium', 'Livraison gratuite']),
          discount_percentage: 8,
          priority_level: 3,
        },
        {
          _uid: currentUserId,
          name: 'Platine',
          min_points: 15000,
          benefits: JSON.stringify(['2.5 points par 1000 FCFA', 'Réductions VIP', 'Gestionnaire dédié']),
          discount_percentage: 12,
          priority_level: 4,
        },
        {
          _uid: currentUserId,
          name: 'Diamant',
          min_points: 50000,
          benefits: JSON.stringify(['3 points par 1000 FCFA', 'Avantages exclusifs', 'Accès anticipé', 'Service concierge']),
          discount_percentage: 15,
          priority_level: 5,
        },
      ];

      for (const tier of tiers) {
        await table.addItem(LOYALTY_TIERS_TABLE_ID, tier);
        results.push(`✓ Niveau créé: ${tier.name}`);
      }

      return {
        success: true,
        message: `${tiers.length} niveaux de fidélité créés avec succès`,
        details: results,
      };
    } catch (error: any) {
      console.error('Failed to seed loyalty tiers:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des niveaux',
        details: [error.message],
      };
    }
  }

  /**
   * Seed all data at once
   */
  async seedAll(currentUserId: string): Promise<SeedResult> {
    const allResults: string[] = [];
    let successCount = 0;
    let failCount = 0;

    try {
      // 1. Admin account
      allResults.push('📋 Création du compte admin...');
      const adminResult = await this.seedDemoAdmin(currentUserId);
      if (adminResult.success) {
        successCount++;
        allResults.push('✅ Admin créé');
      } else {
        allResults.push(`⚠️ Admin: ${adminResult.message}`);
      }

      // 2. Products
      allResults.push('\n📋 Création du catalogue produits...');
      const productsResult = await this.seedProducts(currentUserId);
      if (productsResult.success) {
        successCount++;
        allResults.push('✅ Produits créés');
      } else {
        failCount++;
        allResults.push(`❌ Produits: ${productsResult.message}`);
      }

      // 3. Stations
      allResults.push('\n📋 Création du réseau de stations...');
      const stationsResult = await this.seedStations(currentUserId);
      if (stationsResult.success) {
        successCount++;
        allResults.push('✅ Stations créées');
      } else {
        failCount++;
        allResults.push(`❌ Stations: ${stationsResult.message}`);
      }

      // 4. Insurance plans
      allResults.push('\n📋 Création des plans d\'assurance...');
      const plansResult = await this.seedInsurancePlans(currentUserId);
      if (plansResult.success) {
        successCount++;
        allResults.push('✅ Plans créés');
      } else {
        failCount++;
        allResults.push(`❌ Plans: ${plansResult.message}`);
      }

      // 5. Health providers
      allResults.push('\n📋 Création du réseau de santé...');
      const providersResult = await this.seedHealthProviders(currentUserId);
      if (providersResult.success) {
        successCount++;
        allResults.push('✅ Prestataires créés');
      } else {
        failCount++;
        allResults.push(`❌ Prestataires: ${providersResult.message}`);
      }

      // 6. Loyalty tiers
      allResults.push('\n📋 Création des niveaux de fidélité...');
      const tiersResult = await this.seedLoyaltyTiers(currentUserId);
      if (tiersResult.success) {
        successCount++;
        allResults.push('✅ Niveaux créés');
      } else {
        failCount++;
        allResults.push(`❌ Niveaux: ${tiersResult.message}`);
      }

      allResults.push(`\n✅ ${successCount} modules initialisés avec succès`);
      if (failCount > 0) {
        allResults.push(`⚠️ ${failCount} modules ont échoué`);
      }

      return {
        success: successCount > 0,
        message: `Initialisation terminée: ${successCount} succès, ${failCount} échecs`,
        details: allResults,
      };
    } catch (error: any) {
      console.error('Failed to seed all data:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'initialisation complète',
        details: [error.message],
      };
    }
  }
}

export const seedService = new SeedDataService();
