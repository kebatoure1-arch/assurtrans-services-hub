/**
 * ========================================
 * 📜 Receipt History Page
 * ========================================
 * 
 * Page d'historique des reçus avec :
 * - Liste complète des reçus (fuel orders + TPE transactions)
 * - Filtrage avancé (date, type, statut, recherche)
 * - Téléchargement individuel des PDF
 * - Téléchargement en masse (zip)
 * - Export CSV
 * - Statistiques récapitulatives
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Download, FileText, Calendar, Search, Filter, Loader2, Receipt, Fuel, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  getReceiptHistory,
  exportReceiptHistoryToCSV,
  getReceiptStatistics,
  type ReceiptItem,
  type ReceiptType,
  type ReceiptStatus,
} from '@/services/receipt-history-service';
import {
  generateFuelOrderReceiptPDF,
  generateTPETransactionReceiptPDF,
  type FuelOrderReceiptData,
  type TPETransactionReceiptData,
} from '@/services/receipt-pdf-service';

export default function ReceiptHistoryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<ReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<ReceiptType>('all');
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Statistics
  const [stats, setStats] = useState({
    totalReceipts: 0,
    totalAmount: 0,
    byType: { fuel_order: 0, tpe_transaction: 0 },
    byStatus: { completed: 0, pending: 0, failed: 0, cancelled: 0 },
  });

  // Load receipts
  useEffect(() => {
    loadReceipts();
  }, []);

  // Apply filters when filters change
  useEffect(() => {
    applyFilters();
  }, [receipts, typeFilter, statusFilter, searchQuery, startDate, endDate]);

  const loadReceipts = async () => {
    try {
      setIsLoading(true);
      const [receiptData, statsData] = await Promise.all([
        getReceiptHistory({ type: 'all' }),
        getReceiptStatistics({ type: 'all' }),
      ]);
      setReceipts(receiptData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load receipts:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger l\'historique des reçus',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = receipts;

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.orderNumber?.toLowerCase().includes(query) ||
        r.transactionId?.toLowerCase().includes(query) ||
        r.customerName?.toLowerCase().includes(query) ||
        r.vehicleRegistration?.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(r => r.date >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => r.date <= end);
    }

    setFilteredReceipts(filtered);
  };

  const handleDownloadReceipt = async (receipt: ReceiptItem) => {
    try {
      setIsDownloading(true);

      let pdfBlob: Blob;

      if (receipt.type === 'fuel_order') {
        const order = receipt.rawData;
        const receiptData: FuelOrderReceiptData = {
          orderNumber: order.orderNumber,
          orderDate: new Date(order.createdAt),
          driverName: order.customerName,
          driverPhone: order.customerPhone,
          vehicleRegistration: order.vehicleRegistration,
          fuelType: order.productName,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          totalAmount: order.totalAmount,
          validationCode: order.validationCode,
          qrCodeData: order.qrCodeData,
          paymentMethod: order.paymentMethod || 'prepaid',
          stationName: order.stationName,
          stationAddress: order.stationAddress,
        };
        pdfBlob = await generateFuelOrderReceiptPDF(receiptData);
      } else {
        const transaction = receipt.rawData;
        const receiptData: TPETransactionReceiptData = {
          transactionId: transaction.transactionId,
          transactionDate: new Date(transaction.timestamp || transaction.createdAt),
          stationName: transaction.stationName || 'N/A',
          stationAddress: transaction.stationAddress,
          terminalId: transaction.terminalId || 'N/A',
          orderNumber: transaction.orderNumber || '',
          driverName: transaction.driverName || 'N/A',
          vehicleRegistration: transaction.vehicleRegistration || '',
          fuelType: transaction.fuelType || '',
          quantity: transaction.quantity || 0,
          totalAmount: transaction.amount || 0,
          paymentMethod: transaction.paymentMethod === 'mobile_money' ? 'mobile_money' : 'card',
          cardLastFour: transaction.cardMask?.slice(-4),
          qrCodeData: transaction.qrCodeData || '',
          authorizationCode: transaction.authorizationCode,
        };
        pdfBlob = await generateTPETransactionReceiptPDF(receiptData);
      }

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recu_${receipt.orderNumber || receipt.transactionId}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Téléchargement réussi',
        description: 'Le reçu PDF a été téléchargé',
      });
    } catch (error) {
      console.error('Failed to download receipt:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de télécharger le reçu',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsDownloading(true);

      const csv = await exportReceiptHistoryToCSV({
        type: typeFilter,
        status: statusFilter,
        searchQuery,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Historique_Recus_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export réussi',
        description: 'L\'historique a été exporté en CSV',
      });
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'exporter en CSV',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    toast({
      title: 'Fonctionnalité à venir',
      description: 'Le téléchargement en masse (ZIP) sera disponible prochainement',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Complétée</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">En attente</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">Échouée</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Annulée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: ReceiptType) => {
    if (type === 'fuel_order') {
      return (
        <Badge variant="outline" className="gap-1">
          <Fuel className="h-3 w-3" />
          Carburant
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="gap-1">
          <CreditCard className="h-3 w-3" />
          TPE
        </Badge>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Receipt className="h-8 w-8 text-primary" />
                Historique des Reçus
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Consultez et téléchargez tous vos reçus
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Reçus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalReceipts}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Montant Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {stats.totalAmount.toLocaleString()} <span className="text-sm">XOF</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Carburant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.byType.fuel_order}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Transactions TPE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.byType.tpe_transaction}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="list" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="list">
              <FileText className="h-4 w-4 mr-2" />
              Liste des Reçus
            </TabsTrigger>
            <TabsTrigger value="filters">
              <Filter className="h-4 w-4 mr-2" />
              Filtres
            </TabsTrigger>
          </TabsList>

          {/* Filters Tab */}
          <TabsContent value="filters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Filtrer les Reçus</CardTitle>
                <CardDescription>
                  Affinez votre recherche avec les filtres ci-dessous
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Type Filter */}
                <div className="space-y-2">
                  <Label htmlFor="type-filter">Type de Reçu</Label>
                  <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ReceiptType)}>
                    <SelectTrigger id="type-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="fuel_order">Commande carburant</SelectItem>
                      <SelectItem value="tpe_transaction">Transaction TPE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Statut</Label>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReceiptStatus)}>
                    <SelectTrigger id="status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="completed">Complétée</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="failed">Échouée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="search"
                      type="text"
                      placeholder="Numéro, client, véhicule..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Date de début</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">Date de fin</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTypeFilter('all');
                      setStatusFilter('all');
                      setSearchQuery('');
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    Réinitialiser
                  </Button>
                  <Button onClick={handleExportCSV} disabled={isDownloading}>
                    {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Exporter CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List Tab */}
          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Reçus Trouvés: {filteredReceipts.length}</CardTitle>
                    <CardDescription>
                      Cliquez sur un reçu pour le télécharger en PDF
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={handleDownloadAll} disabled={filteredReceipts.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger Tout
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredReceipts.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-600 dark:text-slate-400">
                      Aucun reçu trouvé avec ces filtres
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {filteredReceipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-primary hover:shadow-md transition-all cursor-pointer"
                          onClick={() => handleDownloadReceipt(receipt)}
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              {getTypeBadge(receipt.type)}
                              {getStatusBadge(receipt.status)}
                            </div>
                            <div className="font-medium text-slate-900">
                              {receipt.orderNumber || receipt.transactionId}
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                {format(receipt.date, 'PPp', { locale: fr })}
                              </div>
                              {receipt.customerName && (
                                <div>Client: {receipt.customerName}</div>
                              )}
                              {receipt.vehicleRegistration && (
                                <div>Véhicule: {receipt.vehicleRegistration}</div>
                              )}
                              {receipt.stationName && (
                                <div>Station: {receipt.stationName}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            <div className="text-2xl font-bold text-primary">
                              {receipt.amount.toLocaleString()} <span className="text-sm">XOF</span>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(receipt)}>
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
      </div>
    </div>
  );
}
