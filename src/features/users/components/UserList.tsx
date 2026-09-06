import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { userService } from '../services/user-service';
import type { User } from '../types';
import { CreateUserDialog } from './CreateUserDialog';

interface UserListProps {
  allowedRoles?: string[];
  currentUserRole?: string;
  roleFilter?: string;
  parentFilter?: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  agent: 'Agent Assur\'Trans',
  petrolier: 'Pétrolier',
  station: 'Station-Service',
  fleet: 'Chef de Flotte',
  driver: 'Chauffeur'
};

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 border-red-200',
  agent: 'bg-blue-100 text-blue-800 border-blue-200',
  petrolier: 'bg-purple-100 text-purple-800 border-purple-200',
  station: 'bg-orange-100 text-orange-800 border-orange-200',
  fleet: 'bg-green-100 text-green-800 border-green-200',
  driver: 'bg-gray-100 text-gray-800 border-gray-200'
};

const statusLabels: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  suspended: 'Suspendu'
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  suspended: 'bg-red-100 text-red-800 border-red-200'
};

export function UserList({ allowedRoles, currentUserRole }: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.listUsers();
      
      // Filter users by allowed roles
      const filteredUsers = data.filter(user => 
        allowedRoles.includes(user.role)
      );
      
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les utilisateurs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDeleteUser = async (user: User) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      await userService.deleteUser(user._id, user._uid);
      toast({
        title: 'Succès',
        description: 'Utilisateur supprimé avec succès',
      });
      loadUsers();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'utilisateur',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`;
    const matchesSearch = 
      fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery);
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredUsers.length} utilisateur(s)
          </p>
        </div>
        
        <Button 
          onClick={() => setShowCreateDialog(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvel Utilisateur
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom, email ou téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="w-full sm:w-48">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Tous les rôles</option>
              {allowedRoles.map(role => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* User List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun utilisateur trouvé
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filterRole !== 'all' 
                ? 'Aucun utilisateur ne correspond à vos critères de recherche.'
                : 'Commencez par créer votre premier utilisateur.'}
            </p>
            {!searchQuery && filterRole === 'all' && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Créer un utilisateur
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map(user => (
            <Card key={user._id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                {/* User Info */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {user.firstName} {user.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  <p className="text-sm text-gray-600">{user.phone}</p>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className={roleColors[user.role]}
                  >
                    {roleLabels[user.role]}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={statusColors[user.status]}
                  >
                    {statusLabels[user.status]}
                  </Badge>
                </div>

                {/* Additional Info */}
                {user.companyName && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Entreprise:</span> {user.companyName}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      toast({
                        title: 'Fonctionnalité à venir',
                        description: 'L\'édition sera disponible prochainement',
                      });
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDeleteUser(user)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        allowedRoles={allowedRoles}
        onSuccess={() => {
          loadUsers();
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}
