
## Sales Dashboard — Football Ticket Tracker

A full-stack sales tracking dashboard for football ticket resales, with data stored in Supabase and a rich filtering/analytics UI.

---

### Pages & Layout

**1. Dashboard (Home)**
- Top-level summary cards: Total Revenue, Total Tickets Sold, Average Ticket Price, Number of Sales
- Revenue over time chart (line/bar chart, filterable by date range)
- Sales by Platform breakdown (LiveFootballTickets vs Tixstock — pie/bar chart)
- Recent sales feed (last 10–20 sales, live updating)

**2. Sales Table Page**
- Full paginated table of all sales with columns:
  - Event name, Category, Sub-category, Section/Block, Quantity, Ticket Price, Date & Time Sold, Platform
- Powerful filtering bar at the top:
  - **Category** (Liverpool FC, World Cup/Internationals, Champions League, etc.)
  - **Sub-category** (e.g. Liverpool FC → specific match/opponent)
  - **Platform** (LiveFootballTickets, Tixstock)
  - **Date range** picker
  - **Quantity** filter
- Sort by any column

**3. Events Page**
- Browse all tracked events organised by category
- Each event card shows: event name, date, total tickets sold, total revenue from that event
- Click an event to drill down into all sales for that specific event

**4. Add Sale Page**
- A form to manually log a sale if needed (event, section, quantity, price, platform, date/time)
- Bulk CSV import option for importing sales in batches

---

### Data Structure (Supabase)

- **events** table: event name, category (Liverpool FC, World Cup, etc.), sub-category (e.g. specific match), event date
- **sales** table: linked to event, section/block, quantity, ticket price, platform, sale timestamp, notes
- **categories** table: top-level and sub-categories for filtering

---

### Key Features

- **Platform comparison**: Side-by-side stats for LiveFootballTickets vs Tixstock
- **Date/time tracking**: Every sale logged with exact timestamp
- **Hierarchical categories**: Liverpool FC → specific match, World Cup → specific game
- **Real-time updates**: Dashboard refreshes automatically when new sales are added
- **Team login**: Supabase auth so multiple team members can log in and view/enter data
- **Export**: Download filtered sales data as CSV

---

### Design Style

- Clean, dark or light professional dashboard look (similar to analytics tools)
- Sidebar navigation between Dashboard, Sales Table, Events, and Add Sale
- Responsive — works on desktop and tablet
