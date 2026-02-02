import React, { useState, useEffect } from "react";
import { api, formatDate } from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import {
  Users,
  Shield,
  Trash2,
  UserCog,
  Crown,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";

export const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.get("/admin/users");
      setUsers(data);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      toast.success("Role updated successfully");
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      await api.delete(`/admin/users/${selectedUser.id}`);
      toast.success("User deleted");
      setDeleteOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: "bg-magenta-500/20 text-magenta-500",
      accountant: "bg-cyan-500/20 text-cyan-500",
      viewer: "bg-muted text-muted-foreground",
    };
    return styles[role] || styles.viewer;
  };

  const getRoleIcon = (role) => {
    const icons = {
      admin: Crown,
      accountant: UserCog,
      viewer: Users,
    };
    const Icon = icons[role] || Users;
    return <Icon className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
          <Shield className="w-8 h-8 text-secondary" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1">Manage users and their permissions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-3xl bg-gradient-to-br from-magenta-500/10 to-magenta-500/5 border-magenta-500/20">
          <CardContent className="p-6 text-center">
            <Crown className="w-8 h-8 mx-auto text-magenta-500 mb-2" />
            <p className="text-3xl font-bold font-mono">
              {users.filter((u) => u.role === "admin").length}
            </p>
            <p className="text-sm text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
          <CardContent className="p-6 text-center">
            <UserCog className="w-8 h-8 mx-auto text-cyan-500 mb-2" />
            <p className="text-3xl font-bold font-mono">
              {users.filter((u) => u.role === "accountant").length}
            </p>
            <p className="text-sm text-muted-foreground">Accountants</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
          <CardContent className="p-6 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-3xl font-bold font-mono">
              {users.filter((u) => u.role === "viewer").length}
            </p>
            <p className="text-sm text-muted-foreground">Viewers</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl bg-card/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="font-heading">User Management</CardTitle>
          <CardDescription>
            View and manage all registered users. Users with @thestarforge.org email are automatically admins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center text-white font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-[140px] rounded-xl" data-testid={`role-select-${user.id}`}>
                          <SelectValue>
                            <Badge className={`${getRoleBadge(user.role)} capitalize`}>
                              {getRoleIcon(user.role)}
                              <span className="ml-1">{user.role}</span>
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Crown className="w-4 h-4 text-magenta-500" />
                              Admin
                            </div>
                          </SelectItem>
                          <SelectItem value="accountant">
                            <div className="flex items-center gap-2">
                              <UserCog className="w-4 h-4 text-cyan-500" />
                              Accountant
                            </div>
                          </SelectItem>
                          <SelectItem value="viewer">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              Viewer
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.email_verified ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setDeleteOpen(true);
                        }}
                        className="rounded-full text-destructive hover:text-destructive"
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-full">
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
