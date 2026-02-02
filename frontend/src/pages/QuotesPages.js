import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, formatCurrency, formatDate, getStatusColor } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
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
  Eye,
  ArrowLeft,
  CalendarIcon,
  FileText,
  ArrowRightCircle,
  Loader2,
  Search,
} from "lucide-react";

// Quotes List Page
export const QuotesPage = () => {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const data = await api.get("/quotes");
      setQuotes(data);
    } catch (err) {
      toast.error("Failed to load quotes");
    } finally {
      setLoading(false);
    }
  };

  const filteredQuotes = quotes.filter(
    (q) =>
      q.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.quote_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="quotes-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Quotes</h1>
          <p className="text-muted-foreground mt-1">Manage your quotes and proposals</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => navigate("/quotes/new")}
            className="rounded-full shadow-glow-cyan"
            data-testid="new-quote-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Quote
          </Button>
        )}
      </div>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl"
              data-testid="search-quotes"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No quotes found</p>
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/quotes/new")}
                  className="mt-4 rounded-full"
                >
                  Create your first quote
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow key={quote.id} className="cursor-pointer hover:bg-accent/50">
                      <TableCell className="font-mono text-sm">{quote.quote_number}</TableCell>
                      <TableCell className="font-medium">{quote.client_name}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(quote.total)}</TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(quote.status)} capitalize`}>
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(quote.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/quotes/${quote.id}`)}
                          className="rounded-full"
                          data-testid={`view-quote-${quote.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/quotes/${quote.id}/edit`)}
                            className="rounded-full"
                            data-testid={`edit-quote-${quote.id}`}
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

// Quote Form Component
const QuoteForm = ({ initialData, onSubmit, loading }) => {
  const [formData, setFormData] = useState(
    initialData || {
      client_name: "",
      client_email: "",
      client_address: "",
      items: [{ description: "", quantity: 1, price: 0 }],
      notes: "",
      valid_until: null,
      status: "draft",
    }
  );

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: 1, price: 0 }],
    });
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index),
      });
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const subtotal = formData.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.client_name || !formData.client_email) {
      toast.error("Please fill in client details");
      return;
    }
    if (formData.items.some((item) => !item.description)) {
      toast.error("Please fill in all item descriptions");
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client Name *</Label>
              <Input
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                className="rounded-xl"
                placeholder="John Doe"
                data-testid="client-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Email *</Label>
              <Input
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                className="rounded-xl"
                placeholder="john@example.com"
                data-testid="client-email"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea
              value={formData.client_address}
              onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
              className="rounded-xl"
              placeholder="123 Main St, City, State 12345"
              data-testid="client-address"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="rounded-full">
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <div key={index} className="flex gap-3 items-start p-4 rounded-xl bg-accent/30">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    className="rounded-xl"
                    data-testid={`item-description-${index}`}
                  />
                </div>
                <div className="w-24 space-y-2">
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                    className="rounded-xl"
                    data-testid={`item-quantity-${index}`}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Input
                    type="number"
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) => updateItem(index, "price", parseFloat(e.target.value) || 0)}
                    className="rounded-xl"
                    data-testid={`item-price-${index}`}
                  />
                </div>
                <div className="w-28 text-right font-mono pt-2">
                  {formatCurrency(item.quantity * item.price)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  disabled={formData.items.length === 1}
                  className="rounded-full text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (10%)</span>
              <span className="font-mono">{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2">
              <span>Total</span>
              <span className="font-mono text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading">Additional Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start rounded-xl">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.valid_until ? format(new Date(formData.valid_until), "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl">
                  <Calendar
                    mode="single"
                    selected={formData.valid_until ? new Date(formData.valid_until) : undefined}
                    onSelect={(date) =>
                      setFormData({ ...formData, valid_until: date?.toISOString().split("T")[0] })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="rounded-xl" data-testid="quote-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
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
              placeholder="Additional notes or terms..."
              data-testid="quote-notes"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading} className="rounded-full shadow-glow-cyan" data-testid="save-quote">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Quote
        </Button>
      </div>
    </form>
  );
};

// Create Quote Page
export const CreateQuotePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post("/quotes", data);
      toast.success("Quote created successfully");
      navigate("/quotes");
    } catch (err) {
      toast.error(err.message || "Failed to create quote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="create-quote-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-heading">New Quote</h1>
          <p className="text-muted-foreground mt-1">Create a new quote for your client</p>
        </div>
      </div>

      <QuoteForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
};

// Edit Quote Page
export const EditQuotePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const fetchQuote = async () => {
    try {
      const data = await api.get(`/quotes/${id}`);
      setQuote(data);
    } catch (err) {
      toast.error("Failed to load quote");
      navigate("/quotes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      await api.put(`/quotes/${id}`, data);
      toast.success("Quote updated successfully");
      navigate(`/quotes/${id}`);
    } catch (err) {
      toast.error(err.message || "Failed to update quote");
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
    <div className="space-y-6" data-testid="edit-quote-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/quotes/${id}`)} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-heading">Edit Quote</h1>
          <p className="text-muted-foreground mt-1">{quote?.quote_number}</p>
        </div>
      </div>

      <QuoteForm initialData={quote} onSubmit={handleSubmit} loading={saving} />
    </div>
  );
};

// View Quote Page
export const ViewQuotePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = useAuth();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const fetchQuote = async () => {
    try {
      const data = await api.get(`/quotes/${id}`);
      setQuote(data);
    } catch (err) {
      toast.error("Failed to load quote");
      navigate("/quotes");
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToInvoice = async () => {
    setConverting(true);
    try {
      const invoice = await api.post(`/quotes/${id}/convert-to-invoice`);
      toast.success("Quote converted to invoice");
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(err.message || "Failed to convert quote");
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/quotes/${id}`);
      toast.success("Quote deleted");
      navigate("/quotes");
    } catch (err) {
      toast.error(err.message || "Failed to delete quote");
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
    <div className="space-y-6" data-testid="view-quote-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-heading">{quote.quote_number}</h1>
            <Badge className={`${getStatusColor(quote.status)} capitalize mt-1`}>{quote.status}</Badge>
          </div>
        </div>
        {canEdit && quote.status !== "converted" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/quotes/${id}/edit`)}
              className="rounded-full"
              data-testid="edit-quote-btn"
            >
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button
              onClick={handleConvertToInvoice}
              disabled={converting}
              className="rounded-full shadow-glow-magenta bg-secondary"
              data-testid="convert-to-invoice-btn"
            >
              {converting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ArrowRightCircle className="w-4 h-4 mr-2" />
              )}
              Convert to Invoice
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              className="rounded-full"
              data-testid="delete-quote-btn"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="font-heading">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.quantity * item.price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-6 pt-6 border-t border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (10%)</span>
                <span className="font-mono">{formatCurrency(quote.tax)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2">
                <span>Total</span>
                <span className="font-mono text-primary">{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="font-heading">Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{quote.client_name}</p>
              <p className="text-sm text-muted-foreground">{quote.client_email}</p>
              {quote.client_address && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">{quote.client_address}</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="font-heading">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(quote.created_at)}</span>
              </div>
              {quote.valid_until && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span>{formatDate(quote.valid_until)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {quote.notes && (
            <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="font-heading">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Delete Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
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
