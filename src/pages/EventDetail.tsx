import { useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Heart, MapPin, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(`
          *,
          profiles:creator_id (username, full_name),
          event_likes (user_id),
          event_attendees (user_id, status)
        `)
        .eq("id", id!)
        .single();

      return {
        ...data,
        is_liked: data.event_likes?.some((l: any) => l.user_id === user?.id),
        likes_count: data.event_likes?.length || 0,
        attendees_count: data.event_attendees?.filter((a: any) => a.status === "approved").length || 0,
        user_attendance: data.event_attendees?.find((a: any) => a.user_id === user?.id),
      };
    },
  });

  const handleJoin = async () => {
    if (!user || !event) return;

    try {
      await supabase.from("event_attendees").insert({
        event_id: event.id,
        user_id: user.id,
        status: event.visibility === "private" ? "pending" : "approved",
      });

      toast({
        title: event.visibility === "private" ? "Request sent" : "Joined!",
        description: event.visibility === "private"
          ? "Waiting for organizer approval"
          : "You're attending this event",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (!event) return null;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        {event.image_url && (
          <div className="h-96 w-full overflow-hidden rounded-lg">
            <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="space-y-4">
          <h1 className="text-4xl font-bold">{event.title}</h1>
          <p className="text-lg text-muted-foreground">{event.description}</p>

          <div className="flex flex-wrap gap-2">
            {event.tags?.map((tag: string) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(new Date(event.event_date), "PPP")}
            </div>
            {event.event_type === "in-person" && event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {event.location}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Heart className={event.is_liked ? "fill-primary text-primary" : ""} />
              {event.likes_count}
            </div>
            <div className="flex items-center gap-2">
              <Users />
              {event.attendees_count}
            </div>
          </div>

          {!event.user_attendance && (
            <Button onClick={handleJoin} size="lg">
              {event.visibility === "private" ? "Request to Join" : "Join Event"}
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
