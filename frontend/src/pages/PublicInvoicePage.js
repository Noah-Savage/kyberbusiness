import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { formatCurrency, formatDate, API_URL } from "../lib/utils";
import { KyberLogo } from "../components/KyberLogo";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";
import { CheckCircle, Loader2, AlertCircle, Calendar, Mail, MapPin } from "lucide-react";

function LineItemRow(props) {
  const { item } = props;
  return (
    <div className="grid grid-cols-12 text-sm py-2">
      <div className="col-span-6">{item.description}</div>
      <div className="col-span-2 text-right">{item.quantity}</div>
      <div className="col-span-2 text-right font-mono">{formatCurrency(item.price)}</div>
      <div className="col-span-2 text-right font-mono">{formatCurrency(item.quantity * item.price)}</div>
    </div>
  );
}

export function PublicInvoicePage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(function() {
    fetch(API_URL + "/public/invoices/" + id)
      .then(function(response) {
        if (!response.ok) throw new Error("Invoice not found");
        return response.json();
      })
      .then(function(data) {
        setInvoice(data);
        if (data.status === "paid") setPaymentSuccess(true);
      })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setLoading(false); });
  }, [id]);

  function handlePaymentSuccess(details) {
    fetch(API_URL + "/public/invoices/" + id + "/mark-paid?payment_id=" + details.id, { method: "POST" })
      .then(function(response) {
        if (response.ok) { setPaymentSuccess(true); toast.success("Payment successful! Thank you."); }
      })
      .catch(function() { toast.error("Payment recorded but failed to update invoice. Please contact support."); });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Invoice Not Found</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <Card className="max-w-md w-full rounded-3xl bg-gradient-to-br from-green-500/10 to-cyan-500/10 border-green-500/20">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold font-heading mb-2">Payment Complete!</h1>
            <p className="text-muted-foreground mb-6">Thank you for your payment.</p>
            <div className="p-4 rounded-xl bg-card/50 text-left">
              <p className="text-sm text-muted-foreground">Invoice Number</p>
              <p className="font-mono font-bold text-lg">{invoice.invoice_number}</p>
              <p className="text-sm text-muted-foreground mt-3">Amount Paid</p>
              <p className="font-mono font-bold text-2xl text-green-500">{formatCurrency(invoice.total)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const itemRows = [];
  for (let i = 0; i < invoice.items.length; i++) {
    itemRows.push(<LineItemRow key={i} item={invoice.items[i]} />);
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Toaster position="top-center" />
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-magenta-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto relative">
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <KyberLogo size={48} />
            <span className="font-heading font-bold text-2xl gradient-text">KyberBusiness</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold font-heading">Invoice</h1>
                  <p className="text-muted-foreground font-mono">{invoice.invoice_number}</p>
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-500 capitalize text-sm px-4 py-1">{invoice.status}</Badge>
              </div>

              <div className="p-4 rounded-xl bg-accent/30 mb-6">
                <p className="text-sm text-muted-foreground mb-1">Bill To</p>
                <p className="font-bold text-lg">{invoice.client_name}</p>
                <div className="flex items-center gap-2 text-muted-foreground mt-2">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{invoice.client_email}</span>
                </div>
                {invoice.client_address && (
                  <div className="flex items-start gap-2 text-muted-foreground mt-1">
                    <MapPin className="w-4 h-4 mt-0.5" />
                    <span className="text-sm">{invoice.client_address}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="grid grid-cols-12 text-sm font-medium text-muted-foreground pb-2 border-b border-border">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {itemRows}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(invoice.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax (10%)</span><span className="font-mono">{formatCurrency(invoice.tax)}</span></div>
                <div className="flex justify-between text-xl font-bold pt-2 border-t border-border"><span>Total Due</span><span className="font-mono text-primary">{formatCurrency(invoice.total)}</span></div>
              </div>

              {invoice.due_date && (
                <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-secondary/10 text-secondary">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Due by {formatDate(invoice.due_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="p-6">
                <h2 className="font-heading font-bold text-lg mb-4">Pay Invoice</h2>
                <div className="text-center mb-6">
                  <p className="text-sm text-muted-foreground">Amount Due</p>
                  <p className="text-4xl font-bold font-mono text-primary">{formatCurrency(invoice.total)}</p>
                </div>

                {invoice.paypal_client_id ? (
                  <PayPalScriptProvider options={{ clientId: invoice.paypal_client_id, currency: "USD" }}>
                    <PayPalButtons
                      style={{ layout: "vertical", shape: "pill", color: "blue" }}
                      createOrder={function(data, actions) {
                        return actions.order.create({
                          purchase_units: [{ description: "Invoice " + invoice.invoice_number, amount: { currency_code: "USD", value: invoice.total.toFixed(2) } }]
                        });
                      }}
                      onApprove={function(data, actions) {
                        return actions.order.capture().then(handlePaymentSuccess);
                      }}
                      onError={function(err) { toast.error("Payment failed. Please try again."); console.error(err); }}
                    />
                  </PayPalScriptProvider>
                ) : (
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">PayPal is not configured. Please contact the business to arrange payment.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {invoice.notes && (
              <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
                <CardContent className="p-6">
                  <h3 className="font-heading font-bold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-center text-muted-foreground">Powered by KyberBusiness</p>
          </div>
        </div>
      </div>
    </div>
  );
}
