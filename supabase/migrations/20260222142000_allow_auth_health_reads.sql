-- Allow authenticated web admins to view the health tables too
CREATE POLICY "Auth users can view service_health" ON public.service_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can view health_logs" ON public.health_logs FOR SELECT TO authenticated USING (true);
