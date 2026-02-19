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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Trash2, Edit, Eye, ArrowLeft, CalendarIcon, FileText, ArrowRightCircle, Loader2, Search, Download, Mail } from "lucide-react";

function QuoteRow({ quote, canEdit, onView, onEdit }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{quote.quote_number}</TableCell>
      <TableCell className="font-medium">{quote.client_name}</TableCell>
      <TableCell className="font-mono">{formatCurrency(quote.total)}</TableCell>
      <TableCell><Badge className={getStatusColor(quote.status) + " capitalize"}>{quote.status}</Badge></TableCell>
      <TableCell className="text-muted-foreground">{formatDate(quote.created_at)}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={onView} className="rounded-full"><Eye className="w-4 h-4" /></Button>
        {canEdit && <Button variant="ghost" size="icon" onClick={onEdit} className="rounded-full"><Edit className="w-4 h-4" /></Button>}
      </TableCell>
    </TableRow>
  );
}

function ItemRow({ item, index, onUpdate, onRemove, canRemove }) {
  return (
    <div className="flex gap-3 items-start p-4 rounded-xl bg-accent/30">
      <Input placeholder="Description" value={item.description} onChange={function(e) { onUpdate(index, "description", e.target.value); }} className="flex-1 rounded-xl" />
      <Input type="number" placeholder="Qty" value={item.quantity} onChange={function(e) { onUpdate(index, "quantity", parseInt(e.target.value) || 0); }} className="w-20 rounded-xl" />
      <Input type="number" placeholder="Price" value={item.price} onChange={function(e) { onUpdate(index, "price", parseFloat(e.target.value) || 0); }} className="w-28 rounded-xl" />
      <div className="w-24 text-right font-mono pt-2">{formatCurrency(item.quantity * item.price)}</div>
      <Button type="button" variant="ghost" size="icon" onClick={function() { onRemove(index); }} disabled={!canRemove} className="rounded-full text-destructive"><Trash2 className="w-4 h-4" /></Button>
    </div>
  );
}

function ViewItemRow({ item }) {
  return (
    <TableRow>
      <TableCell>{item.description}</TableCell>
      <TableCell className="text-right">{item.quantity}</TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(item.price)}</TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(item.quantity * item.price)}</TableCell>
    </TableRow>
  );
}

export function QuotesPage() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(function() {
    api.get("/quotes").then(function(data) { setQuotes(data); }).catch(function() { toast.error("Failed to load quotes"); }).finally(function() { setLoading(false); });
  }, []);

  const filtered = quotes.filter(function(q) {
    return q.client_name.toLowerCase().includes(searchTerm.toLowerCase()) || q.quote_number.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const rows = [];
  for (let i = 0; i < filtered.length; i++) {
    const q = filtered[i];
    rows.push(<QuoteRow key={q.id} quote={q} canEdit={canEdit} onView={function() { navigate("/quotes/" + q.id); }} onEdit={function() { navigate("/quotes/" + q.id + "/edit"); }} />);
  }

  return (
    <div className="space-y-6" data-testid="quotes-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Quotes</h1>
          <p className="text-muted-foreground mt-1">Manage your quotes and proposals</p>
        </div>
        {canEdit && <Button onClick={function() { navigate("/quotes/new"); }} className="rounded-full shadow-glow-cyan" data-testid="new-quote-btn"><Plus className="w-4 h-4 mr-2" />New Quote</Button>}
      </div>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search quotes..." value={searchTerm} onChange={function(e) { setSearchTerm(e.target.value); }} className="pl-10 rounded-xl" data-testid="search-quotes" />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12"><FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No quotes found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Quote #</TableHead><TableHead>Client</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{rows}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CreateQuotePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: 1, price: 0 }]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(null);
  const [status, setStatus] = useState("draft");

  function addItem() { setItems([...items, { description: "", quantity: 1, price: 0 }]); }
  function removeItem(idx) { if (items.length > 1) setItems(items.filter(function(_, i) { return i !== idx; })); }
  function updateItem(idx, field, val) {
    const newItems = items.slice();
    newItems[idx] = { ...newItems[idx], [field]: val };
    setItems(newItems);
  }

  let subtotal = 0;
  for (let i = 0; i < items.length; i++) { subtotal += items[i].quantity * items[i].price; }
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  function handleSubmit(e) {
    e.preventDefault();
    if (!clientName || !clientEmail) { toast.error("Please fill client details"); return; }
    setLoading(true);
    api.post("/quotes", { client_name: clientName, client_email: clientEmail, client_address: clientAddress, items: items, notes: notes, valid_until: validUntil, status: status })
      .then(function() { toast.success("Quote created"); navigate("/quotes"); })
      .catch(function(err) { toast.error(err.message); })
      .finally(function() { setLoading(false); });
  }

  const itemRows = [];
  for (let i = 0; i < items.length; i++) {
    itemRows.push(<ItemRow key={i} item={items[i]} index={i} onUpdate={updateItem} onRemove={removeItem} canRemove={items.length > 1} />);
  }

  return (
    <div className="space-y-6" data-testid="create-quote-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={function() { navigate("/quotes"); }} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
        <div><h1 className="text-3xl font-bold font-heading">New Quote</h1></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader><CardTitle>Client Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Client Name *</Label><Input value={clientName} onChange={function(e) { setClientName(e.target.value); }} className="rounded-xl" data-testid="client-name" /></div>
              <div className="space-y-2"><Label>Client Email *</Label><Input type="email" value={clientEmail} onChange={function(e) { setClientEmail(e.target.value); }} className="rounded-xl" data-testid="client-email" /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={clientAddress} onChange={function(e) { setClientAddress(e.target.value); }} className="rounded-xl" /></div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Line Items</CardTitle><Button type="button" variant="outline" size="sm" onClick={addItem} className="rounded-full"><Plus className="w-4 h-4 mr-1" /> Add</Button></CardHeader>
          <CardContent>
            <div className="space-y-4">{itemRows}</div>
            <div className="mt-6 pt-6 border-t space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax (10%)</span><span className="font-mono">{formatCurrency(tax)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2"><span>Total</span><span className="font-mono text-primary">{formatCurrency(total)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader><CardTitle>Additional Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start rounded-xl"><CalendarIcon className="mr-2 h-4 w-4" />{validUntil ? format(new Date(validUntil), "PPP") : "Select date"}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl"><Calendar mode="single" selected={validUntil ? new Date(validUntil) : undefined} onSelect={function(d) { setValidUntil(d ? d.toISOString().split("T")[0] : null); }} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="draft">Draft</SelectItem><SelectItem value="sent">Sent</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} className="rounded-xl" /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button type="submit" disabled={loading} className="rounded-full shadow-glow-cyan" data-testid="save-quote">{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Quote</Button></div>
      </form>
    </div>
  );
}

export function EditQuotePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(null);
  const [status, setStatus] = useState("draft");

  useEffect(function() {
    api.get("/quotes/" + id).then(function(data) {
      setQuote(data);
      setClientName(data.client_name);
      setClientEmail(data.client_email);
      setClientAddress(data.client_address || "");
      setItems(data.items);
      setNotes(data.notes || "");
      setValidUntil(data.valid_until);
      setStatus(data.status);
    }).catch(function() { toast.error("Failed to load quote"); navigate("/quotes"); }).finally(function() { setLoading(false); });
  }, [id, navigate]);

  function addItem() { setItems([...items, { description: "", quantity: 1, price: 0 }]); }
  function removeItem(idx) { if (items.length > 1) setItems(items.filter(function(_, i) { return i !== idx; })); }
  function updateItem(idx, field, val) {
    const newItems = items.slice();
    newItems[idx] = { ...newItems[idx], [field]: val };
    setItems(newItems);
  }

  let subtotal = 0;
  for (let i = 0; i < items.length; i++) { subtotal += items[i].quantity * items[i].price; }
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    api.put("/quotes/" + id, { client_name: clientName, client_email: clientEmail, client_address: clientAddress, items: items, notes: notes, valid_until: validUntil, status: status })
      .then(function() { toast.success("Quote updated"); navigate("/quotes/" + id); })
      .catch(function(err) { toast.error(err.message); })
      .finally(function() { setSaving(false); });
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const itemRows = [];
  for (let i = 0; i < items.length; i++) {
    itemRows.push(<ItemRow key={i} item={items[i]} index={i} onUpdate={updateItem} onRemove={removeItem} canRemove={items.length > 1} />);
  }

  return (
    <div className="space-y-6" data-testid="edit-quote-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={function() { navigate("/quotes/" + id); }} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
        <div><h1 className="text-3xl font-bold font-heading">Edit Quote</h1>{quote && <p className="text-muted-foreground">{quote.quote_number}</p>}</div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader><CardTitle>Client Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Client Name *</Label><Input value={clientName} onChange={function(e) { setClientName(e.target.value); }} className="rounded-xl" /></div>
              <div className="space-y-2"><Label>Client Email *</Label><Input type="email" value={clientEmail} onChange={function(e) { setClientEmail(e.target.value); }} className="rounded-xl" /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={clientAddress} onChange={function(e) { setClientAddress(e.target.value); }} className="rounded-xl" /></div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Line Items</CardTitle><Button type="button" variant="outline" size="sm" onClick={addItem} className="rounded-full"><Plus className="w-4 h-4 mr-1" /> Add</Button></CardHeader>
          <CardContent>
            <div className="space-y-4">{itemRows}</div>
            <div className="mt-6 pt-6 border-t space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax (10%)</span><span className="font-mono">{formatCurrency(tax)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2"><span>Total</span><span className="font-mono text-primary">{formatCurrency(total)}</span></div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button type="submit" disabled={saving} className="rounded-full shadow-glow-cyan">{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Update Quote</Button></div>
      </form>
    </div>
  );
}

export function ViewQuotePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = useAuth();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("professional");
  const [templates, setTemplates] = useState([]);

  useEffect(function() {
    api.get("/quotes/" + id).then(function(data) { setQuote(data); }).catch(function() { toast.error("Failed to load quote"); navigate("/quotes"); }).finally(function() { setLoading(false); });
    api.get("/pdf-templates").then(function(data) { setTemplates(data); }).catch(function() {});
  }, [id, navigate]);

  function handleConvert() {
    setConverting(true);
    api.post("/quotes/" + id + "/convert-to-invoice").then(function(inv) { toast.success("Converted to invoice"); navigate("/invoices/" + inv.id); }).catch(function(err) { toast.error(err.message); }).finally(function() { setConverting(false); });
  }

  function handleDelete() {
    api.delete("/quotes/" + id).then(function() { toast.success("Quote deleted"); navigate("/quotes"); }).catch(function(err) { toast.error(err.message); });
  }

  function handleDownloadPDF() {
    const token = localStorage.getItem("token");
    const url = process.env.REACT_APP_BACKEND_URL + "/api/quotes/" + id + "/pdf?template=" + selectedTemplate;
    fetch(url, { headers: { "Authorization": "Bearer " + token } })
      .then(function(response) {
        if (!response.ok) throw new Error("Failed to download PDF");
        return response.blob();
      })
      .then(function(blob) {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = quote.quote_number + ".pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        toast.success("PDF downloaded");
      })
      .catch(function(err) { toast.error(err.message); });
  }

  function handlePreviewPDF() {
    const token = localStorage.getItem("token");
    const url = process.env.REACT_APP_BACKEND_URL + "/api/quotes/" + id + "/pdf?template=" + selectedTemplate;
    fetch(url, { headers: { "Authorization": "Bearer " + token } })
      .then(function(response) {
        if (!response.ok) throw new Error("Failed to load preview");
        return response.blob();
      })
      .then(function(blob) {
        const blobUrl = window.URL.createObjectURL(blob);
        setPreviewUrl(blobUrl);
        setPreviewOpen(true);
      })
      .catch(function(err) { toast.error(err.message); });
  }

  function handleSendEmail() {
    setSending(true);
    api.post("/quotes/" + id + "/send-email", { template: selectedTemplate })
      .then(function(data) {
        toast.success("Quote sent to " + quote.client_email);
        api.get("/quotes/" + id).then(function(data) { setQuote(data); });
      })
      .catch(function(err) { toast.error(err.message || "Failed to send quote"); })
      .finally(function() { setSending(false); });
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!quote) return null;

  const itemRows = [];
  for (let i = 0; i < quote.items.length; i++) {
    itemRows.push(<ViewItemRow key={i} item={quote.items[i]} />);
  }

  return (
    <div className="space-y-6" data-testid="view-quote-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={function() { navigate("/quotes"); }} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
          <div><h1 className="text-3xl font-bold font-heading">{quote.quote_number}</h1><Badge className={getStatusColor(quote.status) + " capitalize mt-1"}>{quote.status}</Badge></div>
        </div>
        {canEdit && quote.status !== "converted" && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedTemplate} onChange={function(e) { setSelectedTemplate(e.target.value); }} className="h-9 px-3 rounded-full border border-input bg-background text-sm" data-testid="template-selector">
              {templates.map(function(t) { return <option key={t.id} value={t.id}>{t.name}</option>; })}
            </select>
            <Button variant="outline" onClick={handlePreviewPDF} className="rounded-full" data-testid="preview-quote-btn"><FileText className="w-4 h-4 mr-2" /> Preview</Button>
            <Button variant="outline" onClick={handleDownloadPDF} className="rounded-full" data-testid="download-pdf-btn"><Download className="w-4 h-4 mr-2" /> Download PDF</Button>
            <Button variant="outline" onClick={handleSendEmail} disabled={sending} className="rounded-full" data-testid="send-quote-btn">{sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />} Send Quote</Button>
            <Button variant="outline" onClick={function() { navigate("/quotes/" + id + "/edit"); }} className="rounded-full"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
            <Button onClick={handleConvert} disabled={converting} className="rounded-full shadow-glow-magenta bg-secondary">{converting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRightCircle className="w-4 h-4 mr-2" />}Convert to Invoice</Button>
            <Button variant="destructive" onClick={function() { setDeleteOpen(true); }} className="rounded-full"><Trash2 className="w-4 h-4" /></Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{itemRows}</TableBody>
            </Table>
            <div className="mt-6 pt-6 border-t space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(quote.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax (10%)</span><span className="font-mono">{formatCurrency(quote.tax)}</span></div>
              <div className="flex justify-between text-xl font-bold pt-2"><span>Total</span><span className="font-mono text-primary">{formatCurrency(quote.total)}</span></div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
            <CardHeader><CardTitle>Client</CardTitle></CardHeader>
            <CardContent><p className="font-medium">{quote.client_name}</p><p className="text-sm text-muted-foreground">{quote.client_email}</p>{quote.client_address && <p className="text-sm text-muted-foreground mt-2">{quote.client_address}</p>}</CardContent>
          </Card>
          <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(quote.created_at)}</span></div>
              {quote.valid_until && <div className="flex justify-between"><span className="text-muted-foreground">Valid Until</span><span>{formatDate(quote.valid_until)}</span></div>}
            </CardContent>
          </Card>
          {quote.notes && <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10"><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">{quote.notes}</p></CardContent></Card>}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-3xl"><DialogHeader><DialogTitle>Delete Quote</DialogTitle><DialogDescription>Are you sure? This cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={function() { setDeleteOpen(false); }} className="rounded-full">Cancel</Button><Button variant="destructive" onClick={handleDelete} className="rounded-full">Delete</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={function(open) { setPreviewOpen(open); if (!open && previewUrl) { window.URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}>
        <DialogContent className="rounded-3xl max-w-4xl h-[80vh]">
          <DialogHeader><DialogTitle>Quote Preview - {quote.quote_number}</DialogTitle></DialogHeader>
          <div className="flex-1 h-full min-h-[60vh]">
            {previewUrl && <iframe src={previewUrl} className="w-full h-full rounded-xl border" title="Quote PDF Preview" />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={function() { setPreviewOpen(false); }} className="rounded-full">Close</Button>
            <Button onClick={handleDownloadPDF} className="rounded-full shadow-glow-cyan"><Download className="w-4 h-4 mr-2" /> Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
