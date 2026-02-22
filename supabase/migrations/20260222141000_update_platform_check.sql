-- Drop the existing constraint
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_platform_check;

-- Create a new constraint that allows Fanpass and LiveTicketGroup
ALTER TABLE public.sales ADD CONSTRAINT sales_platform_check CHECK (platform IN ('LiveFootballTickets', 'Tixstock', 'Fanpass', 'LiveTicketGroup'));
