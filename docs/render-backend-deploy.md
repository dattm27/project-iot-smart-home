# Deploy backend to Render

This repo deploys `be-node-js` as a Render HTTPS web service.

## One-time Render setup

1. Push this repo to GitHub.
2. In Render, create a new Blueprint from the repo. Render reads `render.yaml`.
3. During Blueprint creation, fill the secret env vars marked `sync: false`:
   - `MONGO_URI`
   - `HIVEMQ_USERNAME`
   - `HIVEMQ_PASSWORD`
   - `MQTT_BROKER_URL`
4. Wait for the first deploy to finish.
5. Open the Render service settings and copy the Deploy Hook URL.
6. In GitHub, add repository secret:
   - `RENDER_DEPLOY_HOOK_URL=<the deploy hook URL>`

## CI/CD behavior

On every push to `fe_v2` that changes backend/deploy files:

1. GitHub Actions runs `npm ci` and `npm test` in `be-node-js`.
2. If tests pass, GitHub Actions calls the Render Deploy Hook.
3. Render deploys the backend over HTTPS.

The Render internal auto-deploy is disabled in `render.yaml` to avoid duplicate deploys.

## After deploy

Render gives the service an HTTPS URL like:

```text
https://project-iot-smart-home-api.onrender.com
```

Check health:

```text
https://project-iot-smart-home-api.onrender.com/health
```

Then update the Expo app env:

```env
EXPO_PUBLIC_API_BASE_URL=https://project-iot-smart-home-api.onrender.com
```

Restart Expo with cache clear after changing `.env`.
