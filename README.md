# Withdrawal Engine

A robust, production-ready Node.js withdrawal processing system that integrates with M-Pesa for financial transactions. Built with Express.js, PostgreSQL, Redis, and BullMQ, this engine provides reliable fund withdrawal handling with job queuing, transaction tracking, and graceful error handling.

## Features

- **Transaction Processing**: Accept and process user withdrawal requests with atomic database operations
- **M-Pesa Integration**: Seamless B2C (Business-to-Customer) payment integration with M-Pesa/Safaricom
- **Job Queue System**: BullMQ-based asynchronous job processing for reliable payout execution
- **Ledger Tracking**: Complete transaction and ledger logging for audit trails
- **Idempotency**: Built-in idempotency key support to prevent duplicate transactions
- **Callback Handling**: M-Pesa callback webhook processing for transaction status updates
- **Graceful Shutdown**: Proper cleanup and connection management during application shutdown
- **Health Checks**: Built-in health check endpoint for monitoring

## Tech Stack

- **Runtime**: Node.js with ES modules
- **API Framework**: Express.js 5.x
- **Database**: PostgreSQL with connection pooling
- **Message Queue**: BullMQ with Redis backend
- **HTTP Client**: Axios
- **Utilities**: UUID for unique identifiers, dotenv for configuration

## Project Structure

```
withdrawal-engine/
├── server.js                    # Application entry point
├── package.json                 # Project dependencies
├── .env                         # Environment variables (not in repo)
└── src/
    ├── controllers/
    │   ├── withdrawFund.controller.js      # Withdrawal request handler
    │   └── mpesaCallback.controller.js     # M-Pesa callback handler
    ├── routes/
    │   └── payout.routes.js                # API route definitions
    ├── services/
    │   ├── business/
    │   │   └── withdraw.service.js         # Withdrawal business logic
    │   └── mpesa/
    │       └── mpesa.service.js            # M-Pesa API integration
    ├── database/
    │   ├── database.config.js              # PostgreSQL pool configuration
    │   └── database.tables.js              # Database schema initialization
    ├── queues/
    │   ├── queue.config.js                 # Redis/BullMQ configuration
    │   └── payout.queue.js                 # Payout job queue setup
    └── workers/
        └── payout.worker.js                # Background job processor
```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/juneboy933/withdraw_engine.git
   cd withdraw_engine
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=8000
   NODE_ENV=production

   # Database Configuration
   DB_USER=your_postgres_user
   DB_HOST=localhost
   DB_DATABASE=withdrawal_engine
   DB_PASSWORD=your_postgres_password
   DB_PORT=5432

   # Redis Configuration
   REDIS_URL=redis://localhost:6379

   # M-Pesa Configuration
   MPESA_CONSUMER_KEY=your_consumer_key
   MPESA_CONSUMER_SECRET=your_consumer_secret
   MPESA_TOKEN_URL=https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
   MPESA_B2C_URL=https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest
   INITIATOR_NAME=your_initiator_name
   ```

## Getting Started

1. **Ensure prerequisites are running**
   - PostgreSQL server is running
   - Redis server is running

2. **Initialize the database**
   The application will automatically create necessary tables on startup if they don't exist.

3. **Start the development server**
   ```bash
   npm run dev
   ```
   
   Or for production:
   ```bash
   npm start
   ```

4. **Verify the service is running**
   ```bash
   curl http://localhost:8000/health
   ```

## API Endpoints

### 1. Submit Withdrawal Request
**POST** `/api/v1/withdraw`

Submit a withdrawal request to be processed.

**Request Body:**
```json
{
  "userId": "user_123",
  "phoneNumber": "+254712345678",
  "amount": 500
}
```

**Success Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Withdrawal request accepted and is being processed.",
  "transactionId": 42,
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses:**
- `400 Bad Request` - Missing fields or invalid amount
- `404 Not Found` - Account not found
- `400 Bad Request` - Insufficient funds
- `500 Internal Server Error` - Server error

### 2. M-Pesa Callback Handler
**POST** `/api/v1/mpesa/callback`

Webhook endpoint for M-Pesa to send transaction status updates. This is called by M-Pesa when a B2C transaction completes.

### 3. Health Check
**GET** `/health`

Check application health status.

**Response:**
```json
{
  "app": "Withdrawal engine",
  "timestamp": "2026-04-12T10:30:00.000Z",
  "status": "OK"
}
```

## How It Works

### Withdrawal Flow

1. **User Initiates Withdrawal**
   - Client sends POST request to `/api/v1/withdraw` with user ID, phone number, and amount

2. **Validation & Account Check**
   - Controller validates required fields and amount format
   - Service locks the account row and verifies balance using database transaction

3. **Transaction Recording**
   - Account balance is debited
   - Transaction record created with "Pending" status
   - Ledger entry recorded for audit trail
   - All changes committed atomically

4. **Queue Job Creation**
   - Withdrawal job added to BullMQ queue with idempotency key
   - Immediate response sent to client (202 Accepted)

5. **Background Processing**
   - Worker picks up job from queue
   - Updates transaction status to "Processing"
   - Calls M-Pesa B2C API to initiate payment

6. **Status Callback**
   - M-Pesa sends callback with transaction result
   - Transaction final status updated in database

### Error Handling & Retries

- **Database Errors**: Transaction rolled back, no partial updates
- **M-Pesa API Errors**: BullMQ retry mechanism with exponential backoff
- **Network Failures**: Automatic job retry with configurable retry strategy
- **Critical Failures**: Admin alerts triggered after max retries exceeded

## Database Schema

### Core Tables

**accounts**
- `id`: Primary key
- `user_id`: Foreign key to users
- `balance`: Current account balance
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

**transactions**
- `id`: Primary key
- `account_id`: Foreign key to accounts
- `idempotency_key`: Unique identifier to prevent duplicates
- `amount`: Transaction amount
- `status`: Current status (Pending, Processing, Completed, Failed)
- `description`: Transaction details
- `created_at`: Transaction timestamp

**ledger**
- `id`: Primary key
- `transaction_id`: Foreign key to transactions
- `amount`: Ledger entry amount
- `entry_type`: Type (debit/credit)
- `created_at`: Entry timestamp

## Development

### Running in Development Mode
```bash
npm run dev
```
Uses `nodemon` for automatic server restart on file changes.

### Running Tests
```bash
npm test
```
Note: Test suite is not yet configured. See [Contributing](#contributing).

## Deployment

### Production Checklist

- [ ] Environment variables properly configured for production
- [ ] Database backups enabled and tested
- [ ] Redis persistence configured
- [ ] SSL/TLS certificates installed
- [ ] Rate limiting configured on withdrawal endpoint
- [ ] Monitoring and logging setup (e.g., Datadog, New Relic)
- [ ] Error tracking configured (e.g., Sentry)
- [ ] Database connection pooling optimized
- [ ] BullMQ retry strategy configured appropriately
- [ ] M-Pesa credentials rotated and secured in secrets manager
- [ ] Health check endpoints configured for load balancers
- [ ] Graceful shutdown tested

### Docker Deployment Example

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8000
CMD ["npm", "start"]
```

## Monitoring & Logging

The application includes:
- Console logging for process events
- Transaction logging for audit trails
- Worker job failure alerts
- Database operation tracking
- M-Pesa API response logging

Consider integrating:
- Structured logging (e.g., Winston, Pino)
- APM tools (e.g., New Relic, Datadog)
- Error tracking (e.g., Sentry)
- Metrics collection (e.g., Prometheus)

## Contributing

Contributions are welcome! Please follow these steps:

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## Security Considerations

- **Sensitive Data**: Never commit `.env` files or credentials
- **Input Validation**: All user inputs are validated
- **Database Transactions**: Atomic operations prevent race conditions
- **Idempotency**: Duplicate requests are safely handled
- **API Security**: Consider adding:
  - Authentication (JWT, API keys)
  - Rate limiting
  - CORS policy
  - Request signing for M-Pesa callbacks

## Troubleshooting

### Application won't start
- Verify PostgreSQL is running: `psql --version`
- Verify Redis is running: `redis-cli ping`
- Check `.env` variables are set correctly
- Review error logs in console output

### Withdrawals stuck in "Processing"
- Check if Redis/BullMQ is running
- Verify M-Pesa credentials are valid
- Check network connectivity to M-Pesa API
- Review worker logs for errors

### Database connection errors
- Verify PostgreSQL credentials in `.env`
- Ensure database user has necessary permissions
- Check database exists: `psql -l`
- Verify host/port configuration

## License

ISC

## Support

For issues and feature requests, please create an issue on the [GitHub repository](https://github.com/juneboy933/withdraw_engine).

---

**Built with ❤️ for reliable financial transactions**
