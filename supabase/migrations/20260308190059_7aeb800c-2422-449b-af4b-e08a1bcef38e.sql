
-- Drop all existing restrictive policies on attendance
DROP POLICY IF EXISTS "Admins and district heads can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins and district heads can manage attendance"
ON public.attendance FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'district_head'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'district_head'::app_role));

CREATE POLICY "Authenticated users can view attendance"
ON public.attendance FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can insert attendance"
ON public.attendance FOR INSERT TO authenticated
WITH CHECK (auth.uid() = marked_by);

CREATE POLICY "Users can update own attendance"
ON public.attendance FOR UPDATE TO authenticated
USING (auth.uid() = marked_by);
