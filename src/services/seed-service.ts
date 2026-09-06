import { table } from '@devvai/devv-code-backend';

// Table IDs
const USERS_TABLE_ID = 'f4eyoj5l0wzk';
const USER_PROFILES_TABLE_ID = 'f4eyoj561clc';
const PRODUCTS_TABLE_ID = 'f4f186q7i03m';
const STATIONS_TABLE_ID = 'f4f5fpwkqagg';
const INSURANCE_PLANS_TABLE_ID = 'f4f4hkygf56o';
const HEALTH_PROVIDERS_TABLE_ID = 'f4f4hkyix7uo';
const LOYALTY_TIERS_TABLE_ID = 'f4fb4hcprsvk';

export interface SeedResult {
  success: boolean;
  message: string;
  details?: string[];
}

class SeedService {
  /**
   * Create demo admin account and related data
   * This admin account can be used for testing without going through OTP
   */
  async seedDemoAdmin(currentUserId: string): Promise<SeedResult> {
    const details: string[] = [];
    
    try {
      // Check if admin already exists
      const existingUsers = await table.getItems(USERS_TABLE_ID, {
        query: { email: 'admin@assurtrans.com' },
        limit: 1,
      });

      if (existingUsers.items && existingUsers.items.length > 0) {
        return {
          success: false,
          message: 'Compte administrateur démo existe déjà',
          details: ['Email: admin@assurtrans.com'],
        };
      }

      const timestamp = new Date().toISOString();

      // Create admin user
      const adminUser = {
        _uid: currentUserId,
        email: 'admin@assurtrans.com',
        phone: '+221771234567',
        firstName: 'Admin',
        lastName: 'Assur\'Trans',
        role: 'admin',
        status: 'active',
        companyName: 'Assur\'Trans HQ',
        address: '123 Avenue Cheikh Anta Diop',
        city: 'Dakar',
        country: 'Sénégal',
        createdBy: currentUserId,
        createdAt: timestamp,
        lastLogin: timestamp,
        parentId: '',
      };

      await table.addItem(USERS_TABLE_ID, adminUser);
      details.push('✓ Compte administrateur créé');

      // Create admin profile
      const adminProfile = {
        _uid: currentUserId,
        userId: currentUserId,
        bio: 'Administrateur principal de la plateforme Assur\'Trans. Gestion complète du système.',
        emergencyContact: '+221771234568',
        emergencyContactName: 'Support Assur\'Trans',
        licenseNumber: 'ADMIN-001',
        licenseExpiry: '',
        companyRegistration: 'SN-AT-2025-001',
        updatedAt: timestamp,
      };

      await table.addItem(USER_PROFILES_TABLE_ID, adminProfile);
      details.push('✓ Profil administrateur créé');

      return {
        success: true,
        message: 'Compte administrateur démo créé avec succès',
        details: [
          ...details,
          '',
          '📧 Email: admin@assurtrans.com',
          '🔑 Utilisez le système OTP pour vous connecter',
          '⚠️ Pour la démo, vérifiez votre email pour le code OTP',
        ],
      };
    } catch (error: any) {
      console.error('Seed admin failed:', error);
      return {
        success: false,
        message: 'Erreur lors de la création du compte admin',
        details: [error.message || 'Erreur inconnue'],
      };
    }
  }

  /**
   * Seed product catalog
   */
  async seedProducts(currentUserId: string): Promise<SeedResult> {
    const details: string[] = [];
    
    try {
      const timestamp = new Date().toISOString();

      const products = [
        {
          _uid: currentUserId,
          name: 'Gasoil',
          category: 'fuel',
          unit: 'litre',
          price: 750,
          description: 'Gasoil pour véhicules diesel',
          available: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Essence Super',
          category: 'fuel',
          unit: 'litre',
          price: 850,
          description: 'Essence sans plomb',
          available: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Huile Moteur 5W30',
          category: 'oil',
          unit: 'litre',
          price: 8500,
          description: 'Huile moteur synthétique',
          available: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Huile Moteur 10W40',
          category: 'oil',
          unit: 'litre',
          price: 7500,
          description: 'Huile moteur semi-synthétique',
          available: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Liquide de Frein',
          category: 'maintenance',
          unit: 'litre',
          price: 4500,
          description: 'Liquide de frein DOT 4',
          available: true,
          createdAt: timestamp,
        },
      ];

      for (const product of products) {
        await table.addItem(PRODUCTS_TABLE_ID, product);
        details.push(`✓ ${product.name} ajouté`);
      }

      return {
        success: true,
        message: `${products.length} produits créés avec succès`,
        details,
      };
    } catch (error: any) {
      console.error('Seed products failed:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des produits',
        details: [error.message || 'Erreur inconnue'],
      };
    }
  }

  /**
   * Seed stations network
   */
  async seedStations(currentUserId: string): Promise<SeedResult> {
    const details: string[] = [];
    
    try {
      const timestamp = new Date().toISOString();

      const stations = [
        {
          _uid: currentUserId,
          name: 'Station Plateau',
          address: 'Avenue Léopold Sédar Senghor',
          city: 'Dakar',
          country: 'Sénégal',
          latitude: '14.6928',
          longitude: '-17.4467',
          capacity: 50000,
          currentStock: 45000,
          status: 'active',
          managerId: currentUserId,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Station Almadies',
          address: 'Route des Almadies',
          city: 'Dakar',
          country: 'Sénégal',
          latitude: '14.7392',
          longitude: '-17.5008',
          capacity: 40000,
          currentStock: 38000,
          status: 'active',
          managerId: currentUserId,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Station Ouakam',
          address: 'Boulevard du Centenaire',
          city: 'Dakar',
          country: 'Sénégal',
          latitude: '14.7167',
          longitude: '-17.4833',
          capacity: 35000,
          currentStock: 30000,
          status: 'active',
          managerId: currentUserId,
          createdAt: timestamp,
        },
      ];

      for (const station of stations) {
        await table.addItem(STATIONS_TABLE_ID, station);
        details.push(`✓ ${station.name} ajoutée`);
      }

      return {
        success: true,
        message: `${stations.length} stations créées avec succès`,
        details,
      };
    } catch (error: any) {
      console.error('Seed stations failed:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des stations',
        details: [error.message || 'Erreur inconnue'],
      };
    }
  }

  /**
   * Seed insurance plans
   */
  async seedInsurancePlans(currentUserId: string): Promise<SeedResult> {
    const details: string[] = [];
    
    try {
      const timestamp = new Date().toISOString();

      const plans = [
        {
          _uid: currentUserId,
          name: 'Assurance Basic',
          tier: 'basic',
          monthlyPremium: 15000,
          yearlyPremium: 150000,
          coverage: 500000,
          benefits: JSON.stringify([
            'Consultations médicales générales',
            'Médicaments sur ordonnance',
            'Analyses de laboratoire de base',
          ]),
          description: 'Couverture de base pour les soins essentiels',
          active: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Assurance Standard',
          tier: 'standard',
          monthlyPremium: 25000,
          yearlyPremium: 250000,
          coverage: 1000000,
          benefits: JSON.stringify([
            'Consultations médicales générales',
            'Consultations spécialisées',
            'Médicaments sur ordonnance',
            'Analyses de laboratoire complètes',
            'Radiologie de base',
            'Hospitalisation (chambre standard)',
          ]),
          description: 'Couverture standard pour les soins courants et urgences',
          active: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Assurance Premium',
          tier: 'premium',
          monthlyPremium: 45000,
          yearlyPremium: 450000,
          coverage: 3000000,
          benefits: JSON.stringify([
            'Toutes prestations Standard',
            'Chirurgies majeures',
            'Hospitalisation (chambre privée)',
            'Soins dentaires',
            'Lunettes et optique',
            'Évacuation sanitaire',
          ]),
          description: 'Couverture complète avec services premium',
          active: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Assurance Famille',
          tier: 'family',
          monthlyPremium: 65000,
          yearlyPremium: 650000,
          coverage: 5000000,
          benefits: JSON.stringify([
            'Toutes prestations Premium',
            'Couverture jusqu\'à 5 personnes',
            'Soins pédiatriques',
            'Maternité et accouchement',
            'Vaccinations',
            'Check-up annuel complet',
          ]),
          description: 'Protection complète pour toute la famille',
          active: true,
          createdAt: timestamp,
        },
      ];

      for (const plan of plans) {
        await table.addItem(INSURANCE_PLANS_TABLE_ID, plan);
        details.push(`✓ ${plan.name} ajouté`);
      }

      return {
        success: true,
        message: `${plans.length} plans d'assurance créés avec succès`,
        details,
      };
    } catch (error: any) {
      console.error('Seed insurance plans failed:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des plans',
        details: [error.message || 'Erreur inconnue'],
      };
    }
  }

  /**
   * Seed health providers
   */
  async seedHealthProviders(currentUserId: string): Promise<SeedResult> {
    const details: string[] = [];
    
    try {
      const timestamp = new Date().toISOString();

      const providers = [
        {
          _uid: currentUserId,
          name: 'Hôpital Principal de Dakar',
          type: 'hospital',
          address: 'Avenue Pasteur',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221338234545',
          services: JSON.stringify(['Urgences', 'Chirurgie', 'Maternité', 'Pédiatrie']),
          acceptedPlans: JSON.stringify(['basic', 'standard', 'premium', 'family']),
          active: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Clinique Pasteur',
          type: 'clinic',
          address: 'Rue Paul Holle',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221338215151',
          services: JSON.stringify(['Consultations', 'Analyses', 'Imagerie']),
          acceptedPlans: JSON.stringify(['standard', 'premium', 'family']),
          active: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Pharmacie Plateau',
          type: 'pharmacy',
          address: 'Avenue Georges Pompidou',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221338223344',
          services: JSON.stringify(['Médicaments', 'Parapharmacie']),
          acceptedPlans: JSON.stringify(['basic', 'standard', 'premium', 'family']),
          active: true,
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Laboratoire BioMed',
          type: 'laboratory',
          address: 'Rue Vincens',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221338229988',
          services: JSON.stringify(['Analyses sanguines', 'Radiologie', 'Échographie']),
          acceptedPlans: JSON.stringify(['basic', 'standard', 'premium', 'family']),
          active: true,
          createdAt: timestamp,
        },
      ];

      for (const provider of providers) {
        await table.addItem(HEALTH_PROVIDERS_TABLE_ID, provider);
        details.push(`✓ ${provider.name} ajouté`);
      }

      return {
        success: true,
        message: `${providers.length} prestataires de santé créés avec succès`,
        details,
      };
    } catch (error: any) {
      console.error('Seed health providers failed:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des prestataires',
        details: [error.message || 'Erreur inconnue'],
      };
    }
  }

  /**
   * Seed loyalty tiers
   */
  async seedLoyaltyTiers(currentUserId: string): Promise<SeedResult> {
    const details: string[] = [];
    
    try {
      const timestamp = new Date().toISOString();

      const tiers = [
        {
          _uid: currentUserId,
          name: 'Bronze',
          minPoints: 0,
          maxPoints: 999,
          multiplier: 1.0,
          benefits: JSON.stringify([
            'Accumulation de points standard',
            'Accès au catalogue de récompenses',
          ]),
          color: '#CD7F32',
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Argent',
          minPoints: 1000,
          maxPoints: 4999,
          multiplier: 1.25,
          benefits: JSON.stringify([
            'Points bonus 25%',
            'Réductions exclusives',
            'Support prioritaire',
          ]),
          color: '#C0C0C0',
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Or',
          minPoints: 5000,
          maxPoints: 14999,
          multiplier: 1.5,
          benefits: JSON.stringify([
            'Points bonus 50%',
            'Réductions premium',
            'Support VIP',
            'Cadeaux anniversaire',
          ]),
          color: '#FFD700',
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Platine',
          minPoints: 15000,
          maxPoints: 49999,
          multiplier: 1.75,
          benefits: JSON.stringify([
            'Points bonus 75%',
            'Réductions maximales',
            'Concierge personnel',
            'Événements exclusifs',
            'Services premium gratuits',
          ]),
          color: '#E5E4E2',
          createdAt: timestamp,
        },
        {
          _uid: currentUserId,
          name: 'Diamant',
          minPoints: 50000,
          maxPoints: 999999999,
          multiplier: 2.0,
          benefits: JSON.stringify([
            'Points doublés',
            'Tous avantages précédents',
            'Offres sur mesure',
            'Invitations VIP',
            'Partenariats exclusifs',
            'Renouvellement prioritaire',
          ]),
          color: '#B9F2FF',
          createdAt: timestamp,
        },
      ];

      for (const tier of tiers) {
        await table.addItem(LOYALTY_TIERS_TABLE_ID, tier);
        details.push(`✓ Niveau ${tier.name} ajouté`);
      }

      return {
        success: true,
        message: `${tiers.length} niveaux de fidélité créés avec succès`,
        details,
      };
    } catch (error: any) {
      console.error('Seed loyalty tiers failed:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des niveaux',
        details: [error.message || 'Erreur inconnue'],
      };
    }
  }

  /**
   * Seed all demo data
   */
  async seedAll(currentUserId: string): Promise<SeedResult> {
    const allDetails: string[] = [];
    let successCount = 0;
    let failCount = 0;

    // Seed admin (most important)
    const adminResult = await this.seedDemoAdmin(currentUserId);
    if (adminResult.success) {
      successCount++;
      allDetails.push('✅ Admin:', ...(adminResult.details || []));
    } else {
      failCount++;
      allDetails.push('❌ Admin:', adminResult.message);
    }

    // Seed products
    const productsResult = await this.seedProducts(currentUserId);
    if (productsResult.success) {
      successCount++;
      allDetails.push('', '✅ Produits:', ...(productsResult.details || []));
    } else {
      failCount++;
      allDetails.push('', '❌ Produits:', productsResult.message);
    }

    // Seed stations
    const stationsResult = await this.seedStations(currentUserId);
    if (stationsResult.success) {
      successCount++;
      allDetails.push('', '✅ Stations:', ...(stationsResult.details || []));
    } else {
      failCount++;
      allDetails.push('', '❌ Stations:', stationsResult.message);
    }

    // Seed insurance plans
    const plansResult = await this.seedInsurancePlans(currentUserId);
    if (plansResult.success) {
      successCount++;
      allDetails.push('', '✅ Plans d\'assurance:', ...(plansResult.details || []));
    } else {
      failCount++;
      allDetails.push('', '❌ Plans d\'assurance:', plansResult.message);
    }

    // Seed health providers
    const providersResult = await this.seedHealthProviders(currentUserId);
    if (providersResult.success) {
      successCount++;
      allDetails.push('', '✅ Prestataires de santé:', ...(providersResult.details || []));
    } else {
      failCount++;
      allDetails.push('', '❌ Prestataires de santé:', providersResult.message);
    }

    // Seed loyalty tiers
    const tiersResult = await this.seedLoyaltyTiers(currentUserId);
    if (tiersResult.success) {
      successCount++;
      allDetails.push('', '✅ Niveaux de fidélité:', ...(tiersResult.details || []));
    } else {
      failCount++;
      allDetails.push('', '❌ Niveaux de fidélité:', tiersResult.message);
    }

    return {
      success: successCount > 0,
      message: `Initialisation terminée: ${successCount} réussis, ${failCount} échoués`,
      details: allDetails,
    };
  }
}

export const seedService = new SeedService();
