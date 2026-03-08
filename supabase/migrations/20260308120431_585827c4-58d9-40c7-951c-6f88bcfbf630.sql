CREATE POLICY "District heads can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'district_head'::app_role));