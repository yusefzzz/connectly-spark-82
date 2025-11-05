import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EventCard } from "@/components/EventCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Profile() {
  const { user, signOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: myEvents, isLoading } = useQuery({
    queryKey: ["my-events", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(`
          *,
          event_likes (user_id),
          event_attendees (user_id, status)
        `)
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false });

      return data?.map((event) => ({
        ...event,
        is_liked: event.event_likes?.some((l: any) => l.user_id === user?.id),
        likes_count: event.event_likes?.length || 0,
        attendees_count: event.event_attendees?.filter((a: any) => a.status === "approved").length || 0,
      }));
    },
    enabled: !!user,
  });

  return (
    <Layout>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{profile?.full_name || profile?.username}</h1>
              <p className="text-muted-foreground">@{profile?.username}</p>
              {profile?.bio && <p className="mt-2">{profile.bio}</p>}
            </div>
            <Button onClick={signOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">My Events</h2>
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-96 w-full" />
              ))}
            </div>
          ) : myEvents && myEvents.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {myEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">You haven't created any events yet</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
