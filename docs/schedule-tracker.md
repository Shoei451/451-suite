# Schedule Tracker

Lightweight weekly schedule manager built with vanilla HTML/CSS/JS and Supabase.

This repository contains:

- `index.html`: a landing/introduction page
- `home.html`: the actual schedule app (auth + schedule management)

## What It Does

Schedule Tracker lets each user:

- Sign up / sign in with Supabase Auth (email + password)
- Add schedule slots by weekday (including multi-day insert)
- Edit and delete existing slots
- Assign label, color, and notification lead time per slot
- Visualize today in a 24-hour donut chart with a live clock hand
- See current slot and next slot in real time
- Handle overnight slots (end time earlier than start time)

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Supabase (Auth + Postgres + RLS)
- Web Notifications API

## Project Structure

```text
.
|- index.html                      # Landing page
|- home.html                       # Main app UI
|- style.css                       # App styling
|- main.js                         # App logic (state, render, CRUD, auth, notifications)
|- config.js                       # Supabase client + constants
|- weekly_schedule_migration.sql   # DB schema + RLS policies
|- schedule-tracker.svg            # Favicon/logo
```

## Setup

### 1) Configure Supabase

Update `config.js` with your Supabase project values:

- Project URL
- Publishable (anon) key

This app expects table name `weekly_schedule`.

### 2) Create Table and Policies

Run SQL from `weekly_schedule_migration.sql` in Supabase SQL Editor.

It creates:

- `weekly_schedule` table
- Row Level Security
- Policies for own-row select/insert/delete

To enable edit mode in the UI (`UPDATE`), also run:

```sql
CREATE POLICY "update_own" ON weekly_schedule
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3) Run Locally

This is a static frontend app, so no build step is required.

Serve the directory with any static server, for example:

```bash
python -m http.server 5500
```

Then open:

- `http://localhost:5500/index.html` (landing page)
- `http://localhost:5500/home.html` (app)

## Data Model

`weekly_schedule` stores:

- `user_id` (owner)
- `day_of_week` (0-6)
- `start_hour` / `end_hour` (float hour values)
- `label`
- `color`
- `notify_before` (minutes)

If `end_hour < start_hour`, the slot is treated as overnight.

## Notification Behavior

- Uses browser Notification API only
- Notification appears before start time based on `notify_before`
- Works only while the app page is open
- Requires notification permission

## Notes

- Desktop and mobile layouts are both supported.
- Auth/session persistence is handled through Supabase client session.
