# Deployment & Configuration Guide

This guide covers local environment setup, MySQL database configuration, Cloudinary media storage setup, and Vercel serverless deployment.

---

## 1. Local Setup Instructions

1. **Prerequisites**:
   - Node.js (v18 or higher)
   - MySQL Server (v8.0+ recommended)

2. **Database Setup**:
   - Create database named `koli`:
     ```sql
     CREATE DATABASE koli CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
     ```
   - Import the dump file `koli_all.sql`:
     ```bash
     mysql -u root -p koli < koli_all.sql
     ```

3. **Configure Environment Variables**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Update database credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

4. **Install Dependencies & Run**:
   ```bash
   npm install
   npm run dev
   ```
   The API will be available at `http://localhost:3000`.

---

## 2. Cloudinary Setup

1. Create a free account at [Cloudinary](https://cloudinary.com).
2. Copy your `Cloud Name`, `API Key`, and `API Secret` from the dashboard.
3. Add them to your `.env` or Vercel Environment Variables:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

---

## 3. Razorpay Payment Setup

1. Login to your [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Generate API Key ID & Secret.
3. Add them to your `.env` or Vercel Environment Variables:
   ```env
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   ```

---

## 4. Deploying to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Deploy directly:
   ```bash
   vercel
   ```
3. Set the Environment Variables in Vercel Dashboard:
   - `DB_HOST` (Use remote MySQL provider like PlanetScale, Aiven, Railway, or AWS RDS)
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
