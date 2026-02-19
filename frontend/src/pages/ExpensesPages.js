import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, formatCurrency, formatDate, API_URL, getAuthHeaders } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Edit,
  ArrowLeft,
  CalendarIcon,
  Wallet,
  Upload,
  Image,
  Tag,
  Building2,
  Loader2,
  Search,
  X,
} from "lucide-react";

// Expenses List Page
export const ExpensesPage = () => {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [newCategory, setNewCategory] = useState({ name: "", color: "#06b6d4" });
  const [newVendor, setNewVendor] = useState({ name: "", email: "", phone: "", address: "" });
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [expensesData, categoriesData, vendorsData] = await Promise.all([
        api.get("/expenses"),
        api.get("/categories"),
        api.get("/vendors"),
      ]);
      setExpenses(expensesData);
      setCategories(categoriesData);
      setVendors(vendorsData);
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      toast.error("Please enter a category name");
      return;
    }
    try {
      await api.post("/categories", newCategory);
      toast.success("Category created");
      setNewCategory({ name: "", color: "#06b6d4" });
      setCategoryDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await api.delete(`/categories/${id}`);
      toast.success("Category deleted");
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddVendor = async () => {
    if (!newVendor.name) {
      toast.error("Please enter a vendor name");
      return;
    }
    try {
      await api.post("/vendors", newVendor);
      toast.success("Vendor created");
      setNewVendor({ name: "", email: "", phone: "", address: "" });
      setVendorDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteVendor = async (id) => {
    try {
      await api.delete(`/vendors/${id}`);
      toast.success("Vendor deleted");
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || exp.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="expenses-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Expenses</h1>
          <p className="text-muted-foreground mt-1">Track and manage your business expenses</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full" data-testid="manage-categories-btn">
                  <Tag className="w-4 h-4 mr-2" /> Categories
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Manage Categories</DialogTitle>
                  <DialogDescription>Add or remove expense categories</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Category name"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      className="rounded-xl"
                      data-testid="new-category-name"
                    />
                    <Input
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      className="w-14 h-10 rounded-xl p-1"
                    />
                    <Button onClick={handleAddCategory} className="rounded-full" data-testid="add-category-btn">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-2 rounded-xl bg-accent/30">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span>{cat.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="rounded-full text-destructive h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full" data-testid="manage-vendors-btn">
                  <Building2 className="w-4 h-4 mr-2" /> Vendors
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Manage Vendors</DialogTitle>
                  <DialogDescription>Add or remove vendors</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Input
                      placeholder="Vendor name"
                      value={newVendor.name}
                      onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                      className="rounded-xl"
                      data-testid="new-vendor-name"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Email"
                        value={newVendor.email}
                        onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                        className="rounded-xl"
                      />
                      <Input
                        placeholder="Phone"
                        value={newVendor.phone}
                        onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <Button onClick={handleAddVendor} className="w-full rounded-full" data-testid="add-vendor-btn">
                      <Plus className="w-4 h-4 mr-2" /> Add Vendor
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {vendors.map((vendor) => (
                      <div key={vendor.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/30">
                        <div>
                          <p className="font-medium">{vendor.name}</p>
                          {vendor.email && <p className="text-sm text-muted-foreground">{vendor.email}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteVendor(vendor.id)}
                          className="rounded-full text-destructive h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => navigate("/expenses/new")}
              className="rounded-full shadow-glow-magenta bg-secondary"
              data-testid="new-expense-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Expense
            </Button>
          </div>
        )}
      </div>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl"
                data-testid="search-expenses"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] rounded-xl" data-testid="category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No expenses found</p>
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/expenses/new")}
                  className="mt-4 rounded-full"
                >
                  Add your first expense
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id} className="cursor-pointer hover:bg-accent/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expense.receipt_url && <Image className="w-4 h-4 text-primary" />}
                          <span className="font-medium">{expense.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: categories.find((c) => c.id === expense.category_id)?.color || "#666",
                            }}
                          />
                          {expense.category_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {expense.vendor_name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(expense.date)}</TableCell>
                      <TableCell className="text-right font-mono text-secondary">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/expenses/${expense.id}/edit`)}
                            className="rounded-full"
                            data-testid={`edit-expense-${expense.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Expense Form Component
const ExpenseForm = ({ initialData, categories, vendors, onSubmit, loading }) => {
  const [formData, setFormData] = useState(
    initialData || {
      description: "",
      amount: 0,
      category_id: "",
      vendor_id: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    }
  );
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(initialData?.receipt_url || null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.description || !formData.category_id || !formData.date) {
      toast.error("Please fill in required fields");
      return;
    }
    if (formData.amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    onSubmit(formData, receiptFile);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading">Expense Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="rounded-xl"
              placeholder="Office supplies, Travel, etc."
              data-testid="expense-description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="rounded-xl"
                placeholder="0.00"
                data-testid="expense-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start rounded-xl" data-testid="expense-date">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(new Date(formData.date), "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl">
                  <Calendar
                    mode="single"
                    selected={formData.date ? new Date(formData.date) : undefined}
                    onSelect={(date) =>
                      setFormData({ ...formData, date: date?.toISOString().split("T")[0] })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger className="rounded-xl" data-testid="expense-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select
                value={formData.vendor_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, vendor_id: value === "none" ? "" : value })}
              >
                <SelectTrigger className="rounded-xl" data-testid="expense-vendor">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">No vendor</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="rounded-xl"
              placeholder="Additional details..."
              data-testid="expense-notes"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading">Receipt</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            data-testid="receipt-input"
          />
          
          {receiptPreview ? (
            <div className="relative">
              <img
                src={receiptPreview.startsWith("blob:") ? receiptPreview : `${API_URL}${receiptPreview}`}
                alt="Receipt preview"
                className="w-full max-h-64 object-contain rounded-xl"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 rounded-full"
                onClick={() => {
                  setReceiptFile(null);
                  setReceiptPreview(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Click to upload receipt</p>
              <p className="text-xs text-muted-foreground mt-1">Max 10MB - JPEG, PNG, GIF, WEBP</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading} className="rounded-full shadow-glow-magenta bg-secondary" data-testid="save-expense">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Expense
        </Button>
      </div>
    </form>
  );
};

// Create Expense Page
export const CreateExpensePage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [categoriesData, vendorsData] = await Promise.all([
        api.get("/categories"),
        api.get("/vendors"),
      ]);
      setCategories(categoriesData);
      setVendors(vendorsData);
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data, receiptFile) => {
    setSaving(true);
    try {
      const expense = await api.post("/expenses", data);
      
      if (receiptFile) {
        await api.upload(`/expenses/${expense.id}/upload-receipt`, receiptFile);
      }
      
      toast.success("Expense created successfully");
      navigate("/expenses");
    } catch (err) {
      toast.error(err.message || "Failed to create expense");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="create-expense-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/expenses")} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-heading">New Expense</h1>
          <p className="text-muted-foreground mt-1">Record a new business expense</p>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardContent className="p-12 text-center">
            <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Please create at least one category first</p>
            <Button onClick={() => navigate("/expenses")} className="rounded-full">
              Go to Expenses
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ExpenseForm
          categories={categories}
          vendors={vendors}
          onSubmit={handleSubmit}
          loading={saving}
        />
      )}
    </div>
  );
};

// Edit Expense Page
export const EditExpensePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [expense, setExpense] = useState(null);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [expenseData, categoriesData, vendorsData] = await Promise.all([
        api.get(`/expenses/${id}`),
        api.get("/categories"),
        api.get("/vendors"),
      ]);
      setExpense(expenseData);
      setCategories(categoriesData);
      setVendors(vendorsData);
    } catch (err) {
      toast.error("Failed to load data");
      navigate("/expenses");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data, receiptFile) => {
    setSaving(true);
    try {
      await api.put(`/expenses/${id}`, data);
      
      if (receiptFile) {
        await api.upload(`/expenses/${id}/upload-receipt`, receiptFile);
      }
      
      toast.success("Expense updated successfully");
      navigate("/expenses");
    } catch (err) {
      toast.error(err.message || "Failed to update expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/expenses/${id}`);
      toast.success("Expense deleted");
      navigate("/expenses");
    } catch (err) {
      toast.error(err.message || "Failed to delete expense");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="edit-expense-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/expenses")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-heading">Edit Expense</h1>
            <p className="text-muted-foreground mt-1">{expense?.description}</p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          className="rounded-full"
          data-testid="delete-expense-btn"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete
        </Button>
      </div>

      <ExpenseForm
        initialData={expense}
        categories={categories}
        vendors={vendors}
        onSubmit={handleSubmit}
        loading={saving}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-full">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
