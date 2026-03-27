function formatNgn(n) {
  return `₦ ${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function initialsFromName(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function computeDashboard(invoices, products) {
  if (invoices.length === 0) {
    return {
      stats: {
        revenueNaira: 0,
        revenueFormatted: formatNgn(0),
        revenueTrendLabel: '—',
        outstandingNaira: 0,
        outstandingFormatted: formatNgn(0),
        overdueInvoiceCount: 0,
        openInvoiceCount: 0,
        successRatePercent: 0,
        successRateFormatted: '—',
      },
      recentInvoices: [],
      salesTrendHeights: [20, 20, 20, 20, 20],
      salesTrendLabels: ['W1', 'W2', 'W3', 'W4', 'W5'],
      payout: {
        nextDate: '—',
        estimatedNaira: 0,
        estimatedFormatted: '—',
      },
    };
  }

  const revenue = invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const outstandingInvoices = invoices.filter((i) => i.status !== 'Paid');
  const outstanding = outstandingInvoices.reduce((s, i) => s + i.amount, 0);
  const overdueCount = invoices.filter((i) => i.status === 'Overdue').length;
  const paidCount = invoices.filter((i) => i.status === 'Paid').length;
  const successRate = invoices.length ? (paidCount / invoices.length) * 100 : 0;

  const revenueTrendLabel =
    invoices.length === 0 || paidCount === 0 ? '—' : `${Math.round(successRate)}% invoices paid`;

  const recent = invoices.slice(0, 4).map((i) => ({
    customer: i.customer,
    amountNaira: i.amount,
    amountFormatted: formatNgn(i.amount),
    status: i.status,
    date: i.date,
    initials: initialsFromName(i.customer),
  }));

  const totalStockValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const n = invoices.length;
  const heights = [
    Math.min(100, 20 + (n % 5) * 10),
    Math.min(100, 25 + ((n + 1) % 5) * 10),
    Math.min(100, 30 + ((n + 2) % 5) * 10),
    Math.min(100, 40 + ((n + 3) % 5) * 10),
    Math.min(100, 35 + ((n + 4) % 5) * 10),
  ];

  return {
    stats: {
      revenueNaira: revenue,
      revenueFormatted: formatNgn(revenue),
      revenueTrendLabel,
      outstandingNaira: outstanding,
      outstandingFormatted: formatNgn(outstanding),
      overdueInvoiceCount: overdueCount,
      openInvoiceCount: outstandingInvoices.length,
      successRatePercent: Math.round(successRate * 10) / 10,
      successRateFormatted: `${Math.round(successRate * 10) / 10}%`,
    },
    recentInvoices: recent,
    salesTrendHeights: heights,
    salesTrendLabels: ['W1', 'W2', 'W3', 'W4', 'W5'],
    payout: {
      nextDate: '—',
      estimatedNaira: Math.round(totalStockValue / 1000) * 1000 || Math.round(revenue / 10),
      estimatedFormatted:
        products.length === 0 && revenue === 0
          ? '—'
          : formatNgn(Math.round(totalStockValue / 1000) * 1000 || Math.round(revenue / 10)),
    },
  };
}

export function computeInventorySummary(products) {
  if (products.length === 0) {
    return {
      totalItems: 0,
      lowStockCount: 0,
      warehouseValueUsd: 0,
      warehouseValueFormatted: '—',
      categories: 0,
      pageShown: { from: 0, to: 0, of: 0 },
    };
  }

  const lowStock = products.filter((p) => p.stock <= p.minStock).length;
  const totalStockValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const categories = new Set(products.map((p) => p.category)).size;
  const totalItems = products.reduce((s, p) => s + p.stock, 0);

  return {
    totalItems,
    lowStockCount: lowStock,
    warehouseValueUsd: totalStockValue,
    warehouseValueFormatted: `$${(totalStockValue / 1000).toFixed(1)}k`,
    categories,
    pageShown: { from: 1, to: products.length, of: products.length },
  };
}
