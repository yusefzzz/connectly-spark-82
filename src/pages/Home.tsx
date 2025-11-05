import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { EventCard } from "@/components/EventCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user } = useAuth();

  // Fetch personalized events for FYP
  const { data: events, isLoading } = useQuery({
    queryKey: ["events", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's liked events tags
      const { data: likedEvents } = await supabase
        .from("event_likes")
        .select("event_id")
        .eq("user_id", user.id);

      const likedEventIds = likedEvents?.map((l) => l.event_id) || [];

      let tagQuery = supabase
        .from("events")
        .select("tags")
        .in("id", likedEventIds);

      const { data: tagData } = await tagQuery;

      const userTags = tagData?.flatMap((e) => e.tags || []) || [];
      const uniqueTags = [...new Set(userTags)];

      // Get people user follows
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = following?.map((f) => f.following_id) || [];

      // Build personalized query
      let query = supabase
        .from("events")
        .select(`
          *,
          profiles:creator_id (username, full_name, avatar_url),
          event_likes (user_id),
          event_attendees (user_id, status)
        `)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(20);

      const { data: allEvents } = await query;

      // Score events based on relevance
      const scoredEvents = allEvents?.map((event) => {
        let score = 0;

        // Boost if creator is followed
        if (followingIds.includes(event.creator_id)) score += 10;

        // Boost if tags match user interests
        const matchingTags = event.tags?.filter((tag: string) =>
          uniqueTags.includes(tag)
        ).length || 0;
        score += matchingTags * 5;

        // Boost newer events slightly
        const daysSinceCreation = (Date.now() - new Date(event.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 1) score += 3;

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
          <h1 className="text-3xl font-bold">For You</h1>
          <p className="text-muted-foreground">
            Personalized events based on your interests and connections
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
            <h3 className="mb-2 text-lg font-semibold">No events yet</h3>
            <p className="text-muted-foreground">
              Start following people and liking events to get personalized recommendations
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
