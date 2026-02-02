# Runny - Adaptive Running Training Website

Runny is a web application that helps runners create personalized training plans, track their progress, and connect with other runners.

## Features

- **User Accounts**: Sign up, log in, and manage your profile
- **Goal Setting**: Set your race distance, date, experience level, and availability
- **Training Plans**: Get a personalized plan that adapts to your schedule
- **Flexible Scheduling**: Change your available days and the plan updates automatically
- **Run Logging**: Quick logging after each run with effort and pain tracking
- **Automatic Adjustment**: The system monitors your progress and adjusts training intensity
- **Progress Tracking**: View charts of your weekly volume, long runs, and more
- **Community**: Follow other runners and see their activity

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite with better-sqlite3
- **Charts**: Recharts
- **State Management**: Zustand
- **Styling**: CSS with custom design system

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Runny
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Install client dependencies:
```bash
cd ../client
npm install
```

### Running the Application

1. Start the server (from the server directory):
```bash
cd server
npm run dev
```
The server will run on http://localhost:3001

2. In a new terminal, start the client (from the client directory):
```bash
cd client
npm run dev
```
The client will run on http://localhost:5173

### Environment Variables

The server uses the following environment variables (configured in `server/.env`):

- `PORT`: Server port (default: 3001)
- `JWT_SECRET`: Secret key for JWT tokens
- `DATABASE_PATH`: Path to SQLite database file

## Project Structure

```
Runny/
├── client/                 # React frontend
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── store/         # State management
│   │   └── App.tsx        # Main app component
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Express middleware
│   │   ├── database.ts    # Database setup
│   │   └── index.ts       # Server entry point
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Log in
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile/:id` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/profile/photo` - Upload photo
- `GET /api/users/search` - Search users

### Goals
- `POST /api/goals` - Create goal
- `GET /api/goals/active` - Get active goal
- `PUT /api/goals/:id` - Update goal

### Workouts
- `GET /api/workouts/this-week` - Get current week's workouts
- `GET /api/workouts/plan` - Get full training plan
- `GET /api/workouts/:id` - Get single workout
- `POST /api/workouts/reschedule-week` - Reschedule current week

### Run Logs
- `POST /api/runs` - Log a run
- `GET /api/runs` - Get run history
- `PUT /api/runs/:id` - Update log
- `DELETE /api/runs/:id` - Delete log

### Progress
- `GET /api/progress/overview` - Get progress overview
- `GET /api/progress/weekly` - Get weekly trends
- `GET /api/progress/long-runs` - Get long run history
- `POST /api/progress/check-adjustment` - Trigger plan adjustment

### Community
- `POST /api/community/follow/:userId` - Follow user
- `DELETE /api/community/follow/:userId` - Unfollow user
- `GET /api/community/feed` - Get activity feed
- `GET /api/community/weekly-summaries` - Get weekly summaries
- `GET /api/community/discover` - Discover active users

## Training Plan Algorithm

The training plan generator:

1. Calculates total weeks until race day
2. Divides training into build, peak, and taper phases
3. Assigns workouts based on experience level
4. Protects long runs and key workouts during rescheduling
5. Gradually increases volume (max 10% per week)
6. Reduces intensity for beginners

## License

MIT
