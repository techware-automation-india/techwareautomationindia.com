import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Package,
  Trash2,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

const ProductCatalog = () => {
  const [items, setItems] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [root1, setRoot1] = useState("");
  const [root2, setRoot2] = useState("");
  const [root3, setRoot3] = useState("");
  const [root4, setRoot4] = useState("");
  const [quantities, setQuantities] = useState({});
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiGet("/inventory/items"), apiGet("/inventory/categories")])
      .then(([itemsData, catsData]) => {
        const list = Array.isArray(itemsData) ? itemsData : itemsData.items || [];
        const cats = Array.isArray(catsData) ? catsData : catsData.categories || [];
        setItems(list);
        setCategoriesList(cats);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load product catalog.");
      })
      .finally(() => setLoading(false));
  }, []);

  const root1Options = useMemo(
    () => categoriesList.filter((c) => !c.parentId),
    [categoriesList]
  );
  const root2Options = useMemo(
    () => (root1 ? categoriesList.filter((c) => c.parentId === root1) : []),
    [categoriesList, root1]
  );
  const root3Options = useMemo(
    () => (root2 ? categoriesList.filter((c) => c.parentId === root2) : []),
    [categoriesList, root2]
  );
  const root4Options = useMemo(
    () => (root3 ? categoriesList.filter((c) => c.parentId === root3) : []),
    [categoriesList, root3]
  );

  const selectedCategoryIds = useMemo(() => {
    const activeRoot = root4 || root3 || root2 || root1;
    if (!activeRoot) return null;
    const ids = new Set([activeRoot]);
    let added = true;
    while (added) {
      added = false;
      for (const c of categoriesList) {
        if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
          ids.add(c.id);
          added = true;
        }
      }
    }
    return ids;
  }, [categoriesList, root1, root2, root3, root4]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const itemCatId = item.categoryId || item.category?.id;
      const matchesCat = !selectedCategoryIds || selectedCategoryIds.has(itemCatId);
      const matchesSearch =
        !search ||
        (item.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.size || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.sku || "").toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [items, search, selectedCategoryIds]);

  const getQty = (id) => quantities[id] || 1;

  const setQty = (id, val) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, val) }));
  };

  const addToCart = (item) => {
    const qty = getQty(item.id);
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + qty } : c));
      }
      return [...prev, { ...item, qty }];
    });
    toast.success(`Added ${qty} × ${item.name} to cart`);
  };

  const updateCartQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    toast.success(`Order request submitted for ${cart.length} item(s)! Our team will contact you shortly.`);
    setCart([]);
    setCartOpen(false);
  };

  const totalCartItems = cart.reduce((sum, c) => sum + c.qty, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            Product Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse automation parts & components, check sizes, and select quantities to order.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Cart ({totalCartItems})</span>
        </button>
      </div>

      {/* Root 1 -> Root 2 -> Root 3 -> Root 4 -> Item Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          value={root1}
          onChange={(e) => {
            setRoot1(e.target.value);
            setRoot2("");
            setRoot3("");
            setRoot4("");
          }}
          className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm"
        >
          <option value="">All Root 1</option>
          {root1Options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={root2}
          disabled={!root1 || root2Options.length === 0}
          onChange={(e) => {
            setRoot2(e.target.value);
            setRoot3("");
            setRoot4("");
          }}
          className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm disabled:opacity-50"
        >
          <option value="">All Root 2</option>
          {root2Options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={root3}
          disabled={!root2 || root3Options.length === 0}
          onChange={(e) => {
            setRoot3(e.target.value);
            setRoot4("");
          }}
          className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm disabled:opacity-50"
        >
          <option value="">All Root 3</option>
          {root3Options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={root4}
          disabled={!root3 || root4Options.length === 0}
          onChange={(e) => setRoot4(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm disabled:opacity-50"
        >
          <option value="">All Root 4</option>
          {root4Options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, size, SKU..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="py-16 flex justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-border bg-card text-muted-foreground text-sm">
          No products found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((item) => {
            const qty = getQty(item.id);
            const inStock = (item.quantity ?? item.stock ?? 1) > 0;
            const catName = item.category?.name || item.categoryName || "Component";
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div>
                  {/* Image */}
                  <div className="h-44 bg-muted/40 flex items-center justify-center overflow-hidden border-b border-border/60">
                    {item.imageUrl || item.image ? (
                      <img
                        src={item.imageUrl || item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {catName}
                      </span>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          inStock
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-rose-500/10 text-rose-600"
                        }`}
                      >
                        {inStock ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm text-foreground line-clamp-2">
                      {item.name}
                    </h3>

                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {item.size && <p>Size: {item.size}</p>}
                      {item.unit?.name && <p>Unit: {item.unit.name}</p>}
                    </div>
                  </div>
                </div>

                {/* Qty & Add to Cart */}
                <div className="p-4 pt-0 space-y-2.5">
                  <div className="flex items-center justify-between border border-border rounded-xl px-2 py-1 bg-background">
                    <button
                      type="button"
                      onClick={() => setQty(item.id, qty - 1)}
                      className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-semibold">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(item.id, qty + 1)}
                      className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!inStock}
                    onClick={() => addToCart(item)}
                    className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="w-full max-w-md bg-card h-full border-l border-border p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Your Order Cart ({totalCartItems})
                </h2>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  Your cart is empty. Add products from the catalog.
                </p>
              ) : (
                <div className="space-y-3">
                  {cart.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl border border-border bg-background flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        {c.size && (
                          <p className="text-xs text-muted-foreground">Size: {c.size}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(c.id, -1)}
                          className="p-1 rounded border border-border hover:bg-muted cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-semibold w-5 text-center">{c.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(c.id, 1)}
                          className="p-1 rounded border border-border hover:bg-muted cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(c.id)}
                          className="p-1 text-rose-600 hover:bg-rose-500/10 rounded cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Submit Order Request</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;
