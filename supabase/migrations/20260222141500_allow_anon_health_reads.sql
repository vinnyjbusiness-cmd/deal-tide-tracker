-- Drop existing anon policies if they exist so we can cleanly replace them
DROP POLICY IF EXISTS "Anon users can view service_health" ON public.service_health;
DROP POLICY IF EXISTS "Anon users can view health_logs" ON public.health_logs;

-- Recreate policy to allow unrestricted SELECT for anon users
CREATE POLICY "Anon users can view service_health" ON public.service_health FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can view health_logs" ON public.health_logs FOR SELECT TO anon USING (true);
