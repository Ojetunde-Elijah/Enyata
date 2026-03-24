import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { getInventorySummary, getProducts, type InventorySummary } from '../api/client';
import type { Product } from '../types';
import { cn } from '../utils/cn';
import { Filter, Plus, MoreVertical, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, s] = await Promise.all([getProducts(), getInventorySummary()]);
        if (!cancelled) {
          setProducts(p);
          setSummary(s);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load inventory');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <Layout title="Inventory Management">
        <p className="text-error font-medium">{err}</p>
      </Layout>
    );
  }

  if (!summary) {
    return (
      <Layout title="Inventory Management">
        <p className="text-on-surface-variant font-medium">Loading inventory…</p>
      </Layout>
    );
  }

  return (
    <Layout title="Inventory Management">
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-on-surface mb-1">Inventory Management</h2>
            <p className="text-on-surface-variant">Real-time stock monitoring and warehouse logistics.</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-high text-on-primary-fixed-variant font-semibold rounded-xl transition-all hover:bg-surface-container-highest active:scale-95">
              <Filter className="w-5 h-5" />
              <span>Filter</span>
            </button>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-white font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95">
              <Plus className="w-5 h-5" />
              <span>Add New Item</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-surface-container-low p-6 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">Total Items</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface">{summary.totalItems.toLocaleString()}</span>
              <span className="text-xs font-medium text-tertiary">+12%</span>
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl border-l-4 border-amber-500">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">
              Low Stock Alerts
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">{summary.lowStockCount}</span>
              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">Action Needed</span>
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">
              Warehouse Value
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface">{summary.warehouseValueFormatted}</span>
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">Categories</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface">{summary.categories}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Product Details
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">SKU</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Category
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Stock Level
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Unit Price
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Status
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant text-sm font-medium">
                      No products yet. Add inventory data via a future import or API — your workspace starts empty
                      after signup.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                  <tr key={product.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface-container-high overflow-hidden flex-shrink-0">
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{product.name}</p>
                          <p className="text-xs text-on-surface-variant">{product.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">{product.sku}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-on-secondary-container px-2 py-1 bg-secondary-container rounded-lg">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center w-32">
                          <span
                            className={cn(
                              'text-sm font-bold',
                              product.stock <= product.minStock / 2
                                ? 'text-error'
                                : product.stock <= product.minStock
                                  ? 'text-amber-600'
                                  : 'text-on-surface'
                            )}
                          >
                            {product.stock} units
                          </span>
                          <span className="text-[10px] text-on-surface-variant">Min: {product.minStock}</span>
                        </div>
                        <div className="w-32 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              product.stock <= product.minStock / 2
                                ? 'bg-error'
                                : product.stock <= product.minStock
                                  ? 'bg-amber-500'
                                  : 'bg-primary-container'
                            )}
                            style={{ width: `${Math.min((product.stock / product.minStock) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-on-surface">${product.price.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-outline-variant hover:text-primary transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-outline-variant/10 flex justify-between items-center">
            <p className="text-xs text-on-surface-variant">
              Showing{' '}
              <span className="font-bold text-on-surface">
                {summary.pageShown.from} - {summary.pageShown.to}
              </span>{' '}
              of <span className="font-bold text-on-surface">{summary.pageShown.of}</span> items
            </p>
            <div className="flex gap-2">
              <button
                className="p-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-30"
                disabled
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-bold">1</button>
              <button className="px-3 py-1 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors text-xs font-bold">
                2
              </button>
              <button className="px-3 py-1 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors text-xs font-bold">
                3
              </button>
              <button className="p-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-primary-container text-on-primary-container p-8 rounded-3xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2 text-white">Stock Optimization Insight</h3>
              <p className="text-sm opacity-80 max-w-lg mb-6 leading-relaxed">
                Based on your Q3 projection, increasing stock for 'Electronics' by 15% will prevent seasonal
                bottlenecks. Automated reordering is active for 4 core categories.
              </p>
              <button className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-6 py-2 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all">
                View Analytics
              </button>
            </div>
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-surface-tint opacity-20 blur-3xl rounded-full"></div>
          </div>
          <div className="bg-tertiary-container p-8 rounded-3xl flex flex-col justify-between">
            <div>
              <ShieldCheck className="text-tertiary-fixed w-10 h-10 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Audit Ready</h3>
              <p className="text-sm text-tertiary-fixed/70">
                All inventory logs are synced as of {new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}{' '}
                today.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-tertiary-fixed font-bold text-sm cursor-pointer hover:translate-x-1 transition-transform">
              <span>Generate Report</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
