import React, { useState, useEffect, useRef } from "react";
import { api, API_URL, getAuthHeaders } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import { Mail, CreditCard, Palette, Shield, Save, Eye, Check, Star, Loader2, Building2, Upload, Trash2, X, Image } from "lucide-react";

// Branding Settings Tab
function BrandingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settings, setSettings] = useState({
    company_name: "",
    primary_color: "#06b6d4",
    secondary_color: "#d946ef",
    accent_color: "#10b981",
    tagline: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    logo_url: null
  });
  const fileInputRef = useRef(null);

  useEffect(function() {
    fetchSettings();
  }, []);

  function fetchSettings() {
    api.get("/settings/branding").then(function(data) {
      setSettings({
        company_name: data.company_name || "",
        primary_color: data.primary_color || "#06b6d4",
        secondary_color: data.secondary_color || "#d946ef",
        accent_color: data.accent_color || "#10b981",
        tagline: data.tagline || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        logo_url: data.logo_url || null
      });
    }).catch(function(err) {
      console.error(err);
    }).finally(function() {
      setLoading(false);
    });
  }

  function handleSave() {
    if (!settings.company_name) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    api.post("/settings/branding", settings).then(function() {
      toast.success("Branding settings saved");
    }).catch(function(err) {
      toast.error(err.message || "Failed to save");
    }).finally(function() {
      setSaving(false);
    });
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be less than 5MB");
      return;
    }

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    fetch(API_URL + "/settings/branding/logo", {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData
    }).then(function(res) {
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    }).then(function(data) {
      setSettings({ ...settings, logo_url: data.logo_url });
      toast.success("Logo uploaded");
    }).catch(function(err) {
      toast.error(err.message);
    }).finally(function() {
      setUploadingLogo(false);
    });
  }

  function handleDeleteLogo() {
    api.delete("/settings/branding/logo").then(function() {
      setSettings({ ...settings, logo_url: null });
      toast.success("Logo deleted");
    }).catch(function(err) {
      toast.error(err.message);
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Company Logo
          </CardTitle>
          <CardDescription>Upload your company logo to appear on invoices and quotes</CardDescription>
        </CardHeader>
        <CardContent>
          <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" className="hidden" data-testid="logo-upload-input" />
          
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-accent/20 overflow-hidden">
              {settings.logo_url ? (
                <img src={API_URL + settings.logo_url} alt="Company Logo" className="w-full h-full object-contain" />
              ) : (
                <Image className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-3">
              <Button onClick={function() { fileInputRef.current?.click(); }} disabled={uploadingLogo} variant="outline" className="rounded-full" data-testid="upload-logo-btn">
                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload Logo
              </Button>
              {settings.logo_url && (
                <Button onClick={handleDeleteLogo} variant="ghost" className="rounded-full text-destructive" data-testid="delete-logo-btn">
                  <Trash2 className="w-4 h-4 mr-2" /> Remove
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Max 5MB. PNG, JPG, SVG, or GIF</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Building2 className="w-5 h-5 text-secondary" />
            Company Information
          </CardTitle>
          <CardDescription>Your company details for invoices and quotes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input value={settings.company_name} onChange={function(e) { setSettings({ ...settings, company_name: e.target.value }); }} className="rounded-xl" placeholder="Your Company" data-testid="company-name" />
            </div>
            <div className="space-y-2">
              <Label>Tagline</Label>
              <Input value={settings.tagline} onChange={function(e) { setSettings({ ...settings, tagline: e.target.value }); }} className="rounded-xl" placeholder="Your business tagline" data-testid="company-tagline" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={settings.email} onChange={function(e) { setSettings({ ...settings, email: e.target.value }); }} className="rounded-xl" placeholder="contact@company.com" data-testid="company-email" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={settings.phone} onChange={function(e) { setSettings({ ...settings, phone: e.target.value }); }} className="rounded-xl" placeholder="+1 (555) 000-0000" data-testid="company-phone" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={settings.address} onChange={function(e) { setSettings({ ...settings, address: e.target.value }); }} className="rounded-xl" placeholder="123 Business St, City, State 12345" data-testid="company-address" />
          </div>

          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={settings.website} onChange={function(e) { setSettings({ ...settings, website: e.target.value }); }} className="rounded-xl" placeholder="https://yourcompany.com" data-testid="company-website" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Brand Colors
          </CardTitle>
          <CardDescription>Customize colors used on invoices and quotes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={settings.primary_color} onChange={function(e) { setSettings({ ...settings, primary_color: e.target.value }); }} className="w-12 h-12 rounded-xl cursor-pointer border-0" data-testid="primary-color" />
                <Input value={settings.primary_color} onChange={function(e) { setSettings({ ...settings, primary_color: e.target.value }); }} className="rounded-xl font-mono uppercase" />
              </div>
              <p className="text-xs text-muted-foreground">Headers, buttons, accents</p>
            </div>

            <div className="space-y-3">
              <Label>Secondary Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={settings.secondary_color} onChange={function(e) { setSettings({ ...settings, secondary_color: e.target.value }); }} className="w-12 h-12 rounded-xl cursor-pointer border-0" data-testid="secondary-color" />
                <Input value={settings.secondary_color} onChange={function(e) { setSettings({ ...settings, secondary_color: e.target.value }); }} className="rounded-xl font-mono uppercase" />
              </div>
              <p className="text-xs text-muted-foreground">Highlights, badges</p>
            </div>

            <div className="space-y-3">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={settings.accent_color} onChange={function(e) { setSettings({ ...settings, accent_color: e.target.value }); }} className="w-12 h-12 rounded-xl cursor-pointer border-0" data-testid="accent-color" />
                <Input value={settings.accent_color} onChange={function(e) { setSettings({ ...settings, accent_color: e.target.value }); }} className="rounded-xl font-mono uppercase" />
              </div>
              <p className="text-xs text-muted-foreground">Success states, totals</p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-accent/30">
            <p className="text-sm font-medium mb-3">Preview</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: settings.primary_color }}>Primary Button</div>
              <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: settings.secondary_color }}>Secondary Badge</div>
              <div className="px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: settings.accent_color }}>$1,234.56</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="rounded-full shadow-glow-cyan" data-testid="save-branding">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Branding
        </Button>
      </div>
    </div>
  );
}

// SMTP Settings Tab
function SMTPSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ host: "", port: 587, username: "", password: "", from_email: "", from_name: "", use_tls: true });
  const [configured, setConfigured] = useState(false);

  useEffect(function() {
    api.get("/settings/smtp").then(function(data) {
      if (data.configured) {
        setSettings({ host: data.host || "", port: data.port || 587, username: data.username || "", password: "", from_email: data.from_email || "", from_name: data.from_name || "", use_tls: data.use_tls !== false });
        setConfigured(true);
      }
    }).catch(function(err) { console.error(err); }).finally(function() { setLoading(false); });
  }, []);

  function handleSave() {
    if (!settings.host || !settings.username || !settings.password || !settings.from_email) { toast.error("Please fill required fields"); return; }
    setSaving(true);
    api.post("/settings/smtp", settings).then(function() { toast.success("SMTP saved"); setConfigured(true); }).catch(function(err) { toast.error(err.message); }).finally(function() { setSaving(false); });
  }

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-heading flex items-center gap-2"><Mail className="w-5 h-5 text-primary" />SMTP Configuration</CardTitle>
            <CardDescription className="mt-1">Configure email sending for invoices</CardDescription>
          </div>
          {configured && <Badge className="bg-green-500/20 text-green-500"><Check className="w-3 h-3 mr-1" /> Configured</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>SMTP Host *</Label><Input value={settings.host} onChange={function(e) { setSettings({ ...settings, host: e.target.value }); }} placeholder="smtp.gmail.com" className="rounded-xl" data-testid="smtp-host" /></div>
          <div className="space-y-2"><Label>Port *</Label><Input type="number" value={settings.port} onChange={function(e) { setSettings({ ...settings, port: parseInt(e.target.value) || 587 }); }} className="rounded-xl" data-testid="smtp-port" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Username *</Label><Input value={settings.username} onChange={function(e) { setSettings({ ...settings, username: e.target.value }); }} className="rounded-xl" data-testid="smtp-username" /></div>
          <div className="space-y-2"><Label>Password *</Label><Input type="password" value={settings.password} onChange={function(e) { setSettings({ ...settings, password: e.target.value }); }} className="rounded-xl" data-testid="smtp-password" />{configured && <p className="text-xs text-muted-foreground">Leave blank to keep existing</p>}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>From Email *</Label><Input type="email" value={settings.from_email} onChange={function(e) { setSettings({ ...settings, from_email: e.target.value }); }} className="rounded-xl" data-testid="smtp-from-email" /></div>
          <div className="space-y-2"><Label>From Name</Label><Input value={settings.from_name} onChange={function(e) { setSettings({ ...settings, from_name: e.target.value }); }} className="rounded-xl" data-testid="smtp-from-name" /></div>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30">
          <div><p className="font-medium">Use TLS</p><p className="text-sm text-muted-foreground">Secure connection</p></div>
          <Switch checked={settings.use_tls} onCheckedChange={function(c) { setSettings({ ...settings, use_tls: c }); }} />
        </div>
        <div className="flex justify-end"><Button onClick={handleSave} disabled={saving} className="rounded-full shadow-glow-cyan" data-testid="save-smtp">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button></div>
      </CardContent>
    </Card>
  );
}

// PayPal Settings Tab
function PayPalSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ client_id: "", client_secret: "", sandbox: true });
  const [configured, setConfigured] = useState(false);

  useEffect(function() {
    api.get("/settings/paypal").then(function(data) {
      if (data.configured) { setSettings({ client_id: "", client_secret: "", sandbox: data.sandbox !== false }); setConfigured(true); }
    }).catch(function(err) { console.error(err); }).finally(function() { setLoading(false); });
  }, []);

  function handleSave() {
    if (!settings.client_id || !settings.client_secret) { toast.error("Please fill required fields"); return; }
    setSaving(true);
    api.post("/settings/paypal", settings).then(function() { toast.success("PayPal saved"); setConfigured(true); }).catch(function(err) { toast.error(err.message); }).finally(function() { setSaving(false); });
  }

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-heading flex items-center gap-2"><CreditCard className="w-5 h-5 text-secondary" />PayPal Configuration</CardTitle>
            <CardDescription className="mt-1">Connect PayPal for payments</CardDescription>
          </div>
          {configured && <Badge className="bg-green-500/20 text-green-500"><Check className="w-3 h-3 mr-1" /> Configured</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
          <p className="text-sm text-muted-foreground">Get credentials from <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">PayPal Developer Dashboard</a></p>
        </div>
        <div className="space-y-2"><Label>Client ID *</Label><Input value={settings.client_id} onChange={function(e) { setSettings({ ...settings, client_id: e.target.value }); }} className="rounded-xl font-mono text-sm" data-testid="paypal-client-id" /></div>
        <div className="space-y-2"><Label>Client Secret *</Label><Input type="password" value={settings.client_secret} onChange={function(e) { setSettings({ ...settings, client_secret: e.target.value }); }} className="rounded-xl" data-testid="paypal-client-secret" />{configured && <p className="text-xs text-muted-foreground">Leave blank to keep existing</p>}</div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30">
          <div><p className="font-medium">Sandbox Mode</p><p className="text-sm text-muted-foreground">Use for testing</p></div>
          <Switch checked={settings.sandbox} onCheckedChange={function(c) { setSettings({ ...settings, sandbox: c }); }} />
        </div>
        <div className="flex justify-end"><Button onClick={handleSave} disabled={saving} className="rounded-full shadow-glow-magenta bg-secondary" data-testid="save-paypal">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button></div>
      </CardContent>
    </Card>
  );
}

// Email Templates Tab
function EmailTemplates() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(function() {
    api.get("/email-templates").then(function(data) { setTemplates(data); }).catch(function() { toast.error("Failed to load templates"); }).finally(function() { setLoading(false); });
  }, []);

  function handleSetDefault(templateId) {
    api.post("/email-templates/" + templateId + "/set-default").then(function() { toast.success("Default updated"); api.get("/email-templates").then(setTemplates); }).catch(function(err) { toast.error(err.message); });
  }

  function handleEditSave() {
    if (!editData) return;
    setSaving(true);
    api.put("/email-templates/" + editData.id, { name: editData.name, theme: editData.theme, subject: editData.subject, body_html: editData.body_html })
      .then(function() { toast.success("Template updated"); setEditOpen(false); api.get("/email-templates").then(setTemplates); })
      .catch(function(err) { toast.error(err.message); }).finally(function() { setSaving(false); });
  }

  function getThemeColor(theme) {
    const colors = { professional: "bg-blue-500/20 text-blue-500", modern: "bg-cyan-500/20 text-cyan-500", minimal: "bg-gray-500/20 text-gray-500", bold: "bg-magenta-500/20 text-magenta-500", classic: "bg-amber-500/20 text-amber-500" };
    return colors[theme] || colors.professional;
  }

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const templateCards = [];
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    templateCards.push(
      <div key={t.id} className={"p-4 rounded-2xl border transition-all " + (t.is_default ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
        <div className="flex items-start justify-between mb-3">
          <div><h3 className="font-medium">{t.name}</h3><Badge className={getThemeColor(t.theme) + " capitalize mt-1"}>{t.theme}</Badge></div>
          {t.is_default && <Badge className="bg-primary/20 text-primary"><Star className="w-3 h-3 mr-1" /> Default</Badge>}
        </div>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{t.subject}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={function() { setSelectedTemplate(t); setPreviewOpen(true); }} className="rounded-full flex-1"><Eye className="w-4 h-4 mr-1" /> Preview</Button>
          <Button variant="outline" size="sm" onClick={function() { setEditData({ ...t }); setEditOpen(true); }} className="rounded-full">Edit</Button>
          {!t.is_default && <Button variant="ghost" size="sm" onClick={function() { handleSetDefault(t.id); }} className="rounded-full"><Star className="w-4 h-4" /></Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2"><Palette className="w-5 h-5 text-primary" />Email Templates</CardTitle>
          <CardDescription>Customize email templates for invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{templateCards}</div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>Template Preview: {selectedTemplate?.name}</DialogTitle></DialogHeader>
          <div className="mt-4 p-4 rounded-xl bg-white text-black" dangerouslySetInnerHTML={{ __html: selectedTemplate?.body_html || "" }} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Template Name</Label><Input value={editData.name} onChange={function(e) { setEditData({ ...editData, name: e.target.value }); }} className="rounded-xl" /></div>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select value={editData.theme} onValueChange={function(v) { setEditData({ ...editData, theme: v }); }}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl"><SelectItem value="professional">Professional</SelectItem><SelectItem value="modern">Modern</SelectItem><SelectItem value="minimal">Minimal</SelectItem><SelectItem value="bold">Bold</SelectItem><SelectItem value="classic">Classic</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Subject Line</Label><Input value={editData.subject} onChange={function(e) { setEditData({ ...editData, subject: e.target.value }); }} className="rounded-xl" /><p className="text-xs text-muted-foreground">Variables: {"{invoice_number}"}, {"{total}"}, {"{due_date}"}, {"{payment_link}"}</p></div>
              <div className="space-y-2"><Label>HTML Body</Label><Textarea value={editData.body_html} onChange={function(e) { setEditData({ ...editData, body_html: e.target.value }); }} className="rounded-xl font-mono text-sm min-h-[300px]" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={function() { setEditOpen(false); }} className="rounded-full">Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving} className="rounded-full shadow-glow-cyan">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main Settings Page
export function SettingsPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your KyberBusiness application</p>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="bg-card/50 backdrop-blur-xl rounded-full p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="branding" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="w-4 h-4 mr-2" />Branding
          </TabsTrigger>
          <TabsTrigger value="smtp" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Mail className="w-4 h-4 mr-2" />SMTP
          </TabsTrigger>
          <TabsTrigger value="paypal" className="rounded-full data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
            <CreditCard className="w-4 h-4 mr-2" />PayPal
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Palette className="w-4 h-4 mr-2" />Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          {isAdmin ? <BrandingSettings /> : (
            <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
              <CardContent className="p-12 text-center"><Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Admin access required</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="smtp">
          {isAdmin ? <SMTPSettings /> : (
            <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
              <CardContent className="p-12 text-center"><Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Admin access required</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="paypal">
          {isAdmin ? <PayPalSettings /> : (
            <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
              <CardContent className="p-12 text-center"><Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Admin access required</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates"><EmailTemplates /></TabsContent>
      </Tabs>
    </div>
  );
}
