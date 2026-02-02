import React, { useState, useEffect } from "react";
import { api } from "../lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import {
  Mail,
  CreditCard,
  Palette,
  Shield,
  Save,
  Eye,
  Check,
  Star,
  Loader2,
  TestTube,
} from "lucide-react";

// SMTP Settings Tab
const SMTPSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    from_email: "",
    from_name: "",
    use_tls: true,
  });
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.get("/settings/smtp");
      if (data.configured) {
        setSettings({
          host: data.host || "",
          port: data.port || 587,
          username: data.username || "",
          password: "", // Never return password
          from_email: data.from_email || "",
          from_name: data.from_name || "",
          use_tls: data.use_tls !== false,
        });
        setConfigured(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.host || !settings.username || !settings.password || !settings.from_email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await api.post("/settings/smtp", settings);
      toast.success("SMTP settings saved successfully");
      setConfigured(true);
    } catch (err) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-heading flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              SMTP Configuration
            </CardTitle>
            <CardDescription className="mt-1">
              Configure email sending for invoices and notifications
            </CardDescription>
          </div>
          {configured && (
            <Badge className="bg-green-500/20 text-green-500">
              <Check className="w-3 h-3 mr-1" /> Configured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>SMTP Host *</Label>
            <Input
              value={settings.host}
              onChange={(e) => setSettings({ ...settings, host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="rounded-xl"
              data-testid="smtp-host"
            />
          </div>
          <div className="space-y-2">
            <Label>Port *</Label>
            <Input
              type="number"
              value={settings.port}
              onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) || 587 })}
              placeholder="587"
              className="rounded-xl"
              data-testid="smtp-port"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Username *</Label>
            <Input
              value={settings.username}
              onChange={(e) => setSettings({ ...settings, username: e.target.value })}
              placeholder="your-email@gmail.com"
              className="rounded-xl"
              data-testid="smtp-username"
            />
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input
              type="password"
              value={settings.password}
              onChange={(e) => setSettings({ ...settings, password: e.target.value })}
              placeholder="••••••••"
              className="rounded-xl"
              data-testid="smtp-password"
            />
            {configured && (
              <p className="text-xs text-muted-foreground">Leave blank to keep existing password</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Email *</Label>
            <Input
              type="email"
              value={settings.from_email}
              onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
              placeholder="invoices@yourbusiness.com"
              className="rounded-xl"
              data-testid="smtp-from-email"
            />
          </div>
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input
              value={settings.from_name}
              onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
              placeholder="KyberBusiness"
              className="rounded-xl"
              data-testid="smtp-from-name"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30">
          <div>
            <p className="font-medium">Use TLS</p>
            <p className="text-sm text-muted-foreground">Secure connection (recommended)</p>
          </div>
          <Switch
            checked={settings.use_tls}
            onCheckedChange={(checked) => setSettings({ ...settings, use_tls: checked })}
            data-testid="smtp-tls"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full shadow-glow-cyan"
            data-testid="save-smtp"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// PayPal Settings Tab
const PayPalSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    client_id: "",
    client_secret: "",
    sandbox: true,
  });
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.get("/settings/paypal");
      if (data.configured) {
        setSettings({
          client_id: "", // Never return actual credentials
          client_secret: "",
          sandbox: data.sandbox !== false,
        });
        setConfigured(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.client_id || !settings.client_secret) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await api.post("/settings/paypal", settings);
      toast.success("PayPal settings saved successfully");
      setConfigured(true);
    } catch (err) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-heading flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-secondary" />
              PayPal Configuration
            </CardTitle>
            <CardDescription className="mt-1">
              Connect PayPal to receive invoice payments
            </CardDescription>
          </div>
          {configured && (
            <Badge className="bg-green-500/20 text-green-500">
              <Check className="w-3 h-3 mr-1" /> Configured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
          <p className="text-sm text-muted-foreground">
            Get your PayPal API credentials from the{" "}
            <a
              href="https://developer.paypal.com/dashboard/applications/live"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:underline"
            >
              PayPal Developer Dashboard
            </a>
          </p>
        </div>

        <div className="space-y-2">
          <Label>Client ID *</Label>
          <Input
            value={settings.client_id}
            onChange={(e) => setSettings({ ...settings, client_id: e.target.value })}
            placeholder="Your PayPal Client ID"
            className="rounded-xl font-mono text-sm"
            data-testid="paypal-client-id"
          />
        </div>

        <div className="space-y-2">
          <Label>Client Secret *</Label>
          <Input
            type="password"
            value={settings.client_secret}
            onChange={(e) => setSettings({ ...settings, client_secret: e.target.value })}
            placeholder="Your PayPal Client Secret"
            className="rounded-xl"
            data-testid="paypal-client-secret"
          />
          {configured && (
            <p className="text-xs text-muted-foreground">Leave blank to keep existing credentials</p>
          )}
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30">
          <div>
            <p className="font-medium">Sandbox Mode</p>
            <p className="text-sm text-muted-foreground">Use PayPal sandbox for testing</p>
          </div>
          <Switch
            checked={settings.sandbox}
            onCheckedChange={(checked) => setSettings({ ...settings, sandbox: checked })}
            data-testid="paypal-sandbox"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full shadow-glow-magenta bg-secondary"
            data-testid="save-paypal"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Email Templates Tab
const EmailTemplates = () => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await api.get("/email-templates");
      setTemplates(data);
    } catch (err) {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (templateId) => {
    try {
      await api.post(`/email-templates/${templateId}/set-default`);
      toast.success("Default template updated");
      fetchTemplates();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEditSave = async () => {
    if (!editData) return;
    setSaving(true);
    try {
      await api.put(`/email-templates/${editData.id}`, {
        name: editData.name,
        theme: editData.theme,
        subject: editData.subject,
        body_html: editData.body_html,
      });
      toast.success("Template updated");
      setEditOpen(false);
      fetchTemplates();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getThemeColor = (theme) => {
    const colors = {
      professional: "bg-blue-500/20 text-blue-500",
      modern: "bg-cyan-500/20 text-cyan-500",
      minimal: "bg-gray-500/20 text-gray-500",
      bold: "bg-magenta-500/20 text-magenta-500",
      classic: "bg-amber-500/20 text-amber-500",
    };
    return colors[theme] || colors.professional;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Email Templates
          </CardTitle>
          <CardDescription>
            Customize email templates for invoices and communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`p-4 rounded-2xl border transition-all ${
                  template.is_default
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{template.name}</h3>
                    <Badge className={`${getThemeColor(template.theme)} capitalize mt-1`}>
                      {template.theme}
                    </Badge>
                  </div>
                  {template.is_default && (
                    <Badge className="bg-primary/20 text-primary">
                      <Star className="w-3 h-3 mr-1" /> Default
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {template.subject}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setPreviewOpen(true);
                    }}
                    className="rounded-full flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" /> Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditData({ ...template });
                      setEditOpen(true);
                    }}
                    className="rounded-full"
                  >
                    Edit
                  </Button>
                  {!template.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(template.id)}
                      className="rounded-full"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>Template Preview: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 p-4 rounded-xl bg-white text-black">
            <div
              dangerouslySetInnerHTML={{ __html: selectedTemplate?.body_html || "" }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={editData.theme}
                    onValueChange={(value) => setEditData({ ...editData, theme: value })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                      <SelectItem value="classic">Classic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={editData.subject}
                  onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {"{invoice_number}"}, {"{total}"}, {"{due_date}"}, {"{payment_link}"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>HTML Body</Label>
                <Textarea
                  value={editData.body_html}
                  onChange={(e) => setEditData({ ...editData, body_html: e.target.value })}
                  className="rounded-xl font-mono text-sm min-h-[300px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={saving} className="rounded-full shadow-glow-cyan">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Main Settings Page
export const SettingsPage = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your KyberBusiness application</p>
      </div>

      <Tabs defaultValue="smtp" className="space-y-6">
        <TabsList className="bg-card/50 backdrop-blur-xl rounded-full p-1">
          <TabsTrigger value="smtp" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Mail className="w-4 h-4 mr-2" />
            SMTP
          </TabsTrigger>
          <TabsTrigger value="paypal" className="rounded-full data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
            <CreditCard className="w-4 h-4 mr-2" />
            PayPal
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Palette className="w-4 h-4 mr-2" />
            Email Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smtp">
          {isAdmin ? (
            <SMTPSettings />
          ) : (
            <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
              <CardContent className="p-12 text-center">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Admin access required to configure SMTP</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="paypal">
          {isAdmin ? (
            <PayPalSettings />
          ) : (
            <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
              <CardContent className="p-12 text-center">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Admin access required to configure PayPal</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <EmailTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
};
