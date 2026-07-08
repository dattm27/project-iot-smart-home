const openApiDocument = {
    openapi: '3.0.3',
    info: {
        title: 'IoT Smart Home Backend API',
        version: '1.0.0',
        description: 'Backend API for authentication, lights, fans, fire alarm, MQ135 statistics, and DHT22 statistics.',
    },
    servers: [
        {
            url: 'http://localhost:4000',
            description: 'Local development server',
        },
    ],
    tags: [
        { name: 'Auth' },
        { name: 'Lights' },
        { name: 'Fans' },
        { name: 'MQ135' },
        { name: 'DHT22' },
        { name: 'Fire Alarm' },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            AuthRequest: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                    username: { type: 'string', example: 'testuser' },
                    email: { type: 'string', example: 'test@example.com' },
                    password: { type: 'string', example: '123456' },
                },
            },
            AuthResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    token: { type: 'string' },
                    refreshToken: { type: 'string' },
                    user: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            username: { type: 'string' },
                            email: { type: 'string' },
                        },
                    },
                },
            },
            RefreshTokenRequest: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                    refreshToken: { type: 'string' },
                },
            },
            DeviceOnOff: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                    name: { type: 'string', example: 'QUAT_1' },
                    type: { type: 'integer', enum: [0, 1], example: 1 },
                },
            },
            Fan: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'QUAT_1' },
                    status: { type: 'integer', enum: [0, 1], example: 0 },
                    room: { type: 'string', example: 'Phong khach' },
                    autoOnByTemperature: { type: 'boolean', example: true },
                    autoOnTemperature: { type: 'number', example: 30 },
                    timerEnabled: { type: 'boolean', example: false },
                    autoOnTime: { type: 'string', format: 'date-time', nullable: true },
                    autoOffTime: { type: 'string', format: 'date-time', nullable: true },
                    isAutoControlled: { type: 'boolean', example: false },
                    manualOverride: { type: 'boolean', example: false },
                    lastAutoReason: {
                        type: 'string',
                        nullable: true,
                        enum: ['temperature', 'air_quality', 'timer', null],
                    },
                },
            },
            Light: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'DEN_PH' },
                    status: { type: 'integer', enum: [0, 1], example: 0 },
                    room: { type: 'string', example: 'Phong khach' },
                    timerEnabled: { type: 'boolean', example: false },
                    autoOnTime: { type: 'string', format: 'date-time', nullable: true },
                    autoOffTime: { type: 'string', format: 'date-time', nullable: true },
                    isAutoControlled: { type: 'boolean', example: false },
                    manualOverride: { type: 'boolean', example: false },
                    lastAutoReason: {
                        type: 'string',
                        nullable: true,
                        enum: ['timer', 'light_sensor', null],
                    },
                    lightSensorEnabled: { type: 'boolean', example: false },
                },
            },
            CreateDevice: {
                type: 'object',
                required: ['name', 'room'],
                properties: {
                    name: { type: 'string', example: 'DEN_PH' },
                    room: { type: 'string', example: 'Phong khach' },
                    timerEnabled: { type: 'boolean', example: false },
                    autoOnTime: { type: 'string', format: 'date-time', nullable: true },
                    autoOffTime: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            TimerRequest: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', example: 'DEN_PH' },
                    timerEnabled: { type: 'boolean', example: true },
                    autoOnTime: { type: 'string', format: 'date-time' },
                    autoOffTime: { type: 'string', format: 'date-time' },
                },
            },
            FanAutoCoolingRequest: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', example: 'QUAT_1' },
                    autoOnByTemperature: { type: 'boolean', example: true },
                    autoOnTemperature: { type: 'number', example: 30 },
                },
            },
            LightSensorModeRequest: {
                type: 'object',
                required: ['name', 'enabled'],
                properties: {
                    name: { type: 'string', example: 'DEN_PH' },
                    enabled: { type: 'boolean', example: true },
                },
            },
            DeleteByName: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', example: 'DEN_PH' },
                },
            },
            MQ135Statistics: {
                type: 'object',
                properties: {
                    time: { type: 'string', example: '2026-06-29T10:00:00Z' },
                    airQuality: { type: 'string', enum: ['GOOD', 'WARNING', 'DANGER', 'UNKNOWN'], example: 'DANGER' },
                    ppm: { type: 'number', example: 1250 },
                    co2_ppm: { type: 'number', example: 1250 },
                    co_ppm: { type: 'number', example: 600 },
                    timestamp: { type: 'string', format: 'date-time' },
                },
            },
            DHT22Statistics: {
                type: 'object',
                properties: {
                    time: { type: 'string', example: '2026-06-29 10-00-00' },
                    temp: { type: 'number', example: 35 },
                    humidity: { type: 'number', example: 70 },
                    timestamp: { type: 'string', format: 'date-time' },
                },
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                },
            },
        },
    },
    paths: {
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register a user and return a JWT',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRequest' } } } },
                responses: {
                    201: { description: 'Registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                    400: { description: 'Invalid input' },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login and return a JWT',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRequest' } } } },
                responses: {
                    200: { description: 'Logged in', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                    401: { description: 'Invalid credentials' },
                },
            },
        },
        '/auth/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Exchange a refresh token for a new JWT and refresh token',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } } },
                responses: {
                    200: { description: 'Token refreshed', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                    401: { description: 'Invalid or expired refresh token' },
                },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Revoke a refresh token',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } } },
                responses: {
                    200: { description: 'Logged out' },
                },
            },
        },
        '/fire-alarm': {
            get: {
                tags: ['Fire Alarm'],
                summary: 'Get current fire alarm state',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Current fire alarm state',
                        content: { 'application/json': { schema: { type: 'object', properties: { isFire: { type: 'boolean' } } } } },
                    },
                },
            },
        },
        '/fire-alarms': {
            delete: {
                tags: ['Fire Alarm'],
                summary: 'Delete all fire alarm records',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'Deleted' } },
            },
        },
        '/mq135statistics': {
            get: {
                tags: ['MQ135'],
                summary: 'Get recent MQ135 statistics',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'NumOfRecords',
                        in: 'query',
                        schema: { type: 'integer', default: 10 },
                    },
                ],
                responses: {
                    200: {
                        description: 'Recent records',
                        content: {
                            'application/json': {
                                schema: { type: 'array', items: { $ref: '#/components/schemas/MQ135Statistics' } },
                            },
                        },
                    },
                },
            },
        },
        '/dht22statistics': {
            get: {
                tags: ['DHT22'],
                summary: 'Get recent DHT22 temperature and humidity statistics',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'NumOfRecords',
                        in: 'query',
                        schema: { type: 'integer', default: 10 },
                    },
                ],
                responses: {
                    200: {
                        description: 'Recent records',
                        content: {
                            'application/json': {
                                schema: { type: 'array', items: { $ref: '#/components/schemas/DHT22Statistics' } },
                            },
                        },
                    },
                },
            },
        },
        '/fans/': {
            get: {
                tags: ['Fans'],
                summary: 'List fans',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'Fan list' }, 404: { description: 'No fans found' } },
            },
            post: {
                tags: ['Fans'],
                summary: 'Create a fan',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateDevice' } } } },
                responses: { 201: { description: 'Created' }, 400: { description: 'Invalid input' } },
            },
            delete: {
                tags: ['Fans'],
                summary: 'Delete a fan by name',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteByName' } } } },
                responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
            },
        },
        '/fans/OnOff': {
            put: {
                tags: ['Fans'],
                summary: 'Turn a fan on or off',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceOnOff' } } } },
                responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
            },
        },
        '/fans/AutoCooling': {
            put: {
                tags: ['Fans'],
                summary: 'Configure fan auto cooling by temperature',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FanAutoCoolingRequest' } } } },
                responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
            },
        },
        '/fans/Timer/': {
            put: {
                tags: ['Fans'],
                summary: 'Configure fan timer',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TimerRequest' } } } },
                responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
            },
        },
        '/lights/': {
            get: {
                tags: ['Lights'],
                summary: 'List lights',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'Light list' }, 404: { description: 'No lights found' } },
            },
            post: {
                tags: ['Lights'],
                summary: 'Create a light',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateDevice' } } } },
                responses: { 201: { description: 'Created' }, 400: { description: 'Invalid input' } },
            },
            delete: {
                tags: ['Lights'],
                summary: 'Delete a light by name',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteByName' } } } },
                responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
            },
        },
        '/lights/OnOff': {
            put: {
                tags: ['Lights'],
                summary: 'Turn a light on or off',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceOnOff' } } } },
                responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
            },
        },
        '/lights/SensorMode': {
            put: {
                tags: ['Lights'],
                summary: 'Enable or disable light control by the light sensor',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LightSensorModeRequest' } } } },
                responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
            },
        },
        '/lights/Timer/': {
            put: {
                tags: ['Lights'],
                summary: 'Configure light timer',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TimerRequest' } } } },
                responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
            },
        },
    },
};

const swaggerHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IoT Smart Home API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true
    });
  </script>
</body>
</html>`;

module.exports = {
    openApiDocument,
    swaggerHtml,
};
