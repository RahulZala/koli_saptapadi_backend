# How to Import `koli_all.sql` into Supabase (PostgreSQL Solution)

Supabase runs **PostgreSQL**, whereas `koli_all.sql` is a **MySQL** dump. PostgreSQL uses slightly different syntax, data types, and primary key definitions.

Below is the complete solution for importing your database into Supabase.

---

## 🚀 Option 1: Direct Supabase SQL Editor Import (Converted Schema)

Follow these steps to set up your tables directly in Supabase:

### Step 1: Open Supabase SQL Editor
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Click on **SQL Editor** in the left sidebar.
4. Click **New Query**.

---

### Step 2: Copy and Paste the PostgreSQL Conversion SQL

Paste the following PostgreSQL-compatible schema creation script into the SQL Editor and click **Run**:

```sql
-- Disable foreign key checks during import if needed
SET check_function_bodies = false;

-- Create Enum Types for Supabase
CREATE TYPE interest_status_type AS ENUM ('pending', 'accepted', 'rejected');

-- 1. States Table
CREATE TABLE IF NOT EXISTS states (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 2. Districts Table
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    state_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT fk_districts_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE
);

-- 3. Cities Table
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    district_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT fk_cities_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
);

-- 4. Sub Castes Table
CREATE TABLE IF NOT EXISTS sub_castes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_active SMALLINT DEFAULT 1
);

-- 5. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(150),
    password VARCHAR(255),
    gender VARCHAR(20),
    dob DATE,
    profile_for VARCHAR(50),
    sub_caste VARCHAR(100),
    document SMALLINT DEFAULT 0,
    is_verified SMALLINT DEFAULT 0,
    is_active SMALLINT DEFAULT 1,
    api_token VARCHAR(255),
    fcm_token TEXT,
    family_completed SMALLINT DEFAULT 0,
    physical_completed SMALLINT DEFAULT 0,
    address_completed SMALLINT DEFAULT 0,
    marital_professional_completed SMALLINT DEFAULT 0,
    partner_preferences_completed SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 6. User OTPs Table
CREATE TABLE IF NOT EXISTS user_otps (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    is_used SMALLINT DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Family Details Table
CREATE TABLE IF NOT EXISTS family_details (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    father_name VARCHAR(150),
    mother_name VARCHAR(150),
    maternal_surname VARCHAR(256) NOT NULL,
    siblings INT DEFAULT 0,
    father_occupations VARCHAR(255) NOT NULL,
    family_type VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 8. Physical Details Table
CREATE TABLE IF NOT EXISTS physical_details (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    height VARCHAR(50),
    weight NUMERIC(5,2),
    smoking VARCHAR(50),
    drinking VARCHAR(50),
    diet VARCHAR(50),
    is_disabled VARCHAR(50),
    disability_details VARCHAR(255),
    languages_known VARCHAR(255),
    manglik VARCHAR(50) DEFAULT 'dont_know',
    marital_status VARCHAR(50),
    child_count INT DEFAULT 0,
    thalassemia_status VARCHAR(50) DEFAULT 'dont_know',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 9. User Addresses Table
CREATE TABLE IF NOT EXISTS user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address_type VARCHAR(50) NOT NULL,
    address_line TEXT NOT NULL,
    landmark VARCHAR(255),
    state_id INT REFERENCES states(id),
    district_id INT REFERENCES districts(id),
    city_id INT REFERENCES cities(id),
    pincode VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 10. Marital Professional Details Table
CREATE TABLE IF NOT EXISTS marital_professional_details (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    highest_degree VARCHAR(150),
    university_name VARCHAR(256) NOT NULL,
    degree VARCHAR(256) DEFAULT '',
    occupation VARCHAR(150),
    work_city VARCHAR(256) NOT NULL,
    annual_income VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 11. Partner Preferences Table
CREATE TABLE IF NOT EXISTS partner_preferences (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    age_min INT,
    age_max INT,
    height_min NUMERIC(5,2),
    height_max NUMERIC(5,2),
    weight_min NUMERIC(5,2),
    weight_max NUMERIC(5,2),
    preferred_marital_status VARCHAR(255),
    preferred_education VARCHAR(255),
    preferred_occupation VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 12. User Photos Table
CREATE TABLE IF NOT EXISTS user_photos (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. User Document Table
CREATE TABLE IF NOT EXISTS user_document (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100),
    profile TEXT,
    front_image TEXT,
    back_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 14. Interests Table
CREATE TABLE IF NOT EXISTS interests (
    id SERIAL PRIMARY KEY,
    from_user INT REFERENCES users(id) ON DELETE CASCADE,
    to_user INT REFERENCES users(id) ON DELETE CASCADE,
    status interest_status_type DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(id) ON DELETE SET NULL,
    receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50),
    reference_id INT,
    is_read SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Profile Views Table
CREATE TABLE IF NOT EXISTS profile_views (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    viewed_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    validity_days INT NOT NULL,
    profile_views INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    plan_id INT REFERENCES subscription_plans(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    remaining_interests INT DEFAULT 0,
    is_active SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. Subscription Payments Table
CREATE TABLE IF NOT EXISTS subscription_payments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    plan_id INT REFERENCES subscription_plans(id),
    amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(100),
    payment_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 20. User Reports Table
CREATE TABLE IF NOT EXISTS user_reports (
    id SERIAL PRIMARY KEY,
    from_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🛠️ Option 2: Automated Data Migration with `pgloader`

To migrate both table schemas AND existing data from MySQL into Supabase automatically:

Run `pgloader` in terminal:
```bash
pgloader mysql://root:password@localhost:3306/koli postgresql://postgres:[YOUR-SUPABASE-PASSWORD]@db.[YOUR-SUPABASE-PROJECT-REF].supabase.co:5432/postgres
```
