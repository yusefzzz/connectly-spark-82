import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { EventCard } from "@/components/EventCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function Explore() {
  const { user } = useAuth();

  // Fetch explore events (bridging user interests with new topics)
  const { data: events, isLoading } = useQuery({
    queryKey: ["explore-events", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's liked events tags
      const { data: likedEvents } = await supabase
        .from("event_likes")
        .select("event_id")
        .eq("user_id", user.id);

      const likedEventIds = likedEvents?.map((l) => l.event_id) || [];

      const { data: tagData } = await supabase
        .from("events")
        .select("tags")
        .in("id", likedEventIds);

      const userTags = tagData?.flatMap((e) => e.tags || []) || [];
      const uniqueTags = [...new Set(userTags)];

      // Get all upcoming events
      const { data: allEvents } = await supabase
        .from("events")
        .select(`
          *,
          profiles:creator_id (username, full_name, avatar_url),
          event_likes (user_id),
          event_attendees (user_id, status)
        `)
        .eq("visibility", "public")
        .gte("event_date", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      // Score events to bridge interests
      const scoredEvents = allEvents?.map((event) => {
        let score = 0;

        // Check if event has some familiar tags but also new ones
        const eventTags = event.tags || [];
        const familiarTags = eventTags.filter((tag: string) => uniqueTags.includes(tag));
        const newTags = eventTags.filter((tag: string) => !uniqueTags.includes(tag));

        // Ideal: 1 familiar tag + 1-2 new tags (bridging)
        if (familiarTags.length === 1 && newTags.length > 0) score += 15;
        if (familiarTags.length === 2 && newTags.length > 0) score += 10;

        // Completely new topics also get some score
        if (familiarTags.length === 0 && newTags.length > 0) score += 5;

        // Boost newer events
        const hoursSinceCreation = (Date.now() - new Date(event.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreation < 24) score += 3;

        // Filter out events user already liked (they've seen them)
        if (likedEventIds.includes(event.id)) score -= 100;

        return { ...event, score };
      });

      // Sort by score
      scoredEvents?.sort((a, b) => b.score - a.score);

      // Enhance with derived data
      return scoredEvents?.map((event) => ({
        ...event,
        is_liked: event.event_likes?.some((l: any) => l.user_id === user.id),
        likes_count: event.event_likes?.length || 0,
        attendees_count: event.event_attendees?.filter((a: any) => a.status === "approved").length || 0,
      }));
    },
    enabled: !!user,
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Explore</h1>
          <p className="text-muted-foreground">
            Discover new events that bridge your interests with something fresh
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
            <h3 className="mb-2 text-lg font-semibold">No events available</h3>
            <p className="text-muted-foreground">
              Check back later for new events to explore
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
