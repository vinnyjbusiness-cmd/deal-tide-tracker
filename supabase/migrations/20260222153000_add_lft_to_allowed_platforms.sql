ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_platform_check;
ALTER TABLE sales ADD CONSTRAINT sales_platform_check CHECK (platform IN ('Tixstock', 'Fanpass', 'LiveTicketGroup', 'LiveFootballTickets'));
