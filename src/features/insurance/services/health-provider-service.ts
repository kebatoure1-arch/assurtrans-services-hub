import { table } from '@devvai/devv-code-backend';
import { HealthProvider } from '../types';

const TABLE_ID = 'f4f4hkyix7uo'; // health_providers table ID

export const healthProviderService = {
  // Get all active health providers
  async getAllProviders(): Promise<HealthProvider[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          status: 'active'
        }
      });
      
      return result.items.map((provider: any) => ({
        ...provider,
        specialties: provider.specialties ? JSON.parse(provider.specialties as any) : []
      }));
    } catch (error) {
      console.error('Error fetching health providers:', error);
      return [];
    }
  },

  // Get providers by type
  async getProvidersByType(providerType: string): Promise<HealthProvider[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          providerType,
          status: 'active'
        }
      });
      
      return result.items.map((provider: any) => ({
        ...provider,
        specialties: provider.specialties ? JSON.parse(provider.specialties as any) : []
      }));
    } catch (error) {
      console.error('Error fetching providers by type:', error);
      return [];
    }
  },

  // Get providers by city
  async getProvidersByCity(city: string): Promise<HealthProvider[]> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          city,
          status: 'active'
        }
      });
      
      return result.items.map((provider: any) => ({
        ...provider,
        specialties: provider.specialties ? JSON.parse(provider.specialties as any) : []
      }));
    } catch (error) {
      console.error('Error fetching providers by city:', error);
      return [];
    }
  },

  // Get provider by ID
  async getProviderById(providerId: string): Promise<HealthProvider | null> {
    try {
      const result = await table.getItems(TABLE_ID, {
        query: {
          _id: providerId
        }
      });
      
      if (result.items.length === 0) return null;
      
      const provider: any = result.items[0];
      return {
        ...provider,
        specialties: provider.specialties ? JSON.parse(provider.specialties) : []
      } as HealthProvider;
    } catch (error) {
      console.error('Error fetching provider by ID:', error);
      return null;
    }
  },

  // Create health provider
  async createProvider(providerData: Partial<HealthProvider>): Promise<void> {
    try {
      const newProvider = {
        ...providerData,
        specialties: JSON.stringify(providerData.specialties || []),
        status: 'active',
        rating: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await table.addItem(TABLE_ID, newProvider);
    } catch (error) {
      console.error('Error creating health provider:', error);
      throw error;
    }
  },

  // Update health provider
  async updateProvider(provider: HealthProvider): Promise<void> {
    try {
      const updatedProvider = {
        ...provider,
        specialties: JSON.stringify(provider.specialties),
        updatedAt: new Date().toISOString()
      };
      
      await table.updateItem(TABLE_ID, updatedProvider);
    } catch (error) {
      console.error('Error updating health provider:', error);
      throw error;
    }
  },

  // Delete health provider (soft delete)
  async deleteProvider(providerId: string, uid: string): Promise<void> {
    try {
      const provider = await this.getProviderById(providerId);
      if (!provider) throw new Error('Provider not found');
      
      await table.updateItem(TABLE_ID, {
        ...provider,
        _uid: uid,
        specialties: JSON.stringify(provider.specialties),
        status: 'inactive',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting health provider:', error);
      throw error;
    }
  },

  // Seed initial health providers
  async seedProviders(): Promise<void> {
    try {
      const existingProviders = await this.getAllProviders();
      if (existingProviders.length > 0) {
        console.log('Health providers already seeded');
        return;
      }

      const providers = [
        {
          providerName: 'Hôpital Principal de Dakar',
          providerType: 'hospital',
          specialties: ['Urgence', 'Chirurgie', 'Cardiologie', 'Pédiatrie', 'Maternité'],
          address: 'Avenue Nelson Mandela, Dakar',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221 33 839 50 50',
          email: 'contact@hopital-principal.sn',
          operatingHours: '24/7',
          emergencyServices: 'yes',
          networkTier: 'preferred',
          contractNumber: 'CNT-HPD-2025-001'
        },
        {
          providerName: 'Clinique de la Madeleine',
          providerType: 'clinic',
          specialties: ['Médecine générale', 'Consultation', 'Analyses'],
          address: 'Rue 10, Mermoz, Dakar',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221 33 869 12 34',
          email: 'info@clinique-madeleine.sn',
          operatingHours: '08:00-18:00',
          emergencyServices: 'no',
          networkTier: 'standard',
          contractNumber: 'CNT-CLM-2025-002'
        },
        {
          providerName: 'Pharmacie du Point E',
          providerType: 'pharmacy',
          specialties: ['Médicaments', 'Conseils pharmaceutiques'],
          address: 'Point E, Dakar',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221 33 825 45 67',
          email: 'pharmacie.pointe@gmail.com',
          operatingHours: '07:00-23:00',
          emergencyServices: 'no',
          networkTier: 'preferred',
          contractNumber: 'CNT-PPE-2025-003'
        },
        {
          providerName: 'Centre Dentaire International',
          providerType: 'dental',
          specialties: ['Soins dentaires', 'Orthodontie', 'Implants'],
          address: 'Almadies, Dakar',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221 33 869 78 90',
          email: 'contact@centre-dentaire-int.sn',
          operatingHours: '09:00-19:00',
          emergencyServices: 'no',
          networkTier: 'standard',
          contractNumber: 'CNT-CDI-2025-004'
        },
        {
          providerName: 'Laboratoire Biolab',
          providerType: 'laboratory',
          specialties: ['Analyses médicales', 'Tests biologiques', 'Imagerie'],
          address: 'Sacré-Coeur, Dakar',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221 33 864 32 10',
          email: 'biolab@analyses.sn',
          operatingHours: '07:00-17:00',
          emergencyServices: 'no',
          networkTier: 'preferred',
          contractNumber: 'CNT-BIO-2025-005'
        },
        {
          providerName: 'Optique Vision Plus',
          providerType: 'optical',
          specialties: ['Lunettes', 'Lentilles', 'Examen de vue'],
          address: 'Plateau, Dakar',
          city: 'Dakar',
          country: 'Sénégal',
          phone: '+221 33 821 56 78',
          email: 'visionplus@optique.sn',
          operatingHours: '08:30-18:30',
          emergencyServices: 'no',
          networkTier: 'standard',
          contractNumber: 'CNT-OVP-2025-006'
        }
      ];

      for (const provider of providers) {
        await this.createProvider(provider);
      }

      console.log('Health providers seeded successfully');
    } catch (error) {
      console.error('Error seeding health providers:', error);
      throw error;
    }
  }
};
