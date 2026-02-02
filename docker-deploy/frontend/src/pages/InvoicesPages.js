import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, formatCurrency, formatDate, getStatusColor, API_URL } from "../lib/utils";
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
import { Plus, Trash2, Edit, Eye, ArrowLeft, CalendarIcon, Receipt, Copy, ExternalLink, Loader2, Search, CreditCard, FileDown, Send, Mail } from "lucide-react";

function InvoiceRow(props) {
  const { invoice, canEdit, onView, onEdit } = props;
  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
      <TableCell className="font-medium">{invoice.client_name}</TableCell>
      <TableCell className="font-mono">{formatCurrency(invoice.total)}</TableCell>
      <TableCell><Badge className={getStatusColor(invoice.status) + " capitalize"}>{invoice.status}</Badge></TableCell>
      <TableCell className="text-muted-foreground">{invoice.due_date ? formatDate(invoice.due_date) : "-"}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={onView} className="rounded-full"><Eye className="w-4 h-4" /></Button>
        {canEdit && <Button variant="ghost" size="icon" onClick={onEdit} className="rounded-full"><Edit className="w-4 h-4" /></Button>}
      </TableCell>
    </TableRow>
  );
}

function ItemRow(props) {
  const { item, index, onUpdate, onRemove, canRemove } = props;
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

function ViewItemRow(props) {
  const { item } = props;
  return (
    <TableRow>
      <TableCell>{item.description}</TableCell>
      <TableCell className="text-right">{item.quantity}</TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(item.price)}</TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(item.quantity * item.price)}</TableCell>
    </TableRow>
  );
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(function() {
    api.get("/invoices").then(function(data) { setInvoices(data); }).catch(function() { toast.error("Failed to load invoices"); }).finally(function() { setLoading(false); });
  }, []);

  const filtered = invoices.filter(function(inv) {
    const matchesSearch = inv.client_name.toLowerCase().includes(searchTerm.toLowerCase()) || inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const rows = [];
  for (let i = 0; i < filtered.length; i++) {
    const inv = filtered[i];
    rows.push(<InvoiceRow key={inv.id} invoice={inv} canEdit={canEdit} onView={function() { navigate("/invoices/" + inv.id); }} onEdit={function() { navigate("/invoices/" + inv.id + "/edit"); }} />);
  }

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage your invoices and payments</p>
        </div>
        {canEdit && <Button onClick={function() { navigate("/invoices/new"); }} className="rounded-full shadow-glow-cyan" data-testid="new-invoice-btn"><Plus className="w-4 h-4 mr-2" />New Invoice</Button>}
      </div>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search invoices..." value={searchTerm} onChange={function(e) { setSearchTerm(e.target.value); }} className="pl-10 rounded-xl" data-testid="search-invoices" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] rounded-xl" data-testid="status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12"><Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No invoices found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Client</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Due Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{rows}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CreateInvoicePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: 1, price: 0 }]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(null);
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
    api.post("/invoices", { client_name: clientName, client_email: clientEmail, client_address: clientAddress, items: items, notes: notes, due_date: dueDate, status: status })
      .then(function(invoice) { toast.success("Invoice created"); navigate("/invoices/" + invoice.id); })
      .catch(function(err) { toast.error(err.message); })
      .finally(function() { setLoading(false); });
  }

  const itemRows = [];
  for (let i = 0; i < items.length; i++) {
    itemRows.push(<ItemRow key={i} item={items[i]} index={i} onUpdate={updateItem} onRemove={removeItem} canRemove={items.length > 1} />);
  }

  return (
    <div className="space-y-6" data-testid="create-invoice-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={function() { navigate("/invoices"); }} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
        <div><h1 className="text-3xl font-bold font-heading">New Invoice</h1></div>
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
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start rounded-xl"><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(new Date(dueDate), "PPP") : "Select date"}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl"><Calendar mode="single" selected={dueDate ? new Date(dueDate) : undefined} onSelect={function(d) { setDueDate(d ? d.toISOString().split("T")[0] : null); }} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="draft">Draft</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="overdue">Overdue</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} className="rounded-xl" placeholder="Payment terms, bank details, etc..." /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button type="submit" disabled={loading} className="rounded-full shadow-glow-cyan" data-testid="save-invoice">{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Invoice</Button></div>
      </form>
    </div>
  );
}

export function EditInvoicePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(null);
  const [status, setStatus] = useState("draft");

  useEffect(function() {
    api.get("/invoices/" + id).then(function(data) {
      setInvoice(data);
      setClientName(data.client_name);
      setClientEmail(data.client_email);
      setClientAddress(data.client_address || "");
      setItems(data.items);
      setNotes(data.notes || "");
      setDueDate(data.due_date);
      setStatus(data.status);
    }).catch(function() { toast.error("Failed to load invoice"); navigate("/invoices"); }).finally(function() { setLoading(false); });
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
    api.put("/invoices/" + id, { client_name: clientName, client_email: clientEmail, client_address: clientAddress, items: items, notes: notes, due_date: dueDate, status: status })
      .then(function() { toast.success("Invoice updated"); navigate("/invoices/" + id); })
      .catch(function(err) { toast.error(err.message); })
      .finally(function() { setSaving(false); });
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const itemRows = [];
  for (let i = 0; i < items.length; i++) {
    itemRows.push(<ItemRow key={i} item={items[i]} index={i} onUpdate={updateItem} onRemove={removeItem} canRemove={items.length > 1} />);
  }

  return (
    <div className="space-y-6" data-testid="edit-invoice-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={function() { navigate("/invoices/" + id); }} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
        <div><h1 className="text-3xl font-bold font-heading">Edit Invoice</h1>{invoice && <p className="text-muted-foreground">{invoice.invoice_number}</p>}</div>
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

        <div className="flex justify-end"><Button type="submit" disabled={saving} className="rounded-full shadow-glow-cyan">{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Update Invoice</Button></div>
      </form>
    </div>
  );
}

export function ViewInvoicePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(function() {
    api.get("/invoices/" + id).then(function(data) { setInvoice(data); }).catch(function() { toast.error("Failed to load invoice"); navigate("/invoices"); }).finally(function() { setLoading(false); });
  }, [id, navigate]);

  function handleDelete() {
    api.delete("/invoices/" + id).then(function() { toast.success("Invoice deleted"); navigate("/invoices"); }).catch(function(err) { toast.error(err.message); });
  }

  function copyPaymentLink() {
    const url = window.location.origin + "/pay/" + id;
    navigator.clipboard.writeText(url);
    toast.success("Payment link copied!");
  }

  function downloadPDF() {
    const token = localStorage.getItem("token");
    fetch(API_URL + "/invoices/" + id + "/pdf", {
      headers: { "Authorization": "Bearer " + token }
    }).then(function(response) {
      if (!response.ok) throw new Error("Failed to download PDF");
      return response.blob();
    }).then(function(blob) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = invoice.invoice_number + ".pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("PDF downloaded!");
    }).catch(function(err) {
      toast.error(err.message);
    });
  }

  function sendEmail() {
    setSending(true);
    api.post("/invoices/" + id + "/send-email", { custom_message: customMessage })
      .then(function() {
        toast.success("Invoice sent to " + invoice.client_email);
        setEmailOpen(false);
        setCustomMessage("");
        // Refresh invoice to update status
        api.get("/invoices/" + id).then(function(data) { setInvoice(data); });
      })
      .catch(function(err) { toast.error(err.message); })
      .finally(function() { setSending(false); });
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!invoice) return null;

  const itemRows = [];
  for (let i = 0; i < invoice.items.length; i++) {
    itemRows.push(<ViewItemRow key={i} item={invoice.items[i]} />);
  }

  return (
    <div className="space-y-6" data-testid="view-invoice-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={function() { navigate("/invoices"); }} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
          <div><h1 className="text-3xl font-bold font-heading">{invoice.invoice_number}</h1><Badge className={getStatusColor(invoice.status) + " capitalize mt-1"}>{invoice.status}</Badge></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadPDF} className="rounded-full" data-testid="download-pdf-btn"><FileDown className="w-4 h-4 mr-2" /> Download PDF</Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={function() { setEmailOpen(true); }} className="rounded-full" data-testid="send-email-btn"><Send className="w-4 h-4 mr-2" /> Send Email</Button>
              <Button variant="outline" onClick={copyPaymentLink} className="rounded-full" data-testid="copy-payment-link"><Copy className="w-4 h-4 mr-2" /> Copy Link</Button>
              <Button variant="outline" onClick={function() { navigate("/invoices/" + id + "/edit"); }} className="rounded-full" data-testid="edit-invoice-btn"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
              <Button variant="destructive" onClick={function() { setDeleteOpen(true); }} className="rounded-full" data-testid="delete-invoice-btn"><Trash2 className="w-4 h-4" /></Button>
            </>
          )}
        </div>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax (10%)</span><span className="font-mono">{formatCurrency(invoice.tax)}</span></div>
              <div className="flex justify-between text-xl font-bold pt-2"><span>Total</span><span className="font-mono text-primary">{formatCurrency(invoice.total)}</span></div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
            <CardHeader><CardTitle>Client</CardTitle></CardHeader>
            <CardContent><p className="font-medium">{invoice.client_name}</p><p className="text-sm text-muted-foreground">{invoice.client_email}</p>{invoice.client_address && <p className="text-sm text-muted-foreground mt-2">{invoice.client_address}</p>}</CardContent>
          </Card>
          <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(invoice.created_at)}</span></div>
              {invoice.due_date && <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span>{formatDate(invoice.due_date)}</span></div>}
              {invoice.paid_at && <div className="flex justify-between"><span className="text-muted-foreground">Paid On</span><span className="text-green-500">{formatDate(invoice.paid_at)}</span></div>}
            </CardContent>
          </Card>
          {invoice.status !== "paid" && (
            <Card className="rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="p-6 text-center">
                <CreditCard className="w-8 h-8 mx-auto text-primary mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Share payment link with client</p>
                <Button onClick={copyPaymentLink} className="rounded-full shadow-glow-cyan"><Copy className="w-4 h-4 mr-2" /> Copy Link</Button>
              </CardContent>
            </Card>
          )}
          {invoice.notes && <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10"><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">{invoice.notes}</p></CardContent></Card>}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-3xl"><DialogHeader><DialogTitle>Delete Invoice</DialogTitle><DialogDescription>Are you sure? This cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={function() { setDeleteOpen(false); }} className="rounded-full">Cancel</Button><Button variant="destructive" onClick={handleDelete} className="rounded-full">Delete</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> Send Invoice</DialogTitle>
            <DialogDescription>Send this invoice with PDF attachment to {invoice.client_email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Custom Message (optional)</Label>
              <Textarea value={customMessage} onChange={function(e) { setCustomMessage(e.target.value); }} placeholder="Add a personal message to the email..." className="rounded-xl" rows={4} />
            </div>
            <div className="p-4 rounded-xl bg-accent/30">
              <p className="text-sm text-muted-foreground">The email will include:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>• Invoice details ({invoice.invoice_number})</li>
                <li>• PDF attachment with your branding</li>
                <li>• Amount due: {formatCurrency(invoice.total)}</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={function() { setEmailOpen(false); }} className="rounded-full">Cancel</Button>
            <Button onClick={sendEmail} disabled={sending} className="rounded-full shadow-glow-cyan">
              {sending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Send className="w-4 h-4 mr-2" /> Send Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
