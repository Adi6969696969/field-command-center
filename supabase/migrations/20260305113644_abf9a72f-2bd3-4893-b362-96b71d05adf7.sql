
-- Create attendance table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'on_leave', 'half_day', 'late')),
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_lat numeric,
  check_in_lng numeric,
  check_out_lat numeric,
  check_out_lng numeric,
  is_gps_verified boolean DEFAULT false,
  notes text,
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(worker_id, date)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins and district heads can manage attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'district_head'));

CREATE POLICY "Users can insert attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = marked_by);

CREATE POLICY "Users can update own attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (auth.uid() = marked_by);

-- Updated_at trigger
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
