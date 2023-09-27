/* eslint-disable no-unused-vars  -- Remove when used */
import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import { ClientError, errorMiddleware } from './lib/index.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Server } from 'socket.io';
import { createServer } from 'node:http';

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.RDS_USERNAME}:${process.env.RDS_PASSWORD}@${process.env.RDS_HOSTNAME}:${process.env.RDS_PORT}/${process.env.RDS_DB_NAME}`;
// eslint-disable-next-line no-unused-vars -- Remove when used
const db = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:127.0.0.1:5173/page1',
  },
});

// Create paths for static directories
const reactStaticDir = new URL('../client/dist', import.meta.url).pathname;
const uploadsStaticDir = new URL('public', import.meta.url).pathname;
const saltRounds = 10;

function generateAccessToken(username) {
  return jwt.sign(username, process.env.TOKEN_SECRET, { expiresIn: '1800s' });
}

function hashPassword(password) {
  return bcrypt.hashSync(password, saltRounds);
}

function generateActivationToken() {
  let token = crypto.randomBytes(32).toString('hex');
  const sql = `
    select "activationToken"
    from "user"
    where "activationToken" = $1;
    `;
  db.query(sql, [token]).then((results) => {
    if (results) {
      token = generateActivationToken();
    }
  });
  return token;
}

app.use(express.static(reactStaticDir));
// Static directory for file uploads server/public/
app.use(express.static(uploadsStaticDir));
app.use(express.json());

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

app.post('/api/registerUser', async (req, res, next) => {
  let { userName, email, password } = req.body;
  const hash = hashPassword(password);
  if (!userName) {
    userName = email;
  }
  const activationToken = await generateActivationToken();

  const searchUsernameSql = `
    select
      "username","email"
    from "user"
    where "username" = $1 or "email" = $2;
  `;

  await db.query(searchUsernameSql, [userName, email]).then((results) => {
    const matches = results.rows[0];
    if (!matches) {
      return;
    }
    if (matches.email) {
      res.status(409).json({ error: 'Email already in use' });
    }
    if (matches.userName) {
      res.status(409).json({ error: 'Username already in use' });
    }
  });

  const sql = `
    insert into "user" ("username","email","password","activationToken","confirmed")
    values ($1,$2,$3,$4,false)
    returning *
  `;

  const params = [userName, email, hash, activationToken];

  db.query(sql, params)
    .then((results) => {
      res.status(200).json('Account created');
    })
    .catch((err) => next(err));
});

app.post('/api/loginUser', (req, res, next) => {
  const { loginId, password, usingUsername } = req.body;
  const sql = `
    select *
    from "user"
    where $1 = ${usingUsername ? 'username' : 'email'};
  `;
  db.query(sql, [loginId]).then(async (results) => {
    const user = results.rows[0];
    if (!user) {
      res.status(404).json({ Error: 'User not found' });
      return;
    }
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.json('login success');
    } else {
      res.json('wrong password');
    }
  });
});

/**
 * Serves React's index.html if no api route matches.
 *
 * Implementation note:
 * When the final project is deployed, this Express server becomes responsible
 * for serving the React files. (In development, the Vite server does this.)
 * When navigating in the client, if the user refreshes the page, the browser will send
 * the URL to this Express server instead of to React Router.
 * Catching everything that doesn't match a route and serving index.html allows
 * React Router to manage the routing.
 */
app.get('*', (req, res) => res.sendFile(`${reactStaticDir}/index.html`));

io.on('connection', (socket) => {
  console.log('user connected');
});

app.use(errorMiddleware);

httpServer.listen(process.env.PORT, () => {
  process.stdout.write(`\n\napp listening on port ${process.env.PORT}\n\n`);
});
// app.listen(process.env.PORT, () => {
//   process.stdout.write(`\n\napp listening on port ${process.env.PORT}\n\n`);
// });
