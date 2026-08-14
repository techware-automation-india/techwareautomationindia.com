# Techware Automation India - HR Management Platform

A comprehensive HR management system built with React + Vite frontend and Express + Prisma backend.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Database Setup](#database-setup)
- [Default Credentials](#default-credentials)
- [Available Scripts](#available-scripts)
- [Technology Stack](#technology-stack)

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**

**Note:** This project uses **SQLite** for the database, so no separate database server installation is required!

---

## 📦 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AutoCard-Clean
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Setup Environment Variables

The `.env` file is already created in the `backend` directory with SQLite configuration:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change_me_to_a_long_random_string"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
```

**Note:** SQLite stores data in a local file (`dev.db`), so no database credentials are needed!

---

## 🚀 Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend server will start on `http://localhost:4000`

### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173`

---

## 🗄️ Database Setup

### 1. Generate Prisma Client

```bash
cd backend
npm run prisma:generate
```

### 2. Run Database Migrations

```bash
npm run prisma:migrate
```

This will create all necessary tables in your SQLite database file (`dev.db`).

### 3. Seed the Database

```bash
npm run db:seed
```

This will create default users for testing (Admin, Employee, Customer).

### 4. Open Prisma Studio (Optional)

To view and manage your database with a GUI:

```bash
npm run prisma:studio
```

Prisma Studio will open in your browser at `http://localhost:5555`

---

## Admin: Locations

- **New fields:** The admin Locations module now supports `latitude`, `longitude`, `radius`, and an `isDefault` flag for each location.
- **Default location:** Admin users should create the default office location manually in the admin UI.
- **Behaviour:** Marking a location as `isDefault` will unset `isDefault` on any other location automatically.
- **Notes:** These fields are stored in the SQLite database and visible/editable from the admin UI under Locations.


## 🔑 Default Credentials

After seeding the database, you can login with these credentials:

### Admin Account
- **Email:** `admin@techware.com`
- **Password:** `admin123`
- **Role:** ADMIN
- **Full Name:** System Admin

### Employee Account
- **Email:** `employee@techware.com`
- **Password:** `employee123`
- **Role:** EMPLOYEE
- **Full Name:** Staff Member

### Customer Account
- **Email:** `customer@techware.com`
- **Password:** `customer123`
- **Role:** CUSTOMER
- **Full Name:** Sample Customer

---

## 📜 Available Scripts

### Backend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend in development mode with hot-reload |
| `npm start` | Start backend in production mode |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run db:seed` | Seed database with default data |

### Frontend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend development server (Vite) |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint to check code quality |

### Common Prisma Commands

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Pull database schema to Prisma
npx prisma db pull

# Push schema changes without migration
npx prisma db push

# Format Prisma schema file
npx prisma format
```

---

## 🛠️ Technology Stack

### Frontend
- **React** 19.2.6
- **Vite** 8.0.12
- **React Router** 7.15.0
- **Tailwind CSS** 3.4.19
- **Framer Motion** 12.38.0
- **Axios** 1.18.1
- **Lucide React** (Icons)
- **Sonner** (Toast notifications)

### Backend
- **Node.js** with Express 4.21.2
- **Prisma ORM** 6.1.0
- **SQLite** Database (no server required!)
- **JWT** Authentication (jsonwebtoken 9.0.3)
- **bcryptjs** 2.4.3 (Password hashing)
- **Zod** 3.24.1 (Validation)
- **Nodemailer** 9.0.1 (Email)
- **Multer** 2.2.0 (File uploads)
- **CORS** enabled

---

## 📁 Project Structure

```
AutoCard-Clean/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── validation/
│   │   ├── index.js
│   │   └── prismaClient.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── admin/
│   │   ├── employee/
│   │   ├── customer/
│   │   └── components/
│   ├── public/
│   ├── package.json
│   └── index.html
└── README.md
```

---

## 🔐 Security Notes

- Change default passwords immediately in production
- Use strong JWT_SECRET in production
- Enable HTTPS in production
- Configure proper CORS settings
- Never commit `.env` files to version control

---

## 🐛 Troubleshooting

### Database Issues

Since this project uses SQLite, most database connection issues are eliminated! The database file (`dev.db`) is created automatically.

If you need to reset the database:

```bash
cd backend
npx prisma migrate reset --force
npm run db:seed
```

### Port Already in Use

If port 4000 or 5173 is already in use:

- Backend: Change `PORT` in `.env`
- Frontend: Vite will automatically suggest an alternative port

### Prisma Client Issues

If Prisma Client is out of sync:

```bash
cd backend
npm run prisma:generate
```

### Migration Errors

If you encounter migration errors, you can use `db push` instead:

```bash
cd backend
npx prisma db push
npm run db:seed
```

---

## 📞 Support

For issues or questions, please contact the development team.

---

## 📄 License

This project is proprietary software. All rights reserved.
