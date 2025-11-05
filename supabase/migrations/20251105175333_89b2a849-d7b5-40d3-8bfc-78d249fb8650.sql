-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('in-person', 'online')),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  location TEXT,
  online_link TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create event_attendees table
CREATE TABLE public.event_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create event_likes table
CREATE TABLE public.event_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create follows table
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('event_created', 'event_approved', 'event_rejected', 'new_follower')),
  message TEXT NOT NULL,
  related_event_id UUID REFERENCES public.events ON DELETE CASCADE,
  related_user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for events (public events visible to all, private requires approval)
CREATE POLICY "Public events are viewable by everyone" ON public.events FOR SELECT USING (visibility = 'public');
CREATE POLICY "Private events viewable by creator and approved attendees" ON public.events FOR SELECT USING (
  visibility = 'private' AND (
    creator_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.event_attendees 
      WHERE event_id = id AND user_id = auth.uid() AND status = 'approved'
    )
  )
);
CREATE POLICY "Users can create their own events" ON public.events FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their own events" ON public.events FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete their own events" ON public.events FOR DELETE USING (auth.uid() = creator_id);

-- RLS Policies for event_attendees
CREATE POLICY "Attendees viewable by event creator and attendee" ON public.event_attendees FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid())
);
CREATE POLICY "Users can request to attend events" ON public.event_attendees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Event creators can update attendee status" ON public.event_attendees FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid())
);
CREATE POLICY "Users can delete their own attendance" ON public.event_attendees FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for event_likes
CREATE POLICY "Likes are viewable by everyone" ON public.event_likes FOR SELECT USING (true);
CREATE POLICY "Users can like events" ON public.event_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON public.event_likes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for follows
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete their own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to notify followers when user creates event
CREATE OR REPLACE FUNCTION public.notify_followers_of_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  follower_record RECORD;
  creator_name TEXT;
BEGIN
  -- Get creator name
  SELECT full_name INTO creator_name FROM public.profiles WHERE id = NEW.creator_id;
  
  -- Notify all followers
  FOR follower_record IN 
    SELECT follower_id FROM public.follows WHERE following_id = NEW.creator_id
  LOOP
    INSERT INTO public.notifications (user_id, type, message, related_event_id, related_user_id)
    VALUES (
      follower_record.follower_id,
      'event_created',
      creator_name || ' created a new event: ' || NEW.title,
      NEW.id,
      NEW.creator_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger to notify followers when event is created
CREATE TRIGGER notify_followers_on_event_creation
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_of_new_event();

-- Create function to notify user of follow
CREATE OR REPLACE FUNCTION public.notify_user_of_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT full_name INTO follower_name FROM public.profiles WHERE id = NEW.follower_id;
  
  INSERT INTO public.notifications (user_id, type, message, related_user_id)
  VALUES (
    NEW.following_id,
    'new_follower',
    follower_name || ' started following you',
    NEW.follower_id
  );
  
  RETURN NEW;
END;
$$;

-- Trigger to notify user when followed
CREATE TRIGGER notify_user_on_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_of_follow();