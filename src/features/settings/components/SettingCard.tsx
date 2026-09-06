/**
 * Setting Card Component - Display and edit individual settings
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Edit2, Save, X, Trash2 } from 'lucide-react';
import type { SystemSetting } from '../types';

interface SettingCardProps {
  setting: SystemSetting;
  onSave: (id: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SettingCard({ setting, onSave, onDelete }: SettingCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(setting.setting_value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(setting._id, value);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving setting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(setting.setting_value);
    setIsEditing(false);
  };

  const renderValueInput = () => {
    if (setting.data_type === 'boolean') {
      return (
        <div className="flex items-center space-x-2">
          <Switch
            checked={value === 'true'}
            onCheckedChange={(checked) => setValue(checked ? 'true' : 'false')}
            disabled={!isEditing}
          />
          <Label>{value === 'true' ? 'Activé' : 'Désactivé'}</Label>
        </div>
      );
    }

    return (
      <Input
        type={setting.data_type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!isEditing}
        className="max-w-xs"
      />
    );
  };

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base font-medium">
              {setting.setting_key}
            </CardTitle>
            <CardDescription className="text-sm">
              {setting.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={setting.is_public === 'yes' ? 'default' : 'secondary'}>
              {setting.is_public === 'yes' ? 'Public' : 'Privé'}
            </Badge>
            <Badge variant="outline">{setting.data_type}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {renderValueInput()}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Modifié: {new Date(setting.updated_at).toLocaleDateString('fr-FR')}
            </p>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete(setting._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
