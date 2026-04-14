# Render Deployment Configuration

## Overview
Render deployment requires separate services since they don't support docker-compose. You'll need:

1. **PostgreSQL Database** (managed by Render)
2. **Redis Instance** (managed by Render)
3. **Web Service** (Express.js API)
4. **Background Worker** (BullMQ job processor)

## Step 1: Create Render Services

### 1.1 PostgreSQL Database
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "PostgreSQL"
3. Name: `withdrawal-postgres`
4. Choose plan (Starter is fine for testing)
5. Create database
6. **Copy the connection details** (you'll need them later)

### 1.2 Redis Instance
1. Click "New" → "Redis"
2. Name: `withdrawal-redis`
3. Choose plan (Starter is fine)
4. Create Redis instance
5. **Copy the Redis URL** (format: `redis://username:password@host:port`)

## Step 2: Deploy Web Service

### 2.1 Create Web Service
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure service:
   - **Name**: `withdrawal-web`
   - **Environment**: `Docker`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your deployment branch)
   - **Root Directory**: Leave empty
   - **Dockerfile Path**: `./Dockerfile`

### 2.2 Environment Variables for Web Service
Add these environment variables in Render:

```
NODE_ENV=production
PORT=10000
DB_HOST=<your-render-postgres-host>
DB_PORT=5432
DB_DATABASE=<your-render-postgres-database>
DB_USER=<your-render-postgres-user>
DB_PASSWORD=<your-render-postgres-password>
REDIS_URL=<your-render-redis-url>
JWT_SECRET=<your-secure-jwt-secret>
MPESA_CONSUMER_KEY=<your-mpesa-consumer-key>
MPESA_CONSUMER_SECRET=<your-mpesa-consumer-secret>
MPESA_TOKEN_URL=https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
MPESA_B2C_URL=https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest
INITIATOR_NAME=<your-initiator-name>
SECURITY_CREDENTIALS=<your-security-credentials>
MPESA_SHORTCODE=<your-shortcode>
CALLBACK_URL=https://your-web-service-url.onrender.com/api/v1/mpesa/callback
MPESA_WHITELISTED_IPS=196.201.214.200,196.201.214.206,196.201.213.114,196.201.214.207,196.201.214.208,196.50.137.33
MPESA_CALLBACK_SECRET=<your-secure-callback-secret>
TRUST_PROXY=true
RUN_MIGRATIONS_ON_STARTUP=true
```

### 2.3 Deploy Web Service
1. Click "Create Web Service"
2. Wait for deployment to complete
3. **Copy the service URL** (you'll need it for the callback URL)

## Step 3: Deploy Background Worker

### 3.1 Create Background Worker
1. Click "New" → "Background Worker"
2. Connect your GitHub repository (same as web service)
3. Configure service:
   - **Name**: `withdrawal-worker`
   - **Environment**: `Docker`
   - **Region**: Same as web service
   - **Branch**: Same as web service
   - **Dockerfile Path**: `./Dockerfile`

### 3.2 Environment Variables for Worker
Add the same environment variables as the web service, but change the command:

```
# Same environment variables as web service...
```

### 3.3 Worker Command Override
In Render, set the worker command to:
```
npm run worker
```

### 3.4 Deploy Worker
1. Click "Create Background Worker"
2. Wait for deployment

## Step 4: Update Callback URL

1. Go back to your web service
2. Update the `CALLBACK_URL` environment variable with your actual Render URL:
   ```
   CALLBACK_URL=https://withdrawal-web.onrender.com/api/v1/mpesa/callback
   ```
3. Redeploy the web service

## Step 5: Run Database Migrations

1. Go to your web service logs
2. Check that migrations ran automatically (RUN_MIGRATIONS_ON_STARTUP=true)
3. If needed, you can run migrations manually via shell:
   - Go to web service → "Shell" tab
   - Run: `npm run migrate`

## Step 6: Verify Deployment

1. **Health Check**: Visit `https://your-web-service-url.onrender.com/health`
2. **API Test**: Try a withdrawal request
3. **Worker Logs**: Check background worker logs for job processing
4. **Database**: Verify tables were created

## Important Notes

### Free Tier Limitations
- Free services sleep after 15 minutes of inactivity
- Background workers may be limited
- Consider upgrading to paid plans for production

### Environment Variables
- Store sensitive values securely in Render's environment variables
- Never commit secrets to your repository

### Scaling
- Web services can be scaled horizontally
- Background workers can be scaled based on queue load

### Monitoring
- Use Render's built-in logs and metrics
- Set up alerts for failed deployments

### Costs
- PostgreSQL: ~$7/month (Starter)
- Redis: ~$6/month (Starter)
- Web Service: ~$7/month (Starter)
- Background Worker: ~$7/month (Starter)

## Troubleshooting

### Common Issues:
1. **Migration Failures**: Check database connection strings
2. **Worker Not Processing**: Verify Redis connection
3. **Callback Failures**: Ensure callback URL is accessible
4. **Health Check Failures**: Check service logs

### Logs Location:
- Web Service: Service → "Logs" tab
- Background Worker: Service → "Logs" tab
- Database: PostgreSQL service → "Logs" tab

Need help with any of these steps?