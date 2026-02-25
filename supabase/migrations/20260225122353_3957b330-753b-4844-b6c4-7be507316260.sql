
-- Feedback table for sentiment engine
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  sentiment TEXT DEFAULT 'neutral',
  sentiment_score NUMERIC DEFAULT 0,
  topics TEXT[] DEFAULT '{}',
  district TEXT,
  booth TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view feedback" ON public.feedback
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Admins can manage all feedback" ON public.feedback
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'district_head'::app_role)
  );

-- Badges table for gamification
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  badge_type TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  description TEXT,
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view badges" ON public.badges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage badges" ON public.badges
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'district_head'::app_role)
  );

-- Enable realtime for feedback
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
