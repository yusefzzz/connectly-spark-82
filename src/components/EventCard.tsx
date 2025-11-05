import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Heart, MapPin, Calendar, Users, ExternalLink } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface EventCardProps {
  event: any;
}

export function EventCard({ event }: EventCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user || isLiking) return;

    setIsLiking(true);
    try {
      if (event.is_liked) {
        await supabase
          .from("event_likes")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("event_likes").insert({
          event_id: event.id,
          user_id: user.id,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["explore-events"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <Link to={`/event/${event.id}`}>
      <Card className="group overflow-hidden transition-all hover:shadow-lg">
        {event.image_url && (
          <div className="relative h-48 w-full overflow-hidden">
            <img
              src={event.image_url}
              alt={event.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-xl font-bold text-white">{event.title}</h3>
            </div>
          </div>
        )}

        <div className="space-y-4 p-4">
          {!event.image_url && (
            <h3 className="text-xl font-bold">{event.title}</h3>
          )}

          <p className="line-clamp-2 text-muted-foreground">{event.description}</p>

          <div className="flex flex-wrap gap-2">
            {event.tags?.map((tag: string) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(event.event_date), "PPP")}
            </div>

            {event.event_type === "in-person" && event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {event.location}
              </div>
            )}

            {event.event_type === "online" && event.online_link && (
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Online Event
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Heart
                  className={`h-4 w-4 ${event.is_liked ? "fill-primary text-primary" : ""}`}
                />
                <span>{event.likes_count || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{event.attendees_count || 0}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              disabled={isLiking}
            >
              <Heart
                className={`h-5 w-5 ${event.is_liked ? "fill-primary text-primary" : ""}`}
              />
            </Button>
          </div>
        </div>
      </Card>
    </Link>
  );
}
