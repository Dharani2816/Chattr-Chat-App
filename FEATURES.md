# Chatrr — Feature & Technical Deep-Dive

A ranked inventory of every feature, engineering decision, and architectural detail in the app, from most impressive to foundational.

---

## Tier 1: Engineering-Intensive (Portfolio-Worthy)

### 1. AI Chatbot (ChatrrBot) with Context Awareness
- Users type `@ChatrrBot [question]` in any room
- Backend fetches the **last 20 messages** from an in-memory write-through cache (0ms DB reads)
- Builds a **context-rich prompt** including room name, online users, and conversation history
- Sends to **Google Gemini 2.5 Flash** API with automatic fallback models on rate-limit/overload
- API responses are **parsed intelligently** — respects RetryInfo delays from 429 errors
- Responses are **private** — only the asking user sees the bot conversation
- Rate-limited to **5 bot queries per minute per user** to prevent cost explosion
- Swappable provider (Gemini, OpenAI, Ollama) via `callGemini()` function abstraction

**Why it's impressive**: Combines real-time sockets, MongoDB queries, external API orchestration, caching, rate limiting, and privacy scoping — all in one feature.

### 2. Write-Through In-Memory Message Cache
- Every message sent is **simultaneously persisted to MongoDB AND stored in a `Map` in RAM**
- Bot context queries read from cache instead of MongoDB — **0ms vs 50-200ms**
- Cache is **primed on room join** (loads last 50 messages from DB into memory)
- Capped at **50 messages per room** — automatic eviction of oldest
- **Graceful degradation** — falls back to MongoDB if cache is empty (server restart)
- No external dependencies — pure Node.js `Map`

**Why it's impressive**: This is exactly what Redis does, but implemented at the application level with zero infrastructure overhead.

### 3. Rate Limiting (Sliding Window)
- Two-tier rate limiting: **30 messages/min** + **5 bot queries/min** per socket
- Sliding window algorithm — resets exactly 60 seconds after first request, not on a fixed clock
- **Memory-safe** — stale entries cleaned up every 5 minutes via `setInterval`
- Different limits for different message types (bot vs normal)
- User-facing error messages: `"You are sending messages too fast"` and `"⏳ You are using the bot too fast"`
- Frontend **removes the illegally-added message** from UI on error reception

**Why it's impressive**: Rate limiting with per-socket granularity, automatic cleanup, and graceful UX degradation. Most apps skip this entirely.

### 4. Write-Through Cache on Room Join
- When a user joins a room, the last 50 messages from MongoDB are **simultaneously sent to frontend AND cached in memory**
- The cache is stored **newest-first** (unshift) for O(1) access to recent messages
- Room's message history is immediately available for bot queries without additional DB calls
- Handles server restarts gracefully — DB fallback + cache repopulation

---

## Tier 2: Solid Engineering (Above Average)

### 5. Real-Time Typing Indicator
- Debounced emission: emits `typing: true` on keystroke, `typing: false` after **2 seconds of inactivity**
- Also stops on message send (immediate `typing: false`)
- Animated bouncing dots (3 dots with staggered CSS `animation-delay`)
- Plural-aware text: "Alice is typing..." vs "Alice and Bob are typing..." vs "Alice and 2 others..."
- Server-side broadcast to room (not to sender)

### 6. System Join/Leave Notifications
- `"X has joined the room"` emitted on **both** `create-room` and `join-room`
- `"X has left the room"` emitted on `disconnect`
- Styled as centered, muted, italic banners — visually distinct from chat messages
- No username label shown for system messages
- Custom `system-message` CSS class

### 7. Message Timestamps
- Every message stores a MongoDB `Date` timestamp
- Frontend displays in **HH:MM format** via `toLocaleTimeString()`
- Timestamps shown for sent, received, and history-loaded messages
- Small muted text (`0.6rem`, 35% opacity) below each bubble
- Falls back to `new Date()` if timestamp is missing

### 8. Socket.IO Auth Middleware
- JWT verification on socket handshake (before any events)
- `socket.username` and `socket.userId` populated from token payload
- Rejects unauthenticated connections at the transport level
- Handles duplicate login blocking (`"Already logged in from another tab"`)

### 9. Gemini API Fallback Chain
- Primary: `gemini-2.5-flash`
- Fallbacks: `gemini-2.0-flash` → `gemini-flash-latest` → `gemini-2.0-flash-lite`
- Respects `RetryInfo.retryDelay` from 429 responses instead of fixed backoff
- Exponential backoff with model progression on consecutive failures
- Graceful user-facing error: `"⚠️ Could not connect to AI model"`

### 10. Reconnection Logic
- Auto-rejoin room on socket reconnect (server restart / network drop)
- 500ms delay before rejoin to let server rebuild its rooms map
- Checks that `roomId` hasn't changed during delay
- Uses `sessionStorage` for username persistence across reconnects

---

## Tier 3: Standard Good Practices (Expected)

### 11. MongoDB Persistence
- Users, rooms, and messages stored in MongoDB
- Messages indexed on `{ roomId: 1, timestamp: 1 }` for fast sorted queries
- Room model supports upsert (create or update)
- User's room list tracked via `$addToSet`

### 12. Chat History on Join
- Last 50 messages loaded from DB when user joins a room
- Sorted ascending by timestamp for chronological display
- Race-protected via a "chat-history catcher" pattern in socket.js
- Handles both initial load and late-arriving history

### 13. Auth (JWT-based)
- Registration with username + email + password
- Login with email or username
- 7-day JWT expiry stored in `sessionStorage`
- Password hashing with bcryptjs (12 rounds)
- Room list returned on login for quick rejoin

### 14. Error Handling
- Backend guards: missing `roomId`, rate limit exceeded, DB failures
- Frontend displays errors via `error` banner component
- Socket connection errors dispatched via custom events
- `alert()` for rate-limit violations (user must acknowledge)
- `catch` blocks on all async operations with `console.error` logging

### 15. Responsive CSS
- Desktop: sidebar always visible (260px width)
- Mobile: sidebar hidden, toggle button to show
- Responsive breakpoints at 768px and 480px
- Backdrop blur, smooth transitions, dark theme
- Custom scrollbar styling

---

## Tier 4: Foundational (Expected in Any Chat App)

### 16. Room Management
- Create room (generates 8-char uppercase UUID)
- Join room by ID
- Rejoin saved rooms from localStorage
- Room name + room ID displayed in header
- One-click room ID copy to clipboard

### 17. Online Users
- Real-time member list via `online` socket event
- Sidebar with green status dots
- Count badge in header
- Users removed on disconnect

### 18. Message Flow
- Send/receive via Socket.IO `message` event
- Messages persisted to MongoDB
- Broadcast to room (not sender)
- Input panel with send button + Enter key

### 19. Single-Session Enforcement
- Duplicate login detection via socket auth
- Existing session automatically blocked
- User redirected to login with explanation

### 20. Room Persistence
- Rooms survive server restart (stored in MongoDB)
- Users can rejoin rooms they've visited before
- Room creator tracked in DB

---

## Quick Reference: Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express 5 |
| Real-time | Socket.IO 4 |
| Database | MongoDB, Mongoose 9 |
| Auth | JWT (jsonwebtoken) |
| Passwords | bcryptjs |
| AI | Google Gemini API (gemini-2.5-flash) |
| Local dev | Vite dev server + nodemon |

## File Map

```
project/
├── backend/
│   ├── index.js           # Main server: sockets, rooms, cache, rate limiter, Gemini
│   ├── db.js              # MongoDB connection
│   ├── .env               # MONGO_URI, JWT_SECRET, GEMINI_API_KEY
│   ├── middleware/
│   │   └── auth.js        # Socket.IO JWT verification
│   ├── models/
│   │   ├── User.js        # username, email, password, rooms, lastSeen
│   │   ├── Room.js        # roomId, roomName, createdBy
│   │   └── Message.js     # roomId, username, text, timestamp
│   └── routes/
│       └── auth.js        # Register, login endpoints
├── chat-app-frontend/
│   └── src/
│       ├── App.jsx        # Auth UI, room join/create dashboard
│       ├── ChatPage.jsx   # Chat interface, messages, typing, sidebar
│       ├── Room.jsx       # Create room screen
│       ├── socket.js      # Socket.IO client setup + event handlers
│       └── *.css          # Component styles
└── FEATURES.md            # This file