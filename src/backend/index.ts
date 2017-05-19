import express = require('express');
import session = require('express-session');
import proxy = require('http-proxy-middleware');
import serveStatic = require('serve-static');
import bodyParser = require('body-parser');
import morgan = require('morgan');
import MongoStore = require('connect-mongo')(session);

import useExpressMiddleware = require('use-express-middleware');

import passport = require('passport');
import Auth0Strategy = require('passport-auth0');

// Setup Passport + Auth0
const strategy = new Auth0Strategy({
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    callbackURL: process.env.AUTH0_CALLBACK_URL
}, (accessToken, refreshToken, extraParams, profile, done) => {
    return done(null, profile);
});

passport.use(strategy);

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

// Express app
const app = express();

app.use(morgan('dev'));

const wsProxy = proxy({
    target: process.env.DEEPSTREAM_PROXY_URL,
    changeOrigin: true,
    ws: true
});

app.use('/deepstream', wsProxy);

const authMiddlewares = [
    session({
        secret: process.env.SESSION_SECRET,
        store: (process.env.NODE_ENV === 'development') ?
            new session.MemoryStore() :
            new MongoStore({ url: process.env.MONGO_URL })
    }),
    passport.initialize(),
    passport.session()
];

authMiddlewares.forEach(mw => {
    app.use(mw);
});

app.use(bodyParser.json());

app.use(serveStatic('./static'));

app.get('/login', passport.authenticate('auth0', {}));

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

app.get('/callback',
    passport.authenticate('auth0', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.post('/deepstream-auth', (req, res) => {
    const { connectionData, authData } = req.body;

    if(authData.internalService) {
        if(authData.internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
            const serviceId = `internal_service_${Math.random()}`;

            res.status(200).json({
                username: serviceId,
                clientData: { type: 'internal-service', serviceId },
                serverData: { type: 'internal-service', serviceId }
            });
        }
        else {
            res.sendStatus(401);
        }
    }
    else {
        useExpressMiddleware(connectionData.headers, authMiddlewares, authReq => {
            const { user } = authReq;

            console.log(user);

            if(user) {
                const username = `user_${user.id}`;
                res.status(200).json({
                    username,
                    clientData: { type: 'user', username, auth0: user._json },
                    serverData: { type: 'user', auth0: user._json }
                });
            }
            else {
                res.status(200).json({
                    username: `guest_${Math.random()}`,
                    clientData: { type: 'guest' },
                    serverData: { type: 'guest' }
                });
            }
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(
        require('path').join(__dirname, '../../static/index.html')
    );
});

const server = app.listen(process.env.PORT);

server.on('upgrade', wsProxy.upgrade);
