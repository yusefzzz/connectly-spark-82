import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function Notifications() {
  const { user } = useAuth();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data;
    },
    enabled: !!user,
  });

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Notifications</h1>

        <div className="space-y-4">
          {notifications?.map((notif) => (
            <Card key={notif.id} className={`p-4 ${!notif.read ? "border-primary" : ""}`}>
              <div className="flex items-start gap-4">
                <Bell className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p>{notif.message}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
