import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatCurrency, formatDate } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Receipt, FileText, Wallet, DollarSign, Plus, ArrowRight, CalendarDays } from "lucide-react";

const CHART_COLORS = ["#06b6d4", "#d946ef", "#10b981", "#f59e0b", "#8b5cf6"];

function StatCard(props) {
  const { title, value, icon: Icon, color } = props;
  return (
    <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10 hover:shadow-glow-cyan transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold font-heading mt-2">{value}</p>
          </div>
          <div className={color === "magenta" ? "p-3 rounded-2xl bg-secondary/20" : "p-3 rounded-2xl bg-primary/20"}>
            <Icon className={color === "magenta" ? "w-6 h-6 text-secondary" : "w-6 h-6 text-primary"} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceItem(props) {
  const { inv, onClick } = props;
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-accent/30 hover:bg-accent/50 cursor-pointer transition-colors" onClick={onClick}>
      <div>
        <p className="font-medium">{inv.client_name}</p>
        <p className="text-sm text-muted-foreground">{inv.invoice_number}</p>
      </div>
      <div className="text-right">
        <p className="font-mono font-medium">{formatCurrency(inv.total)}</p>
        <Badge variant="outline" className="text-xs capitalize">{inv.status}</Badge>
      </div>
    </div>
  );
}

function ExpenseItem(props) {
  const { exp, onClick } = props;
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-accent/30 hover:bg-accent/50 cursor-pointer transition-colors" onClick={onClick}>
      <div>
        <p className="font-medium">{exp.description}</p>
        <p className="text-sm text-muted-foreground">{exp.category_name}</p>
      </div>
      <div className="text-right">
        <p className="font-mono font-medium text-secondary">{formatCurrency(exp.amount)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(exp.date)}</p>
      </div>
    </div>
  );
}

function CategoryLegendItem(props) {
  const { cat, color } = props;
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{cat.name}</span>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [timeRange, setTimeRange] = useState("month");

  useEffect(function() {
    fetchData();
  }, [timeRange]);

  function fetchData() {
    setLoading(true);
    
    const endDate = new Date().toISOString().split("T")[0];
    const now = new Date();
    let startDate;
    
    if (timeRange === "week") {
      now.setDate(now.getDate() - 7);
      startDate = now.toISOString().split("T")[0];
    } else if (timeRange === "month") {
      now.setMonth(now.getMonth() - 1);
      startDate = now.toISOString().split("T")[0];
    } else if (timeRange === "quarter") {
      now.setMonth(now.getMonth() - 3);
      startDate = now.toISOString().split("T")[0];
    } else {
      now.setFullYear(now.getFullYear() - 1);
      startDate = now.toISOString().split("T")[0];
    }

    Promise.all([
      api.get("/reports/dashboard"),
      api.get("/reports/summary?start_date=" + startDate + "&end_date=" + endDate)
    ]).then(function(results) {
      setData(results[0]);
      setReportData(results[1]);
    }).catch(function() {
      toast.error("Failed to load dashboard data");
    }).finally(function() {
      setLoading(false);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 mx-auto animate-pulse-glow" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const pendingInvoices = data?.pending_invoices || [];
  const recentExpenses = data?.recent_expenses || [];
  const chartData = reportData?.chart_data || [];
  const categoryBreakdown = reportData?.category_breakdown || [];

  const invoiceItems = [];
  for (let i = 0; i < pendingInvoices.length; i++) {
    const inv = pendingInvoices[i];
    invoiceItems.push(<InvoiceItem key={inv.id} inv={inv} onClick={function() { navigate("/invoices/" + inv.id); }} />);
  }

  const expenseItems = [];
  for (let i = 0; i < recentExpenses.length; i++) {
    const exp = recentExpenses[i];
    expenseItems.push(<ExpenseItem key={exp.id} exp={exp} onClick={function() { navigate("/expenses/" + exp.id); }} />);
  }

  const legendItems = [];
  for (let i = 0; i < categoryBreakdown.length; i++) {
    const cat = categoryBreakdown[i];
    legendItems.push(<CategoryLegendItem key={cat.name} cat={cat} color={CHART_COLORS[i % CHART_COLORS.length]} />);
  }

  const firstName = user?.name?.split(" ")[0] || "User";
  const profitLoss = reportData?.profit_loss || 0;

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Welcome back, <span className="gradient-text">{firstName}</span></h1>
          <p className="text-muted-foreground mt-1">Here's your business overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] rounded-xl" data-testid="time-range-select">
              <CalendarDays className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && (
            <Button onClick={function() { navigate("/invoices/new"); }} className="rounded-full shadow-glow-cyan" data-testid="new-invoice-btn">
              <Plus className="w-4 h-4 mr-2" />New Invoice
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenue This Month" value={formatCurrency(data?.revenue_this_month || 0)} icon={DollarSign} color="cyan" />
        <StatCard title="Outstanding" value={formatCurrency(data?.total_outstanding || 0)} icon={Receipt} color="magenta" />
        <StatCard title="Total Invoices" value={data?.invoice_count || 0} icon={FileText} color="cyan" />
        <StatCard title="Total Expenses" value={data?.expense_count || 0} icon={Wallet} color="magenta" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-0"><CardTitle className="font-heading text-lg">Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d946ef" stopOpacity={0.3} /><stop offset="95%" stopColor="#d946ef" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                  <Area type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="expenses" stroke="#d946ef" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-0"><CardTitle className="font-heading text-lg">Expense Categories</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {categoryBreakdown.map(function(entry, index) { return <Cell key={"cell-" + index} fill={CHART_COLORS[index % CHART_COLORS.length]} />; })}
                  </Pie>
                  <Tooltip formatter={function(value) { return formatCurrency(value); }} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">{legendItems}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-4xl font-bold font-mono text-primary mt-2">{formatCurrency(reportData?.total_revenue || 0)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-4xl font-bold font-mono text-secondary mt-2">{formatCurrency(reportData?.total_expenses || 0)}</p>
          </CardContent>
        </Card>
        <Card className={profitLoss >= 0 ? "rounded-3xl bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20" : "rounded-3xl bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20"}>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Profit / Loss</p>
            <p className={profitLoss >= 0 ? "text-4xl font-bold font-mono mt-2 text-green-500" : "text-4xl font-bold font-mono mt-2 text-red-500"}>{formatCurrency(profitLoss)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Pending Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={function() { navigate("/invoices"); }} className="rounded-full">View All <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvoices.length === 0 ? <p className="text-muted-foreground text-center py-8">No pending invoices</p> : invoiceItems}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Recent Expenses</CardTitle>
            <Button variant="ghost" size="sm" onClick={function() { navigate("/expenses"); }} className="rounded-full">View All <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentExpenses.length === 0 ? <p className="text-muted-foreground text-center py-8">No recent expenses</p> : expenseItems}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
