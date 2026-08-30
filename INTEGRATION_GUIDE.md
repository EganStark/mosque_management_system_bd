# 🔗 Landing Page Integration Guide

## 📋 Overview

This guide explains how to connect the React landing page frontend (in `landing-page/`) with the Express backend API (in `src/routes/api.js`).

---

## 🏗️ Architecture

```
Frontend (React + Vite)          Backend (Express)
┌─────────────────────┐          ┌──────────────────┐
│  landing-page/      │          │  src/            │
│  - Components       │  ────→   │  - routes/api.js │
│  - API calls        │  ←────   │  - Database      │
│  - Pages            │  (HTTP)  │  - Services      │
└─────────────────────┘          └──────────────────┘
   Port: 3001                        Port: 3000
```

---

## 🚀 Quick Start

### Step 1: Backend API (Express)
✅ **Already Created** - See `src/routes/api.js`

**Endpoints available:**
- `GET /api/prayer-times` - Prayer times for the day
- `GET /api/dashboard-stats` - Collections, expenses, balance
- `GET /api/donations/recent` - Recent donations
- `GET /api/members/count` - Member statistics
- `GET /api/announcements` - Latest announcements
- `GET /api/company-settings` - Mosque information
- `GET /api/gallery` - Photo gallery
- `GET /api/staff` - Staff directory
- `GET /api/faq` - Frequently asked questions
- `GET /api/janaza` - Death notices
- `POST /api/contact` - Contact form submissions
- `POST /api/donations/submit` - Donation submissions

### Step 2: Frontend Setup

1. **Navigate to landing-page folder:**
   ```bash
   cd landing-page
   npm install
   ```

2. **Create `.env.local` file** (already created):
   ```
   VITE_API_URL=http://localhost:3000/api
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5173` (or another port)

### Step 3: Connect Components to API

Each component needs to fetch data from the API. Here's how:

#### Example: Prayer Times Component

**Current (hardcoded):**
```typescript
// src/components/mosque/PrayerTimes.tsx
function PrayerTimes() {
  const prayerTimes = {
    prayers: [
      { name: 'Fajr', time: '04:35' },
      // ...
    ]
  };
  return <div>...</div>;
}
```

**Updated (with API):**
```typescript
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/lib/api';

function PrayerTimes() {
  const { data: prayerTimes, isLoading, error } = useQuery({
    queryKey: ['prayer-times'],
    queryFn: () => apiService.getPrayerTimes(),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading prayer times</div>;

  return (
    <div>
      {prayerTimes?.prayers.map(prayer => (
        <div key={prayer.name}>
          {prayer.name} - {prayer.time}
        </div>
      ))}
    </div>
  );
}
```

---

## 📝 Integration Checklist

### Components to Update:

- [ ] **PrayerTimes.tsx** - Replace hardcoded times with `/api/prayer-times`
- [ ] **Finance.tsx** - Replace with `/api/dashboard-stats`
- [ ] **LiveStats.tsx** - Replace with `/api/members/count`
- [ ] **Donations.tsx** - Replace with `/api/donations/recent`
- [ ] **Announcements.tsx** - Replace with `/api/announcements`
- [ ] **Events.tsx** - Add `/api/events` endpoint
- [ ] **Gallery.tsx** - Replace with `/api/gallery`
- [ ] **Staff.tsx** - Replace with `/api/staff`
- [ ] **FAQ.tsx** - Replace with `/api/faq`
- [ ] **Janaza.tsx** - Replace with `/api/janaza`
- [ ] **DonateForm.tsx** - Connect submit to `/api/donations/submit`
- [ ] **Contact.tsx** - Connect submit to `/api/contact`
- [ ] **HeroCarousel.tsx** - Load images from `/api/gallery?category=carousel`
- [ ] **Navbar.tsx** - Load company name from `/api/company-settings`
- [ ] **Footer.tsx** - Load company info from `/api/company-settings`

---

## 🔄 Real-Time Updates

Use React Query for auto-refreshing:

```typescript
const { data } = useQuery({
  queryKey: ['donations'],
  queryFn: () => apiService.getRecentDonations(6),
  refetchInterval: 30000, // Refresh every 30 seconds
  staleTime: 20000, // Data is fresh for 20 seconds
});
```

---

## 🛠️ Environment Setup

### Development Mode

**Terminal 1 - Start Backend:**
```bash
cd Baitur-Rahman-Jame-Mosjid-Updated
npm run dev
```
Backend runs on `http://localhost:3000`

**Terminal 2 - Start Frontend:**
```bash
cd landing-page
npm run dev
```
Frontend runs on `http://localhost:5173` (or similar)

### Production Mode

**Build Frontend:**
```bash
cd landing-page
npm run build
```

**Serve both from same Express server:**
```bash
# Copy build output to Express static folder
cp -r landing-page/dist/* src/public/landing
```

---

## 🐛 Debugging API Calls

### Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Make a request in the app
4. Click the request to see response

### Console
Enable logging in `src/lib/api.ts`:
```typescript
console.log(`Calling ${API_BASE_URL}${endpoint}`);
console.log('Response:', data);
```

---

## ❌ Troubleshooting

### CORS Error
**Problem:** `Access to XMLHttpRequest blocked by CORS policy`

**Solution:** Add CORS middleware to Express:
```javascript
const cors = require('cors');
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
}));
```

### API Not Responding
1. Check backend is running: `http://localhost:3000/api/prayer-times`
2. Check `.env.local` has correct `VITE_API_URL`
3. Check browser console for errors

### Data Not Updating
1. Check `refetchInterval` is set
2. Verify database queries are working
3. Check React Query DevTools

---

## 📚 Implementation Steps

### Phase 1: Setup (30 min)
- [x] Create backend API routes
- [x] Create frontend API service
- [x] Configure environment variables
- [ ] Test individual endpoints

### Phase 2: Component Integration (2-3 hours)
- [ ] Update PrayerTimes component
- [ ] Update Finance component
- [ ] Update Donations component
- [ ] Update other display components

### Phase 3: Form Integration (1-2 hours)
- [ ] Connect donation form submission
- [ ] Connect contact form submission
- [ ] Add form validation
- [ ] Add success/error handling

### Phase 4: Testing (1 hour)
- [ ] Test all API endpoints
- [ ] Test real-time updates
- [ ] Test on mobile
- [ ] Test error scenarios

### Phase 5: Deployment (1-2 hours)
- [ ] Build frontend
- [ ] Configure production environment
- [ ] Deploy to server
- [ ] Test in production

---

## 📞 Support

### API Documentation

Each endpoint returns a JSON response. Check `src/routes/api.js` for detailed comments and response formats.

### Component Updates

When updating components:
1. Import `useQuery` from `@tanstack/react-query`
2. Import `apiService` from `@/lib/api`
3. Replace static data with API calls
4. Add loading and error states
5. Add refresh intervals as needed

---

## 🎯 Next Steps

1. **Rename folder manually:**
   ```bash
   # In Git Bash or terminal
   mv bayt-ar-rahman-hub-main landing-page
   ```

2. **Start both servers:**
   - Backend: `npm run dev` (port 3000)
   - Frontend: `npm run dev` in landing-page folder (port 3001/5173)

3. **Update components** one by one using the checklist above

4. **Test each component** before moving to next

5. **Deploy** when all components are connected and tested

---

**Questions? Check the code comments in:**
- `src/routes/api.js` - API endpoint details
- `landing-page/src/lib/api.ts` - Frontend API calls
- Component files in `landing-page/src/components/mosque/`
