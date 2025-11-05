import { Link, useLocation } from "react-router-dom";
import { Home, Compass, PlusCircle, User, Bell } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "./ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count || 0;
    },
    enabled: !!user,
  });

  const navItems = [
    { path: "/", icon: Home, label: "For You" },
    { path: "/explore", icon: Compass, label: "Explore" },
    { path: "/create", icon: PlusCircle, label: "Create" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-primary to-accent" />
            <span className="text-xl font-bold">Connectly</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link to="/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount && unreadCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">{children}</main>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
        <div className="flex justify-around">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link key={path} to={path} className="flex-1">
              <Button
                variant="ghost"
                className={`h-16 w-full rounded-none ${
                  location.pathname === path ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{label}</span>
                </div>
              </Button>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop sidebar navigation */}
      <nav className="fixed bottom-6 right-6 hidden flex-col gap-2 md:flex">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link key={path} to={path}>
            <Button
              variant={location.pathname === path ? "default" : "outline"}
              size="lg"
              className="w-48 justify-start gap-3"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Button>
          </Link>
        ))}
      </nav>
    </div>
  );
}
