import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../../../core/api/api-url.service';

export interface DashboardSummary {
  readonly date: string;
  readonly timeZone: string;
  readonly revenue: number;
  readonly grossProfit: number;
  readonly transactionCount: number;
  readonly itemsSold: number;
  readonly averageBasket: number;
  readonly expenses: number;
  readonly lowStockCount: number;
  readonly salesAvailable: boolean;
  readonly accountingAvailable: boolean;
  readonly inventoryAvailable: boolean;
}

export interface SalesSummary {
  readonly fromDate: string;
  readonly toDate: string;
  readonly revenue: number;
  readonly costOfGoodsSold: number;
  readonly grossProfit: number;
  readonly transactionCount: number;
  readonly itemsSold: number;
  readonly averageTransactionValue: number;
}
export interface FinancialTrendPoint { readonly date: string; readonly netSales: number; readonly grossProfit: number; readonly expenses: number; readonly transactions: number; }
export interface PaymentMethodBreakdown { readonly method: string; readonly amount: number; readonly percentOfPayments: number; }
export interface LocationPerformance { readonly locationId: string; readonly locationName: string; readonly netSales: number; readonly grossProfit: number; readonly expenses: number; readonly transactions: number; }
export interface TopProduct { readonly productId: string; readonly productName: string; readonly netSales: number; readonly netQuantity: number; }
export interface FinancialDashboard { readonly fromDate: string; readonly toDate: string; readonly locationId: string | null; readonly netSales: number; readonly discounts: number; readonly refunds: number; readonly costOfGoodsSold: number; readonly grossProfit: number; readonly grossMarginPercent: number; readonly expenses: number; readonly operatingContribution: number; readonly transactionCount: number; readonly itemsSold: number; readonly averageTransactionValue: number; readonly dailyTrend: FinancialTrendPoint[]; readonly paymentMethods: PaymentMethodBreakdown[]; readonly locations: LocationPerformance[]; readonly topProducts: TopProduct[]; }

export interface ProductPerformance {
  readonly productId: string;
  readonly productName: string;
  readonly grossQuantitySold: number;
  readonly returnedQuantity: number;
  readonly netQuantitySold: number;
  readonly grossRevenue: number;
  readonly refundedRevenue: number;
  readonly netRevenue: number;
}

export interface VariantPerformance {
  readonly productVariantId: string;
  readonly productId: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly grossQuantitySold: number;
  readonly returnedQuantity: number;
  readonly netQuantitySold: number;
  readonly grossRevenue: number;
  readonly refundedRevenue: number;
  readonly netRevenue: number;
}

export interface InventoryReportRow {
  readonly productVariantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly quantityOnHand: number;
  readonly unitCost: number | null;
  readonly stockValue: number | null;
}

export interface InventoryReport {
  readonly locationId: string | null;
  readonly includeZeroStock: boolean;
  readonly totalVariants: number;
  readonly totalQuantityOnHand: number;
  readonly knownStockValue: number;
  readonly unvaluedQuantity: number;
  readonly totalStockValue: number | null;
  readonly items: InventoryReportRow[];
}

export interface LowStockRow {
  readonly productVariantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly sku: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly quantityOnHand: number;
  readonly reorderPoint: number;
  readonly isOutOfStock: boolean;
}

export interface LowStockReport {
  readonly locationId: string | null;
  readonly totalItems: number;
  readonly items: LowStockRow[];
}

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(ApiUrlService);

  dashboardToday(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(this.apiUrl.path('/reports/dashboard/today'));
  }

  salesSummary(fromDate: string, toDate: string): Observable<SalesSummary> {
    return this.http.get<SalesSummary>(this.apiUrl.path('/reports/sales/summary'), {
      params: new HttpParams().set('fromDate', fromDate).set('toDate', toDate),
    });
  }

  financialDashboard(fromDate: string, toDate: string, locationId: string | null): Observable<FinancialDashboard> {
    let params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    if (locationId) params = params.set('locationId', locationId);
    return this.http.get<FinancialDashboard>(this.apiUrl.path('/reports/financial-dashboard'), { params });
  }

  productPerformance(
    fromDate: string,
    toDate: string,
    rankBy: 'Quantity' | 'Revenue',
    page: PageRequest,
  ): Observable<ProductPerformance[]> {
    return this.http.get<ProductPerformance[]>(this.apiUrl.path('/reports/products/performance'), {
      params: new HttpParams()
        .set('fromDate', fromDate)
        .set('toDate', toDate)
        .set('rankBy', rankBy)
        .set('page', page.page)
        .set('pageSize', page.pageSize),
    });
  }

  variantPerformance(
    productId: string,
    fromDate: string,
    toDate: string,
  ): Observable<VariantPerformance[]> {
    return this.http.get<VariantPerformance[]>(
      this.apiUrl.path(`/reports/products/${productId}/variants`),
      {
        params: new HttpParams().set('fromDate', fromDate).set('toDate', toDate),
      },
    );
  }

  inventory(
    locationId: string | null,
    includeZeroStock: boolean,
    page: PageRequest,
  ): Observable<InventoryReport> {
    let params = new HttpParams()
      .set('includeZeroStock', String(includeZeroStock))
      .set('page', page.page)
      .set('pageSize', page.pageSize);
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    return this.http.get<InventoryReport>(this.apiUrl.path('/reports/inventory'), { params });
  }

  lowStock(locationId: string | null, page: PageRequest): Observable<LowStockReport> {
    let params = new HttpParams().set('page', page.page).set('pageSize', page.pageSize);
    if (locationId) {
      params = params.set('locationId', locationId);
    }
    return this.http.get<LowStockReport>(this.apiUrl.path('/reports/low-stock'), { params });
  }
}
