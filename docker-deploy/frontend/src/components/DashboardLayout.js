import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { KyberLogoWithText } from "./KyberLogo";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Wallet,
  Settings,
  Users,
  Sun,
  Moon,
  LogOut,
  Menu,
  ChevronDown,
  User,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/quotes", icon: FileText, label: "Quotes" },
  { to: "/invoices", icon: Receipt, label: "Invoices" },
  { to: "/expenses", icon: Wallet, label: "Expenses" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const NavItem = ({ to, icon: Icon, label, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
        isActive
          ? "bg-primary/10 text-primary glow-cyan"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`
    }
    data-testid={`nav-${label.toLowerCase()}`}
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
  </NavLink>
);

export const DashboardLayout = () => {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/40 bg-card/30 backdrop-blur-2xl h-screen sticky top-0 p-6">
        <div className="mb-8">
          <KyberLogoWithText size={36} />
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {isAdmin && (
            <NavItem to="/admin" icon={Users} label="Admin" />
          )}
        </nav>

        <div className="pt-4 border-t border-border/40 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-2xl"
            onClick={toggleTheme}
            data-testid="theme-toggle"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 rounded-2xl"
                data-testid="user-menu"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive cursor-pointer"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <KyberLogoWithText size={32} />
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
            data-testid="mobile-theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-card/95 backdrop-blur-xl">
              <nav className="mt-8 space-y-2">
                {navItems.map((item) => (
                  <NavItem key={item.to} {...item} onClick={closeMobile} />
                ))}
                {isAdmin && (
                  <NavItem to="/admin" icon={Users} label="Admin" onClick={closeMobile} />
                )}
              </nav>
              <div className="absolute bottom-8 left-6 right-6">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 rounded-2xl text-destructive"
                  onClick={handleLogout}
                  data-testid="mobile-logout"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 bg-card/80 backdrop-blur-xl border border-white/10 rounded-full p-2 flex justify-around shadow-2xl z-50">
        {navItems.slice(0, 4).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `p-3 rounded-full transition-all duration-200 ${
                isActive ? "bg-primary text-primary-foreground glow-cyan" : "text-muted-foreground"
              }`
            }
            data-testid={`mobile-nav-${label.toLowerCase()}`}
          >
            <Icon className="w-5 h-5" />
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-h-screen md:p-8 p-4 pt-20 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
