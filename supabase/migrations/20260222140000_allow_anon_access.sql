-- Allow anonymous access for the Python scripts using the public anon key

-- Categories
CREATE POLICY "Anon users can view categories" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can insert categories" ON public.categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon users can update categories" ON public.categories FOR UPDATE TO anon USING (true);

-- Events
CREATE POLICY "Anon users can view events" ON public.events FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can insert events" ON public.events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon users can update events" ON public.events FOR UPDATE TO anon USING (true);

-- Sales
CREATE POLICY "Anon users can view sales" ON public.sales FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can insert sales" ON public.sales FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon users can update sales" ON public.sales FOR UPDATE TO anon USING (true);

-- Service Health (Enable RLS if not already enabled)
ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon users can view service_health" ON public.service_health FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can insert service_health" ON public.service_health FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon users can update service_health" ON public.service_health FOR UPDATE TO anon USING (true);

-- Health Logs (Enable RLS if not already enabled)
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon users can view health_logs" ON public.health_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon users can insert health_logs" ON public.health_logs FOR INSERT TO anon WITH CHECK (true);
