# Order Management and Delivery System (Negadras Dispatch Engine)

A complete, lightweight, full-stack dispatching and order management web platform designed for local delivery companies. 

This platform allows company dispatchers (Staff/Admins) to register customers, manage active driver fleets, track credit balances for corporate accounts, dispatch incoming delivery calls, trigger automated customer and driver SMS alerts, and compile business data into beautiful Excel reports.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 19, Tailwind CSS, Lucide Icons, and Motion.
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, and Motion on Cloudflare Pages.
- **Backend**: Cloudflare Pages Functions with Hono and Web Crypto; the Node/Express server remains available for local development.
- **Database**: Cloudflare D1 in production, with the local JSON/MongoDB-compatible adapter for Node development.
- **Security**: Web Crypto PBKDF2 password hashing and HMAC-signed JWT authentication on Workers.
- **Integrations**: CSV report downloads and Basic Auth Android SMS Gateway protocol.

---

## 📂 File Directory Layout
```
├── README.md               # Root-level project setup and instruction documentation
├── package.json            # Application dependencies and build scripts
├── vite.config.ts          # Vite asset bundling rules
├── tsconfig.json           # Global TypeScript settings
├── index.html              # HTML DOM entry-point
├── server.ts               # Custom Express server with Vite middleware integration
├── backend/                # Server-side architecture
│   ├── db.ts               # MongoDB Mongoose-like file persistence database
│   ├── middleware/
│   │   ├── auth.ts         # JWT security middleware
│   ├── models/
│   │   ├── User.ts         # Dispatcher admin schema
│   │   ├── Customer.ts     # Clients/Account Holders schema
│   │   ├── Driver.ts       # Fleet driver schema
│   │   └── Order.ts        # Dispatch order schema
│   ├── routes/
│   │   ├── auth.ts         # Credentials verification router
│   │   ├── customers.ts    # Accounts directory & settlements router
│   │   ├── drivers.ts      # Active fleet configuration router
│   │   ├── orders.ts       # Core dispatch workflow & Excel compiler router
│   │   └── sms.ts          # Simulated SMS transmission log router
│   └── utils/
│       ├── smsGateway.ts   # Automated SMS dispatcher utility
│       └── excelExport.ts  # Excel log binary compilers (xlsx)
└── frontend/               # Client-side React interface
    ├── App.tsx             # Main React application entry
    ├── main.tsx            # DOM Render mounting point
    ├── index.css           # Global Tailwind imports
    └── types.ts            # Client-side typescript interface declarations
```

---

## 💾 Core Schemas & Database Models

The local persistence file database (`/backend/db.ts`) mirrors standard MongoDB / Mongoose schemas.

### 1. `Customers` Profile
- `_id`: String (Unique identifier)
- `name`: String (Required)
- `phone`: String (Required, Unique phone collision check)
- `address`: String (Billing or Delivery Address)
- `type`: Enum `['NORMAL', 'ACCOUNT_HOLDER']`
- `creditBalance`: Number (Accumulates credit balance, defaults to `0.00`)

### 2. `Drivers` Fleet
- `_id`: String (Unique identifier)
- `name`: String (Required)
- `phone`: String (Required)
- `status`: Enum `['AVAILABLE', 'BUSY', 'INACTIVE']` (Defaults to `AVAILABLE`)

### 3. `Orders` Dispatch
- `_id`: String (Unique identifier)
- `orderNumber`: Number (Unique, auto-incrementing dispatcher reference starting at `1001`)
- `customer`: ObjectId Ref `Customers`
- `driver`: ObjectId Ref `Drivers`
- `pickupAddress`: String (Required pickup warehouse or store)
- `deliveryAddress`: String (Required dropoff residential address)
- `fee`: Number (Delivery fee value)
- `paymentType`: Enum `['CASH', 'CREDIT']`
- `paymentStatus`: Enum `['UNPAID', 'PAID', 'SETTLED']`
- `orderStatus`: Enum `['PENDING', 'DISPATCHED', 'DELIVERED', 'CANCELLED']`
- `createdAt`: ISO Date String

---

## 🔒 Security Gateways

1. **JWT Auth Verification**: 
   All client requests (excluding `/api/auth/login` and `/api/auth/register`) must append `Authorization: Bearer <JWT_TOKEN>` header.
2. **Password Cryptography**: 
   Hashed safely with `bcryptjs` before committing to the mock DB layer.

---

## 🌐 Android SMS Gateway Integration Specifications

Outgoing SMS are sent using an HTTP Basic Auth `POST` request matching the admin's Android SMS Gateway app credentials.

- **Endpoint**: `POST ${SMS_GATEWAY_ADDRESS}/v1/message/send`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Basic Base64(SMS_GATEWAY_USERNAME:SMS_GATEWAY_PASSWORD)`
- **Body payload**:
  ```json
  {
    "phoneNumber": "...",
    "message": "...",
    "deviceId": "..."
  }
  ```
- **Fallback Simulation**: If environment variables are missing, the system prints the exact text layout to the server console and redirects logs to `/api/sms/logs` for real-time sandbox verification.

---

## 🚀 Setup & Local Execution Instructions

### 1. Configure Environment Variables (`.env`)
Create a `.env` file at the root of the project for local Node development, or
configure the equivalent Cloudflare Pages variables/secrets:
```env
PORT=3000
NODE_ENV=production
APP_URL=https://nega.bahma.com.et
JWT_SECRET="replace-with-a-long-random-secret"

# Android SMS Gateway credentials
SMS_GATEWAY_ADDRESS="https://my-sms-gateway-endpoint.com"
SMS_GATEWAY_USERNAME="gateway-user"
SMS_GATEWAY_PASSWORD="gateway-password"
SMS_GATEWAY_DEVICE_ID="android-device-identifier-1"
```

### Cloudflare Pages deployment

Production uses Cloudflare Pages for the Vite frontend, Pages Functions for
the `/api/*` backend, and Cloudflare D1 for persistence. The legacy
Node/Express server remains available for local development and is not used by
Pages.

1. Authenticate Wrangler with `npx wrangler login`.
2. Create the D1 database with `npx wrangler d1 create dispatch-cf`.
3. Copy the returned database ID into `wrangler.toml`, replacing
  `REPLACE_WITH_D1_DATABASE_ID`.
4. Apply the schema with `npx wrangler d1 migrations apply dispatch-cf --remote`.
5. Set production secrets with `npx wrangler pages secret put JWT_SECRET --project-name dispatch-cf` and repeat for `SMS_GATEWAY_PASSWORD` if live SMS is enabled.
6. Create the Pages project with `npx wrangler pages project create dispatch-cf`, then deploy with `npm run deploy`.

In the Cloudflare dashboard, use `npm run build` as the build command and
`dist` as the output directory. The Pages Function and frontend share one
origin, so the existing relative `/api` requests work without a separate API
URL or CORS setup.

### 2. Boot Up Development Servers
Launch both Vite and Express concurrent routing inside the sandbox or your console:
```bash
npm run dev
```

### 3. Open Dispatch Dashboard
Open your browser and navigate to:
```
http://localhost:3000
```

### 4. Live Login Credentials
Use the pre-seeded admin user details to bypass the authentication gate:
- **Username**: `admin`
- **Password**: `password123`
